import { useCallback, type Dispatch, type PointerEvent, type SetStateAction } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from "@tauri-apps/plugin-autostart";
import {
  chooseInstructionRoot,
  createSoftwareResetBackup,
  loadConfig,
  loadShortcutRegistrationStatus,
  prepareSoftwareReset,
  reapplyDashboardSettings,
  restoreBackup,
  resumeDashboardShortcuts,
  saveConfig,
  selectBackupFolder,
  selectBackupZip,
  softwareReset,
  suspendDashboardShortcuts,
  updateInstructionReferences,
  type ShortcutRegistrationStatus,
  type TestProfileInfo,
} from "../tauri";
import { DEFAULT_EXTEND_TIMER_MINUTES } from "../constants";
import {
  NUMBER_INPUT_DRAG_PIXELS_PER_STEP,
  NUMBER_INPUT_DRAG_THRESHOLD_PX,
} from "../app/constants";
import { instructionPathKey, instructionPathWithin } from "../app/dropTargets";
import { normalizeTimerMinutes, validateShortcutSettings } from "../app/helpers";
import {
  SOFTWARE_RESET_TIMER_MESSAGE,
  captureSoftwareResetStorage,
  clearSoftwareResetStorage,
  restoreSoftwareResetStorage,
} from "../app/softwareReset";
import {
  INSTRUCTION_RELOAD_TREE_EVENT,
  resetInstructionWindowPosition,
} from "../instructionWindow";
import type { ConfirmDialogRequest } from "../components/ConfirmDialog";
import type {
  ActiveTimer,
  ActiveView,
  ButtonEditDraft,
  ContextMenuState,
  DropDialogState,
  ManualSessionDraft,
  NextStepEditDraft,
  NotesSaveStatus,
  NumberInputDrag,
  NumberInputDragField,
  ProjectEditDraft,
  SessionEditDraft,
  SettingsCenterDraft,
  SettingsSectionKey,
  ShortcutDraftField,
  TimerCompletionPrompt,
  ToastTone,
} from "../app/dashboardTypes";
import type { AppConfig, SoftwareResetStorageSnapshot } from "../types";

// V164-A5: the settings centre, the maintenance actions and the software reset, moved out of
// App.tsx. The body is the same code in the same order; every input arrives in one deps object.
// The effects that drive them stay in App.tsx, in their original order.

export type SettingsMaintenanceDeps = {
  actions: {
    persistConfig: (
      nextConfig: AppConfig,
      applySettingsAfterSave?: boolean,
      options?: { errorToastMessage?: string },
    ) => Promise<boolean>;
    refreshRecords: () => Promise<void>;
    refreshSessions: () => Promise<void>;
    refreshTodayActivity: () => Promise<void>;
    requestConfirmation: (request: ConfirmDialogRequest) => void;
    requestDiscardConfirmation: (onConfirm: () => void | boolean | Promise<void | boolean>) => void;
    saveDefaultTimerMinutes: (rawValue: string | number) => Promise<void>;
    showToast: (tone: ToastTone, message: string) => void;
  };
  refs: {
    activeTimerRef: { current: ActiveTimer | null };
    completionFollowupTimerRef: { current: number | null };
    completionPromptRef: { current: TimerCompletionPrompt | null };
    configRef: { current: AppConfig | null };
    configSaveBlockedRef: { current: boolean };
    confirmFocusReturnRef: { current: HTMLElement | null };
    earlyStopRef: {
      current: {
        timer: ActiveTimer;
        sourceKey: string;
        stoppedAt: number;
        recorded: boolean;
      } | null;
    };
    iconRefreshGenerationRef: { current: number };
    iconRequestIdsRef: { current: Map<string, number> };
    lastSettingsApplyErrorRef: { current: string | null };
    notesSaveTimersRef: { current: Map<string, number> };
    numberInputDragRef: { current: NumberInputDrag | null };
    resetInProgressRef: { current: boolean };
    shortcutCaptureActiveRef: { current: boolean };
    softwareResetChoiceOpenerRef: { current: HTMLElement | null };
    timerStartRequestRef: { current: number };
    writeGenerationRef: { current: number };
  };
  setters: {
    setActiveTimer: Dispatch<SetStateAction<ActiveTimer | null>>;
    setBackupPath: Dispatch<SetStateAction<string>>;
    setBanner: Dispatch<SetStateAction<string | null>>;
    setButtonEditDraft: Dispatch<SetStateAction<ButtonEditDraft | null>>;
    setButtonIconSources: Dispatch<SetStateAction<Record<string, string>>>;
    setCompletionExtendDraft: Dispatch<SetStateAction<string>>;
    setCompletionPrompt: Dispatch<SetStateAction<TimerCompletionPrompt | null>>;
    setConfig: Dispatch<SetStateAction<AppConfig | null>>;
    setConfigSaveBlocked: Dispatch<SetStateAction<boolean>>;
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
    setDefaultTimerDraft: Dispatch<SetStateAction<string>>;
    setDropDraft: Dispatch<SetStateAction<DropDialogState | null>>;
    setGroupDraft: Dispatch<SetStateAction<string | null>>;
    setGroupRenameDraft: Dispatch<SetStateAction<{ from: string; to: string } | null>>;
    setInstructionSettingsBusy: Dispatch<SetStateAction<boolean>>;
    setManualSessionDraft: Dispatch<SetStateAction<ManualSessionDraft | null>>;
    setMorningVictorySuggestion: Dispatch<SetStateAction<string | null>>;
    setNextStepEditDraft: Dispatch<SetStateAction<NextStepEditDraft | null>>;
    setNotesSaveStatus: Dispatch<SetStateAction<NotesSaveStatus>>;
    setNumberInputDragging: Dispatch<SetStateAction<NumberInputDragField | null>>;
    setProjectEditDraft: Dispatch<SetStateAction<ProjectEditDraft | null>>;
    setSessionEditDraft: Dispatch<SetStateAction<SessionEditDraft | null>>;
    setSettingsDraft: Dispatch<SetStateAction<SettingsCenterDraft | null>>;
    setSettingsSection: Dispatch<SetStateAction<SettingsSectionKey>>;
    setShortcutRecordingField: Dispatch<SetStateAction<ShortcutDraftField | null>>;
    setShortcutRegistration: Dispatch<SetStateAction<ShortcutRegistrationStatus | null>>;
    setSoftwareResetChoiceBusy: Dispatch<SetStateAction<boolean>>;
    setSoftwareResetChoiceOpen: Dispatch<SetStateAction<boolean>>;
    setSoftwareResetStage: Dispatch<SetStateAction<"idle" | "resetting" | "restart">>;
  };
  state: {
    activeView: ActiveView;
    config: AppConfig | null;
    nextStepEditDraft: NextStepEditDraft | null;
    settingsDraft: SettingsCenterDraft | null;
    shortcutRecordingField: ShortcutDraftField | null;
    softwareResetChoiceBusy: boolean;
    testProfile: TestProfileInfo | null;
  };
};

export function useSettingsAndMaintenance(deps: SettingsMaintenanceDeps) {
  const { actions, refs, setters, state } = deps;
  const {
    persistConfig,
    refreshRecords,
    refreshSessions,
    refreshTodayActivity,
    requestConfirmation,
    requestDiscardConfirmation,
    saveDefaultTimerMinutes,
    showToast,
  } = actions;
  const {
    activeTimerRef,
    completionFollowupTimerRef,
    completionPromptRef,
    configRef,
    configSaveBlockedRef,
    confirmFocusReturnRef,
    earlyStopRef,
    iconRefreshGenerationRef,
    iconRequestIdsRef,
    lastSettingsApplyErrorRef,
    notesSaveTimersRef,
    numberInputDragRef,
    resetInProgressRef,
    shortcutCaptureActiveRef,
    softwareResetChoiceOpenerRef,
    timerStartRequestRef,
    writeGenerationRef,
  } = refs;
  const {
    setActiveTimer,
    setBackupPath,
    setBanner,
    setButtonEditDraft,
    setButtonIconSources,
    setCompletionExtendDraft,
    setCompletionPrompt,
    setConfig,
    setConfigSaveBlocked,
    setContextMenu,
    setDefaultTimerDraft,
    setDropDraft,
    setGroupDraft,
    setGroupRenameDraft,
    setInstructionSettingsBusy,
    setManualSessionDraft,
    setMorningVictorySuggestion,
    setNextStepEditDraft,
    setNotesSaveStatus,
    setNumberInputDragging,
    setProjectEditDraft,
    setSessionEditDraft,
    setSettingsDraft,
    setSettingsSection,
    setShortcutRecordingField,
    setShortcutRegistration,
    setSoftwareResetChoiceBusy,
    setSoftwareResetChoiceOpen,
    setSoftwareResetStage,
  } = setters;
  const {
    activeView,
    config,
    nextStepEditDraft,
    settingsDraft,
    shortcutRecordingField,
    softwareResetChoiceBusy,
    testProfile,
  } = state;

  const finishShortcutRecording = useCallback(async () => {
    setShortcutRecordingField(null);
    if (!shortcutCaptureActiveRef.current) return;
    shortcutCaptureActiveRef.current = false;
    try {
      await resumeDashboardShortcuts();
    } catch (error) {
      showToast(
        "warn",
        `ショートカットを再登録できません: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }, [setShortcutRecordingField, shortcutCaptureActiveRef, showToast]);

  const beginShortcutRecording = async (field: ShortcutDraftField) => {
    if (shortcutCaptureActiveRef.current) {
      if (shortcutRecordingField === field) {
        await finishShortcutRecording();
        return;
      }
      setShortcutRecordingField(field);
      return;
    }
    try {
      await suspendDashboardShortcuts();
      shortcutCaptureActiveRef.current = true;
      setShortcutRecordingField(field);
    } catch (error) {
      showToast(
        "error",
        `ショートカット入力を開始できません: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const openSettingsCenter = () => {
    if (!config) return;
    if (shortcutCaptureActiveRef.current) {
      void finishShortcutRecording();
    } else {
      setShortcutRecordingField(null);
    }
    setSettingsSection("basic");
    setSettingsDraft({
      mainDisplaySize: config.settings.mainDisplaySize ?? "standard",
      defaultTimerMinutes: String(config.settings.defaultTimerMinutes),
      shortTimerMinutes: String(config.settings.shortTimerMinutes),
      extendTimerMinutes: String(
        config.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES,
      ),
      dayStartHour: String(config.settings.dayStartHour),
      focusHotkey: config.settings.focusHotkey ?? "",
      launcherHotkey: config.settings.launcherHotkey ?? "",
      miniHotkey: config.settings.miniHotkey ?? "",
      instructionHotkey: config.settings.instructionHotkey ?? "",
      instructionFolders: [...config.settings.instructionFolders],
      weeklyFocusProjectIds: config.projects
        .filter((project) => project.weeklyFocus === true)
        .map((project) => project.id),
      alwaysOnTop: config.settings.alwaysOnTop,
      autoStart: config.settings.autoStart,
      miniMode: config.settings.miniMode,
      restartShortFirst: config.settings.restartShortFirst ?? true,
      backupFolder: config.settings.backupFolder ?? "",
      backupKeep: String(config.settings.backupKeep ?? 30),
    });
  };

  const settingsHaveUnsavedChanges = Boolean(
    config &&
    settingsDraft &&
    (settingsDraft.mainDisplaySize !== (config.settings.mainDisplaySize ?? "standard") ||
      settingsDraft.defaultTimerMinutes !== String(config.settings.defaultTimerMinutes) ||
      settingsDraft.shortTimerMinutes !== String(config.settings.shortTimerMinutes) ||
      settingsDraft.extendTimerMinutes !==
        String(config.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES) ||
      settingsDraft.dayStartHour !== String(config.settings.dayStartHour) ||
      settingsDraft.focusHotkey !== (config.settings.focusHotkey ?? "") ||
      settingsDraft.launcherHotkey !== (config.settings.launcherHotkey ?? "") ||
      settingsDraft.miniHotkey !== (config.settings.miniHotkey ?? "") ||
      settingsDraft.instructionHotkey !== (config.settings.instructionHotkey ?? "") ||
      JSON.stringify(settingsDraft.instructionFolders) !==
        JSON.stringify(config.settings.instructionFolders) ||
      JSON.stringify(settingsDraft.weeklyFocusProjectIds) !==
        JSON.stringify(
          config.projects
            .filter((project) => project.weeklyFocus === true)
            .map((project) => project.id),
        ) ||
      settingsDraft.alwaysOnTop !== config.settings.alwaysOnTop ||
      settingsDraft.autoStart !== config.settings.autoStart ||
      settingsDraft.miniMode !== config.settings.miniMode ||
      settingsDraft.restartShortFirst !== (config.settings.restartShortFirst ?? true) ||
      settingsDraft.backupFolder !== (config.settings.backupFolder ?? "") ||
      settingsDraft.backupKeep !== String(config.settings.backupKeep ?? 30)),
  );

  const requestCloseSettings = useCallback(() => {
    if (settingsHaveUnsavedChanges) {
      requestDiscardConfirmation(() => setSettingsDraft(null));
      return;
    }
    setSettingsDraft(null);
  }, [requestDiscardConfirmation, setSettingsDraft, settingsHaveUnsavedChanges]);

  const setNumberDragValue = (field: NumberInputDragField, value: number) => {
    if (field === "timer") {
      setDefaultTimerDraft(String(value));
      return;
    }
    if (field === "completionExtend") {
      setCompletionExtendDraft(String(value));
      return;
    }
    if (field === "projectDefault" || field === "projectShort") {
      if (!nextStepEditDraft) return;
      setNextStepEditDraft({
        ...nextStepEditDraft,
        [field === "projectDefault" ? "defaultTimerMinutes" : "shortTimerMinutes"]: String(value),
      });
      return;
    }
    if (!settingsDraft) return;
    if (field === "settingsDefault") {
      setSettingsDraft({ ...settingsDraft, defaultTimerMinutes: String(value) });
    } else if (field === "settingsShort") {
      setSettingsDraft({ ...settingsDraft, shortTimerMinutes: String(value) });
    } else if (field === "settingsExtend") {
      setSettingsDraft({ ...settingsDraft, extendTimerMinutes: String(value) });
    } else {
      setSettingsDraft({ ...settingsDraft, dayStartHour: String(value) });
    }
  };

  const startNumberInputDrag = (
    event: PointerEvent<HTMLElement>,
    field: NumberInputDragField,
    value: number,
  ) => {
    if (event.button !== 0) return;
    window.getSelection()?.removeAllRanges();
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
    numberInputDragRef.current = {
      pointerId: event.pointerId,
      field,
      startY: event.clientY,
      startValue: value,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateNumberInputDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = numberInputDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.abs(event.clientY - drag.startY);
    if (!drag.moved && distance < NUMBER_INPUT_DRAG_THRESHOLD_PX) return;

    drag.moved = true;
    const max = drag.field === "settingsDayStart" ? 23 : 240;
    const min = drag.field === "settingsDayStart" ? 0 : 1;
    const value = Math.min(
      max,
      Math.max(
        min,
        drag.startValue +
          Math.round((drag.startY - event.clientY) / NUMBER_INPUT_DRAG_PIXELS_PER_STEP),
      ),
    );
    setNumberDragValue(drag.field, value);
    setNumberInputDragging(drag.field);
    event.preventDefault();
  };

  const finishNumberInputDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = numberInputDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    numberInputDragRef.current = null;
    setNumberInputDragging(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;

    // V163-C11: a drag that changed the number must not leave the focus (and its yellow ring)
    // behind. The click that follows this pointer-up puts the focus back into the field, so the
    // focus is dropped one task later. A plain press without moving keeps the focus, so the
    // number can still be typed.
    window.setTimeout(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest(".nextStepTimerStepper")) {
        focused.blur();
      }
    }, 0);

    const max = drag.field === "settingsDayStart" ? 23 : 240;
    const min = drag.field === "settingsDayStart" ? 0 : 1;
    const value = Math.min(
      max,
      Math.max(
        min,
        drag.startValue +
          Math.round((drag.startY - event.clientY) / NUMBER_INPUT_DRAG_PIXELS_PER_STEP),
      ),
    );
    if (drag.field === "timer") {
      void saveDefaultTimerMinutes(value);
    }
  };

  const cancelNumberInputDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = numberInputDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    numberInputDragRef.current = null;
    setNumberInputDragging(null);
  };

  const chooseBackupFolder = async () => {
    if (!settingsDraft) return;
    try {
      const selected = await selectBackupFolder();
      if (selected) {
        setSettingsDraft({ ...settingsDraft, backupFolder: selected });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `フォルダを選べません: ${message}`);
    }
  };

  const addInstructionFolder = async () => {
    if (!settingsDraft || settingsDraft.instructionFolders.length >= 5) return;
    setInstructionSettingsBusy(true);
    try {
      const selected = await chooseInstructionRoot();
      if (!selected) return;
      if (
        settingsDraft.instructionFolders.some(
          (folder) => instructionPathKey(folder) === instructionPathKey(selected.path),
        )
      ) {
        showToast("warn", "同じ手順書フォルダは重複して登録できません");
        return;
      }
      setSettingsDraft({
        ...settingsDraft,
        instructionFolders: [...settingsDraft.instructionFolders, selected.path],
      });
    } catch (error) {
      showToast(
        "error",
        `手順書フォルダを追加できません: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setInstructionSettingsBusy(false);
    }
  };

  const removeInstructionFolder = (path: string) => {
    if (!config || !settingsDraft) return;
    const savedRoot = config.settings.instructionFolders.some(
      (folder) => instructionPathKey(folder) === instructionPathKey(path),
    );
    const projectNames = config.projects
      .filter(
        (project) =>
          project.nextStep?.instructionPath &&
          instructionPathWithin(project.nextStep.instructionPath, path),
      )
      .map((project) => project.name);
    requestConfirmation({
      title: "手順書フォルダの登録を解除しますか？",
      subject: path,
      message:
        projectNames.length > 0
          ? `実フォルダは削除しません。次のプロジェクトとの紐付けを解除します: ${projectNames.join("、")}`
          : "実フォルダや手順書ファイルは削除しません。Life Launcherからの登録だけを解除します。",
      confirmLabel: "登録を解除",
      processingLabel: "解除しています…",
      tone: "warning",
      onConfirm: async () => {
        setInstructionSettingsBusy(true);
        try {
          if (savedRoot) {
            await updateInstructionReferences(path, null, true);
            const response = await loadConfig();
            configSaveBlockedRef.current = response.saveBlocked;
            setConfigSaveBlocked(response.saveBlocked);
            setConfig(response.config);
          }
          setSettingsDraft((current) =>
            current
              ? {
                  ...current,
                  instructionFolders: current.instructionFolders.filter(
                    (folder) => instructionPathKey(folder) !== instructionPathKey(path),
                  ),
                }
              : current,
          );
          await emit(INSTRUCTION_RELOAD_TREE_EVENT);
          showToast("neutral", "手順書フォルダの登録を解除しました");
          return true;
        } catch (error) {
          throw new Error(
            `登録を解除できません: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        } finally {
          setInstructionSettingsBusy(false);
        }
      },
    });
  };

  const reloadInstructionList = async () => {
    await emit(INSTRUCTION_RELOAD_TREE_EVENT);
    showToast("ok", "手順書一覧を再読み込みしました");
  };

  const requestInstructionWindowPositionReset = () => {
    requestConfirmation({
      title: "手順書ウィンドウ位置をリセットしますか？",
      message: "手順書ウィンドウを標準サイズでメインディスプレイ中央へ戻します。",
      confirmLabel: "リセットする",
      processingLabel: "リセットしています…",
      tone: "warning",
      onConfirm: async () => {
        await resetInstructionWindowPosition();
        showToast("ok", "手順書ウィンドウ位置をリセットしました");
        return true;
      },
    });
  };

  const softwareResetIsTimerBlocked = useCallback(
    () => Boolean(activeTimerRef.current || completionPromptRef.current || earlyStopRef.current),
    [activeTimerRef, completionPromptRef, earlyStopRef],
  );

  const rejectSoftwareResetForTimer = useCallback(() => {
    if (!softwareResetIsTimerBlocked()) return false;
    showToast("warn", SOFTWARE_RESET_TIMER_MESSAGE);
    return true;
  }, [showToast, softwareResetIsTimerBlocked]);

  const freezeFrontendForSoftwareReset = useCallback(() => {
    resetInProgressRef.current = true;
    writeGenerationRef.current += 1;
    timerStartRequestRef.current += 1;
    notesSaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    notesSaveTimersRef.current.clear();
    if (completionFollowupTimerRef.current !== null) {
      window.clearTimeout(completionFollowupTimerRef.current);
      completionFollowupTimerRef.current = null;
    }
    setNotesSaveStatus("saved");
    setShortcutRecordingField(null);
    setSettingsDraft(null);
    setManualSessionDraft(null);
    setSessionEditDraft(null);
    setButtonEditDraft(null);
    setProjectEditDraft(null);
    setNextStepEditDraft(null);
    setDropDraft(null);
    setGroupDraft(null);
    setGroupRenameDraft(null);
    setContextMenu(null);
  }, [
    completionFollowupTimerRef,
    notesSaveTimersRef,
    resetInProgressRef,
    setButtonEditDraft,
    setContextMenu,
    setDropDraft,
    setGroupDraft,
    setGroupRenameDraft,
    setManualSessionDraft,
    setNextStepEditDraft,
    setNotesSaveStatus,
    setProjectEditDraft,
    setSessionEditDraft,
    setSettingsDraft,
    setShortcutRecordingField,
    timerStartRequestRef,
    writeGenerationRef,
  ]);

  const executeSoftwareReset = useCallback(async () => {
    if (resetInProgressRef.current) return false;
    if (rejectSoftwareResetForTimer()) return true;

    let localStorageSnapshot: SoftwareResetStorageSnapshot;
    try {
      localStorageSnapshot = captureSoftwareResetStorage();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `ソフトウェアリセットを準備できません: ${message}`);
      return false;
    }
    resetInProgressRef.current = true;
    freezeFrontendForSoftwareReset();
    setSoftwareResetStage("resetting");

    try {
      await prepareSoftwareReset();
      clearSoftwareResetStorage();
      const response = await softwareReset({
        localStorageSnapshot,
        localStorageCleared: true,
      });
      if (!response?.restartRequested) {
        throw new Error("アプリの再起動を開始できませんでした");
      }
      setSoftwareResetStage("restart");
      return true;
    } catch (error) {
      let storageRollbackError: unknown = null;
      try {
        restoreSoftwareResetStorage(localStorageSnapshot);
      } catch (rollbackError) {
        storageRollbackError = rollbackError;
      }
      resetInProgressRef.current = false;
      writeGenerationRef.current += 1;
      setSoftwareResetStage("idle");
      const message = error instanceof Error ? error.message : String(error);
      const rollbackDetail = storageRollbackError
        ? ` localStorageも復元できません: ${
            storageRollbackError instanceof Error
              ? storageRollbackError.message
              : String(storageRollbackError)
          }`
        : "";
      showToast("error", `ソフトウェアリセットに失敗しました: ${message}${rollbackDetail}`);
      return false;
    }
  }, [
    freezeFrontendForSoftwareReset,
    rejectSoftwareResetForTimer,
    resetInProgressRef,
    setSoftwareResetStage,
    showToast,
    writeGenerationRef,
  ]);

  const requestFinalSoftwareResetConfirmation = useCallback(() => {
    confirmFocusReturnRef.current = softwareResetChoiceOpenerRef.current;
    requestConfirmation({
      title: "ソフトウェアリセットを実行しますか？",
      message:
        "Life Launcherのデータと設定を初回起動時の状態へ戻します。\n\nこの操作はアプリ内からは取り消せません。",
      confirmLabel: "ソフトウェアリセット",
      processingLabel: "リセットしています…",
      tone: "danger",
      initialFocus: "cancel",
      closeOnBackdrop: true,
      onConfirm: executeSoftwareReset,
    });
  }, [
    confirmFocusReturnRef,
    executeSoftwareReset,
    requestConfirmation,
    softwareResetChoiceOpenerRef,
  ]);

  const closeSoftwareResetChoice = useCallback(
    (restoreFocus = true) => {
      setSoftwareResetChoiceOpen(false);
      if (restoreFocus) {
        window.requestAnimationFrame(() =>
          softwareResetChoiceOpenerRef.current?.focus({ preventScroll: true }),
        );
      }
    },
    [setSoftwareResetChoiceOpen, softwareResetChoiceOpenerRef],
  );

  const continueSoftwareReset = useCallback(
    async (createBackup: boolean) => {
      if (softwareResetChoiceBusy || rejectSoftwareResetForTimer()) {
        if (!softwareResetChoiceBusy) closeSoftwareResetChoice();
        return;
      }
      setSoftwareResetChoiceBusy(true);
      try {
        if (createBackup) {
          let backupFolder =
            settingsDraft?.backupFolder.trim() ||
            configRef.current?.settings.backupFolder?.trim() ||
            "";
          if (!backupFolder) {
            const selected = await selectBackupFolder();
            if (!selected) {
              showToast("warn", "バックアップ保存先を選択してください");
              return;
            }
            backupFolder = selected;
          }

          const current = configRef.current;
          if (!current) throw new Error("現在の設定を確認できませんでした");
          if ((current.settings.backupFolder ?? "") !== backupFolder) {
            const saved = await persistConfig({
              ...current,
              settings: {
                ...current.settings,
                backupFolder,
              },
            });
            if (!saved) throw new Error("バックアップ保存先を保存できませんでした");
            setSettingsDraft((draft) => (draft ? { ...draft, backupFolder } : draft));
          }

          const backup = await createSoftwareResetBackup();
          if (!backup?.path) throw new Error("バックアップ先を確認できませんでした");
        }
        softwareResetChoiceOpenerRef.current?.focus({ preventScroll: true });
        closeSoftwareResetChoice(false);
        requestFinalSoftwareResetConfirmation();
      } catch (error) {
        closeSoftwareResetChoice();
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `リセット前のバックアップに失敗しました: ${message}`);
      } finally {
        setSoftwareResetChoiceBusy(false);
      }
    },
    [
      configRef,
      closeSoftwareResetChoice,
      persistConfig,
      rejectSoftwareResetForTimer,
      requestFinalSoftwareResetConfirmation,
      setSettingsDraft,
      setSoftwareResetChoiceBusy,
      settingsDraft?.backupFolder,
      showToast,
      softwareResetChoiceBusy,
      softwareResetChoiceOpenerRef,
    ],
  );

  const requestSoftwareReset = useCallback(() => {
    if (rejectSoftwareResetForTimer()) return;
    softwareResetChoiceOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSoftwareResetChoiceBusy(false);
    setSoftwareResetChoiceOpen(true);
  }, [
    rejectSoftwareResetForTimer,
    setSoftwareResetChoiceBusy,
    setSoftwareResetChoiceOpen,
    softwareResetChoiceOpenerRef,
  ]);

  const requestClearBackupFolder = () => {
    if (!settingsDraft?.backupFolder) return;
    requestConfirmation({
      title: "バックアップ保存先を未設定にしますか？",
      subject: settingsDraft.backupFolder,
      message: "今後のバックアップは作成されません。保存済みのバックアップは削除されません。",
      confirmLabel: "未設定にする",
      cancelLabel: "設定を維持",
      tone: "danger",
      onConfirm: () => {
        setSettingsDraft((current) => (current ? { ...current, backupFolder: "" } : current));
      },
    });
  };

  const saveSettingsCenter = async () => {
    if (!config || !settingsDraft) return;
    const shortcutError = validateShortcutSettings(settingsDraft, config.settings);
    if (shortcutError) {
      showToast("warn", shortcutError);
      setSettingsSection("shortcuts");
      return;
    }
    const defaultTimerMinutes = normalizeTimerMinutes(
      Number.parseInt(settingsDraft.defaultTimerMinutes, 10),
    );
    const shortTimerMinutes = normalizeTimerMinutes(
      Number.parseInt(settingsDraft.shortTimerMinutes, 10),
    );
    const extendParsed = Number.parseInt(settingsDraft.extendTimerMinutes, 10);
    const extendTimerMinutes = normalizeTimerMinutes(
      Number.isFinite(extendParsed) && extendParsed > 0
        ? extendParsed
        : (config.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES),
    );
    const dayStartHour = Math.min(
      23,
      Math.max(0, Math.round(Number.parseInt(settingsDraft.dayStartHour, 10))),
    );
    const keep = Number.parseInt(settingsDraft.backupKeep, 10);
    const backupKeep = Number.isFinite(keep) && keep > 0 ? keep : 30;
    const hotkeysChanged =
      (settingsDraft.focusHotkey.trim() || null) !== (config.settings.focusHotkey ?? null) ||
      (settingsDraft.launcherHotkey.trim() || null) !== (config.settings.launcherHotkey ?? null) ||
      (settingsDraft.miniHotkey.trim() || null) !== (config.settings.miniHotkey ?? null) ||
      (settingsDraft.instructionHotkey.trim() || null) !==
        (config.settings.instructionHotkey ?? null);
    const alwaysOnTopChanged = settingsDraft.alwaysOnTop !== config.settings.alwaysOnTop;

    try {
      // テスト用の起動では、普段のアプリの自動起動の登録を書き換えない。
      if (!testProfile?.testProfile && settingsDraft.autoStart !== config.settings.autoStart) {
        if (settingsDraft.autoStart) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      }

      const previousConfig = config;
      const weeklyFocusIds = new Set(settingsDraft.weeklyFocusProjectIds);
      const saved = await persistConfig(
        {
          ...config,
          projects: config.projects.map((project) => {
            if (weeklyFocusIds.has(project.id)) {
              return { ...project, weeklyFocus: true };
            }
            if (project.weeklyFocus === undefined) return project;
            const nextProject = { ...project };
            delete nextProject.weeklyFocus;
            return nextProject;
          }),
          settings: {
            ...config.settings,
            mainDisplaySize: settingsDraft.mainDisplaySize,
            defaultTimerMinutes,
            shortTimerMinutes,
            extendTimerMinutes,
            dayStartHour: Number.isFinite(dayStartHour)
              ? dayStartHour
              : config.settings.dayStartHour,
            focusHotkey: settingsDraft.focusHotkey.trim() || null,
            launcherHotkey: settingsDraft.launcherHotkey.trim() || null,
            miniHotkey: settingsDraft.miniHotkey.trim() || null,
            instructionHotkey: settingsDraft.instructionHotkey.trim() || null,
            instructionFolders: settingsDraft.instructionFolders,
            alwaysOnTop: settingsDraft.alwaysOnTop,
            autoStart: settingsDraft.autoStart,
            miniMode: settingsDraft.miniMode,
            restartShortFirst: settingsDraft.restartShortFirst,
            backupFolder: settingsDraft.backupFolder.trim() || null,
            backupKeep,
          },
        },
        hotkeysChanged,
      );
      if (!saved) {
        try {
          const restored = await saveConfig(previousConfig);
          setConfig(restored.config);
          await reapplyDashboardSettings();
          setShortcutRegistration(await loadShortcutRegistrationStatus().catch(() => null));
          setBanner(null);
          showToast("warn", "設定を反映できなかったため、以前の設定を維持しました");
        } catch (rollbackError) {
          showToast(
            "error",
            `以前の設定へ戻せません: ${
              rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
            }`,
          );
        }
        return;
      }
      let windowWarning: string | null = null;
      if (alwaysOnTopChanged && !hotkeysChanged) {
        try {
          await getCurrentWindow().setAlwaysOnTop(settingsDraft.alwaysOnTop);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          windowWarning = `保存しましたが、最前面表示を反映できません: ${message}`;
          setBanner(windowWarning);
        }
      }
      setDefaultTimerDraft(String(defaultTimerMinutes));
      await emit(INSTRUCTION_RELOAD_TREE_EVENT);
      setSettingsDraft(null);
      showToast(windowWarning ? "warn" : "ok", windowWarning ?? "設定を保存しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `設定を保存できません: ${message}`);
    }
  };

  const chooseBackupZipForRestore = async () => {
    try {
      const selected = await selectBackupZip();
      if (selected) {
        requestConfirmation({
          title: "バックアップから復元しますか？",
          subject: selected,
          message: "現在のデータは復元前に退避され、選択したZIPの内容で上書きされます。",
          confirmLabel: "復元する",
          processingLabel: "復元しています…",
          tone: "warning",
          onConfirm: () => confirmBackupRestore(selected),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `バックアップZIPを選べません: ${message}`);
    }
  };

  const confirmBackupRestore = async (zipPath: string) => {
    let shortcutsSuspended = false;
    let response: Awaited<ReturnType<typeof restoreBackup>>;
    try {
      await suspendDashboardShortcuts();
      shortcutsSuspended = true;
      response = await restoreBackup(zipPath);
    } catch (error) {
      if (shortcutsSuspended) {
        await resumeDashboardShortcuts().catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `復元できません: ${message}`);
      return false;
    }

    configSaveBlockedRef.current = response.saveBlocked;
    setConfigSaveBlocked(response.saveBlocked);
    iconRefreshGenerationRef.current += 1;
    iconRequestIdsRef.current.clear();
    setButtonIconSources({});
    setConfig(response.config);
    setMorningVictorySuggestion(response.morningVictorySuggestion ?? null);
    setBackupPath(response.backupPath);
    setBanner(response.error ?? null);
    setActiveTimer(null);
    setCompletionPrompt(null);

    let settingsWarning: string | null = null;
    try {
      await reapplyDashboardSettings();
      lastSettingsApplyErrorRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastSettingsApplyErrorRef.current = message;
      settingsWarning = `ショートカットを登録できません: ${message}`;
    }

    let refreshWarning: string | null = null;
    try {
      await refreshSessions();
      await refreshTodayActivity();
      if (activeView === "records") {
        await refreshRecords();
      }
    } catch (error) {
      refreshWarning = `表示を更新できません: ${error instanceof Error ? error.message : String(error)}`;
    }

    setSettingsDraft(null);
    const warnings = [settingsWarning, refreshWarning].filter(
      (warning): warning is string => warning !== null,
    );
    if (warnings.length > 0) {
      showToast("warn", `バックアップから復元しましたが、${warnings.join(" / ")}`);
    } else {
      showToast("ok", "バックアップから復元しました");
    }
    return true;
  };

  return {
    addInstructionFolder,
    beginShortcutRecording,
    cancelNumberInputDrag,
    chooseBackupFolder,
    chooseBackupZipForRestore,
    closeSoftwareResetChoice,
    continueSoftwareReset,
    finishNumberInputDrag,
    finishShortcutRecording,
    openSettingsCenter,
    reloadInstructionList,
    removeInstructionFolder,
    requestClearBackupFolder,
    requestCloseSettings,
    requestInstructionWindowPositionReset,
    requestSoftwareReset,
    saveSettingsCenter,
    startNumberInputDrag,
    updateNumberInputDrag,
  };
}
