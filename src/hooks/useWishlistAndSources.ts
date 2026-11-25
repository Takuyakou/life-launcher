import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ConfirmDialogRequest } from "../components/ConfirmDialog";
import type { AppConfig, SourceCompletion } from "../types";
import type {
  ActiveTimer,
  ContextMenuState,
  ToastOptions,
  ToastTone,
} from "../app/dashboardTypes";
import { createStableId } from "../app/helpers";
import {
  canonicalSourceKey,
  resnapshotSource,
  sourceLockedByUnfinishedToday,
  timerSourceKey,
  SOURCE_EDIT_TIMER_REASON,
  SOURCE_LOCK_REASON,
} from "../sourceEdit";
import { legacyWishlistSourceKey, wishlistSourceKey } from "../todayCandidates";
import { shouldSkipFocusRestore } from "../app/focusRestore";

type WishlistDeps = {
  config: AppConfig | null;
  configRef: MutableRefObject<AppConfig | null>;
  persistConfig: (next: AppConfig) => Promise<boolean>;
  showToast: (tone: ToastTone, message: string, options?: ToastOptions) => void;
  activeTimer: ActiveTimer | null;
  activeTimerRef: MutableRefObject<ActiveTimer | null>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
  requestConfirmation: (request: ConfirmDialogRequest) => void;
  requestDiscardConfirmation: (
    onConfirm: () => void | boolean | Promise<void | boolean>,
  ) => void;
  sourceEditBusyRef: MutableRefObject<string | null>;
  refreshInstructionChoices: () => Promise<void>;
  withoutSourceFromToday: (currentConfig: AppConfig, sourceKeys: string[]) => AppConfig["today"];
  projectsById: Map<string, AppConfig["projects"][number]>;
};

export function useWishlistAndSources({
  config,
  configRef,
  persistConfig,
  showToast,
  activeTimer,
  activeTimerRef,
  setContextMenu,
  requestConfirmation,
  requestDiscardConfirmation,
  sourceEditBusyRef,
  refreshInstructionChoices,
  withoutSourceFromToday,
  projectsById,
}: WishlistDeps) {
  const [inboxDraft, setInboxDraft] = useState("");
  const [inboxAddProjectId, setInboxAddProjectId] = useState("");
  const [inboxAddOpen, setInboxAddOpen] = useState(false);
  const [inboxAddSaving, setInboxAddSaving] = useState(false);
  const [inboxAddError, setInboxAddError] = useState<string | null>(null);
  const [inboxEditingIndex, setInboxEditingIndex] = useState<number | null>(null);
  const inboxEditingIdRef = useRef<string | null>(null);
  const inboxEditInitialDraftRef = useRef<{
    text: string;
    projectId: string;
    buttonIds: string[];
    instructionPath: string;
    instructionOpenOnStart: boolean;
  } | null>(null);
  const [sourceEditSaving, setSourceEditSaving] = useState(false);
  const [inboxEditDraft, setInboxEditDraft] = useState("");
  const [inboxEditProjectId, setInboxEditProjectId] = useState("");
  const [inboxEditButtonIds, setInboxEditButtonIds] = useState<string[]>([]);
  const [inboxEditInstructionPath, setInboxEditInstructionPath] = useState("");
  const [inboxEditInstructionOpenOnStart, setInboxEditInstructionOpenOnStart] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxAddSavingRef = useRef(false);
  const inboxAddOpenerRef = useRef<HTMLButtonElement | null>(null);
  const inboxAddInitialProjectIdRef = useRef("");
  const sourceEditOriginRef = useRef<"source" | "today" | "builder">("source");


  const addInboxItem = async () => {
    if (!config || inboxAddSavingRef.current) return;
    const text = inboxDraft.trim();
    if (!text) {
      setInboxAddError("やりたいことを入力してください");
      return;
    }
    if (text.length > 120) {
      setInboxAddError("やりたいことは120文字以内で入力してください");
      return;
    }

    inboxAddSavingRef.current = true;
    setInboxAddSaving(true);
    setInboxAddError(null);
    const saved = await persistConfig({
      ...config,
      inbox: [
        ...config.inbox,
        {
          id: createStableId(),
          text,
          ...(inboxAddProjectId ? { projectId: inboxAddProjectId } : {}),
        },
      ],
    });
    inboxAddSavingRef.current = false;
    setInboxAddSaving(false);
    if (!saved) {
      setInboxAddError("保存できませんでした。内容を残したまま、もう一度お試しください");
      return;
    }
    closeInboxAddDialog(true);
  };

  function sourceEditBlockReason(key: string, allowTodaySourceSync = false) {
    const current = configRef.current;
    if (sourceEditBusyRef.current !== null) return "保存処理が完了してから変更してください";
    if (
      current &&
      activeTimerRef.current &&
      timerSourceKey(current, activeTimerRef.current.sourceId) === key
    ) {
      return SOURCE_EDIT_TIMER_REASON;
    }
    if (current && !allowTodaySourceSync && sourceLockedByUnfinishedToday(current, key)) {
      return SOURCE_LOCK_REASON;
    }
    return null;
  }

  function sourceEditBlocked(key: string, allowTodaySourceSync = false) {
    return sourceEditBlockReason(key, allowTodaySourceSync) !== null;
  }

  function warnSourceEditBlocked(key: string, allowTodaySourceSync = false) {
    const reason = sourceEditBlockReason(key, allowTodaySourceSync);
    if (reason) showToast("warn", reason);
    return Boolean(reason);
  }

  const saveSourceEdit = async (previous: AppConfig, next: AppConfig, key: string) => {
    const allowTodaySourceSync = sourceEditOriginRef.current === "today";
    if (warnSourceEditBlocked(key, allowTodaySourceSync)) {
      return null;
    }
    sourceEditBusyRef.current = key;
    setSourceEditSaving(true);
    try {
      const resnapshot = resnapshotSource(previous, next, key);
      const todayUpdated = resnapshot.today !== next.today;
      return (await persistConfig(resnapshot)) ? { todayUpdated } : null;
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      sourceEditBusyRef.current = null;
      setSourceEditSaving(false);
    }
  };

  const beginInboxEdit = (index: number, origin: "source" | "today" | "builder" = "source") => {
    const item = configRef.current?.inbox[index];
    if (!item) return;
    if (!item.id) return;
    if (warnSourceEditBlocked(`wishlist:${item.id}`, origin === "today")) {
      return;
    }
    inboxEditingIdRef.current = item.id;
    sourceEditOriginRef.current = origin;
    setContextMenu(null);
    setInboxOpen(true);
    setInboxEditingIndex(index);
    inboxEditInitialDraftRef.current = {
      text: item.text,
      projectId: item.projectId ?? "",
      buttonIds: [...(item.buttonIds ?? [])],
      instructionPath: item.instructionPath ?? "",
      instructionOpenOnStart: Boolean(
        item.instructionPath && item.instructionOpenOnStart !== false,
      ),
    };
    setInboxEditDraft(item.text);
    setInboxEditProjectId(item.projectId ?? "");
    setInboxEditButtonIds(item.buttonIds ?? []);
    setInboxEditInstructionPath(item.instructionPath ?? "");
    setInboxEditInstructionOpenOnStart(
      Boolean(item.instructionPath && item.instructionOpenOnStart !== false),
    );
    void refreshInstructionChoices();
  };

  const commitInboxEdit = async () => {
    const config = configRef.current;
    if (!config || inboxEditingIndex === null) return;
    const editingId = inboxEditingIdRef.current;
    if (!editingId || !config.inbox.some((item) => item.id === editingId)) {
      showToast("warn", "元の登録が見つかりません");
      return;
    }
    if (warnSourceEditBlocked(`wishlist:${editingId}`, sourceEditOriginRef.current === "today")) {
      return;
    }
    const text = inboxEditDraft.trim();
    if (!text) {
      closeInboxEditDialog(true);
      return;
    }
    const inbox = config.inbox.map((item) =>
      item.id === editingId
        ? {
            id: item.id ?? createStableId(),
            text,
            ...(inboxEditProjectId ? { projectId: inboxEditProjectId } : {}),
            ...(inboxEditButtonIds.length > 0 ? { buttonIds: inboxEditButtonIds } : {}),
            ...(inboxEditInstructionPath
              ? {
                  instructionPath: inboxEditInstructionPath,
                  instructionOpenOnStart: inboxEditInstructionOpenOnStart,
                }
              : {}),
          }
        : item,
    );
    const result = await saveSourceEdit(config, { ...config, inbox }, `wishlist:${editingId}`);
    if (!result) return;
    closeInboxEditDialog(true);
    const detail =
      sourceEditOriginRef.current === "source"
        ? result.todayUpdated
          ? "今日の3件にも反映しました"
          : undefined
        : "元の「やりたいこと」にも反映しました";
    showToast("ok", "変更を保存しました", { detail });
  };

  function isTimerActiveForSource(sourceKeys: string[], projectId?: string) {
    if (!activeTimer) return false;
    return (
      (projectId !== undefined && activeTimer.sourceId === projectId) ||
      sourceKeys.some((sourceKey) => activeTimer.sourceId === `today:${sourceKey}`)
    );
  }

  const completeInboxItem = (index: number) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;
    const sourceKeys = [wishlistSourceKey(item, index), legacyWishlistSourceKey(item)];
    const canonicalKey = canonicalSourceKey(config, sourceKeys[0]) ?? sourceKeys[0];
    if (warnSourceEditBlocked(canonicalKey)) {
      setContextMenu(null);
      return;
    }
    if (isTimerActiveForSource(sourceKeys)) {
      setContextMenu(null);
      showToast("warn", "タイマーを停止してから完了してください");
      return;
    }
    const project = item.projectId ? projectsById.get(item.projectId) : undefined;
    setContextMenu(null);
    requestConfirmation({
      title: "完了にしますか？",
      subject: `「${item.text}」`,
      message: "この項目は今後の候補から外れます。これまでの実行記録は残ります。",
      confirmLabel: "完了にする",
      processingLabel: "完了にしています…",
      onConfirm: async () => {
        const completion: SourceCompletion = {
          id: createStableId(),
          sourceType: "wishlist",
          sourceIdentity: sourceKeys[0],
          textSnapshot: item.text,
          ...(project ? { projectId: project.id, projectNameSnapshot: project.name } : {}),
          completedAt: new Date().toISOString(),
        };
        return persistConfig({
          ...config,
          today: withoutSourceFromToday(config, sourceKeys),
          inbox: config.inbox.filter((_, itemIndex) => itemIndex !== index),
          sourceCompletions: [...config.sourceCompletions, completion],
        });
      },
    });
  };

  const deleteInboxItem = (index: number) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;
    const sourceKeys = [wishlistSourceKey(item, index), legacyWishlistSourceKey(item)];
    const canonicalKey = canonicalSourceKey(config, sourceKeys[0]) ?? sourceKeys[0];
    if (warnSourceEditBlocked(canonicalKey)) {
      setContextMenu(null);
      return;
    }
    if (isTimerActiveForSource(sourceKeys)) {
      setContextMenu(null);
      showToast("warn", "タイマーを停止してから削除してください");
      return;
    }
    setContextMenu(null);
    requestConfirmation({
      title: "削除しますか？",
      subject: `「${item.text}」`,
      message: "この登録を削除します。完了としては記録されません。",
      confirmLabel: "削除",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: async () =>
        persistConfig({
          ...config,
          today: withoutSourceFromToday(config, sourceKeys),
          inbox: config.inbox.filter((_, itemIndex) => itemIndex !== index),
        }),
    });
  };

  const closeInboxAddDialog = useCallback(
    (afterSuccessfulSave = false) => {
      if (inboxAddSavingRef.current) return;
      const dirty = Boolean(
        inboxDraft.trim() || inboxAddProjectId !== inboxAddInitialProjectIdRef.current,
      );
      if (!afterSuccessfulSave && dirty) {
        requestDiscardConfirmation(() => closeInboxAddDialog(true));
        return;
      }
      const opener = inboxAddOpenerRef.current;
      inboxAddOpenerRef.current = null;
      setInboxAddOpen(false);
      setInboxDraft("");
      setInboxAddProjectId("");
      inboxAddInitialProjectIdRef.current = "";
      setInboxAddError(null);
      setInboxAddSaving(false);
      window.requestAnimationFrame(() => {
        if (!opener?.isConnected || shouldSkipFocusRestore(opener)) return;
        opener.focus();
      });
    },
    [inboxAddProjectId, inboxDraft, requestDiscardConfirmation],
  );

  const closeInboxEditDialog = useCallback(
    (afterSuccessfulSave = false) => {
      if (sourceEditBusyRef.current) return;
      const currentDraft = {
        text: inboxEditDraft,
        projectId: inboxEditProjectId,
        buttonIds: inboxEditButtonIds,
        instructionPath: inboxEditInstructionPath,
        instructionOpenOnStart: inboxEditInstructionOpenOnStart,
      };
      const dirty =
        !afterSuccessfulSave &&
        JSON.stringify(currentDraft) !== JSON.stringify(inboxEditInitialDraftRef.current);
      if (dirty) {
        requestDiscardConfirmation(() => closeInboxEditDialog(true));
        return;
      }
      inboxEditInitialDraftRef.current = null;
      setInboxEditingIndex(null);
      setInboxEditDraft("");
      setInboxEditProjectId("");
      setInboxEditButtonIds([]);
      setInboxEditInstructionPath("");
      setInboxEditInstructionOpenOnStart(false);
    },
    [
      inboxEditButtonIds,
      inboxEditDraft,
      inboxEditInstructionOpenOnStart,
      inboxEditInstructionPath,
      inboxEditProjectId,
      requestDiscardConfirmation,
      sourceEditBusyRef,
    ],
  );

  const openInboxAddDialog = (opener?: HTMLButtonElement, projectId = "") => {
    if (inboxAddSaving) return;
    if (opener) inboxAddOpenerRef.current = opener;
    setContextMenu(null);
    setInboxOpen(true);
    setInboxDraft("");
    const initialProjectId =
      projectId && config?.projects.some((project) => project.id === projectId) ? projectId : "";
    inboxAddInitialProjectIdRef.current = initialProjectId;
    setInboxAddProjectId(initialProjectId);
    setInboxAddError(null);
    setInboxAddOpen(true);
  };

  return {
    inboxDraft,
    setInboxDraft,
    inboxAddProjectId,
    setInboxAddProjectId,
    inboxAddOpen,
    setInboxAddOpen,
    inboxAddSaving,
    setInboxAddSaving,
    inboxAddError,
    setInboxAddError,
    inboxEditingIndex,
    setInboxEditingIndex,
    sourceEditSaving,
    setSourceEditSaving,
    inboxEditDraft,
    setInboxEditDraft,
    inboxEditProjectId,
    setInboxEditProjectId,
    inboxEditButtonIds,
    setInboxEditButtonIds,
    inboxEditInstructionPath,
    setInboxEditInstructionPath,
    inboxEditInstructionOpenOnStart,
    setInboxEditInstructionOpenOnStart,
    inboxOpen,
    setInboxOpen,
    inboxEditingIdRef,
    sourceEditOriginRef,
    addInboxItem,
    sourceEditBlockReason,
    sourceEditBlocked,
    warnSourceEditBlocked,
    saveSourceEdit,
    beginInboxEdit,
    commitInboxEdit,
    isTimerActiveForSource,
    completeInboxItem,
    deleteInboxItem,
    closeInboxAddDialog,
    closeInboxEditDialog,
    openInboxAddDialog,
  };
}
