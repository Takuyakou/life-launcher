import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Dispatch, DragEvent, KeyboardEvent, MouseEvent, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BUTTON_GROUP, OVERLAY_PAGE_NAME_MAX_CHARS } from "../constants";
import { moveIdToSlot, replaceVisibleOrder } from "../dictionaryTileReorder";
import {
  getButtonsForOverlayPage,
  OVERLAY_UNCLASSIFIED_PAGE_KEY,
  overlayCustomPageKey,
  overlayPageIdFromKey,
} from "../overlayPages";
import {
  deleteButtonIconCache,
  enableMainShellDrop,
  resolveDropItem,
  saveConfigAndNotifyDashboard,
} from "../tauri";
import type {
  AppConfig,
  DropButtonDraft,
  DropResolveInput,
  LauncherAction,
  LauncherButton,
  OverlayPage,
} from "../types";
import type { ConfirmDialogRequest } from "./ConfirmDialog";

type ShellDropEvent = {
  windowLabel: string;
  stage: "dragEnter" | "dragLeave" | "drop" | "error";
  message: string;
  paths: string[];
  url?: string | null;
  label?: string | null;
  shellSpecial?: "recycle_bin" | null;
};
type DropDraft = DropButtonDraft & {
  label: string;
  group: string;
  showInSidebar: boolean;
  showInOverlay: boolean;
  overlayPageId: string | null;
};
type ActionDraft = LauncherAction & { draftId: string };
type ButtonDraft = {
  id: string;
  label: string;
  icon: string;
  group: string;
  showInSidebar: boolean;
  showInOverlay: boolean;
  overlayPageId: string | null;
  aliasesInput: string;
  description: string;
  actions: ActionDraft[];
};
type PageDraft = {
  mode: "add" | "rename";
  pageId?: string;
  name: string;
  assignToButton?: boolean;
};
type Menu =
  | { kind: "button"; button: LauncherButton; x: number; y: number; opener: HTMLElement }
  | { kind: "page"; page: OverlayPage; x: number; y: number; opener: HTMLElement };
type Input = {
  config: AppConfig | null;
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  selectedPageKey: string;
  searchActive: boolean;
  selectPage: (key: string) => void;
};
const PAGE_DRAG_TYPE = "application/x-life-launcher-dictionary-page";
const STATUS_DISPLAY_MS = 3000;
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const groupOf = (button: LauncherButton) => button.group?.trim() || DEFAULT_BUTTON_GROUP;
export const valueOf = (action: LauncherAction) =>
  action.type === "open_url"
    ? action.payload.url
    : action.type === "open_shell_special"
      ? "ごみ箱"
      : action.payload.path;
const toDraft = (action: LauncherAction) => ({ ...action, draftId: id() }) as ActionDraft;
const stripDraft = (action: ActionDraft) => {
  const next = { ...action };
  delete (next as Partial<ActionDraft>).draftId;
  return next as LauncherAction;
};
export function makeAction(type: LauncherAction["type"], value = ""): ActionDraft {
  if (type === "open_url") return { draftId: id(), type, payload: { url: value } };
  if (type === "open_shell_special")
    return { draftId: id(), type, payload: { item: "recycle_bin" } };
  return { draftId: id(), type, payload: { path: value } };
}
export function setValue(action: ActionDraft, value: string): ActionDraft {
  if (action.type === "open_url") return { ...action, payload: { url: value } };
  if (action.type === "open_shell_special") return action;
  return { ...action, payload: { ...action.payload, path: value } };
}
function iconFor(action: LauncherAction) {
  return action.type === "open_app"
    ? "▣"
    : action.type === "open_folder"
      ? "□"
      : action.type === "open_url"
        ? "↗"
        : action.type === "run_script"
          ? ">"
          : action.type === "open_shell_special"
            ? "♻"
            : "◇";
}
function groupsOf(config: AppConfig) {
  const seen = new Set<string>();
  const values: string[] = [];
  const add = (value?: string | null) => {
    const clean = value?.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      values.push(clean);
    }
  };
  config.groups.forEach(add);
  config.buttons.forEach((button) => add(groupOf(button)));
  add(DEFAULT_BUTTON_GROUP);
  return values;
}
function buttonId(label: string, buttons: LauncherButton[]) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "button";
  const ids = new Set(buttons.map((button) => button.id));
  let next = base;
  let suffix = 2;
  while (ids.has(next)) next = `${base}-${suffix++}`;
  return next;
}
function aliases(input: string) {
  const result: string[] = [];
  input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .forEach((item) => {
      if (item && !result.includes(item) && result.length < 20) result.push(item);
    });
  return result;
}
function firstUrl(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && /^https?:\/\//i.test(line)) ?? null
  );
}

export function useDictionaryFeatureParity({
  config,
  setConfig,
  selectedPageKey,
  searchActive,
  selectPage,
}: Input) {
  const [dragActive, setDragActive] = useState(false);
  const [dropDraft, setDropDraft] = useState<DropDraft | null>(null);
  const [pageDraft, setPageDraft] = useState<PageDraft | null>(null);
  const [buttonDraft, setButtonDraft] = useState<ButtonDraft | null>(null);
  const [buttonInitialDraft, setButtonInitialDraft] = useState<ButtonDraft | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmDialogRequest | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pageDragId, setPageDragId] = useState<string | null>(null);
  const saving = useRef(false);
  const statusTimer = useRef<number | null>(null);
  const pageMoveQueue = useRef<Promise<void>>(Promise.resolve());
  const pages = useMemo(() => config?.overlayPages ?? [], [config?.overlayPages]);
  const groups = useMemo(() => (config ? groupsOf(config) : []), [config]);
  const configRef = useRef(config);
  const selectedPageKeyRef = useRef(selectedPageKey);
  const searchActiveRef = useRef(searchActive);
  const recentDropRef = useRef<{ key: string; at: number } | null>(null);
  configRef.current = config;
  selectedPageKeyRef.current = selectedPageKey;
  searchActiveRef.current = searchActive;
  const showStatus = useCallback((message: string | null) => {
    if (statusTimer.current !== null) {
      window.clearTimeout(statusTimer.current);
      statusTimer.current = null;
    }
    setStatus(message);
    if (message) {
      statusTimer.current = window.setTimeout(() => {
        setStatus(null);
        statusTimer.current = null;
      }, STATUS_DISPLAY_MS);
    }
  }, []);
  useEffect(
    () => () => {
      if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    },
    [],
  );
  const persist = useCallback(
    async (
      next: AppConfig,
      message: string | null,
      afterSave?: () => Promise<void>,
      throwOnFailure = false,
    ) => {
      if (saving.current) return false;
      saving.current = true;
      setError(null);
      try {
        const response = await saveConfigAndNotifyDashboard(next);
        await afterSave?.();
        configRef.current = response.config;
        setConfig(response.config);
        showStatus(message);
        return true;
      } catch (cause) {
        const failure = `保存できません: ${cause instanceof Error ? cause.message : String(cause)}`;
        setError(failure);
        if (throwOnFailure) throw new Error(failure);
        return false;
      } finally {
        saving.current = false;
      }
    },
    [setConfig, showStatus],
  );
  const reorderVisibleButtons = useCallback(
    async (input: {
      pageKey: string;
      sourceId: string;
      beforeIds: string[];
      afterIds: string[];
    }) => {
      const latest = configRef.current;
      if (!latest || saving.current) return false;
      const latestIds = getButtonsForOverlayPage(
        latest.buttons,
        input.pageKey,
        latest.overlayPages ?? [],
        latest.dictionaryOrder,
      ).map((button) => button.id);
      if (
        !latestIds.includes(input.sourceId) ||
        latestIds.length !== input.beforeIds.length ||
        latestIds.some((id, index) => id !== input.beforeIds[index])
      ) {
        setError("辞書が更新されたため、並び替えを取り消しました。もう一度お試しください。");
        return false;
      }
      const currentOrder =
        latest.dictionaryOrder ??
        latest.buttons
          .filter((button) => button.showInOverlay !== false)
          .map((button) => button.id);
      const nextOrder = replaceVisibleOrder(currentOrder, input.beforeIds, input.afterIds);
      if (
        nextOrder.length !== currentOrder.length ||
        nextOrder.every((id, index) => id === currentOrder[index])
      ) {
        return false;
      }
      return persist({ ...latest, dictionaryOrder: nextOrder }, null);
    },
    [persist],
  );
  const visibleButtonIds = useCallback(() => {
    const latest = configRef.current;
    if (!latest || searchActiveRef.current) return [];
    return getButtonsForOverlayPage(
      latest.buttons,
      selectedPageKeyRef.current,
      latest.overlayPages ?? [],
      latest.dictionaryOrder,
    ).map((button) => button.id);
  }, []);
  const canMoveButton = useCallback(
    (buttonId: string, offset: -1 | 1) => {
      const ids = visibleButtonIds();
      const index = ids.indexOf(buttonId);
      return index >= 0 && index + offset >= 0 && index + offset < ids.length;
    },
    [visibleButtonIds],
  );
  const moveButton = useCallback(
    async (button: LauncherButton, offset: -1 | 1, opener: HTMLElement) => {
      setMenu(null);
      const beforeIds = visibleButtonIds();
      const index = beforeIds.indexOf(button.id);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= beforeIds.length) {
        window.requestAnimationFrame(() => opener.focus());
        return false;
      }
      const afterIds = moveIdToSlot(beforeIds, button.id, targetIndex);
      const message = `${button.label}を${targetIndex + 1}番目へ移動しました`;
      setReorderAnnouncement("");
      try {
        const saved = await reorderVisibleButtons({
          pageKey: selectedPageKeyRef.current,
          sourceId: button.id,
          beforeIds,
          afterIds,
        });
        if (saved) {
          window.requestAnimationFrame(() => setReorderAnnouncement(message));
        }
        return saved;
      } finally {
        window.requestAnimationFrame(() => {
          if (opener.isConnected) opener.focus();
        });
      }
    },
    [reorderVisibleButtons, visibleButtonIds],
  );
  const addButtonToSidebar = useCallback(
    async (buttonId: string) => {
      setMenu(null);
      const current = configRef.current;
      const button = current?.buttons.find((item) => item.id === buttonId);
      if (!current || !button || button.showInSidebar !== false) return false;
      const page = current.overlayPages?.find((item) => item.id === button.overlayPageId);
      const group = page?.name.trim() || DEFAULT_BUTTON_GROUP;
      const groups =
        group !== DEFAULT_BUTTON_GROUP && !current.groups.includes(group)
          ? [...current.groups, group]
          : current.groups;
      return persist(
        {
          ...current,
          groups,
          buttons: current.buttons.map((item) =>
            item.id === buttonId
              ? {
                  ...item,
                  showInSidebar: true,
                  group: group === DEFAULT_BUTTON_GROUP ? undefined : group,
                }
              : item,
          ),
        },
        `${button.label} をサイドバーに追加しました`,
      );
    },
    [persist],
  );
  const moveButtonToPage = useCallback(
    async (buttonId: string, pageId: string | null) => {
      const current = configRef.current;
      if (pageId && !current?.overlayPages?.some((page) => page.id === pageId)) return false;
      const button = current?.buttons.find((item) => item.id === buttonId);
      if (!current || !button || (button.overlayPageId ?? null) === pageId) return false;
      return persist(
        {
          ...current,
          buttons: current.buttons.map((item) => {
            if (item.id !== buttonId) return item;
            if (pageId) return { ...item, overlayPageId: pageId };
            const next = { ...item };
            delete next.overlayPageId;
            return next;
          }),
        },
        `${button.label} の辞書グループを移動しました`,
      );
    },
    [persist],
  );
  const currentDropPage = useCallback(() => {
    if (searchActiveRef.current) return null;
    const current = configRef.current;
    const pageId = overlayPageIdFromKey(selectedPageKeyRef.current);
    return pageId && current?.overlayPages?.some((page) => page.id === pageId) ? pageId : null;
  }, []);
  const claimDrop = useCallback((key: string) => {
    const now = Date.now();
    const previous = recentDropRef.current;
    if (previous?.key === key && now - previous.at < 1000) return false;
    recentDropRef.current = { key, at: now };
    return true;
  }, []);
  const openDrop = useCallback(
    async (input: DropResolveInput, suggestedLabel?: string | null) => {
      const current = configRef.current;
      const key = `${input.kind}:${input.value.trim().toLocaleLowerCase()}`;
      if (!current || !claimDrop(key)) return;
      setError(null);
      try {
        const draft = await resolveDropItem(
          input.kind === "url" ? { ...input, suggestedLabel } : input,
        );
        setDropDraft({
          ...draft,
          label: draft.label,
          group: draft.group?.trim() || groupsOf(current)[0] || DEFAULT_BUTTON_GROUP,
          showInSidebar: true,
          showInOverlay: true,
          overlayPageId: currentDropPage(),
        });
      } catch (cause) {
        setError(`登録できません: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    },
    [claimDrop, currentDropPage],
  );
  const droppedPaths = useCallback(
    (paths: string[]) => {
      setDragActive(false);
      if (paths[0]) void openDrop({ kind: "path", value: paths[0] });
    },
    [openDrop],
  );
  const recycleBin = useCallback(() => {
    const current = configRef.current;
    if (!current || !claimDrop("shell:recycle_bin")) return;
    setDropDraft({
      label: "ごみ箱",
      group: groupsOf(current)[0] || DEFAULT_BUTTON_GROUP,
      iconSource: null,
      action: { type: "open_shell_special", payload: { item: "recycle_bin" } },
      source: "Windowsデスクトップのごみ箱",
      showInSidebar: true,
      showInOverlay: true,
      overlayPageId: currentDropPage(),
    });
  }, [claimDrop, currentDropPage]);
  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    listen<ShellDropEvent>("main-shell-drop-result", (event) => {
      const payload = event.payload;
      if (!alive || payload.windowLabel !== "dictionary") return;
      if (payload.stage === "error") {
        setDragActive(false);
        setError(`D&Dを初期化できません: ${payload.message}`);
      } else if (payload.stage === "dragEnter") setDragActive(true);
      else if (payload.stage === "dragLeave") setDragActive(false);
      else {
        setDragActive(false);
        if (payload.paths.length) droppedPaths(payload.paths);
        else if (payload.url) void openDrop({ kind: "url", value: payload.url }, payload.label);
        else if (payload.shellSpecial === "recycle_bin") recycleBin();
      }
    })
      .then((dispose) => {
        if (!alive) return dispose();
        unlisten = dispose;
        void enableMainShellDrop().catch((cause) =>
          setError(
            `D&Dを初期化できません: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
        );
      })
      .catch((cause) =>
        setError(
          `D&Dを初期化できません: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [droppedPaths, openDrop, recycleBin]);
  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") setDragActive(true);
        else if (event.payload.type === "leave") setDragActive(false);
        else if (event.payload.type === "drop") droppedPaths(event.payload.paths);
      })
      .then((dispose) => (alive ? (unlisten = dispose) : dispose()))
      .catch(() => undefined);
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [droppedPaths]);
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
    event.preventDefault();
    setDragActive(true);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const url = firstUrl(
      event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain"),
    );
    if (url) void openDrop({ kind: "url", value: url });
  };
  const register = async () => {
    if (!config || !dropDraft) return;
    const label = dropDraft.label.trim();
    if (!label) return setError("ラベルを入力してください");
    const group = dropDraft.group.trim();
    const button: LauncherButton = {
      id: buttonId(label, config.buttons),
      label,
      icon: iconFor(dropDraft.action),
      iconSource: dropDraft.iconSource ?? undefined,
      group: group && group !== DEFAULT_BUTTON_GROUP ? group : undefined,
      showInSidebar: dropDraft.showInSidebar,
      showInOverlay: dropDraft.showInOverlay,
      overlayPageId: dropDraft.overlayPageId ?? undefined,
      aliases: [],
      actions: [dropDraft.action],
    };
    const nextGroups =
      group && group !== DEFAULT_BUTTON_GROUP && !config.groups.includes(group)
        ? [...config.groups, group]
        : config.groups;
    if (
      await persist(
        { ...config, groups: nextGroups, buttons: [...config.buttons, button] },
        `${label} を登録しました`,
      )
    )
      setDropDraft(null);
  };
  const pageError = (name: string, pageId?: string) => {
    const clean = name.trim();
    if (!clean) return "ページ名を入力してください";
    if (clean.length > OVERLAY_PAGE_NAME_MAX_CHARS)
      return `ページ名は${OVERLAY_PAGE_NAME_MAX_CHARS}文字以内で入力してください`;
    if (["すべて", "未分類"].includes(clean)) return `${clean} は固定ページ名です`;
    return pages.some(
      (page) => page.id !== pageId && page.name.toLowerCase() === clean.toLowerCase(),
    )
      ? `${clean} はすでにあります`
      : null;
  };
  const savePage = async () => {
    if (!config || !pageDraft) return;
    const name = pageDraft.name.trim();
    const invalid = pageError(name, pageDraft.pageId);
    if (invalid) return setError(invalid);
    if (pageDraft.mode === "add") {
      const existing = new Set(pages.map((page) => page.id));
      let pageId = `overlay-page-${id()}`;
      while (existing.has(pageId)) pageId = `overlay-page-${id()}`;
      if (
        await persist(
          { ...config, overlayPages: [...pages, { id: pageId, name }] },
          `${name} を追加しました`,
        )
      ) {
        setPageDraft(null);
        selectPage(overlayCustomPageKey(pageId));
        if (pageDraft.assignToButton)
          setButtonDraft((draft) => (draft ? { ...draft, overlayPageId: pageId } : draft));
      }
    } else if (
      pageDraft.pageId &&
      (await persist(
        {
          ...config,
          overlayPages: pages.map((page) =>
            page.id === pageDraft.pageId ? { ...page, name } : page,
          ),
        },
        `${name} に変更しました`,
      ))
    )
      setPageDraft(null);
  };
  const movePage = async (pageId: string, offset: -1 | 1) => {
    if (!config) return;
    const from = pages.findIndex((page) => page.id === pageId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= pages.length) return;
    const next = [...pages];
    const [page] = next.splice(from, 1);
    next.splice(to, 0, page);
    await persist({ ...config, overlayPages: next }, null);
  };
  const movePageTo = (pageId: string, targetId: string, after: boolean) => {
    const operation = pageMoveQueue.current.then(async () => {
      const latest = configRef.current;
      if (!latest || pageId === targetId) return;
      const next = [...(latest.overlayPages ?? [])];
      const from = next.findIndex((page) => page.id === pageId);
      if (from < 0) return;
      const [page] = next.splice(from, 1);
      const target = next.findIndex((item) => item.id === targetId);
      if (target < 0) return;
      next.splice(target + (after ? 1 : 0), 0, page);
      await persist({ ...latest, overlayPages: next }, null);
    });
    pageMoveQueue.current = operation.catch(() => undefined);
    return operation;
  };
  const deletePage = (page: OverlayPage) => {
    setMenu(null);
    const affected =
      config?.buttons.filter((button) => button.overlayPageId === page.id).length ?? 0;
    setConfirmation({
      title: "辞書ページを削除しますか？",
      subject: `「${page.name}」`,
      message: `${affected}件は「未分類」へ移動します。ボタン自体は削除されません。`,
      confirmLabel: "ページを削除",
      tone: "danger",
      onConfirm: async () => {
        const latest = configRef.current;
        if (!latest) return false;
        const deletingSelectedPage = selectedPageKeyRef.current === overlayCustomPageKey(page.id);
        const saved = await persist(
          {
            ...latest,
            overlayPages: (latest.overlayPages ?? []).filter((item) => item.id !== page.id),
            buttons: latest.buttons.map((button) =>
              button.overlayPageId === page.id ? { ...button, overlayPageId: undefined } : button,
            ),
          },
          `${page.name} を削除しました`,
          undefined,
          true,
        );
        if (saved && deletingSelectedPage) selectPage(OVERLAY_UNCLASSIFIED_PAGE_KEY);
        return saved;
      },
    });
  };
  const editButton = (button: LauncherButton) => {
    setMenu(null);
    const draft = {
      id: button.id,
      label: button.label,
      icon: button.icon ?? "",
      group: groupOf(button),
      showInSidebar: button.showInSidebar !== false,
      showInOverlay: button.showInOverlay !== false,
      overlayPageId: pages.some((page) => page.id === button.overlayPageId)
        ? (button.overlayPageId ?? null)
        : null,
      aliasesInput: button.aliases?.join(", ") ?? "",
      description: button.description ?? "",
      actions: button.actions.map(toDraft),
    };
    setButtonDraft(draft);
    setButtonInitialDraft(draft);
  };
  const saveButton = async () => {
    if (!config || !buttonDraft) return;
    const label = buttonDraft.label.trim();
    if (!label) return setError("ラベルを入力してください");
    const actions = buttonDraft.actions.map(stripDraft);
    if (!actions.length || actions.some((action) => !valueOf(action).trim()))
      return setError("実行アクションと内容を入力してください");
    const original = config.buttons.find((button) => button.id === buttonDraft.id);
    const changed = JSON.stringify(original?.actions ?? []) !== JSON.stringify(actions);
    const group = buttonDraft.group.trim();
    const buttons = config.buttons.map((button) =>
      button.id === buttonDraft.id
        ? {
            ...button,
            label,
            icon: buttonDraft.icon.trim() || undefined,
            group: group && group !== DEFAULT_BUTTON_GROUP ? group : undefined,
            showInSidebar: buttonDraft.showInSidebar,
            showInOverlay: buttonDraft.showInOverlay,
            overlayPageId: buttonDraft.overlayPageId ?? undefined,
            aliases: aliases(buttonDraft.aliasesInput),
            description: buttonDraft.description.trim() || undefined,
            actions,
          }
        : button,
    );
    const nextGroups =
      group && group !== DEFAULT_BUTTON_GROUP && !config.groups.includes(group)
        ? [...config.groups, group]
        : config.groups;
    const projects =
      buttonDraft.showInSidebar || buttonDraft.showInOverlay
        ? config.projects
        : config.projects.map((project) => ({
            ...project,
            buttonIds: project.buttonIds.filter((item) => item !== buttonDraft.id),
          }));
    if (
      await persist(
        { ...config, groups: nextGroups, buttons, projects },
        `${label} を保存しました`,
        changed ? () => deleteButtonIconCache(buttonDraft.id).catch(() => undefined) : undefined,
      )
    ) {
      setButtonDraft(null);
      setButtonInitialDraft(null);
    }
  };
  const requestCloseButtonEdit = () => {
    if (!buttonDraft) return;
    if (JSON.stringify(buttonDraft) === JSON.stringify(buttonInitialDraft)) {
      setError(null);
      setButtonDraft(null);
      setButtonInitialDraft(null);
      return;
    }
    setConfirmation({
      title: "変更を破棄しますか？",
      message: "保存していない編集内容は失われます。",
      confirmLabel: "破棄して閉じる",
      tone: "danger",
      onConfirm: () => {
        setError(null);
        setButtonDraft(null);
        setButtonInitialDraft(null);
      },
    });
  };
  const deleteButton = (button: LauncherButton) => {
    setMenu(null);
    setConfirmation({
      title: "ボタンを削除しますか？",
      subject: `「${button.label}」`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      tone: "danger",
      onConfirm: async () => {
        const latest = configRef.current;
        if (!latest) return false;
        return persist(
          {
            ...latest,
            buttons: latest.buttons.filter((item) => item.id !== button.id),
            projects: latest.projects.map((project) => ({
              ...project,
              buttonIds: project.buttonIds.filter((item) => item !== button.id),
            })),
          },
          `${button.label} を削除しました`,
          () => deleteButtonIconCache(button.id).catch(() => undefined),
          true,
        );
      },
    });
  };
  const buttonMenu = (event: MouseEvent<HTMLElement>, button: LauncherButton) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      kind: "button",
      button,
      x: event.clientX,
      y: event.clientY,
      opener: event.currentTarget,
    });
  };
  const pageMenu = (event: MouseEvent<HTMLElement>, page: OverlayPage) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      kind: "page",
      page,
      x: event.clientX,
      y: event.clientY,
      opener: event.currentTarget,
    });
  };
  const keyboardMenu = (
    event: KeyboardEvent<HTMLElement>,
    target: { kind: "button"; button: LauncherButton } | { kind: "page"; page: OverlayPage },
  ) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ ...target, x: rect.left, y: rect.bottom + 4, opener: event.currentTarget });
  };
  const pageDrag = (page: OverlayPage) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      setPageDragId(page.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(PAGE_DRAG_TYPE, page.id);
    },
    onDragEnd: () => setPageDragId(null),
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const dragged = event.dataTransfer.getData(PAGE_DRAG_TYPE) || pageDragId;
      if (dragged && dragged !== page.id) event.preventDefault();
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const dragged = event.dataTransfer.getData(PAGE_DRAG_TYPE) || pageDragId;
      if (!dragged || dragged === page.id) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      setPageDragId(null);
      void movePageTo(dragged, page.id, event.clientX >= rect.left + rect.width / 2);
    },
  });
  return {
    addButtonToSidebar,
    blocking: Boolean(dropDraft || pageDraft || buttonDraft || confirmation),
    buttonDraft,
    buttonMenu,
    canMoveButton,
    confirmation,
    deleteButton,
    deletePage,
    dragActive,
    dropDraft,
    editButton,
    error,
    groups,
    keyboardMenu,
    menu,
    movePage,
    movePageTo,
    moveButton,
    moveButtonToPage,
    onDragOver,
    onDrop,
    pageDraft,
    pageDrag,
    pageError,
    pageMenu,
    pages,
    register,
    reorderAnnouncement,
    reorderVisibleButtons,
    requestCloseButtonEdit,
    saveButton,
    savePage,
    setButtonDraft,
    setConfirmation,
    setDropDraft,
    setError,
    setMenu,
    setPageDraft,
    status,
    searchActive,
  };
}
export type DictionaryFeatureParityController = ReturnType<typeof useDictionaryFeatureParity>;
