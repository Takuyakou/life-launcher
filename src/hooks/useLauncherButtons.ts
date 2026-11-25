import type { Dispatch, SetStateAction } from "react";
import {
  actionHasSuspiciousPath,
  actionValue,
  aliasesInputToList,
  aliasesListToInput,
  buttonGroupName,
  iconForAction,
  normalizeOptionalText,
  showButtonInOverlay,
  showButtonInSidebar,
  stripActionDraft,
  toActionDraft,
  uniqueButtonId,
  writeCollapsedGroups,
} from "../app/helpers";
import { DEFAULT_BUTTON_GROUP } from "../constants";
import { chooseLauncherTarget, deleteButtonIconCache, resolveDropItem } from "../tauri";
import type {
  ActionDraft,
  ButtonEditDraft,
  ContextMenuState,
  DropDialogState,
  ToastTone,
} from "../app/dashboardTypes";
import type { ConfirmDialogRequest } from "../components/ConfirmDialog";
import type { AppConfig, LauncherButton, OverlayPage } from "../types";

// V164-A5: the drop registration, the button and group edits, moved out of App.tsx.
// The body is the same code in the same order; every input arrives in one deps object.

type BuilderKind = "file" | "folder" | "url";
type BuilderModeDraft = { source: string; label: string; labelTouched: boolean };

export type LauncherButtonsDeps = {
  actions: {
    persistConfig: (
      nextConfig: AppConfig,
      applySettingsAfterSave?: boolean,
      options?: { errorToastMessage?: string },
    ) => Promise<boolean>;
    refreshButtonIcon: (button: LauncherButton, force?: boolean) => Promise<void>;
    requestConfirmation: (request: ConfirmDialogRequest) => void;
    showToast: (tone: ToastTone, message: string) => void;
  };
  setters: {
    setBuilderBusy: Dispatch<SetStateAction<boolean>>;
    setBuilderKind: Dispatch<SetStateAction<BuilderKind | null>>;
    setBuilderLabelTouched: Dispatch<SetStateAction<boolean>>;
    setBuilderModeDrafts: Dispatch<SetStateAction<Partial<Record<BuilderKind, BuilderModeDraft>>>>;
    setBuilderSource: Dispatch<SetStateAction<string>>;
    setButtonEditDraft: Dispatch<SetStateAction<ButtonEditDraft | null>>;
    setButtonEditInitialDraft: Dispatch<SetStateAction<ButtonEditDraft | null>>;
    setButtonIconSources: Dispatch<SetStateAction<Record<string, string>>>;
    setCollapsedGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
    setConfig: Dispatch<SetStateAction<AppConfig | null>>;
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
    setDropDraft: Dispatch<SetStateAction<DropDialogState | null>>;
    setGroupDraft: Dispatch<SetStateAction<string | null>>;
    setGroupRenameDraft: Dispatch<SetStateAction<{ from: string; to: string } | null>>;
  };
  state: {
    builderBusy: boolean;
    builderKind: BuilderKind | null;
    builderLabelTouched: boolean;
    builderModeDrafts: Partial<Record<BuilderKind, BuilderModeDraft>>;
    builderSource: string;
    buttonEditDraft: ButtonEditDraft | null;
    config: AppConfig | null;
    dropDraft: DropDialogState | null;
    groupDraft: string | null;
    groupNames: string[];
    groupRenameDraft: { from: string; to: string } | null;
    overlayPages: OverlayPage[];
  };
};

export function useLauncherButtons(deps: LauncherButtonsDeps) {
  const { actions, setters, state } = deps;
  const {
    persistConfig,
    refreshButtonIcon,
    requestConfirmation,
    showToast,
  } = actions;
  const {
    setBuilderBusy,
    setBuilderKind,
    setBuilderLabelTouched,
    setBuilderModeDrafts,
    setBuilderSource,
    setButtonEditDraft,
    setButtonEditInitialDraft,
    setButtonIconSources,
    setCollapsedGroups,
    setConfig,
    setContextMenu,
    setDropDraft,
    setGroupDraft,
    setGroupRenameDraft,
  } = setters;
  const {
    builderBusy,
    builderKind,
    builderLabelTouched,
    builderModeDrafts,
    builderSource,
    buttonEditDraft,
    config,
    dropDraft,
    groupDraft,
    groupNames,
    groupRenameDraft,
    overlayPages,
  } = state;

const confirmDropRegistration = async () => {
  if (!config || !dropDraft) return;
  if (builderBusy) return;
  let resolved = dropDraft;
  if (builderKind) {
    const source = builderSource.trim();
    if (!source) {
      showToast("warn", "登録先を入力してください");
      return;
    }
    try {
      setBuilderBusy(true);
      const target = await resolveDropItem(
        builderKind === "url" ? { kind: "url", value: source } : { kind: "path", value: source },
      );
      if (
        (builderKind === "folder" && target.action.type !== "open_folder") ||
        (builderKind === "file" &&
          target.action.type === "open_folder" &&
          !source.toLowerCase().endsWith(".lnk"))
      ) {
        showToast(
          "warn",
          builderKind === "file" ? "ファイルを選んでください" : "フォルダを選んでください",
        );
        return;
      }
      resolved = {
        ...dropDraft,
        action: target.action,
        iconSource: target.iconSource,
        source: target.source,
      };
    } catch (error) {
      showToast(
        "error",
        `登録先を確認できません: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    } finally {
      setBuilderBusy(false);
    }
  }
  const label = resolved.label.trim();
  if (!label) {
    showToast("warn", "ラベルを入力してください");
    return;
  }

  const group =
    dropDraft.groupMode === "existing"
      ? dropDraft.existingGroup.trim()
      : dropDraft.newGroup.trim();
  const button: LauncherButton = {
    id: uniqueButtonId(label, config.buttons),
    label,
    icon: iconForAction(resolved.action),
    iconSource: resolved.iconSource ?? undefined,
    group: group && group !== DEFAULT_BUTTON_GROUP ? group : undefined,
    showInSidebar: dropDraft.showInSidebar,
    showInOverlay: dropDraft.showInOverlay,
    overlayPageId: dropDraft.overlayPageId ?? undefined,
    aliases: [],
    actions: [resolved.action],
  };

  const saved = await persistConfig({
    ...config,
    groups:
      group && !config.groups.includes(group) && group !== DEFAULT_BUTTON_GROUP
        ? [...config.groups, group]
        : config.groups,
    buttons: [...config.buttons, button],
  });
  if (!saved) return;
  setDropDraft(null);
  setBuilderKind(null);
  setBuilderModeDrafts({});
  void refreshButtonIcon(button, true);
  showToast("ok", `${label} を登録しました`);
};

const deleteButton = (button: LauncherButton) => {
  if (!config) return;
  setContextMenu(null);
  requestConfirmation({
    title: "ボタンを削除しますか？",
    subject: `「${button.label}」`,
    message: "この操作は元に戻せません。",
    confirmLabel: "削除する",
    processingLabel: "削除しています…",
    tone: "danger",
    onConfirm: async () => {
      const saved = await persistConfig({
        ...config,
        buttons: config.buttons.filter((item) => item.id !== button.id),
        projects: config.projects.map((project) => ({
          ...project,
          ...(project.nextStep
            ? {
                nextStep: {
                  ...project.nextStep,
                  buttonIds: project.nextStep.buttonIds.filter(
                    (buttonId) => buttonId !== button.id,
                  ),
                },
              }
            : {}),
          ...(project.legacyNextStepSettings
            ? {
                legacyNextStepSettings: {
                  ...project.legacyNextStepSettings,
                  buttonIds: project.legacyNextStepSettings.buttonIds.filter(
                    (buttonId) => buttonId !== button.id,
                  ),
                },
              }
            : {}),
        })),
      });
      if (!saved) {
        setConfig(config);
        return false;
      }
      void deleteButtonIconCache(button.id);
      setButtonIconSources((current) => {
        const next = { ...current };
        delete next[button.id];
        return next;
      });
      setContextMenu(null);
      showToast("danger", `${button.label} を削除しました`);
      return true;
    },
  });
};

const openGroupDialog = () => {
  if (!config) return;
  setContextMenu(null);
  setGroupDraft("");
};

const openButtonBuilder = (groupName?: string) => {
  if (!config) return;
  const group = groupName || groupNames[0] || DEFAULT_BUTTON_GROUP;
  setContextMenu(null);
  setBuilderKind("file");
  setBuilderSource("");
  setBuilderLabelTouched(false);
  setBuilderModeDrafts({});
  setDropDraft({
    label: "",
    group,
    groupMode: "existing",
    existingGroup: group,
    newGroup: "",
    iconSource: null,
    action: { type: "open_file", payload: { path: "" } },
    source: "",
    showInSidebar: true,
    showInOverlay: true,
    overlayPageId: null,
  });
};

const updateBuilderSource = (source: string) => {
  setBuilderSource(source);
  if (!dropDraft || !builderKind) return;
  const basename = source.trim().replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
  let suggestion = basename.replace(/\.[^.]+$/, "");
  if (builderKind === "url") {
    try {
      suggestion = new URL(source).hostname;
    } catch {
      suggestion = "";
    }
  }
  if (!builderLabelTouched) setDropDraft({ ...dropDraft, label: suggestion });
};

const switchBuilderKind = (kind: "file" | "folder" | "url") => {
  if (!builderKind || !dropDraft || builderKind === kind) return;
  const restored = builderModeDrafts[kind];
  setBuilderModeDrafts({
    ...builderModeDrafts,
    [builderKind]: {
      source: builderSource,
      label: dropDraft.label,
      labelTouched: builderLabelTouched,
    },
  });
  setBuilderKind(kind);
  setBuilderSource(restored?.source ?? "");
  setBuilderLabelTouched(restored?.labelTouched ?? false);
  setDropDraft({ ...dropDraft, label: restored?.label ?? "" });
};

const pickBuilderSource = async () => {
  if (!builderKind || builderKind === "url") return;
  try {
    const source = await chooseLauncherTarget(builderKind);
    if (source) updateBuilderSource(source);
  } catch (error) {
    showToast("error", `選択できません: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const confirmGroupAddition = () => {
  if (!config || groupDraft === null) return;

  const groupName = groupDraft.trim();
  if (!groupName) return;

  if (groupNames.includes(groupName)) {
    showToast("warn", `${groupName} はすでにあります`);
    return;
  }

  setCollapsedGroups((current) => {
    const next = { ...current, [groupName]: false };
    writeCollapsedGroups(next);
    return next;
  });

  void persistConfig({
    ...config,
    groups: [...config.groups, groupName],
  });
  setGroupDraft(null);
  showToast("ok", `${groupName} を追加しました`);
};

const deleteGroup = (groupName: string) => {
  if (!config) return;
  const cleanGroupName = groupName.trim();
  if (!cleanGroupName) return;

  if (cleanGroupName === DEFAULT_BUTTON_GROUP) {
    showToast("warn", `${DEFAULT_BUTTON_GROUP} は削除できません`);
    return;
  }

  if (!groupNames.includes(cleanGroupName)) {
    showToast("warn", `${cleanGroupName} は見つかりません`);
    return;
  }

  const affectedButtons = config.buttons.filter(
    (button) => buttonGroupName(button) === cleanGroupName,
  );
  requestConfirmation({
    title: "グループを削除しますか？",
    subject: `「${cleanGroupName}」`,
    message:
      affectedButtons.length > 0
        ? `${affectedButtons.length}個のボタンは「${DEFAULT_BUTTON_GROUP}」へ移動します。この操作は元に戻せません。`
        : "この操作は元に戻せません。",
    confirmLabel: "削除する",
    processingLabel: "削除しています…",
    tone: "danger",
    onConfirm: async () => {
      const nextButtons = config.buttons.map((button) =>
        buttonGroupName(button) === cleanGroupName ? { ...button, group: undefined } : button,
      );
      const nextGroups = config.groups.filter((name) => name.trim() !== cleanGroupName);
      const saved = await persistConfig({ ...config, groups: nextGroups, buttons: nextButtons });
      if (!saved) {
        setConfig(config);
        return false;
      }
      setCollapsedGroups((current) => {
        const next = { ...current };
        delete next[cleanGroupName];
        writeCollapsedGroups(next);
        return next;
      });
      setContextMenu(null);
      showToast("danger", `${cleanGroupName} を削除しました`);
      return true;
    },
  });
};

const openGroupRenameDialog = (groupName?: string) => {
  const cleanName = groupName?.trim();
  if (!cleanName || cleanName === DEFAULT_BUTTON_GROUP) {
    showToast("warn", `${DEFAULT_BUTTON_GROUP} は名前を変更できません`);
    setContextMenu(null);
    return;
  }

  setContextMenu(null);
  setGroupRenameDraft({ from: cleanName, to: cleanName });
};

const confirmGroupRename = () => {
  if (!config || !groupRenameDraft) return;
  const from = groupRenameDraft.from.trim();
  const to = groupRenameDraft.to.trim();
  if (!to) return;
  if (from === DEFAULT_BUTTON_GROUP || to === DEFAULT_BUTTON_GROUP) {
    showToast("warn", `${DEFAULT_BUTTON_GROUP} は変更できません`);
    return;
  }
  if (from !== to && groupNames.includes(to)) {
    showToast("warn", `${to} はすでにあります`);
    return;
  }

  const nextGroups = config.groups.map((group) => (group.trim() === from ? to : group));
  const nextButtons = config.buttons.map((button) =>
    buttonGroupName(button) === from
      ? { ...button, group: to === DEFAULT_BUTTON_GROUP ? undefined : to }
      : button,
  );

  setCollapsedGroups((current) => {
    const next = { ...current };
    if (Object.prototype.hasOwnProperty.call(next, from)) {
      next[to] = next[from];
      delete next[from];
    }
    writeCollapsedGroups(next);
    return next;
  });

  setGroupRenameDraft(null);
  void persistConfig({
    ...config,
    groups: nextGroups,
    buttons: nextButtons,
  });
  showToast("ok", `${from} を ${to} に変更しました`);
};

const moveSidebarButtonToDictionary = async (button: LauncherButton) => {
  if (!config || !showButtonInSidebar(button)) return;
  const previousConfig = config;
  setContextMenu(null);
  const dictionaryOrder =
    config.dictionaryOrder ?? config.buttons.filter(showButtonInOverlay).map((item) => item.id);
  const nextDictionaryOrder = dictionaryOrder.includes(button.id)
    ? dictionaryOrder
    : [...dictionaryOrder, button.id];
  const saved = await persistConfig({
    ...config,
    dictionaryOrder: nextDictionaryOrder,
    buttons: config.buttons.map((item) =>
      item.id === button.id ? { ...item, showInSidebar: false, showInOverlay: true } : item,
    ),
  });
  if (!saved) {
    setConfig(previousConfig);
    return;
  }
  showToast("ok", `${button.label} を辞書に移動しました`);
};

const openButtonEditDialog = (button: LauncherButton) => {
  setContextMenu(null);
  const group = buttonGroupName(button);
  const draft: ButtonEditDraft = {
    id: button.id,
    label: button.label,
    groupMode: "existing",
    existingGroup: group,
    newGroup: "",
    showInSidebar: showButtonInSidebar(button),
    showInOverlay: showButtonInOverlay(button),
    overlayPageId: overlayPages.some((page) => page.id === button.overlayPageId)
      ? (button.overlayPageId ?? null)
      : null,
    aliasesInput: aliasesListToInput(button.aliases),
    description: button.description ?? "",
    actions: button.actions.map(toActionDraft),
  };
  setButtonEditDraft(draft);
  setButtonEditInitialDraft(draft);
};

const saveButtonEdit = async () => {
  if (!config || !buttonEditDraft) return;
  const label = buttonEditDraft.label.trim();
  if (!label) {
    showToast("warn", "ラベルを入力してください");
    return;
  }

  const actions = buttonEditDraft.actions.map(stripActionDraft);
  if (actions.some((action) => !actionValue(action).trim())) {
    showToast("warn", "アクション内容を入力してください");
    return;
  }

  const originalButton = config.buttons.find((button) => button.id === buttonEditDraft.id);
  const actionsChanged =
    JSON.stringify(originalButton?.actions ?? []) !== JSON.stringify(actions);
  const group =
    buttonEditDraft.groupMode === "existing"
      ? buttonEditDraft.existingGroup.trim()
      : buttonEditDraft.newGroup.trim();
  if (buttonEditDraft.groupMode === "new" && groupNames.includes(group)) {
    showToast("warn", `${group} はすでにあります`);
    return;
  }
  const aliases = aliasesInputToList(buttonEditDraft.aliasesInput);
  const description = normalizeOptionalText(buttonEditDraft.description);
  const nextButtons = config.buttons.map((button) =>
    button.id === buttonEditDraft.id
      ? {
          ...button,
          label,
          group: group && group !== DEFAULT_BUTTON_GROUP ? group : undefined,
          showInSidebar: buttonEditDraft.showInSidebar,
          showInOverlay: buttonEditDraft.showInOverlay,
          overlayPageId: buttonEditDraft.overlayPageId ?? undefined,
          aliases,
          description,
          actions,
        }
      : button,
  );
  const nextGroups =
    group && group !== DEFAULT_BUTTON_GROUP && !config.groups.includes(group)
      ? [...config.groups, group]
      : config.groups;
  const nextProjects =
    buttonEditDraft.showInSidebar || buttonEditDraft.showInOverlay
      ? config.projects
      : config.projects.map((project) => ({
          ...project,
          ...(project.nextStep
            ? {
                nextStep: {
                  ...project.nextStep,
                  buttonIds: project.nextStep.buttonIds.filter(
                    (buttonId) => buttonId !== buttonEditDraft.id,
                  ),
                },
              }
            : {}),
          ...(project.legacyNextStepSettings
            ? {
                legacyNextStepSettings: {
                  ...project.legacyNextStepSettings,
                  buttonIds: project.legacyNextStepSettings.buttonIds.filter(
                    (buttonId) => buttonId !== buttonEditDraft.id,
                  ),
                },
              }
            : {}),
        }));

  const saved = await persistConfig({
    ...config,
    groups: nextGroups,
    buttons: nextButtons,
    projects: nextProjects,
  });
  if (!saved) return;
  setButtonEditDraft(null);
  setButtonEditInitialDraft(null);
  const updatedButton = nextButtons.find((button) => button.id === buttonEditDraft.id);
  if (updatedButton && actionsChanged) {
    void refreshButtonIcon(updatedButton, true);
  }

  if (actions.some(actionHasSuspiciousPath)) {
    showToast("warn", "保存しました。開けない場合はパスまたはURLを確認してください");
  } else {
    showToast("ok", `${label} を保存しました`);
  }
};

const updateButtonAction = (draftIdValue: string, action: ActionDraft) => {
  setButtonEditDraft((draft) =>
    draft
      ? {
          ...draft,
          actions: draft.actions.map((item) => (item.draftId === draftIdValue ? action : item)),
        }
      : draft,
  );
};

const moveButtonAction = (draftIdValue: string, delta: -1 | 1) => {
  setButtonEditDraft((draft) => {
    if (!draft) return draft;
    const index = draft.actions.findIndex((action) => action.draftId === draftIdValue);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= draft.actions.length) return draft;
    const actions = [...draft.actions];
    const [action] = actions.splice(index, 1);
    actions.splice(nextIndex, 0, action);
    return { ...draft, actions };
  });
};

const moveButtonActionTo = (draggedId: string, targetId: string) => {
  if (draggedId === targetId) return;
  setButtonEditDraft((draft) => {
    if (!draft) return draft;
    const fromIndex = draft.actions.findIndex((action) => action.draftId === draggedId);
    const toIndex = draft.actions.findIndex((action) => action.draftId === targetId);
    if (fromIndex < 0 || toIndex < 0) return draft;

    const actions = [...draft.actions];
    const [action] = actions.splice(fromIndex, 1);
    actions.splice(toIndex, 0, action);
    return { ...draft, actions };
  });
};
  return {
    confirmDropRegistration,
    confirmGroupAddition,
    confirmGroupRename,
    deleteButton,
    deleteGroup,
    moveButtonAction,
    moveButtonActionTo,
    moveSidebarButtonToDictionary,
    openButtonBuilder,
    openButtonEditDialog,
    openGroupDialog,
    openGroupRenameDialog,
    pickBuilderSource,
    saveButtonEdit,
    switchBuilderKind,
    updateBuilderSource,
    updateButtonAction,
  };
}
