/* eslint-disable @typescript-eslint/no-explicit-any */
import type { KeyboardEvent } from "react";
import { createStableId, toThreeNoteDraft, todayEntries, todayTimerSourceId } from "../app/helpers";
import { saveNotesForDate, undoTodaySelection } from "../tauri";
import { timerRunsTodayItem } from "../timerSource";
import { TODAY_ITEM_LIMIT } from "../constants";
import { buildTodayCandidates, wishlistSourceKey } from "../todayCandidates";
import type { AppConfig, InboxItem, TodayItem } from "../types";

import type { TodayCandidate } from "../todayCandidates";
import { todaySourceKey } from "../app/helpers";

type Deps = Record<string, any>;

export function useTodayAndVictory(deps: Deps) {
  const {
    activeTimerRef,
    config,
    configRef,
    persistConfig,
    setTodayPickerDraftItems,
    setTodayTriggerDraft,
    setTodayTriggerEditingIndex,
    setVictoryEditing,
    showToast,
    todayPickerDraftItems,
    todayTriggerDraft,
    mainScrollAreaRef,
    seenCompletionFeedbackRef,
    setCompletionFeedback,
    showCompletionFeedback,
    todayPickerSaving,
    todayPickerSavingRef,
    setTodayPickerSaving,
    victoryInputRef,
    victoryNavigationRef,
    victorySaveRef,
    setConfig,
    setBanner,
    resetInProgressRef,
    notesSaveTimersRef,
    writeGenerationRef,
    setNotesSaveStatus,
    notesHistory,
    setNotesHistory,
    todayPickerAddedWishes,
    setTodayPickerAddedWishes,
    todayPickerInitialItemsRef,
    todayPickerQuickText,
    setTodayPickerQuickText,
    todayPickerFilter,
    closeTodayPicker,
    todayPickerDragIndex,
    setTodayPickerDragIndex,
    todayPickerCandidateSelected,
    announceReorder,
  } = deps;

  const updateVictoryText = (text: string) => {
    if (!config) return Promise.resolve(false);
    if (!text.trim()) {
      seenCompletionFeedbackRef.current.delete(`victory:${config.today.date}`);
      setCompletionFeedback((current: any) => (current?.kind === "victory" ? null : current));
    }
    const victory = {
      text,
      done: text.trim() ? config.today.victory.done : false,
    };
    return persistConfig({ ...config, today: { ...config.today, victory } });
  };

  const clearVictoryAutoFocus = (event: { currentTarget: HTMLElement }) => {
    delete event.currentTarget.dataset.autoFocus;
  };

  const enterVictoryEditing = () => {
    victorySaveRef.current = null;
    setVictoryEditing(true);
    window.requestAnimationFrame(() => victoryInputRef.current?.focus({ preventScroll: true }));
  };

  const leaveVictoryEditing = () => {
    setVictoryEditing(false);
    window.requestAnimationFrame(() => victoryNavigationRef.current?.focus({ preventScroll: true }));
  };

  const applyVictorySuggestion = (text: string) => {
    const scrollArea = mainScrollAreaRef.current;
    const scrollTop = scrollArea?.scrollTop ?? 0;
    setVictoryEditing(true);
    victorySaveRef.current = updateVictoryText(text);
    void victorySaveRef.current.then(() => {
      window.requestAnimationFrame(() => {
        if (scrollArea?.isConnected) scrollArea.scrollTop = scrollTop;
        victoryInputRef.current?.focus({ preventScroll: true });
        window.requestAnimationFrame(() => {
          if (scrollArea?.isConnected) scrollArea.scrollTop = scrollTop;
        });
      });
    });
  };

  const toggleVictoryDone = () => {
    const current = configRef.current;
    if (!current) return;
    const text = current.today.victory.text.trim();
    if (!text) {
      showToast("warn", "勝利条件を入力してください");
      return;
    }

    const victory = {
      ...current.today.victory,
      done: !current.today.victory.done,
    };
    void persistConfig({ ...current, today: { ...current.today, victory } }).then((saved: any) => {
      if (saved && victory.done) {
        showCompletionFeedback({
          key: `victory:${current.today.date}`,
          kind: "victory",
          label: text,
        });
      } else if (saved) {
        seenCompletionFeedbackRef.current.delete(`victory:${current.today.date}`);
        setCompletionFeedback((feedback: any) => (feedback?.kind === "victory" ? null : feedback));
      }
    });
  };

  const handleVictoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      leaveVictoryEditing();
      return;
    }
    void (victorySaveRef.current ?? Promise.resolve(true)).then((saved: any) => {
      if (saved) leaveVictoryEditing();
    });
  };

  const sourceSnapshotForUndo = (current: AppConfig, sourceKey: string): unknown | null => {
    if (sourceKey.startsWith("project:")) {
      return current.projects.find((project: any) => `project:${project.id}` === sourceKey) ?? null;
    }
    if (sourceKey.startsWith("wishlist:")) {
      return current.inbox.find((item: any) => `wishlist:${item.id}` === sourceKey) ?? null;
    }
    return null;
  };

  const undoTodaySelectionOperation = async (input: {
    operationId: string;
    dayKey: string;
    sourceKey: string;
    item: TodayItem | null;
    previousSourceKey: string | null;
    nextSourceKey: string | null;
    sourceSnapshot: unknown | null;
    restoreExclusion: boolean;
  }) => {
    const current = configRef.current;
    if (!current) return false;
    if (
      activeTimerRef.current?.sourceId === `today:${input.sourceKey}` ||
      (input.sourceKey.startsWith("project:") &&
        activeTimerRef.current?.sourceId === input.sourceKey.slice("project:".length))
    ) {
      showToast("warn", "タイマーを停止してから元に戻してください");
      return false;
    }
    try {
      const response = await undoTodaySelection(input);
      configRef.current = response.config;
      setConfig(response.config);
      setBanner(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `元に戻せません: ${message}`);
      return false;
    }
  };

  async function removeTodayItem(sourceKey: string) {
    const current = configRef.current;
    if (!current) return;
    const index = current.today.items.findIndex(
      (item: any, itemIndex: any) => todaySourceKey(item, itemIndex) === sourceKey,
    );
    if (index < 0) return;
    if (
      timerRunsTodayItem(
        todayEntries(current.today.items),
        activeTimerRef.current,
        todayTimerSourceId(current.today.items[index], index),
        sourceKey,
      )
    ) {
      showToast("warn", "タイマーを停止してから外してください");
      return;
    }
    // Keep legacy timer identities stable when an earlier card is removed.
    const stableItems = current.today.items.map((item: any, itemIndex: any) =>
      item.sourceKey?.trim() ? item : { ...item, sourceKey: todaySourceKey(item, itemIndex) },
    );
    const removedItem = stableItems[index];
    const operationId = createStableId();
    const previousSourceKey = index > 0 ? (stableItems[index - 1]?.sourceKey ?? null) : null;
    const nextSourceKey = stableItems[index + 1]?.sourceKey ?? null;
    const items = stableItems.filter((_: any, itemIndex: any) => itemIndex !== index);
    setTodayTriggerEditingIndex(null);
    if (
      await persistConfig({
        ...current,
        today: {
          ...current.today,
          items,
          selectionMutationTokens: {
            ...current.today.selectionMutationTokens,
            [sourceKey]: operationId,
          },
        },
      })
    ) {
      showToast("neutral", "今日の3件から外しました", {
        detail: "元の次の一手・やりたいことは残ります",
        actionLabel: "元に戻す",
        onAction: () =>
          undoTodaySelectionOperation({
            operationId,
            dayKey: current.today.date,
            sourceKey,
            item: removedItem,
            previousSourceKey,
            nextSourceKey,
            sourceSnapshot: sourceSnapshotForUndo(current, sourceKey),
            restoreExclusion: false,
          }),
      });
    }
  }

  const beginTodayTriggerEdit = (index: number) => {
    if (!config) return;
    setTodayTriggerDraft(config.today.items[index]?.trigger ?? "");
    setTodayTriggerEditingIndex(index);
  };

  const cancelTodayTriggerEdit = () => {
    setTodayTriggerDraft("");
    setTodayTriggerEditingIndex(null);
  };

  const commitTodayTriggerEdit = (index: number) => {
    if (!config) return;
    const trigger = todayTriggerDraft.trim();
    const items = config.today.items.map((item: any, itemIndex: any) => {
      if (itemIndex !== index) return item;
      const nextItem = { ...item };
      if (trigger) {
        nextItem.trigger = trigger;
      } else {
        delete nextItem.trigger;
      }
      return nextItem;
    });
    cancelTodayTriggerEdit();
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const handleTodayTriggerKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTodayTriggerEdit(index);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelTodayTriggerEdit();
      event.currentTarget.blur();
    }
  };

  const scheduleNotesSave = (key: string, save: () => Promise<void>, immediate = false) => {
    if (resetInProgressRef.current) return;
    const existing = notesSaveTimersRef.current.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    const writeGeneration = writeGenerationRef.current;
    const run = () => {
      notesSaveTimersRef.current.delete(key);
      if (resetInProgressRef.current || writeGeneration !== writeGenerationRef.current) return;
      void save();
    };
    if (immediate) {
      run();
      return;
    }
    setNotesSaveStatus("saving");
    notesSaveTimersRef.current.set(key, window.setTimeout(run, 500));
  };

  const flushHistoryNotesSave = (date: string) => {
    if (!notesHistory) return;
    const items = notesHistory.entries.find((entry: any) => entry.date === date)?.items ?? [];
    scheduleNotesSave(
      `history-${date}`,
      async () => {
        try {
          const response = await saveNotesForDate({ date, items });
          setNotesHistory(response);
          setNotesSaveStatus("saved");
        } catch (error) {
          setNotesSaveStatus("error");
          const message = error instanceof Error ? error.message : String(error);
          showToast("error", `できたことノートを保存できません: ${message}`);
        }
      },
      true,
    );
  };

  const updateHistoryNoteText = (date: string, index: number, text: string) => {
    if (!notesHistory) return;

    const nextEntries = notesHistory.entries.map((entry: any) => {
      if (entry.date !== date) return entry;
      const nextItems = toThreeNoteDraft(entry.items).map((item: any, itemIndex: any) =>
        itemIndex === index ? text : item,
      );
      return { ...entry, items: nextItems };
    });
    setNotesHistory({ ...notesHistory, entries: nextEntries });

    scheduleNotesSave(`history-${date}`, async () => {
      try {
        const response = await saveNotesForDate({
          date,
          items: nextEntries.find((entry: any) => entry.date === date)?.items ?? [],
        });
        setNotesHistory(response);
        setNotesSaveStatus("saved");
      } catch (error) {
        setNotesSaveStatus("error");
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `できたことノートを保存できません: ${message}`);
      }
    });
  };

  async function addCandidateToToday(candidate: TodayCandidate, insertionIndex?: number) {
    const current = configRef.current;
    if (!current || !candidate.text.trim()) return false;
    if (current.today.items.length >= TODAY_ITEM_LIMIT) {
      showToast("warn", "いま選べるのは3件までです。完了後に次の3件を選べます");
      return false;
    }
    const matchingSourceKeys = new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])]);
    if (
      current.today.items.some((item: any, index: any) => matchingSourceKeys.has(todaySourceKey(item, index)))
    ) {
      showToast("warn", "今日の3件に既にあります");
      return false;
    }
    const scrollArea = mainScrollAreaRef.current;
    const scrollTopBeforeSave = scrollArea?.scrollTop;

    const selectionMutationTokens = { ...current.today.selectionMutationTokens };
    delete selectionMutationTokens[candidate.sourceKey];
    const items = [...current.today.items];
    items.splice(Math.min(Math.max(0, insertionIndex ?? items.length), items.length), 0, {
      text: candidate.text,
      done: false,
      sourceKey: candidate.sourceKey,
      ...(candidate.sourceGenerationId ? { sourceGenerationId: candidate.sourceGenerationId } : {}),
      ...(candidate.trigger ? { trigger: candidate.trigger } : {}),
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      ...(candidate.buttonIds?.length ? { buttonIds: [...candidate.buttonIds] } : {}),
      ...(candidate.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
      ...(candidate.instructionPath
        ? {
            instructionPath: candidate.instructionPath,
            instructionOpenOnStart: candidate.instructionOpenOnStart !== false,
          }
        : {}),
      defaultTimerMinutes: candidate.defaultTimerMinutes,
      shortTimerMinutes: candidate.shortTimerMinutes,
    });
    const savePromise = persistConfig({
      ...current,
      today: {
        ...current.today,
        items,
        selectionMutationTokens,
      },
    });
    if (scrollArea && scrollTopBeforeSave !== undefined) {
      scrollArea.scrollTop = scrollTopBeforeSave;
      window.requestAnimationFrame(() => {
        if (scrollArea.isConnected) scrollArea.scrollTop = scrollTopBeforeSave;
      });
    }
    const saved = await savePromise;
    if (saved && scrollArea && scrollTopBeforeSave !== undefined) {
      scrollArea.scrollTop = scrollTopBeforeSave;
    }
    if (saved) showToast("ok", "今日の3件に追加しました");
    return saved;
  }

  const todayItemFromCandidate = (candidate: TodayCandidate): TodayItem => ({
    text: candidate.text,
    done: false,
    sourceKey: candidate.sourceKey,
    ...(candidate.sourceGenerationId ? { sourceGenerationId: candidate.sourceGenerationId } : {}),
    ...(candidate.trigger ? { trigger: candidate.trigger } : {}),
    ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
    ...(candidate.buttonIds?.length ? { buttonIds: [...candidate.buttonIds] } : {}),
    ...(candidate.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
    ...(candidate.instructionPath
      ? {
          instructionPath: candidate.instructionPath,
          instructionOpenOnStart: candidate.instructionOpenOnStart !== false,
        }
      : {}),
    defaultTimerMinutes: candidate.defaultTimerMinutes,
    shortTimerMinutes: candidate.shortTimerMinutes,
  });

  // P10-10 (§6.1): the Picker only edits a draft. "決定" is the single save point.
  const saveTodayPickerDraft = async (items = todayPickerDraftItems) => {
    const current = configRef.current;
    if (!current || todayPickerSavingRef.current) return false;
    const addedWishes = todayPickerAddedWishes;
    if (
      JSON.stringify(current.today.items) !== JSON.stringify(todayPickerInitialItemsRef.current)
    ) {
      // Something else (a finishing Timer, another window) changed Today3 while the Picker was open.
      const rebuilt = current.today.items.map((item: any) => ({
        ...item,
        ...(item.buttonIds ? { buttonIds: [...item.buttonIds] } : {}),
      }));
      todayPickerInitialItemsRef.current = rebuilt;
      setTodayPickerDraftItems(rebuilt);
      showToast("warn", "今日の3件がほかの所で変わりました。もう一度選んでください");
      return false;
    }
    if (
      addedWishes.length === 0 &&
      JSON.stringify(items) === JSON.stringify(current.today.items)
    ) {
      closeTodayPicker();
      return true;
    }
    todayPickerSavingRef.current = true;
    setTodayPickerSaving(true);
    // V163-B7: the quick-added wishes and Today3 are saved together, in this one write.
    const saved = await persistConfig({
      ...current,
      ...(addedWishes.length > 0 ? { inbox: [...current.inbox, ...addedWishes] } : {}),
      today: {
        ...current.today,
        items,
      },
    });
    if (saved) {
      todayPickerSavingRef.current = false;
      closeTodayPicker();
      showToast("ok", "今日の3件を選択しました");
      return true;
    }
    todayPickerSavingRef.current = false;
    setTodayPickerSaving(false);
    return false;
  };

  const chooseTodayCandidate = (candidate: TodayCandidate) => {
    if (todayPickerSaving || todayPickerDraftItems.length >= TODAY_ITEM_LIMIT) return;
    const matchingSourceKeys = new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])]);
    if (
      todayPickerDraftItems.some((item: any, index: any) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      )
    ) {
      return;
    }
    setTodayPickerDraftItems([...todayPickerDraftItems, todayItemFromCandidate(candidate)]);
  };

  // V163-B7: one line of quick add inside the Picker. The wish is only a draft until 決定
  // (P10-10 §6.1: one save point); when Today3 has room it also joins the draft at once.
  const addTodayPickerQuickWish = () => {
    if (todayPickerSaving) return;
    const text = todayPickerQuickText.trim().slice(0, 120);
    if (!text) return;
    const current = configRef.current;
    if (!current) return;
    const projectId =
      todayPickerFilter !== "all" && todayPickerFilter !== "unassigned"
        ? todayPickerFilter
        : undefined;
    const wish: InboxItem = {
      id: createStableId(),
      text,
      ...(projectId ? { projectId } : {}),
      buttonIds: [],
    };
    const nextAdded = [...todayPickerAddedWishes, wish];
    setTodayPickerAddedWishes(nextAdded);
    setTodayPickerQuickText("");
    const candidate = buildTodayCandidates({
      ...current,
      inbox: [...current.inbox, ...nextAdded],
    }).find((entry: any) => entry.sourceKey === wishlistSourceKey(wish, 0));
    if (!candidate) return;
    const hasRoom = todayPickerDraftItems.length < TODAY_ITEM_LIMIT;
    if (!hasRoom) {
      showToast("warn", "今日の3件は3件埋まっています。候補に追加しました");
      return;
    }
    if (todayPickerCandidateSelected(candidate)) return;
    setTodayPickerDraftItems([...todayPickerDraftItems, todayItemFromCandidate(candidate)]);
  };

  const removeTodayPickerDraftItem = (index: number) => {
    if (todayPickerSaving) return;
    const draftItem = todayPickerDraftItems[index];
    if (
      draftItem &&
      timerRunsTodayItem(
        todayEntries(todayPickerDraftItems),
        activeTimerRef.current,
        todayTimerSourceId(draftItem, index),
        todaySourceKey(draftItem, index),
      )
    ) {
      showToast("warn", "タイマーを停止してから外してください");
      return;
    }
    setTodayPickerDraftItems(todayPickerDraftItems.filter((_: any, itemIndex: any) => itemIndex !== index));
  };

  const moveTodayPickerItem = (fromIndex: number, toIndex: number) => {
    if (todayPickerSaving) return;
    if (fromIndex === toIndex) return;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= todayPickerDraftItems.length ||
      toIndex >= todayPickerDraftItems.length
    ) {
      return;
    }
    const nextItems = [...todayPickerDraftItems];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    setTodayPickerDraftItems(nextItems);
    setTodayPickerDragIndex(null);
    announceReorder(moved.text || "未入力", toIndex + 1);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-today-picker-slot-index="${toIndex}"]`)
        ?.focus();
    });
  };

  const moveTodayPickerItemToIndex = (index: number) => {
    if (todayPickerDragIndex === null) return;
    moveTodayPickerItem(
      todayPickerDragIndex,
      Math.min(index, Math.max(0, todayPickerDraftItems.length - 1)),
    );
  };

  const startNextTodayBatch = async () => {
    if (!config || !(config && config.today.items.length > 0 && config.today.items.every((item: any) => item.done))) return;
    const saved = await persistConfig({
      ...config,
      today: { ...config.today, items: [], selectionMutationTokens: {} },
    });
    if (!saved) return;
    showToast("ok", "次の3件を選べます");
  };

  return {
    addTodayPickerQuickWish,
    updateVictoryText,
    clearVictoryAutoFocus,
    enterVictoryEditing,
    leaveVictoryEditing,
    applyVictorySuggestion,
    toggleVictoryDone,
    handleVictoryKeyDown,
    sourceSnapshotForUndo,
    undoTodaySelectionOperation,
    removeTodayItem,
    beginTodayTriggerEdit,
    cancelTodayTriggerEdit,
    commitTodayTriggerEdit,
    handleTodayTriggerKeyDown,
    scheduleNotesSave,
    flushHistoryNotesSave,
    updateHistoryNoteText,
    addCandidateToToday,
    todayItemFromCandidate,
    saveTodayPickerDraft,
    chooseTodayCandidate,
    removeTodayPickerDraftItem,
    moveTodayPickerItem,
    moveTodayPickerItemToIndex,
    startNextTodayBatch,
  };
}
