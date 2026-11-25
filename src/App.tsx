import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  getCurrentWindow,
} from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from "@tauri-apps/plugin-autostart";
import type {
  KeyboardEvent,
} from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";import { AnimatePresence, motion } from "motion/react";
import { springSnappy } from "./motion";
import { nextStepStaleDays } from "./nextStepFreshness";
import {
  DEFAULT_EXTEND_TIMER_MINUTES,
  TIMER_TICK_MS,
  TODAY_ITEM_LIMIT,
} from "./constants";
import {
  acknowledgeSoftwareResetRecovery,
  deleteButtonIconCache,
  ensureButtonIconCache,
  executeActions,
  focusDashboardWindow,
  listenForConfigChanges,
  loadConfig,
  loadMissingLaunchTargets,
  loadShortcutRegistrationStatus,
  loadDoNowCandidates,
  loadNotesHistory,
  loadNextStepFreshness,
  loadNextStepSuggestions,
  loadSessionEntries,
  loadSessionSummary,
  loadTodaySessionTotal,
  loadWeeklyReview,
  openConfigBackups,
  openDataFolder,
  reapplyDashboardSettings,
  revealLauncherItem,
  recordSession,
  notifyDictionaryConfigChanged,
  saveConfig,
  saveNotesForDate,
  setDisplayAwake,
  loadInstructionBookState,
  undoTodaySelection,
  loadTestProfileInfo,
  type ShortcutRegistrationStatus,
  type TestProfileInfo,
} from "./tauri";
import {
  AppConfig,
  DoNowResponse,
  InboxItem,
  LauncherAction,
  LauncherButton,
  LauncherNextStep,
  LauncherProject,
  MiniWindowPosition,
  NotesHistoryResponse,
  SessionEntriesResponse,
  SessionEntryRow,
  SessionSummaryResponse,
  WeeklyReviewResponse,
  TodayItem,
} from "./types";
import { ConfirmDialog, type ConfirmDialogRequest } from "./components/ConfirmDialog";
import { TopBar } from "./components/TopBar";
import { MainHeaderVictoryBand } from "./components/MainHeaderVictoryBand";
import { CompletionNextStepDialog } from "./components/CompletionNextStepDialog";
import { SidebarQuickLaunch } from "./components/SidebarQuickLaunch";
import { DoNowBand } from "./components/DoNowBand";
import { TodayThreeSection } from "./components/TodayThreeSection";
import { NextStepsSection } from "./components/NextStepsSection";
import { WishlistSection } from "./components/WishlistSection";
import { DashboardContextMenu } from "./components/DashboardContextMenu";
import { ExitPresence } from "./components/ExitPresence";
import { GroupNameDialog } from "./components/GroupNameDialog";
import { ImportDialog } from "./components/ImportDialog";
import { InboxAddDialog } from "./components/InboxAddDialog";
import { CompletionFollowupDialog } from "./components/CompletionFollowupDialog";
import { NextStepEditDialog } from "./components/NextStepEditDialog";
import { ButtonEditDialog } from "./components/ButtonEditDialog";
import { DropRegisterDialog } from "./components/DropRegisterDialog";
import { InboxEditDialog } from "./components/InboxEditDialog";
import { ProjectEditDialog } from "./components/ProjectEditDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { TodayPickerDialog } from "./components/TodayPickerDialog";
import { ManualSessionDialog, SessionEditDialog } from "./components/SessionDialogs";
import {
  SoftwareResetChoiceDialog,
  SoftwareResetProgressDialog,
} from "./components/SoftwareResetDialogs";
import { TodayActivitySection } from "./components/TodayActivitySection";
import { ToastStack } from "./components/ToastStack";
import { useToasts } from "./hooks/useToasts";
import { useSearchPalette } from "./hooks/useSearchPalette";
import { useLauncherButtons } from "./hooks/useLauncherButtons";
import { useDashboardDragAndDrop } from "./hooks/useDashboardDragAndDrop";
import { useSettingsAndMaintenance } from "./hooks/useSettingsAndMaintenance";
import { FirstRunBand } from "./components/FirstRunBand";
import { IMPORT_PROMPT_FIRST } from "./content/importPrompt";
import { earlyCompletionItem } from "./earlyCompletion";
import { WindowControls } from "./components/WindowControls";
import {
  findTodayEntryForTimer,
  sameSourceGeneration,
  timerMatchesProjectNextStep,
  timerRunsTodayItem,
} from "./timerSource";
import { HelpGuideDialog } from "./components/HelpGuideDialog";
import { SearchPalette } from "./components/SearchPalette";
import { ProjectIdentity } from "./components/ProjectIdentity";
import { RecordsView } from "./RecordsView";
import {
  canonicalSourceKey,
  timerSourceKey,
} from "./sourceEdit";
import {
  completeTodayItemAndPrepareSource,
  completeWishlistAfterToday,
  type TodayCompletionSource,
} from "./completionFollowup";
import {
  buttonGlyph,
  resolveProjectColorId,
} from "./projectIdentity";
import {
  groupWishlist,
  groupWishlistForDisplay,
  wishlistGroupKey,
} from "./nextStepWishlist";
import { ExpandedTimerOverlay } from "./components/ExpandedTimerOverlay";
import {
  buildTodayCandidates,
  wishlistSourceKey,
  type TodayCandidate,
} from "./todayCandidates";
import {
  plannedEndAtMs,
  SESSION_MINIMUM_MINUTES,
  sessionMinutes,
  timerMetrics,
  type TimerMode,
} from "./timerRuntime";
import { findShortcutConflicts } from "./shortcutConflicts";
import { localDayKey } from "./localDay";
import { useTopMenuLabelLevel } from "./topMenuLabels";
import { useHoverSuppressionAfterResize } from "./hoverSuppression";
import { installSettingsFieldEditing, navigateAppArrow } from "./keyboardNavigation";
import {
} from "./overlayPages";
import {
  INSTRUCTION_BOOK_STATE_CHANGED_EVENT,
  INSTRUCTION_WINDOW_SHOW_EVENT,
  openInstructionWindow,
  readLastInstructionPath,
  type InstructionWindowOpenOptions,
} from "./instructionWindow";
import { isInstructionBookName } from "./instructionBook";
import {
  DICTIONARY_LOCK_EVENT,
  DICTIONARY_VISIBILITY_EVENT,
  focusDictionaryWindowIfVisible,
  openDictionaryWindow,
  toggleDictionaryWindow,
} from "./dictionaryWindow";
import { MINI_READY_EVENT, MINI_RETURN_EVENT, MINI_TIMER_COMMAND_EVENT, MINI_TIMER_SNAPSHOT_EVENT, MINI_WINDOW_HEIGHT_PX, MINI_WINDOW_LABEL, MINI_WINDOW_WIDTH_PX, PROJECT_CARD_COMPACT_LIMIT, SOURCE_LIST_COMPACT_LIMIT, SOURCE_LIST_PAGE_SIZE, SOURCE_LIST_PAGINATION_THRESHOLD } from "./app/constants";
import { type ActiveTimer, type ActiveView, type ButtonEditDraft, type ButtonGroup, type CompletionFeedback, type CompletionFollowup, type ContextMenuState, type ContextMenuTarget, type DoNowCompletionHold, type DropDialogState, type InboxDragPreview, type InboxPointerDrag, type InstructionChoice, type ManualSessionDraft, type MiniTimerCommand, type MiniTimerSnapshot, type NextStepEditDraft, type NotesSaveStatus, type NumberInputDrag, type NumberInputDragField, type ProjectDragPreview, type ProjectEditDraft, type ProjectPointerDrag, type RecordsDateScope, SHORTCUT_DRAFT_FIELDS, type SessionEditDraft, type SettingsCenterDraft, type SettingsSectionKey, type ShortcutDraftField, type SidebarDragPreview, type SidebarGroupDragPreview, type SidebarGroupPointerDrag, type SidebarPointerDrag, TOP_MENU_LABELS, type TimerCompletionPrompt, type TodayDragPreview, type TodayPointerDrag, type WishlistGroupDragPreview, type WishlistGroupPointerDrag, type WishlistGroupView } from "./app/dashboardTypes";
import { MiniModeApp } from "./components/MiniModeApp";
import { getSoftwareResetRecoveryForBoot, restoreSoftwareResetStorage } from "./app/softwareReset";
import { buttonGroupName, buttonHasIconCacheSource, createStableId, formatActionSummary, formatClock, formatDateKeyForHeader, formatStartedAt, iconForAction, isCloseShortcutValue, isEditableTarget, limitToday, makeAction, matchesHotkey, normalizeTimerMinutes, readCollapsedGroups, shortcutFromKeyboardEvent, showButtonInOverlay, showButtonInSidebar, toThreeNoteDraft, todayEntries, todaySourceKey, todayTimerSourceId, uniqueGroupNames, uniqueSuggestions, writeCollapsedGroups } from "./app/helpers";
import { clearMiniPosition, createMiniReadyWaiter, inactiveMiniSnapshot, isDictionaryView, isFiniteMiniPosition, isInstructionView, isMiniModeView, readMiniPosition, resolveSafeMiniPosition, sameMiniPosition, timerActionText, waitForMiniWindowCreated, writeMiniPosition } from "./app/miniWindow";
import { notifyTimerComplete } from "./app/dropTargets";
import { useWishlistAndSources } from "./hooks/useWishlistAndSources";
import { useProjectsAndNextSteps } from "./hooks/useProjectsAndNextSteps";
import { useSessionLogs } from "./hooks/useSessionLogs";
import { shouldSkipFocusRestore } from "./app/focusRestore";

const InstructionViewer = lazy(() =>
  import("./components/InstructionViewer").then((module) => ({
    default: module.InstructionViewer,
  })),
);

const DictionaryWindow = lazy(() =>
  import("./components/DictionaryWindow").then((module) => ({
    default: module.DictionaryWindow,
  })),
);
export default function App() {
  if (isMiniModeView()) return <MiniModeApp />;
  if (isDictionaryView()) {
    return (
      <Suspense fallback={<main className="dictionaryWindowLoading">辞書を準備しています</main>}>
        <DictionaryWindow />
      </Suspense>
    );
  }
  if (isInstructionView()) {
    return (
      <Suspense fallback={<main className="instructionLoading">手順書を準備しています</main>}>
        <InstructionViewer />
      </Suspense>
    );
  }
  return <DashboardApp />;
}

function DashboardApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [shortcutRegistration, setShortcutRegistration] = useState<ShortcutRegistrationStatus | null>(null);
  const configRef = useRef<AppConfig | null>(null);

  const [projectNextStepSuggestions, setProjectNextStepSuggestions] = useState<string[]>([]);
  const [projectEditDraft, setProjectEditDraft] = useState<ProjectEditDraft | null>(null);
  const [projectEditSaving, setProjectEditSaving] = useState(false);
  const [nextStepEditDraft, setNextStepEditDraft] = useState<NextStepEditDraft | null>(null);
  const [nextStepOpenMenuOpen, setNextStepOpenMenuOpen] = useState(false);
  const [nextStepOpenPicker, setNextStepOpenPicker] = useState<"buttons" | "instructions" | null>(
    null,
  );
  const [instructionChoices, setInstructionChoices] = useState<InstructionChoice[]>([]);
  const [instructionChoicesLoading, setInstructionChoicesLoading] = useState(false);
  const [instructionChoicesError, setInstructionChoicesError] = useState<string | null>(null);
  const [instructionSettingsBusy, setInstructionSettingsBusy] = useState(false);
  const projectEditSavingRef = useRef(false);
  const projectEditInitialDraftRef = useRef<ProjectEditDraft | null>(null);
  const nextStepEditInitialDraftRef = useRef<NextStepEditDraft | null>(null);
  const projectEditReturnFocusRef = useRef<HTMLElement | null>(null);
  const nextStepEditReturnFocusRef = useRef<HTMLElement | null>(null);
  configRef.current = config;
  const [backupPath, setBackupPath] = useState("");
  const [todaySessionMinutes, setTodaySessionMinutes] = useState(0);
  const [todaySessionDate, setTodaySessionDate] = useState("");
  const [observedDayKey, setObservedDayKey] = useState("");
  const lastDayRefreshRef = useRef("");
  const [morningVictorySuggestion, setMorningVictorySuggestion] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dictionaryVisible, setDictionaryVisible] = useState(false);
  // V163-C4: while the dictionary keeps the main screen locked (範囲外クリックで閉じる: オフ).
  const [dictionaryLocked, setDictionaryLocked] = useState(false);
  // P10-03: the search window (D4).
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const searchOpenerRef = useRef<HTMLElement | null>(null);
  const openSearchRef = useRef<() => void>(() => {});
  const doNowInitialCopyKeyRef = useRef<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const { toasts, showToast, dismissToast, pauseToast, runToastAction } = useToasts();
  const [todayTriggerEditingIndex, setTodayTriggerEditingIndex] = useState<number | null>(null);
  const [todayTriggerDraft, setTodayTriggerDraft] = useState("");
  // テスト用の起動（普段のデータから切り離した起動）かどうか。
  // 自動起動の登録を呼ばないことと、「テスト」の表示に使う。
  const [testProfile, setTestProfile] = useState<TestProfileInfo | null>(null);
  useEffect(() => {
    void loadTestProfileInfo()
      .then(setTestProfile)
      .catch(() => undefined);
  }, []);
  // P97-02 F: 窓の大きさが変わった直後は、マウスが動くまで乗せた色を出さない。
  useHoverSuppressionAfterResize();
  // 上部メニューの文字は、幅の決まった境目ではなく実測で隠す(P96-01 追加修正)。
  // 段階はメイン画面の見出し(「今日 N分」＋日付)の幅で決め、記録画面も同じ段階にする
  // (オーナー決定 2026-11-06)。表示切替のボタンだけは画面で文字が変わるため、
  // 長い方の文字で測って2つの画面の数値をそろえる。
  // config の読み込み前は行が無いので、読み込み後に測り直すため measureKey に含める。
  const topMenuDayKey = observedDayKey || config?.today.date || "";
  const topMenuMinutes = todaySessionDate === topMenuDayKey ? todaySessionMinutes : 0;
  const {
    barRef: topMenuBarRef,
    pillsRef: topMenuPillsRef,
    level: measuredMenuLabelLevel,
  } = useTopMenuLabelLevel({
    measureKey: config ? (config.settings.mainDisplaySize ?? "standard") : "loading",
    summaryTitle: `今日 ${topMenuMinutes}分`,
    summaryDate: topMenuDayKey ? formatDateKeyForHeader(topMenuDayKey) : "",
    toggleLabel:
      TOP_MENU_LABELS.records.length >= TOP_MENU_LABELS.dashboard.length
        ? TOP_MENU_LABELS.records
        : TOP_MENU_LABELS.dashboard,
  });
  // P10-14e (10): the wider top row keeps all three labels from 1000px, hides the
  // two secondary labels down to 900px, and hides all three below that.
  const [wideMenuLabelLevel, setWideMenuLabelLevel] = useState(0);
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setWideMenuLabelLevel(width < 900 ? 2 : width < 1000 ? 1 : 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const topMenuLabelLevel = Math.max(measuredMenuLabelLevel, wideMenuLabelLevel);

  useEffect(() => {
    const unlisten = listen<InstructionWindowOpenOptions>(
      INSTRUCTION_WINDOW_SHOW_EVENT,
      (event) => {
        void openInstructionWindow(event.payload).catch((error) => {
          console.error("[instruction-window] 手順書ウィンドウを開けません", error);
        });
      },
    );
    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    const unlisten = listen<boolean>(DICTIONARY_VISIBILITY_EVENT, (event) => {
      setDictionaryVisible(event.payload);
      // V163-C4: a hidden dictionary never keeps the main screen locked.
      if (!event.payload) setDictionaryLocked(false);
    });
    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    const unlisten = listen<boolean>(DICTIONARY_LOCK_EVENT, (event) => {
      setDictionaryLocked(Boolean(event.payload));
    });
    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);
  // V163-C4: while the lock is on, nothing under the scrim takes clicks or Tab stops.
  useEffect(() => {
    if (!dictionaryVisible || !dictionaryLocked) return;
    const shell = document.querySelector<HTMLElement>(".appShell");
    if (!shell) return;
    const children = Array.from(shell.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        !child.classList.contains("dictionaryMainScrim") &&
        child.tagName !== "A",
    );
    for (const child of children) child.setAttribute("inert", "");
    return () => {
      for (const child of children) child.removeAttribute("inert");
    };
  }, [dictionaryLocked, dictionaryVisible]);
  // V163-C4: while the lock is on, focusing the main window sends the focus back to the dictionary.
  useEffect(() => {
    if (!dictionaryVisible || !dictionaryLocked) return;
    let disposed = false;
    const unlistenPromise = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused || disposed) return;
      void focusDictionaryWindowIfVisible();
    });
    return () => {
      disposed = true;
      void unlistenPromise
        .then((unlisten) => {
          if (disposed) unlisten();
        })
        .catch(() => undefined);
    };
  }, [dictionaryLocked, dictionaryVisible]);
  const [defaultTimerDraft, setDefaultTimerDraft] = useState("");
  const [victoryEditing, setVictoryEditing] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [projectsListExpanded, setProjectsListExpanded] = useState(false);
  const [wishlistGroupViews, setWishlistGroupViews] = useState<Record<string, WishlistGroupView>>(
    {},
  );
  const [todayPickerOpen, setTodayPickerOpen] = useState(false);
  const [todayPickerDraftItems, setTodayPickerDraftItems] = useState<TodayItem[]>([]);
  const [todayPickerSaving, setTodayPickerSaving] = useState(false);
  // P10-14 (§6.1): guard the single save with a ref too, so two calls in one tick cannot pass.
  const todayPickerSavingRef = useRef(false);
  // P10-10 (§6.1): which draft slot is being dragged (HTML5 drag keeps it inside the Picker).
  const [todayPickerDragIndex, setTodayPickerDragIndex] = useState<number | null>(null);
  // V163-B7: the filter pills ("all" / a project id / "unassigned") reset on every open.
  const [todayPickerFilter, setTodayPickerFilter] = useState<string>("all");
  // V163-B7: wishes added in the Picker stay here until 決定 saves them with Today3 (one save point).
  const [todayPickerAddedWishes, setTodayPickerAddedWishes] = useState<InboxItem[]>([]);
  const [todayPickerQuickText, setTodayPickerQuickText] = useState("");
  const [todayActivityOpen, setTodayActivityOpen] = useState(false);
  const [, setNotesSaveStatus] = useState<NotesSaveStatus>("saved");
  const [buttonIconSources, setButtonIconSources] = useState<Record<string, string>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryResponse | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewResponse | null>(null);
  const [staleNextStepProjectIds, setStaleNextStepProjectIds] = useState<string[]>([]);
  const [missingButtonIds, setMissingButtonIds] = useState<Set<string>>(() => new Set());
  const [missingInstructionProjectIds, setMissingInstructionProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  // V160-B4: the remembered page of the ZIP used by the current Do Now step.
  const [doNowBookPage, setDoNowBookPage] = useState<number | null>(null);
  const missingTargetsRequestRef = useRef(0);
  const [nextStepReviewBusy, setNextStepReviewBusy] = useState<string | null>(null);
  const [doNowResponse, setDoNowResponse] = useState<DoNowResponse | null>(null);
  // The Project picked with "other step"; null shows the first candidate. Held by Project id so a
  // reordered candidate list never silently switches to another Project.
  const [doNowPickedProjectId, setDoNowPickedProjectId] = useState<string | null>(null);
  const [sessionEntries, setSessionEntries] = useState<SessionEntriesResponse | null>(null);
  const [recordsWeekSessions, setRecordsWeekSessions] = useState<SessionEntryRow[]>([]);
  const [recordsAllSessions, setRecordsAllSessions] = useState<SessionEntryRow[]>([]);
  const [todayActivityEntries, setTodayActivityEntries] = useState<SessionEntryRow[]>([]);
  const [todayActivityDate, setTodayActivityDate] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionProjectFilter, setSessionProjectFilter] = useState("");
  const [sessionDateScope, setSessionDateScope] = useState<RecordsDateScope>("week");
  const [notesHistory, setNotesHistory] = useState<NotesHistoryResponse | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [expandedTimerOpen, setExpandedTimerOpen] = useState(false);
  const expandTimerButtonRef = useRef<HTMLButtonElement | null>(null);
  const timerStartRequestRef = useRef(0);
  const activeTimerRef = useRef<ActiveTimer | null>(null);
  const finishActiveTimerRef = useRef<(timer: ActiveTimer) => void>(() => undefined);
  const finishingTimerRef = useRef<number | null>(null);
  const plannedCommitRef = useRef(false);
  const earlyStopRef = useRef<{
    timer: ActiveTimer;
    sourceKey: string;
    stoppedAt: number;
    recorded: boolean;
  } | null>(null);
  const [earlyStop, setEarlyStop] = useState<typeof earlyStopRef.current>(null);
  const [earlyStopSaving, setEarlyStopSaving] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState<TimerCompletionPrompt | null>(null);
  const [timerResumeDraft, setTimerResumeDraft] = useState("");
  // V163-B4: the 「続ける」 minutes, editable on the prompt; reset from settings each time it opens.
  const [completionExtendDraft, setCompletionExtendDraft] = useState(
    String(DEFAULT_EXTEND_TIMER_MINUTES),
  );
  const [completionResumeSaving, setCompletionResumeSaving] = useState(false);
  const completionResumeSavingRef = useRef(false);
  const [completionFeedback, setCompletionFeedback] = useState<CompletionFeedback | null>(null);
  const [doNowCompletionHold, setDoNowCompletionHold] = useState<DoNowCompletionHold | null>(null);
  const [doNowCompletionSaving, setDoNowCompletionSaving] = useState(false);
  const [doNowExcludedProjectId, setDoNowExcludedProjectId] = useState<string | null>(null);
  const [completionFollowup, setCompletionFollowup] = useState<CompletionFollowup | null>(null);
  // P10-09 (§8.1): which choice is selected in the completion dialog.
  const [completionFollowupChoice, setCompletionFollowupChoice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [collapsedGroups, setCollapsedGroups] =
    useState<Record<string, boolean>>(readCollapsedGroups);
  const [dropDraft, setDropDraft] = useState<DropDialogState | null>(null);
  const [builderKind, setBuilderKind] = useState<"file" | "folder" | "url" | null>(null);
  const [builderSource, setBuilderSource] = useState("");
  const [builderLabelTouched, setBuilderLabelTouched] = useState(false);
  const [builderModeDrafts, setBuilderModeDrafts] = useState<
    Partial<Record<"file" | "folder" | "url", { source: string; label: string; labelTouched: boolean }>>
  >({});
  const [builderBusy, setBuilderBusy] = useState(false);
  const [groupDraft, setGroupDraft] = useState<string | null>(null);
  const [groupRenameDraft, setGroupRenameDraft] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [, setOverlayPageDragId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsCenterDraft | null>(null);
  const [shortcutRecordingField, setShortcutRecordingField] = useState<ShortcutDraftField | null>(
    null,
  );
  const closeShortcutDisabled = useMemo(() => {
    if (shortcutRecordingField) return true;
    const settings = config?.settings;
    if (!settings) return false;
    return [
      settings.focusHotkey,
      settings.launcherHotkey,
      settings.miniHotkey,
      settings.instructionHotkey,
    ].some(isCloseShortcutValue);
  }, [config, shortcutRecordingField]);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) =>
      navigateAppArrow(event, shortcutCaptureActiveRef.current);
    document.addEventListener("keydown", onKeyDown);
    const removeSettingsFieldEditing = installSettingsFieldEditing();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      removeSettingsFieldEditing();
    };
  }, []);
  const [helpGuideOpen, setHelpGuideOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionKey>("basic");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogRequest | null>(null);
  const [softwareResetChoiceOpen, setSoftwareResetChoiceOpen] = useState(false);
  const [softwareResetChoiceBusy, setSoftwareResetChoiceBusy] = useState(false);
  const [softwareResetStage, setSoftwareResetStage] = useState<"idle" | "resetting" | "restart">(
    "idle",
  );
  const [manualSessionDraft, setManualSessionDraft] = useState<ManualSessionDraft | null>(null);
  const [sessionEditDraft, setSessionEditDraft] = useState<SessionEditDraft | null>(null);
  const [buttonEditDraft, setButtonEditDraft] = useState<ButtonEditDraft | null>(null);
  const [buttonEditInitialDraft, setButtonEditInitialDraft] = useState<ButtonEditDraft | null>(
    null,
  );
  const [dailyActivityCopying, setDailyActivityCopying] = useState(false);
  const [sidebarPointerDrag, setSidebarPointerDrag] = useState<SidebarDragPreview | null>(null);
  const [sidebarGroupPointerDrag, setSidebarGroupPointerDrag] =
    useState<SidebarGroupDragPreview | null>(null);
  const [todayPointerDrag, setTodayPointerDrag] = useState<TodayDragPreview | null>(null);
  const [projectPointerDrag, setProjectPointerDrag] = useState<ProjectDragPreview | null>(null);
  const [inboxPointerDrag, setInboxPointerDrag] = useState<InboxDragPreview | null>(null);
  const [wishlistGroupPointerDrag, setWishlistGroupPointerDrag] =
    useState<WishlistGroupDragPreview | null>(null);
  const [miniTransitioning, setMiniTransitioning] = useState(false);
  const [numberInputDragging, setNumberInputDragging] = useState<NumberInputDragField | null>(null);
  const [actionDragId, setActionDragId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [jsonDrop, setJsonDrop] = useState<"main" | "sidebar" | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState("");
  const [importInitialError, setImportInitialError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const sidebarPointerDragRef = useRef<SidebarPointerDrag | null>(null);
  const sidebarGroupPointerDragRef = useRef<SidebarGroupPointerDrag | null>(null);
  const todayPointerDragRef = useRef<TodayPointerDrag | null>(null);
  const projectPointerDragRef = useRef<ProjectPointerDrag | null>(null);
  const inboxPointerDragRef = useRef<InboxPointerDrag | null>(null);
  const wishlistGroupPointerDragRef = useRef<WishlistGroupPointerDrag | null>(null);
  const configSaveBlockedRef = useRef(false);
  // P10-11: the first-run guide must not appear while saves are blocked.
  const [configSaveBlocked, setConfigSaveBlocked] = useState(false);
  const resetInProgressRef = useRef(false);
  const writeGenerationRef = useRef(0);
  const softwareResetChoiceOpenerRef = useRef<HTMLElement | null>(null);
  const softwareResetProgressRef = useRef<HTMLElement | null>(null);
  const confirmDialogRef = useRef<ConfirmDialogRequest | null>(null);
  const importOpenerRef = useRef<HTMLElement | null>(null);
  const lastDropRef = useRef<{ signature: string; at: number } | null>(null);
  const dragPathsRef = useRef<string[]>([]);
  const todayPickerOpenerRef = useRef<HTMLElement | null>(null);
  const todayPickerInitialItemsRef = useRef<TodayItem[]>([]);
  // P10-11 (§8.2): the IDs for the first-run guide are created once per guide.
  const firstRunIdsRef = useRef<{ projectId: string; generationId: string } | null>(null);
  const [firstRunSaving, setFirstRunSaving] = useState(false);
  const projectListAnchorRef = useRef<{ id: string; index: number } | null>(null);
  const inboxListAnchorRef = useRef<{ id: string; index: number } | null>(null);
  const mainScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const projectAutoScrollFrameRef = useRef<number | null>(null);
  const projectAutoScrollSpeedRef = useRef(0);
  const numberInputDragRef = useRef<NumberInputDrag | null>(null);
  const completionFeedbackTimerRef = useRef<number | null>(null);
  const completionFollowupTimerRef = useRef<number | null>(null);
  const seenCompletionFeedbackRef = useRef<Set<string>>(new Set());
  const queuedCompletionFollowupsRef = useRef<Set<string>>(new Set());
  const lastBackupErrorRef = useRef<string | null>(null);
  const lastSettingsApplyErrorRef = useRef<string | null>(null);
  const shortcutCaptureActiveRef = useRef(false);
  const victoryInputRef = useRef<HTMLInputElement | null>(null);
  const victorySuggestionsRef = useRef<HTMLDivElement | null>(null);
  const victoryNavigationRef = useRef<HTMLButtonElement | null>(null);
  const victorySaveRef = useRef<Promise<boolean> | null>(null);
  const contextMenuReturnFocusRef = useRef<HTMLElement | null>(null);
  const confirmFocusReturnRef = useRef<HTMLElement | null>(null);
  const morningFocusDateRef = useRef<string | null>(null);
  const miniWindowRef = useRef<WebviewWindow | null>(null);
  const miniModeOpenRef = useRef(false);
  const miniTransitioningRef = useRef(false);
  const miniSnapshotRef = useRef<MiniTimerSnapshot>(inactiveMiniSnapshot());
  const iconRequestIdsRef = useRef<Map<string, number>>(new Map());
  const iconRefreshGenerationRef = useRef(0);
  const notesSaveTimersRef = useRef<Map<string, number>>(new Map());
  const completionPromptRef = useRef<TimerCompletionPrompt | null>(null);
  completionPromptRef.current = completionPrompt;

  const requestConfirmation = useCallback((request: ConfirmDialogRequest) => {
    // V164 (E1): the confirm closes with a motion, so the focus goes back from the close handler
    // instead of waiting for the surface to leave the DOM.
    if (!confirmFocusReturnRef.current) {
      confirmFocusReturnRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setConfirmDialog((current) => {
      const next = current ?? request;
      confirmDialogRef.current = next;
      return next;
    });
  }, []);

  const requestDiscardConfirmation = useCallback(
    (onConfirm: () => void | boolean | Promise<void | boolean>) => {
      requestConfirmation({
        title: "入力内容を破棄して閉じますか？",
        message: "保存していない変更は失われます。",
        confirmLabel: "破棄して閉じる",
        cancelLabel: "戻る",
        tone: "danger",
        initialFocus: "cancel",
        onConfirm,
      });
    },
    [requestConfirmation],
  );

  const showCompletionFeedback = useCallback((feedback: CompletionFeedback) => {
    if (document.hidden || seenCompletionFeedbackRef.current.has(feedback.key)) return;
    seenCompletionFeedbackRef.current.add(feedback.key);
    if (completionFeedbackTimerRef.current !== null) {
      window.clearTimeout(completionFeedbackTimerRef.current);
    }
    setCompletionFeedback(feedback);
    completionFeedbackTimerRef.current = window.setTimeout(() => {
      completionFeedbackTimerRef.current = null;
      setCompletionFeedback((current) => (current?.key === feedback.key ? null : current));
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (completionFeedbackTimerRef.current !== null) {
        window.clearTimeout(completionFeedbackTimerRef.current);
      }
      if (completionFollowupTimerRef.current !== null) {
        window.clearTimeout(completionFollowupTimerRef.current);
      }
    },
    [],
  );

  const dismissContextMenu = useCallback((restoreFocus = true) => {
    const returnTarget = contextMenuReturnFocusRef.current;
    contextMenuReturnFocusRef.current = null;
    setContextMenu(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        if (!returnTarget?.isConnected || shouldSkipFocusRestore(returnTarget)) return;
        returnTarget.focus();
      });
    }
  }, []);

  const captureDialogReturnFocus = useCallback(
    (returnFocusRef: { current: HTMLElement | null }) => {
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (activeElement?.closest('[role="menu"]')) {
        const contextMenuOpener = contextMenuReturnFocusRef.current;
        returnFocusRef.current = contextMenuOpener?.isConnected ? contextMenuOpener : null;
        return;
      }
      returnFocusRef.current =
        activeElement?.isConnected &&
        !activeElement.closest('.modalBackdrop:not([data-exiting="true"])')
          ? activeElement
          : null;
    },
    [],
  );

  const restoreDialogFocus = useCallback(
    (returnFocusRef: { current: HTMLElement | null }, fallbackSelector?: string) => {
      const returnTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = returnTarget?.isConnected
            ? returnTarget
            : fallbackSelector
              ? document.querySelector<HTMLElement>(fallbackSelector)
              : null;
          if (!target?.isConnected || shouldSkipFocusRestore(target)) return;
          target.focus();
        });
      });
    },
    [],
  );

  const closeProjectEditDialog = useCallback(
    (afterSuccessfulSave = false) => {
      if (!projectEditDraft || (!afterSuccessfulSave && projectEditSavingRef.current)) return;
      const initialDraft = projectEditInitialDraftRef.current;
      const dirty =
        !afterSuccessfulSave &&
        Boolean(initialDraft) &&
        JSON.stringify(projectEditDraft) !== JSON.stringify(initialDraft);
      if (dirty) {
        requestDiscardConfirmation(() => {
          projectEditInitialDraftRef.current = null;
          setProjectEditDraft(null);
          restoreDialogFocus(projectEditReturnFocusRef);
        });
        return;
      }
      const fallbackSelector = projectEditDraft.isNew
        ? undefined
        : `[data-project-id="${CSS.escape(projectEditDraft.id)}"] .nextStepProjectRegion`;
      setProjectEditDraft(null);
      projectEditInitialDraftRef.current = null;
      restoreDialogFocus(projectEditReturnFocusRef, fallbackSelector);
    },
    [projectEditDraft, requestDiscardConfirmation, restoreDialogFocus],
  );

  const sourceEditBusyRef = useRef<string | null>(null);

  const closeNextStepEditDialog = useCallback(
    (afterSuccessfulSave = false) => {
      if (!nextStepEditDraft || (!afterSuccessfulSave && sourceEditBusyRef.current)) return;
      const initialDraft = nextStepEditInitialDraftRef.current;
      const hasNewInput = Boolean(
        nextStepEditDraft.text.trim() ||
        nextStepEditDraft.trigger.trim() ||
        nextStepEditDraft.buttonIds.length ||
        nextStepEditDraft.defaultTimerMinutes.trim() ||
        nextStepEditDraft.shortTimerMinutes.trim() ||
        nextStepEditDraft.expandTimerOnStart ||
        nextStepEditDraft.startNoteTemplate.trim() ||
        nextStepEditDraft.instructionPath.trim() ||
        nextStepEditDraft.projectId !== initialDraft?.projectId ||
        nextStepEditDraft.legacyChoice !== initialDraft?.legacyChoice ||
        nextStepEditDraft.replacementChoice !== initialDraft?.replacementChoice,
      );
      const dirty =
        !afterSuccessfulSave &&
        (nextStepEditDraft.mode === "edit"
          ? Boolean(initialDraft) &&
            JSON.stringify(nextStepEditDraft) !== JSON.stringify(initialDraft)
          : hasNewInput);
      if (dirty) {
        requestDiscardConfirmation(() => {
          nextStepEditInitialDraftRef.current = null;
          setNextStepOpenMenuOpen(false);
          setNextStepOpenPicker(null);
          setNextStepEditDraft(null);
          restoreDialogFocus(nextStepEditReturnFocusRef);
        });
        return;
      }
      const fallbackSelector = nextStepEditDraft.projectId
        ? `[data-project-id="${CSS.escape(nextStepEditDraft.projectId)}"] .nextStepActionRegion`
        : undefined;
      setNextStepOpenMenuOpen(false);
      setNextStepOpenPicker(null);
      setNextStepEditDraft(null);
      nextStepEditInitialDraftRef.current = null;
      restoreDialogFocus(nextStepEditReturnFocusRef, fallbackSelector);
    },
    [nextStepEditDraft, requestDiscardConfirmation, restoreDialogFocus],
  );

  const openContextMenu = useCallback(
    (target: ContextMenuTarget, x: number, y: number, opener?: HTMLElement | null) => {
      contextMenuReturnFocusRef.current =
        opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setContextMenu({ ...target, x, y });
    },
    [],
  );

  const openContextMenuFromKeyboard = useCallback(
    (event: KeyboardEvent<HTMLElement>, target: ContextMenuTarget) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      event.stopPropagation();
      const opener = event.target instanceof HTMLElement
        ? (event.target.closest<HTMLElement>('button, [tabindex="0"]') ?? event.currentTarget)
        : event.currentTarget;
      const rect = opener.getBoundingClientRect();
      openContextMenu(target, rect.left, rect.bottom + 4, opener);
    },
    [openContextMenu],
  );

  const closeConfirmDialog = useCallback(() => {
    confirmDialogRef.current = null;
    setConfirmDialog(null);
    const returnTarget = confirmFocusReturnRef.current;
    confirmFocusReturnRef.current = null;
    window.requestAnimationFrame(() => {
      if (!returnTarget?.isConnected || shouldSkipFocusRestore(returnTarget)) return;
      returnTarget.focus();
    });
  }, []);

  const buttonsById = useMemo(() => {
    const map = new Map<string, LauncherButton>();
    config?.buttons.forEach((button) => map.set(button.id, button));
    return map;
  }, [config]);

  const projectsById = useMemo(() => {
    const map = new Map<string, LauncherProject>();
    config?.projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [config]);

  const staleNextStepProjects = useMemo(() => {
    if (!config) return [];
    const staleIds = new Set(staleNextStepProjectIds);
    return config.projects.filter(
      (project) => staleIds.has(project.id) && project.nextStep?.text.trim(),
    );
  }, [config, staleNextStepProjectIds]);
  // P10-05 (D11): the age of each stale Next Step, in whole days.
  const staleNextStepMap = useMemo(() => {
    const nowMs = Date.now();
    const map = new Map<string, number>();
    for (const project of staleNextStepProjects) {
      const days = nextStepStaleDays(project.nextStep, nowMs);
      if (days !== null && days >= 14) map.set(project.id, days);
    }
    return map;
  }, [staleNextStepProjects]);



  const buttonGroups = useMemo<ButtonGroup[]>(() => {
    if (!config) return [];

    const groups = new Map<string, LauncherButton[]>();
    config.buttons.forEach((button) => {
      const groupName = buttonGroupName(button);
      const buttons = groups.get(groupName) ?? [];
      buttons.push(button);
      groups.set(groupName, buttons);
    });

    return uniqueGroupNames(config).map((name) => ({ name, buttons: groups.get(name) ?? [] }));
  }, [config]);

  const groupNames = useMemo(() => {
    return buttonGroups.map((group) => group.name);
  }, [buttonGroups]);

  const currentTimerMetrics = activeTimer ? timerMetrics(activeTimer, now) : null;
  useEffect(() => {
    if (!expandedTimerOpen) return;
    // 背景を操作できないようにする。窓のボタンがあるヘッダーは含めない
    // (拡大タイマーの表示中も窓のボタンを押せるようにするため)。
    const background = document.querySelectorAll<HTMLElement>(".sidebar, .mainScrollArea");
    background.forEach((element) => { element.inert = true; });
    return () => background.forEach((element) => { element.inert = false; });
  }, [expandedTimerOpen]);

  useEffect(() => {
    if (!activeTimer) setExpandedTimerOpen(false);
  }, [activeTimer]);
  const timerRunning = activeTimer !== null;
  useEffect(() => {
    if (!expandedTimerOpen || !timerRunning) return;
    const leaseId = `expanded-timer-${Date.now()}-${Math.random()}`;
    let closed = false;
    const release = () => { void setDisplayAwake(leaseId, false).catch(() => undefined); };
    void setDisplayAwake(leaseId, true)
      .then(() => { if (closed) release(); })
      .catch(() => undefined);
    const renewal = window.setInterval(() => {
      if (!closed) void setDisplayAwake(leaseId, true).catch(() => undefined);
    }, 20_000);
    const visibilityCheck = window.setInterval(() => {
      const mainWindow = getCurrentWindow();
      void Promise.all([mainWindow.isVisible(), mainWindow.isMinimized()])
        .then(([visible, minimized]) => {
          if (!closed && (!visible || minimized)) setExpandedTimerOpen(false);
        })
        .catch(() => undefined);
    }, 1_000);
    window.addEventListener("pagehide", release);
    return () => {
      closed = true;
      window.clearInterval(renewal);
      window.clearInterval(visibilityCheck);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [expandedTimerOpen, timerRunning]);
  const visibleSidebarButtonGroups = useMemo(
    () =>
      buttonGroups
        .filter((group) => group.buttons.length > 0 || config?.groups.includes(group.name))
        .map((group) => ({
          name: group.name,
          buttons: group.buttons.filter(showButtonInSidebar),
        })),
    [buttonGroups, config?.groups],
  );
  const projectSelectableButtons = useMemo(
    () =>
      (config?.buttons ?? []).filter(
        (button) => showButtonInSidebar(button) || showButtonInOverlay(button),
      ),
    [config?.buttons],
  );
  const overlayPages = useMemo(() => config?.overlayPages ?? [], [config?.overlayPages]);
  // P10-08 (§7.2): "N分のうち … ・ HH:MM に終わります"; paused shows the pause note instead.
  const expandedTimerPlanLabel = (() => {
    if (!activeTimer || activeTimer.paused) return "";
    if (activeTimer.mode === "measure") return "時間を決めずに計測しています";
    const total = activeTimer.targetMinutes ?? config?.settings.defaultTimerMinutes ?? 25;
    const endsAt = new Date(
      activeTimer.startedAtMs + total * 60_000 + activeTimer.pausedTotalMs,
    );
    const ends = endsAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    return `${total}分のうち ・ ${ends} に終わります`;
  })();
  const timerProgressPercent =
    activeTimer?.mode === "countdown" && activeTimer.targetMinutes !== null && currentTimerMetrics
      ? Math.min(
          100,
          Math.max(
            0,
            (currentTimerMetrics.elapsedSeconds / (activeTimer.targetMinutes * 60)) * 100,
          ),
        )
      : null;
  // P96-02: 窓の上端のタイマーの線。予定時間のあるタイマー(countdown)が実行中か一時停止中の間だけ出す。
  // 長さは上の timerProgressPercent をそのまま使い、線のためだけの時計は持たない。
  // 予定時間が変わったとき(開始・「続ける(+15分)」)は resetKey が変わり、動きなしで今の値になる。
  const windowTimerLine =
    activeTimer?.mode === "countdown" &&
    activeTimer.targetMinutes !== null &&
    timerProgressPercent !== null
      ? {
          percent: timerProgressPercent,
          paused: activeTimer.paused,
          resetKey: `${activeTimer.instanceId}:${activeTimer.targetMinutes}`,
        }
      : null;
  const miniSnapshot = useMemo<MiniTimerSnapshot>(() => {
    if (!activeTimer) return inactiveMiniSnapshot();
    const project = activeTimer.projectId
      ? config?.projects.find((item) => item.id === activeTimer.projectId)
      : undefined;
    const metrics = timerMetrics(activeTimer, now);
    const progressPercent =
      activeTimer.mode === "countdown" && activeTimer.targetMinutes !== null
        ? Math.min(
            100,
            Math.max(0, (metrics.elapsedSeconds / (activeTimer.targetMinutes * 60)) * 100),
          )
        : null;

    return {
      active: true,
      label: activeTimer.label,
      actionText: timerActionText(activeTimer),
      mode: activeTimer.mode,
      remainingClock: formatClock(
        activeTimer.mode === "measure"
          ? metrics.elapsedSeconds
          : Math.max(0, metrics.remainingSeconds ?? 0),
      ),
      paused: activeTimer.paused,
      progressPercent,
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      projectColorId: project?.colorId ?? null,
    };
  }, [activeTimer, config?.projects, now]);
  miniSnapshotRef.current = miniSnapshot;

  const refreshButtonIcon = useCallback(async (button: LauncherButton, force = false) => {
    const generation = iconRefreshGenerationRef.current;
    if (!buttonHasIconCacheSource(button)) return;
    if (iconRequestIdsRef.current.has(button.id)) return;

    iconRequestIdsRef.current.set(button.id, generation);
    try {
      if (force) {
        setButtonIconSources((current) => {
          const next = { ...current };
          delete next[button.id];
          return next;
        });
        await deleteButtonIconCache(button.id);
      }
      const source = await ensureButtonIconCache(button);
      if (generation !== iconRefreshGenerationRef.current) return;
      if (source) {
        setButtonIconSources((current) => ({
          ...current,
          [button.id]: source,
        }));
      } else if (force) {
        setButtonIconSources((current) => {
          const next = { ...current };
          delete next[button.id];
          return next;
        });
      }
    } catch {
      if (force && generation === iconRefreshGenerationRef.current) {
        setButtonIconSources((current) => {
          const next = { ...current };
          delete next[button.id];
          return next;
        });
      }
    } finally {
      if (iconRequestIdsRef.current.get(button.id) === generation) {
        iconRequestIdsRef.current.delete(button.id);
      }
    }
  }, []);

  const applyDoNowResponse = useCallback((response: DoNowResponse) => {
    setDoNowResponse(response);
    // A picked Project that is no longer offered returns to the first candidate and stays there.
    setDoNowPickedProjectId((picked) =>
      picked !== null && !response.candidates.some((candidate) => candidate.projectId === picked)
        ? null
        : picked,
    );
  }, []);

  const refreshDoNow = useCallback(async () => {
    try {
      applyDoNowResponse(await loadDoNowCandidates());
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `今やる一手を読めません: ${message}`);
      return false;
    }
  }, [applyDoNowResponse, showToast]);

  useEffect(() => {
    if (doNowCompletionHold && config?.today.date !== doNowCompletionHold.date) {
      setDoNowCompletionHold(null);
    }
  }, [config?.today.date, doNowCompletionHold]);

  useEffect(() => {
    setDoNowExcludedProjectId(null);
  }, [config?.today.date]);

  // V160-B4: keep the Do Now chip's page in step with the chosen ZIP and with saves from the
  // instruction window (the Rust save command emits this event).
  useEffect(() => {
    const picked = doNowPickedProjectId;
    const offer =
      doNowResponse?.candidates.find((candidate) => candidate.projectId === picked) ??
      doNowResponse?.candidates[0];
    const project = offer
      ? config?.projects.find((entry) => entry.id === offer.projectId)
      : undefined;
    const path = project?.nextStep?.instructionPath?.trim() ?? "";
    const fileName = path.split(/[\\/]/).pop() ?? "";
    if (!path || !isInstructionBookName(fileName)) {
      setDoNowBookPage(null);
      return;
    }
    let disposed = false;
    const refresh = () => {
      void loadInstructionBookState(path)
        .then((state) => {
          if (!disposed) setDoNowBookPage(state.lastPage >= 2 ? state.lastPage : null);
        })
        .catch(() => {
          if (!disposed) setDoNowBookPage(null);
        });
    };
    refresh();
    const unlisten = listen(INSTRUCTION_BOOK_STATE_CHANGED_EVENT, () => refresh());
    return () => {
      disposed = true;
      void unlisten.then((stop) => stop());
    };
  }, [config, doNowResponse, doNowPickedProjectId]);

  const refreshSessions = useCallback(async () => {
    try {
      const [response, doNow] = await Promise.all([loadTodaySessionTotal(), loadDoNowCandidates()]);
      setTodaySessionMinutes(response.totalMinutes);
      setTodaySessionDate(response.date);
      applyDoNowResponse(doNow);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を読めません: ${message}`);
    }
  }, [applyDoNowResponse, showToast]);

  const refreshTodayActivity = useCallback(async () => {
    try {
      const response = await loadSessionEntries({ dateScope: "today" });
      setTodayActivityEntries(response.entries);
      setTodayActivityDate(response.date);
      if (response.warning) {
        showToast("warn", response.warning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `今日の実行を読み込めません: ${message}`);
    }
  }, [showToast]);

  const applyWeeklyReview = useCallback((response: WeeklyReviewResponse) => {
    setWeeklyReview(response);
  }, []);

  const refreshWeeklyReview = useCallback(async () => {
    try {
      const [review, freshness] = await Promise.all([loadWeeklyReview(), loadNextStepFreshness()]);
      applyWeeklyReview(review);
      setStaleNextStepProjectIds(freshness.staleProjectIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `先週のふりかえりを読めません: ${message}`);
    }
  }, [applyWeeklyReview, showToast]);

  const refreshRecords = useCallback(async () => {
    try {
      const [summary, entries, weekEntries, allEntries, history, review, freshness] =
        await Promise.all([
          loadSessionSummary(),
          loadSessionEntries({
            query: sessionSearch,
            projectId: sessionProjectFilter || null,
            dateScope: sessionDateScope,
          }),
          loadSessionEntries({ dateScope: "week" }),
          loadSessionEntries({ dateScope: "all" }),
          loadNotesHistory(),
          loadWeeklyReview(),
          loadNextStepFreshness(),
        ]);
      setSessionSummary(summary);
      setSessionEntries(entries);
      setRecordsWeekSessions(weekEntries.entries);
      setRecordsAllSessions(allEntries.entries);
      setNotesHistory(history);
      applyWeeklyReview(review);
      setStaleNextStepProjectIds(freshness.staleProjectIds);
      if (entries.warning) {
        showToast("warn", entries.warning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `記録を読めません: ${message}`);
    }
  }, [applyWeeklyReview, sessionDateScope, sessionProjectFilter, sessionSearch, showToast]);

  const refreshNextStepSuggestions = useCallback(async (projectId: string | null | undefined) => {
    if (!projectId) {
      setProjectNextStepSuggestions([]);
      return;
    }

    try {
      const suggestions = await loadNextStepSuggestions(projectId);
      setProjectNextStepSuggestions(suggestions);
    } catch {
      setProjectNextStepSuggestions([]);
    }
  }, []);

  const refreshConfig = useCallback(
    async (toastOnSuccess = false) => {
      if (resetInProgressRef.current) return;
      try {
        const response = await loadConfig();
        const registration = await loadShortcutRegistrationStatus().catch(() => ({
          main: false,
          launcher: false,
          mini: false,
          instruction: false,
        }));
        configSaveBlockedRef.current = response.saveBlocked;
        setConfigSaveBlocked(response.saveBlocked);
        setShortcutRegistration(registration);
        setConfig(response.config);
        setMorningVictorySuggestion(response.morningVictorySuggestion ?? null);
        setBackupPath(response.backupPath);
        setBanner(response.error ?? null);
        if (response.backupError && response.backupError !== lastBackupErrorRef.current) {
          lastBackupErrorRef.current = response.backupError;
          showToast("warn", `バックアップできません: ${response.backupError}`);
        }
        if (!response.backupError) {
          lastBackupErrorRef.current = null;
        }
        await refreshSessions();
        await refreshTodayActivity();
        if (toastOnSuccess) {
          showToast("ok", "設定を再読み込みしました");
        }
      } catch (error) {
        configSaveBlockedRef.current = true;
        setConfigSaveBlocked(true);
        const message = error instanceof Error ? error.message : String(error);
        setBanner(message);
        setBackupPath("");
        showToast("error", `設定を読めません: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    [refreshSessions, refreshTodayActivity, showToast],
  );

  const configuredDayStartHour = config?.settings.dayStartHour;
  const storedTodayDate = config?.today.date;
  useEffect(() => {
    if (configuredDayStartHour === undefined || !storedTodayDate) return;
    const checkDay = () => {
      const dayKey = localDayKey(new Date(), configuredDayStartHour);
      setObservedDayKey((current) => (current === dayKey ? current : dayKey));
      if (configRef.current?.today.date === dayKey) {
        lastDayRefreshRef.current = "";
      } else if (lastDayRefreshRef.current !== dayKey) {
        lastDayRefreshRef.current = dayKey;
        void refreshConfig();
      }
    };
    checkDay();
    const timer = window.setInterval(checkDay, 1000);
    window.addEventListener("focus", checkDay);
    const onVisibilityChange = () => {
      if (!document.hidden) checkDay();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkDay);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [configuredDayStartHour, storedTodayDate, refreshConfig]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const recovery = await getSoftwareResetRecoveryForBoot();
        if (active && recovery) {
          restoreSoftwareResetStorage(recovery.localStorageSnapshot);
          setCollapsedGroups(readCollapsedGroups());
          await acknowledgeSoftwareResetRecovery();
          showToast("warn", recovery.message);
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : String(error);
          showToast("error", `ソフトウェアリセットの復旧を完了できません: ${message}`);
        }
      }
      if (active) void refreshConfig();
    })();
    const unlisten = listenForConfigChanges(() => {
      window.setTimeout(() => void refreshConfig(), 250);
    });
    const notesSaveTimers = notesSaveTimersRef.current;

    return () => {
      active = false;
      unlisten.then((dispose) => dispose()).catch(() => undefined);
      notesSaveTimers.forEach((timer) => window.clearTimeout(timer));
      notesSaveTimers.clear();
    };
  }, [refreshConfig, showToast]);

  useEffect(() => {
    if (activeView === "records") {
      void refreshRecords();
    }
  }, [activeView, refreshRecords]);

  useEffect(() => {
    if (config?.today.date) {
      void refreshWeeklyReview();
    }
  }, [config?.today.date, refreshWeeklyReview]);

  useEffect(() => {
    if (config) {
      void refreshDoNow();
    }
  }, [config, refreshDoNow]);

  useEffect(() => {
    if (!config || activeView !== "main" || config.today.victory.text.trim()) return;
    if (morningFocusDateRef.current === config.today.date) return;

    morningFocusDateRef.current = config.today.date;
    window.requestAnimationFrame(() => {
      const button = victoryNavigationRef.current;
      if (!button) return;
      // The automatic focus shows no ring (cleared on blur / key press by clearVictoryAutoFocus).
      button.dataset.autoFocus = "";
      button.focus({ preventScroll: true });
    });
  }, [activeView, config]);

  // Keyed on the timer instance, not the timer object: pause/resume replace the object, and
  // re-creating the interval each time starves it when the buttons are pressed faster than a tick.
  const activeTimerInstanceId = activeTimer?.instanceId ?? null;
  useEffect(() => {
    if (activeTimerInstanceId === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [activeTimerInstanceId]);

  useEffect(() => {
    if (!config) return;
    setDefaultTimerDraft(String(config.settings.defaultTimerMinutes));
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const buttonIds = new Set(config.buttons.map((button) => button.id));
    setButtonIconSources((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([buttonId]) => buttonIds.has(buttonId)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });

    config.buttons.forEach((button) => {
      if (!buttonIconSources[button.id]) {
        void refreshButtonIcon(button);
      }
    });
  }, [buttonIconSources, config, refreshButtonIcon]);

  const persistConfig = useCallback(
    async (
      nextConfig: AppConfig,
      applySettingsAfterSave = false,
      options?: { errorToastMessage?: string },
    ) => {
      if (resetInProgressRef.current) return false;
      if (configSaveBlockedRef.current) {
        const message = "設定ファイルに問題があるため、元データを保護して保存を停止しています";
        setBanner(message);
        showToast("error", options?.errorToastMessage ?? message);
        return false;
      }
      const safeConfig = limitToday(nextConfig);
      const previousConfig = configRef.current;
      const writeGeneration = writeGenerationRef.current;
      configRef.current = safeConfig;
      setConfig(safeConfig);
      let response: Awaited<ReturnType<typeof saveConfig>>;
      try {
        response = await saveConfig(safeConfig);
        if (resetInProgressRef.current || writeGeneration !== writeGenerationRef.current) {
          return false;
        }
        configRef.current = response.config;
        setConfig(response.config);
        setBanner(null);
        // V163-C8: the Dictionary window keeps its own copy, so it is told about every save here.
        void notifyDictionaryConfigChanged();
        // P10-05 (D11): a successful save can change which Next Steps are stale, so the
        // list is read again from the saved config.
        void loadNextStepFreshness()
          .then((freshness) => setStaleNextStepProjectIds(freshness.staleProjectIds))
          .catch(() => undefined);
      } catch (error) {
        if (resetInProgressRef.current || writeGeneration !== writeGenerationRef.current) {
          return false;
        }
        if (configRef.current === safeConfig) {
          configRef.current = previousConfig;
          setConfig(previousConfig);
        }
        const message = error instanceof Error ? error.message : String(error);
        setBanner(message);
        showToast("error", options?.errorToastMessage ?? `保存できません: ${message}`);
        return false;
      }

      if (!applySettingsAfterSave) {
        return true;
      }

      try {
        await reapplyDashboardSettings();
        lastSettingsApplyErrorRef.current = null;
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const warning = `保存しましたが、ショートカットを登録できません: ${message}`;
        setBanner(warning);
        if (message !== lastSettingsApplyErrorRef.current) {
          lastSettingsApplyErrorRef.current = message;
          showToast("warn", warning);
        }
        return false;
      } finally {
        setShortcutRegistration(await loadShortcutRegistrationStatus().catch(() => ({
          main: false,
          launcher: false,
          mini: false,
          instruction: false,
        })));
      }
    },
    [showToast],
  );

  const configuredMiniPosition = useCallback((): MiniWindowPosition | null => {
    return config?.settings.miniWindowPosition ?? readMiniPosition();
  }, [config?.settings.miniWindowPosition]);

  const placeMiniWindowSafely = useCallback(
    async (miniWindow: WebviewWindow, preferredPosition: MiniWindowPosition | null) => {
      const safePosition = await resolveSafeMiniPosition(preferredPosition);
      await miniWindow.setPosition(new PhysicalPosition(safePosition.x, safePosition.y));
      writeMiniPosition(safePosition.x, safePosition.y);
      return safePosition;
    },
    [],
  );

  const ensureMiniWindow = useCallback(
    async (shouldShow = true) => {
      const existing = await WebviewWindow.getByLabel(MINI_WINDOW_LABEL);
      const preferredPosition = configuredMiniPosition();

      if (existing) {
        miniWindowRef.current = existing;
        const currentPosition = await existing.outerPosition().catch(() => null);
        const safePosition = await resolveSafeMiniPosition(
          isFiniteMiniPosition(currentPosition) ? currentPosition : preferredPosition,
        );
        if (!sameMiniPosition(currentPosition, safePosition)) {
          await existing.setPosition(new PhysicalPosition(safePosition.x, safePosition.y));
        }
        writeMiniPosition(safePosition.x, safePosition.y);
        if (shouldShow) {
          await existing.show().catch(() => undefined);
        }
        return existing;
      }

      const safePosition = await resolveSafeMiniPosition(preferredPosition);
      const readyWaiter = await createMiniReadyWaiter();
      const miniWindow = new WebviewWindow(MINI_WINDOW_LABEL, {
        url: "/?view=mini",
        title: "Life Launcher Timer",
        x: safePosition.x,
        y: safePosition.y,
        width: MINI_WINDOW_WIDTH_PX,
        height: MINI_WINDOW_HEIGHT_PX,
        minWidth: MINI_WINDOW_WIDTH_PX,
        minHeight: MINI_WINDOW_HEIGHT_PX,
        resizable: false,
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focus: false,
        focusable: false,
        visible: false,
        // テスト用の起動では、WebView2 のデータもテスト用のフォルダに置く。
        ...(testProfile?.webviewDataDir ? { dataDirectory: testProfile.webviewDataDir } : {}),
      });
      try {
        await Promise.all([waitForMiniWindowCreated(miniWindow), readyWaiter.promise]);
      } catch (error) {
        miniWindowRef.current = null;
        await miniWindow.close().catch(() => undefined);
        throw error;
      } finally {
        readyWaiter.dispose();
      }
      miniWindowRef.current = miniWindow;
      writeMiniPosition(safePosition.x, safePosition.y);
      if (shouldShow) {
        await miniWindow.show();
      }
      return miniWindow;
    },
    [configuredMiniPosition, testProfile?.webviewDataDir],
  );

  const openMiniMode = useCallback(async () => {
    if (expandedTimerOpen) return;
    if (!config?.settings.miniMode) {
      showToast("warn", "設定で「ミニタイマーを使う」をオンにしてください");
      return;
    }
    let stage = "メイン画面の取得";
    let miniWindow: WebviewWindow | null = null;
    try {
      const mainWindow = await WebviewWindow.getByLabel("main");
      if (!mainWindow) {
        throw new Error("メインウィンドウが見つかりません");
      }
      stage = "ミニ画面の準備";
      miniWindow = await ensureMiniWindow(false);
      stage = "ミニ画面の表示";
      await miniWindow.show();
      stage = "タイマー状態の同期";
      await emit(MINI_TIMER_SNAPSHOT_EVENT, miniSnapshot);
      stage = "メイン画面の非表示";
      await mainWindow.hide();
      miniModeOpenRef.current = true;
    } catch (error) {
      miniModeOpenRef.current = false;
      await miniWindow?.hide().catch(() => undefined);
      await focusDashboardWindow().catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mini-mode] ${stage}で失敗しました`, error);
      showToast("warn", `ミニタイマーを開けません (${stage}): ${message}`);
    }
  }, [config?.settings.miniMode, ensureMiniWindow, expandedTimerOpen, miniSnapshot, showToast]);

  const hideMiniWindow = useCallback(async () => {
    const existing = miniWindowRef.current ?? (await WebviewWindow.getByLabel(MINI_WINDOW_LABEL));
    miniModeOpenRef.current = false;
    if (!existing) return;
    miniWindowRef.current = existing;

    const currentPosition = await existing.outerPosition().catch(() => null);
    if (config && isFiniteMiniPosition(currentPosition)) {
      const nextPosition = {
        x: Math.round(currentPosition.x),
        y: Math.round(currentPosition.y),
      };
      writeMiniPosition(nextPosition.x, nextPosition.y);
      if (!sameMiniPosition(config.settings.miniWindowPosition, nextPosition)) {
        await persistConfig({
          ...config,
          settings: {
            ...config.settings,
            miniWindowPosition: nextPosition,
          },
        });
      }
    }

    await existing.hide();
  }, [config, persistConfig]);

  const returnToMain = useCallback(async () => {
    await focusDashboardWindow();
    await hideMiniWindow();
  }, [hideMiniWindow]);

  const toggleMainFromShortcut = useCallback(async () => {
    const mainWindow = getCurrentWindow();
    const [visible, minimized, focused] = await Promise.all([
      mainWindow.isVisible(),
      mainWindow.isMinimized(),
      mainWindow.isFocused(),
    ]);
    if (visible && !minimized && focused) {
      await mainWindow.close();
      return;
    }
    await returnToMain();
  }, [returnToMain]);

  const toggleMiniMode = useCallback(async () => {
    if (miniTransitioningRef.current) return;
    miniTransitioningRef.current = true;
    setMiniTransitioning(true);
    try {
      if (miniModeOpenRef.current) {
        await returnToMain();
      } else {
        await openMiniMode();
      }
    } finally {
      miniTransitioningRef.current = false;
      setMiniTransitioning(false);
    }
  }, [openMiniMode, returnToMain]);

  const openInstructionsManually = useCallback(async () => {
    try {
      await openInstructionWindow({
        path: readLastInstructionPath() ?? undefined,
        focus: true,
      });
    } catch (error) {
      showToast(
        "error",
        `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [showToast]);

  const openDictionaryManually = useCallback(async () => {
    try {
      await openDictionaryWindow();
    } catch (error) {
      showToast(
        "error",
        `辞書ウィンドウを開けません: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [showToast]);
  const toggleDictionaryFromShortcut = useCallback(async () => {
    try {
      await toggleDictionaryWindow();
    } catch (error) {
      showToast(
        "error",
        "辞書ウィンドウを切り替えられません: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    let cleanup: Array<() => void> = [];

    const setup = async () => {
      const unlistenMain = await listen("main-shortcut-toggle", () => {
        void toggleMainFromShortcut().catch((error) =>
          console.error("[main-shortcut] メイン表示の切り替えに失敗しました", error),
        );
      });
      const unlistenLauncher = await listen("launcher-shortcut-toggle", () => {
        if (mounted) void toggleDictionaryFromShortcut();
      });
      const unlistenMini = await listen("mini-shortcut-toggle", () => {
        void toggleMiniMode();
      });
      const unlistenInstruction = await listen("instruction-shortcut-toggle", () => {
        void openInstructionsManually();
      });

      if (mounted) {
        cleanup = [unlistenMain, unlistenLauncher, unlistenMini, unlistenInstruction];
      } else {
        unlistenMain();
        unlistenLauncher();
        unlistenMini();
        unlistenInstruction();
      }
    };

    void setup();
    return () => {
      mounted = false;
      cleanup.forEach((dispose) => dispose());
    };
  }, [openInstructionsManually, toggleDictionaryFromShortcut, toggleMainFromShortcut, toggleMiniMode]);

  const resetMiniWindowPosition = useCallback(async () => {
    if (!config) return false;
    const saved = await persistConfig({
      ...config,
      settings: {
        ...config.settings,
        miniWindowPosition: null,
      },
    });
    if (!saved) {
      setConfig(config);
      return false;
    }
    clearMiniPosition();

    const existing = miniWindowRef.current ?? (await WebviewWindow.getByLabel(MINI_WINDOW_LABEL));
    if (existing) {
      miniWindowRef.current = existing;
      await placeMiniWindowSafely(existing, null);
    }
    showToast("ok", "ミニウィンドウ位置をリセットしました");
    return true;
  }, [config, persistConfig, placeMiniWindowSafely, showToast]);

  const regenerateIconCache = useCallback(async () => {
    if (!config) return false;
    const targets = config.buttons.filter(buttonHasIconCacheSource);
    if (targets.length === 0) {
      showToast("warn", "再生成できるアイコンがありません");
      return false;
    }

    await Promise.all(targets.map((button) => refreshButtonIcon(button, true)));
    showToast("ok", `アイコンキャッシュを再生成しました (${targets.length}件)`);
    return true;
  }, [config, refreshButtonIcon, showToast]);

  const requestMiniWindowPositionReset = useCallback(() => {
    requestConfirmation({
      title: "ミニウィンドウ位置をリセットしますか？",
      message: "次に開くとき、安全な初期位置へ戻します。",
      confirmLabel: "リセットする",
      processingLabel: "リセットしています…",
      tone: "warning",
      onConfirm: resetMiniWindowPosition,
    });
  }, [requestConfirmation, resetMiniWindowPosition]);

  const requestIconCacheRegeneration = useCallback(() => {
    if (!config) return;
    const targetCount = config.buttons.filter(buttonHasIconCacheSource).length;
    if (targetCount === 0) {
      showToast("warn", "再生成できるアイコンがありません");
      return;
    }

    requestConfirmation({
      title: "アイコンキャッシュを再生成しますか？",
      subject: `${targetCount}件の登録済みアイコン`,
      message: "登録数によっては完了まで少し時間がかかります。",
      confirmLabel: "再生成する",
      processingLabel: "再生成しています…",
      tone: "warning",
      onConfirm: regenerateIconCache,
    });
  }, [config, regenerateIconCache, requestConfirmation, showToast]);

  const openBackupFolder = useCallback(async () => {
    try {
      const path = await openConfigBackups();
      setBackupPath(path);
      showToast("ok", "バックアップフォルダを開きました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `バックアップを開けません: ${message}`);
    }
  }, [showToast]);

  const saveDefaultTimerMinutes = async (rawValue: string | number) => {
    if (!config) return;
    const parsed = typeof rawValue === "number" ? rawValue : Number.parseInt(rawValue.trim(), 10);
    const minutes = normalizeTimerMinutes(
      Number.isFinite(parsed) ? parsed : config.settings.defaultTimerMinutes,
    );

    setDefaultTimerDraft(String(minutes));
    if (minutes === config.settings.defaultTimerMinutes) return;

    await persistConfig({
      ...config,
      settings: {
        ...config.settings,
        defaultTimerMinutes: minutes,
      },
    });
  };

  const openRuntimeDataFolder = useCallback(async () => {
    try {
      await openDataFolder();
      showToast("ok", "データフォルダを開きました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `データフォルダを開けません: ${message}`);
    }
  }, [showToast]);


  const {
    copyTodayActivityLog,
    openManualSessionDialog,
    saveManualSession,
    openSessionEditDialog,
    saveSessionEdit,
    requestSessionDelete,
  } = useSessionLogs({
    activeView,
    config,
    dailyActivityCopying,
    manualSessionDraft,
    persistConfig,
    refreshRecords,
    refreshSessions,
    refreshTodayActivity,
    requestConfirmation,
    sessionEditDraft,
    sessionEntries,
    setDailyActivityCopying,
    setManualSessionDraft,
    setSessionEditDraft,
    setSessionEntries,
    setSessionSummary,
    showToast,
  });

  const {
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
  } = useSettingsAndMaintenance({
    actions: {
      persistConfig,
      refreshRecords,
      refreshSessions,
      refreshTodayActivity,
      requestConfirmation,
      requestDiscardConfirmation,
      saveDefaultTimerMinutes,
      showToast,
    },
    refs: {
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
    },
    setters: {
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
    },
    state: {
      activeView,
      config,
      nextStepEditDraft,
      settingsDraft,
      shortcutRecordingField,
      softwareResetChoiceBusy,
      testProfile,
    },
  });

  useEffect(() => {
    if (!shortcutRecordingField) return;
    const captureShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        void finishShortcutRecording();
        return;
      }
      const shortcut = shortcutFromKeyboardEvent(event);
      if (shortcut === undefined) return;
      if (shortcut === null) {
        showToast("warn", "英数字、F1〜F12、Spaceのいずれかを押してください");
        return;
      }
      setSettingsDraft((current) =>
        current ? { ...current, [shortcutRecordingField]: shortcut } : current,
      );
      void finishShortcutRecording();
    };
    window.addEventListener("keydown", captureShortcut, true);
    return () => window.removeEventListener("keydown", captureShortcut, true);
  }, [finishShortcutRecording, shortcutRecordingField, showToast]);

  useEffect(() => {
    if (settingsDraft !== null || !shortcutCaptureActiveRef.current) return;
    void finishShortcutRecording();
  }, [finishShortcutRecording, settingsDraft]);


  const requestCloseButtonEdit = useCallback(() => {
    if (!buttonEditDraft) return;
    const hasChanges =
      !buttonEditInitialDraft ||
      JSON.stringify(buttonEditDraft) !== JSON.stringify(buttonEditInitialDraft);
    if (hasChanges) {
      requestDiscardConfirmation(() => {
        setButtonEditDraft(null);
        setButtonEditInitialDraft(null);
      });
      return;
    }
    setButtonEditDraft(null);
    setButtonEditInitialDraft(null);
  }, [buttonEditDraft, buttonEditInitialDraft, requestDiscardConfirmation]);


  const closeTodayPicker = useCallback(() => {
    const opener = todayPickerOpenerRef.current;
    todayPickerOpenerRef.current = null;
    setTodayPickerOpen(false);
    setTodayPickerDraftItems([]);
    setTodayPickerSaving(false);
    setTodayPickerDragIndex(null);
    setTodayPickerFilter("all");
    setTodayPickerAddedWishes([]);
    setTodayPickerQuickText("");
    window.requestAnimationFrame(() => {
      // Never steal focus from a dialog that opened while the Picker was closing. The Picker itself
      // stays in the DOM while its close motion runs (V164), so focus still inside it means「戻す」.
      const active = document.activeElement;
      const insideClosingPicker =
        active instanceof HTMLElement && active.closest(".todayPickerDialog") !== null;
      if (active instanceof HTMLElement && active !== document.body && !insideClosingPicker) return;
      if (opener?.isConnected) opener.focus();
    });
  }, []);

  // P10-10 (§6.1): closing never saves; a changed draft only asks before discarding it.
  // V163-B7: wishes added in the Picker and an unsent quick-add line count as unsaved too.
  const requestCloseTodayPicker = useCallback(() => {
    if (todayPickerSaving) return;
    const dirty =
      JSON.stringify(todayPickerDraftItems) !== JSON.stringify(todayPickerInitialItemsRef.current) ||
      todayPickerAddedWishes.length > 0 ||
      todayPickerQuickText.trim().length > 0;
    if (dirty) {
      requestDiscardConfirmation(() => {
        closeTodayPicker();
        return true;
      });
      return;
    }
    closeTodayPicker();
  }, [
    closeTodayPicker,
    requestDiscardConfirmation,
    todayPickerAddedWishes,
    todayPickerDraftItems,
    todayPickerQuickText,
    todayPickerSaving,
  ]);

  const openTodayPicker = useCallback((opener: HTMLElement) => {
    if ((configRef.current?.today.items.length ?? TODAY_ITEM_LIMIT) >= TODAY_ITEM_LIMIT) return;
    const initialItems = (configRef.current?.today.items ?? []).map((item) => ({
      ...item,
      ...(item.buttonIds ? { buttonIds: [...item.buttonIds] } : {}),
    }));
    todayPickerOpenerRef.current = opener;
    todayPickerInitialItemsRef.current = initialItems;
    setTodayPickerDraftItems(initialItems);
    setTodayPickerDragIndex(null);
    // V163-B7: every open starts on すべて with no quick-added wishes and an empty quick-add line.
    setTodayPickerFilter("all");
    setTodayPickerAddedWishes([]);
    setTodayPickerQuickText("");
    setTodayPickerOpen(true);
  }, []);


  const refreshInstructionChoicesRef = useRef<() => Promise<void>>(async () => {});

  const withoutSourceFromToday = (currentConfig: AppConfig, sourceKeys: string[]) => {
    const matchingSourceKeys = new Set(sourceKeys);
    const selectionMutationTokens = { ...currentConfig.today.selectionMutationTokens };
    sourceKeys.forEach((sourceKey) => delete selectionMutationTokens[sourceKey]);
    return {
      ...currentConfig.today,
      items: currentConfig.today.items.filter(
        (item, todayIndex) => !matchingSourceKeys.has(todaySourceKey(item, todayIndex)),
      ),
      candidateExcludedSourceKeys: currentConfig.today.candidateExcludedSourceKeys.filter(
        (sourceKey) => !matchingSourceKeys.has(sourceKey),
      ),
      selectionMutationTokens,
    };
  };

  const {
    inboxDraft,
    setInboxDraft,
    inboxAddProjectId,
    setInboxAddProjectId,
    inboxAddOpen,
    inboxAddSaving,
    inboxAddError,
    setInboxAddError,
    inboxEditingIndex,
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
  } = useWishlistAndSources({
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
    refreshInstructionChoices: () => refreshInstructionChoicesRef.current(),
    withoutSourceFromToday,
    projectsById,
  });

  const {
    chooseLegacyNextStepSettings,
    clearProjectNextStep,
    openNextStepEditor,
    openProjectAddDialog,
    openProjectEditDialog,
    openProjectManagement,
    promoteInboxToNextStep,
    promoteWishlistToProject,
    refreshInstructionChoices,
    removeProjectNextStep,
    requestProjectDeletion,
    saveNextStepEdit,
    saveProjectEdit,
    selectNextStepDecisionMode,
    selectNextStepProject,
    setProjectWeeklyFocus,
    setWeeklyReviewProjectFocus,
  } = useProjectsAndNextSteps({
    activeTimerRef,
    closeNextStepEditDialog,
    closeProjectEditDialog,
    config,
    configRef,
    now,
    persistConfig,
    projectsById,
    refreshInstructionChoicesRef,
    requestConfirmation,
    requestDiscardConfirmation,
    captureDialogReturnFocus,
    restoreDialogFocus,
    saveSourceEdit,
    setSourceEditSaving,
    setContextMenu,
    setProjectsOpen,
    showToast,
    sourceEditBlockReason,
    sourceEditBlocked,
    sourceEditBusyRef,
    sourceEditOriginRef,
    warnSourceEditBlocked,
    withoutSourceFromToday,
    projectNextStepSuggestions,
    setProjectNextStepSuggestions,
    projectEditDraft,
    setProjectEditDraft,
    projectEditSaving,
    setProjectEditSaving,
    nextStepEditDraft,
    setNextStepEditDraft,
    nextStepOpenMenuOpen,
    setNextStepOpenMenuOpen,
    nextStepOpenPicker,
    setNextStepOpenPicker,
    instructionChoices,
    setInstructionChoices,
    instructionChoicesLoading,
    setInstructionChoicesLoading,
    instructionChoicesError,
    setInstructionChoicesError,
    instructionSettingsBusy,
    setInstructionSettingsBusy,
    projectEditSavingRef,
    projectEditInitialDraftRef,
    nextStepEditInitialDraftRef,
    projectEditReturnFocusRef,
    nextStepEditReturnFocusRef,
    projectSelectableButtons,
    refreshNextStepSuggestions,
  });
  refreshInstructionChoicesRef.current = refreshInstructionChoices;

  const dismissNonCriticalModal = useCallback(() => {
    if (sourceEditBusyRef.current || projectEditSavingRef.current) return;
    if (todayPickerOpen) {
      requestCloseTodayPicker();
      return;
    }
    if (inboxAddOpen) {
      closeInboxAddDialog();
      return;
    }
    if (inboxEditingIndex !== null) {
      closeInboxEditDialog();
      return;
    }
    if (helpGuideOpen) {
      setHelpGuideOpen(false);
      return;
    }
    if (settingsDraft) {
      requestCloseSettings();
      return;
    }
    if (dropDraft) {
      setDropDraft(null);
      return;
    }
    if (sessionEditDraft) {
      setSessionEditDraft(null);
      return;
    }
    if (manualSessionDraft) {
      setManualSessionDraft(null);
      return;
    }
    if (buttonEditDraft) {
      requestCloseButtonEdit();
      return;
    }
    if (projectEditDraft) {
      closeProjectEditDialog();
      return;
    }
    if (nextStepEditDraft) {
      closeNextStepEditDialog();
      return;
    }
    if (completionFollowup) {
      setCompletionFollowup(null);
      return;
    }
    if (groupRenameDraft) {
      setGroupRenameDraft(null);
      return;
    }
    if (groupDraft !== null) setGroupDraft(null);
  }, [
    buttonEditDraft,
    closeNextStepEditDialog,
    closeProjectEditDialog,
    closeInboxAddDialog,
    closeInboxEditDialog,
    dropDraft,
    groupDraft,
    groupRenameDraft,
    helpGuideOpen,
    inboxAddOpen,
    inboxEditingIndex,
    manualSessionDraft,
    projectEditDraft,
    nextStepEditDraft,
    completionFollowup,
    requestCloseButtonEdit,
    requestCloseSettings,
    sessionEditDraft,
    settingsDraft,
    todayPickerOpen,
    requestCloseTodayPicker,
    sourceEditBusyRef,
  ]);

  const hasDismissibleModal = Boolean(
    inboxAddOpen ||
    todayPickerOpen ||
    inboxEditingIndex !== null ||
    helpGuideOpen ||
    settingsDraft ||
    dropDraft ||
    sessionEditDraft ||
    manualSessionDraft ||
    buttonEditDraft ||
    projectEditDraft ||
    nextStepEditDraft ||
    completionFollowup ||
    groupRenameDraft ||
    groupDraft !== null,
  );

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        completionPrompt ||
        confirmDialog ||
        earlyStop ||
        !hasDismissibleModal
      )
        return;
      event.preventDefault();
      dismissNonCriticalModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [completionPrompt, confirmDialog, earlyStop, dismissNonCriticalModal, hasDismissibleModal]);

  // P10-03: Ctrl+F opens the search window from the main window (the dictionary and the
  // instruction viewer keep their own handling).
  useEffect(() => {
    const openOnCtrlF = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || !event.ctrlKey) return;
      if (event.altKey || event.metaKey || event.shiftKey) return;
      if (event.repeat) return;
      if (event.isComposing || event.keyCode === 229) return;
      // The main window always swallows Ctrl+F, even when the search window cannot open
      // (a dialog or a menu is up): WebView2's own find bar must never come up. Only the
      // Japanese conversion case above is left alone.
      event.preventDefault();
      if (activeView !== "main") return;
      if (completionPrompt || confirmDialog || earlyStop) return;
      if (contextMenu) return;
      if (hasDismissibleModal && !searchOpen) return;
      openSearchRef.current();
    };
    window.addEventListener("keydown", openOnCtrlF, true);
    return () => window.removeEventListener("keydown", openOnCtrlF, true);
  }, [
    activeView,
    completionPrompt,
    confirmDialog,
    contextMenu,
    earlyStop,
    hasDismissibleModal,
    searchOpen,
  ]);
  // P10-02: F1 opens the guide from the main window. It stays out of the way when a dialog or a
  // menu is open, while Japanese input is composing, or when the dictionary key is exactly F1.
  useEffect(() => {
    const openGuideOnF1 = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "F1") return;
      if (event.isComposing || event.keyCode === 229) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (activeView !== "main") return;
      if (hasDismissibleModal || completionPrompt || confirmDialog || earlyStop) return;
      if (contextMenu) return;
      const launcherKey = (config?.settings.launcherHotkey ?? "").trim().toUpperCase();
      if (launcherKey === "F1") return;
      event.preventDefault();
      setHelpGuideOpen(true);
    };
    window.addEventListener("keydown", openGuideOnF1);
    return () => window.removeEventListener("keydown", openGuideOnF1);
  }, [
    activeView,
    completionPrompt,
    config?.settings.launcherHotkey,
    confirmDialog,
    contextMenu,
    earlyStop,
    hasDismissibleModal,
  ]);

  useEffect(() => {
    if (
      confirmDialog ||
      earlyStop ||
      helpGuideOpen ||
      (!hasDismissibleModal && !completionPrompt)
    ) {
      return;
    }

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const topSurface = () => {
      const surfaces = document.querySelectorAll<HTMLElement>(
        '.modalBackdrop:not([data-exiting="true"])',
      );
      return surfaces.item(surfaces.length - 1)?.querySelector<HTMLElement>("section") ?? null;
    };
    const focusableInside = (surface: HTMLElement) =>
      Array.from(
        surface.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const focusFrame = window.requestAnimationFrame(() => {
      const surface = topSurface();
      if (!surface || surface.contains(document.activeElement)) return;
      (
        surface.querySelector<HTMLElement>("[data-initial-focus]:not([disabled])") ??
        focusableInside(surface)[0] ??
        surface
      ).focus();
    });
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const surface = topSurface();
      if (!surface) return;
      const controls = focusableInside(surface);
      if (controls.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!surface.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", trapFocus, true);
      opener?.focus();
    };
  }, [
    completionPrompt,
    confirmDialog,
    earlyStop,
    hasDismissibleModal,
    helpGuideOpen,
  ]);




  useEffect(() => {
    if (!softwareResetChoiceOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || softwareResetChoiceBusy) return;
      event.preventDefault();
      event.stopPropagation();
      closeSoftwareResetChoice();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [closeSoftwareResetChoice, softwareResetChoiceBusy, softwareResetChoiceOpen]);

  useEffect(() => {
    if (softwareResetStage === "idle") return;
    window.requestAnimationFrame(() => softwareResetProgressRef.current?.focus());
  }, [softwareResetStage]);


  const runActions = useCallback(
    async (id: string, actions: LauncherAction[]) => {
      if (actions.length === 0) {
        showToast("warn", "ボタン編集で実行するアクションを追加してください");
        return;
      }

      setPendingActionId(id);
      try {
        const results = await executeActions(actions);
        const summary = formatActionSummary(results);
        showToast(summary.tone, summary.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `実行できません: ${message}`);
      } finally {
        setPendingActionId(null);
      }
    },
    [showToast],
  );

  const revealButtonInExplorer = useCallback(
    async (button: LauncherButton) => {
      try {
        await revealLauncherItem(button.id);
      } catch {
        showToast("error", "エクスプローラーで表示できませんでした");
      }
    },
    [showToast],
  );

  const toggleGroupCollapsed = (groupName: string) => {
    setCollapsedGroups((current) => {
      const next = { ...current, [groupName]: !current[groupName] };
      writeCollapsedGroups(next);
      return next;
    });
  };

  const {
    announceReorder,
    cancelInboxPointerDrag,
    cancelProjectPointerDrag,
    cancelSidebarGroupPointerDrag,
    cancelSidebarPointerDrag,
    cancelTodayPointerDrag,
    cancelWishlistGroupPointerDrag,
    closeImportDialog,
    finishInboxPointerDrag,
    finishProjectPointerDrag,
    finishSidebarGroupPointerDrag,
    finishSidebarPointerDrag,
    finishTodayPointerDrag,
    finishWishlistGroupPointerDrag,
    handleDomDragOver,
    handleDomDrop,
    handleImported,
    moveInboxItemByOffset,
    moveSidebarButtonByOffset,
    moveSidebarGroupByOffset,
    moveTodayItemByOffset,
    openImportDialog,
    startInboxPointerDrag,
    startProjectPointerDrag,
    startSidebarGroupPointerDrag,
    startSidebarPointerDrag,
    startTodayPointerDrag,
    startWishlistGroupPointerDrag,
    toggleWishlistGroup,
    updateInboxPointerDrag,
    updateProjectPointerDrag,
    updateSidebarGroupPointerDrag,
    updateSidebarPointerDrag,
    updateTodayPointerDrag,
    updateWishlistGroupPointerDrag,
  } = useDashboardDragAndDrop({
    actions: {
      addCandidateToToday,
      isTimerActiveForSource,
      persistConfig,
      promoteWishlistToProject,
      removeProjectNextStep,
      removeTodayItem,
      runActions,
      showToast,
      sourceEditBlocked,
      sourceEditBlockReason,
      toggleGroupCollapsed,
      warnSourceEditBlocked,
    },
    refs: {
      activeTimerRef,
      configRef,
      dragPathsRef,
      importOpenerRef,
      inboxPointerDragRef,
      lastDropRef,
      mainScrollAreaRef,
      projectAutoScrollFrameRef,
      projectAutoScrollSpeedRef,
      projectPointerDragRef,
      sidebarGroupPointerDragRef,
      sidebarPointerDragRef,
      todayPointerDragRef,
      wishlistGroupPointerDragRef,
    },
    setters: {
      setActionDragId,
      setBuilderKind,
      setConfig,
      setContextMenu,
      setDragActive,
      setDropDraft,
      setImportDialogOpen,
      setImportInitialError,
      setImportInitialText,
      setInboxPointerDrag,
      setJsonDrop,
      setOverlayPageDragId,
      setProjectPointerDrag,
      setReorderAnnouncement,
      setSidebarGroupPointerDrag,
      setSidebarPointerDrag,
      setTodayPointerDrag,
      setWishlistGroupPointerDrag,
      setWishlistGroupViews,
    },
    state: {
      config,
      groupNames,
      overlayPages,
    },
  });
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (matchesHotkey(event, config?.settings.launcherHotkey)) {
        event.preventDefault();
        const visualQa = Boolean(
          (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: boolean })
            .__LIFE_LAUNCHER_VISUAL_QA__,
        );
        // V163-S2: without the old launcher overlay, outside Tauri this shortcut does nothing.
        if (isTauri() && !visualQa) {
          void toggleDictionaryFromShortcut();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [config?.settings.launcherHotkey, toggleDictionaryFromShortcut]);

  const {
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
  } = useLauncherButtons({
    actions: { persistConfig, refreshButtonIcon, requestConfirmation, showToast },
    setters: {
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
    },
    state: {
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
    },
  });

  // P10-09 (§8.1): preselect the first wishlist item, else "repeat", else "write".
  useEffect(() => {
    if (!completionFollowup) return;
    const current = configRef.current;
    const projectId = completionFollowup.source.projectId;
    const firstWishlist = current?.inbox.find(
      (item) => item.projectId === projectId && Boolean(item.id),
    );
    if (firstWishlist?.id) {
      setCompletionFollowupChoice(`wishlist:${firstWishlist.id}`);
    } else if (completionFollowup.previousNextStep) {
      setCompletionFollowupChoice("repeat");
    } else {
      setCompletionFollowupChoice("write");
    }
  }, [completionFollowup]);
  const queueCompletionFollowup = (
    key: string,
    source: TodayCompletionSource | null,
    text: string,
    previousNextStep?: LauncherNextStep,
    minutes?: number,
    startedAt?: string,
    endedAt?: string,
  ) => {
    if (!source || queuedCompletionFollowupsRef.current.has(key)) return;
    // P10-09 (§8.1): a Next Step completion always asks where to start next, even when the
    // Project has no wishlist items yet.
    if (source.kind === "nextStep" && !source.isCurrentSnapshot) return;
    queuedCompletionFollowupsRef.current.add(key);
    if (completionFollowupTimerRef.current !== null) {
      window.clearTimeout(completionFollowupTimerRef.current);
    }
    const showFollowup = () => {
      completionFollowupTimerRef.current = null;
      if (source.kind === "nextStep") {
        // The Project must still be there and its Next Step must still be empty.
        const current = configRef.current;
        const project = current?.projects.find((item) => item.id === source.projectId);
        if (project && !project.nextStep?.text.trim()) {
          setCompletionFollowup({ key, source, text, minutes, previousNextStep, startedAt, endedAt });
        }
        return;
      }
      if (confirmDialogRef.current) {
        completionFollowupTimerRef.current = window.setTimeout(showFollowup, 250);
        return;
      }
      requestConfirmation({
        title: "この「やりたいこと」はどうしますか？",
        subject: `「${text}」`,
        message: "完了にすると、やりたいことから外します。今日の3件と実行記録は残ります。",
        confirmLabel: "完了にする",
        cancelLabel: "まだやりたい",
        onConfirm: async () => {
          const current = configRef.current;
          if (!current) return false;
          const next = completeWishlistAfterToday(
            current,
            source,
            text,
            new Date().toISOString(),
            createStableId(),
          );
          if (!next) {
            showToast("warn", "元のやりたいことが見つかりません");
            return false;
          }
          return persistConfig(next);
        },
      });
    };
    completionFollowupTimerRef.current = window.setTimeout(showFollowup, 1100);
  };

  const recordTimerSession = useCallback(
    async (timer: ActiveTimer, stoppedAt: number, reason: "manual" | "switch" | "complete") => {
      const minutes = sessionMinutes(timer, stoppedAt);

      if (minutes < SESSION_MINIMUM_MINUTES) {
        if (reason === "manual" || reason === "switch") {
          showToast("warn", "1分未満なので記録しませんでした");
        }
        return true;
      }

      try {
        const response = await recordSession({
          projectId: timer.projectId,
          label: timer.label,
          startedAt: timer.startedAt,
          minutes,
          note: timer.note,
        });
        setTodaySessionMinutes(response.totalMinutes);
        setTodaySessionDate(response.date);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `記録できません: ${message}`);
        return false;
      }
      // A refresh error after append must never cause a second Session append.
      try {
        if (!timer.doNowSnapshot || reason !== "complete") await refreshDoNow();
        await refreshTodayActivity();
        // P97-02 C: 記録画面を開いたままでも集計がすぐ新しくなるように、
        // 記録に成功したあとだけ記録画面のデータを読み直す（記録の処理は増やさない）。
        await refreshRecords();
      } catch {
        showToast("warn", "記録は保存しましたが、表示を更新できませんでした");
      }
      showToast("ok", `${timer.label} ${minutes}分を記録しました`);
      return true;
    },
    [refreshDoNow, refreshTodayActivity, refreshRecords, showToast],
  );

  const finishTimer = useCallback(
    async (requested: ActiveTimer, reason: "manual" | "switch" | "complete" = "manual") => {
      const timer = activeTimerRef.current;
      if (
        !timer ||
        timer.instanceId !== requested.instanceId ||
        finishingTimerRef.current !== null ||
        earlyStopRef.current ||
        (plannedCommitRef.current && reason !== "complete")
      )
        return false;
      const stoppedAt = Date.now();
      const metrics = timerMetrics(timer, stoppedAt);
      if (
        reason === "manual" &&
        timer.mode === "countdown" &&
        timer.targetMinutes !== null &&
        metrics.remainingSeconds !== null &&
        metrics.remainingSeconds <= 0
      ) {
        setCompletionPrompt({
          sourceId: timer.sourceId,
          projectId: timer.projectId,
          targetMinutes: timer.targetMinutes,
          label: timer.label,
          actionText: timer.actionText,
        });
        return false;
      }
      const item =
        reason === "manual"
          ? earlyCompletionItem(configRef.current?.today.items ?? [], timer, metrics.elapsedSeconds)
          : undefined;
      if (item?.sourceKey) {
        const pending = { timer, sourceKey: item.sourceKey.trim(), stoppedAt, recorded: false };
        earlyStopRef.current = pending;
        setEarlyStop(pending);
        const frozen = timer.paused
          ? timer
          : { ...timer, paused: true, pausedStartedAtMs: stoppedAt };
        activeTimerRef.current = frozen;
        setActiveTimer(frozen);
        void focusDashboardWindow().catch(() => undefined);
        return false;
      }
      finishingTimerRef.current = timer.instanceId;
      try {
        const saved = await recordTimerSession(timer, stoppedAt, reason);
        if (saved && activeTimerRef.current?.instanceId === timer.instanceId) {
          activeTimerRef.current = null;
          setActiveTimer(null);
          setCompletionPrompt(null);
        }
        return saved;
      } finally {
        finishingTimerRef.current = null;
      }
    },
    [recordTimerSession],
  );

  const showTimerCompletionFeedback = (
    timer: ActiveTimer,
    current: AppConfig,
    nextItems: AppConfig["today"]["items"],
    completedSourceKey: string | null,
    stoppedAt: number,
  ) => {
    const key = `timer:${current.today.date}:${timer.instanceId}`;
    if (timer.doNowSnapshot && (timer.continuedAfterCompletion || !completedSourceKey)) {
      setDoNowCompletionHold({
        ...timer.doNowSnapshot,
        date: current.today.date,
        minutes: sessionMinutes(timer, stoppedAt),
      });
    }
    if (completedSourceKey && timer.doNowSnapshot) {
      setDoNowExcludedProjectId(timer.doNowSnapshot.projectId);
      setDoNowPickedProjectId(null);
    }
    if (completedSourceKey && nextItems.length === 3 && nextItems.every((item) => item.done)) {
      showCompletionFeedback({ key, kind: "todayAll", label: timer.note || timer.label });
      return;
    }
    if (completedSourceKey) {
      showCompletionFeedback({
        key,
        kind: "today",
        label: timer.note || timer.label,
        sourceKey: completedSourceKey,
      });
      return;
    }
  };

  const resolveEarlyStop = async (complete: boolean) => {
    const pending = earlyStopRef.current;
    if (
      !pending ||
      finishingTimerRef.current !== null ||
      activeTimerRef.current?.instanceId !== pending.timer.instanceId
    )
      return false;
    finishingTimerRef.current = pending.timer.instanceId;
    setEarlyStopSaving(true);
    try {
      if (!pending.recorded) {
        if (!(await recordTimerSession(pending.timer, pending.stoppedAt, "manual"))) return false;
        pending.recorded = true;
      }
      // Session is durable before updating Today3; a failed config write rolls back only Today3.
      if (complete) {
        const current = configRef.current;
        if (current) {
          const completedItem = current.today.items.find(
            (item, index) => todaySourceKey(item, index) === pending.sourceKey && !item.done,
          );
          const prepared = completeTodayItemAndPrepareSource(
            current,
            pending.sourceKey,
            new Date().toISOString(),
            createStableId(),
          );
          const completedSourceKey = prepared.config === current ? null : pending.sourceKey;
          const saved = prepared.config === current ? true : await persistConfig(prepared.config);
          if (saved && completedSourceKey) {
            showTimerCompletionFeedback(
              pending.timer,
              current,
              prepared.config.today.items,
              completedSourceKey,
              pending.stoppedAt,
            );
            queueCompletionFollowup(
              `timer:${current.today.date}:${pending.timer.instanceId}:${completedSourceKey}`,
              prepared.source,
              completedItem?.text ?? pending.timer.note ?? pending.timer.label,
              prepared.source?.projectId
                ? current.projects.find((project) => project.id === prepared.source!.projectId)
                    ?.nextStep
                : undefined,
              sessionMinutes(pending.timer, pending.stoppedAt),
              new Date(pending.timer.startedAtMs).toISOString(),
              new Date(pending.stoppedAt).toISOString(),
            );
          }
        }
      }
      earlyStopRef.current = null;
      setEarlyStop(null);
      activeTimerRef.current = null;
      setActiveTimer(null);
      return true;
    } finally {
      finishingTimerRef.current = null;
      setEarlyStopSaving(false);
    }
  };

  useEffect(() => {
    if (
      !activeTimer ||
      activeTimer.mode !== "countdown" ||
      activeTimer.targetMinutes === null ||
      activeTimer.paused ||
      !currentTimerMetrics ||
      finishingTimerRef.current !== null ||
      plannedCommitRef.current
    )
      return;
    if (
      currentTimerMetrics.remainingSeconds !== null &&
      currentTimerMetrics.remainingSeconds <= 0
    ) {
      if (
        completionPrompt?.sourceId === activeTimer.sourceId &&
        completionPrompt.targetMinutes === activeTimer.targetMinutes
      ) {
        return;
      }

      // V151-S7: stop counting at the planned end while the prompt waits for an answer.
      const expiredAtMs = plannedEndAtMs(activeTimer);
      if (expiredAtMs !== null && activeTimer.expiredAtMs == null) {
        const frozen = { ...activeTimer, expiredAtMs };
        activeTimerRef.current = frozen;
        setActiveTimer(frozen);
      }
      setCompletionPrompt({
        sourceId: activeTimer.sourceId,
        projectId: activeTimer.projectId,
        targetMinutes: activeTimer.targetMinutes,
        label: activeTimer.label,
        actionText: activeTimer.actionText,
      });
      void focusDashboardWindow().catch(() => undefined);
      void notifyTimerComplete(activeTimer.label).catch(() => undefined);
    }
  }, [activeTimer, completionPrompt, currentTimerMetrics]);

  const startTimer = useCallback(
    async (
      sourceId: string,
      label: string,
      projectId: string | null,
      actions: LauncherAction[] = [],
      targetMinutes?: number,
      noteOverride?: string,
      instructionPathOverride?: string,
      instructionOpenOnStartOverride?: boolean,
      mode: TimerMode = "countdown",
      doNowProject?: LauncherProject,
      expandOnStart = false,
    ) => {
      const cleanLabel = label.trim();
      if (
        !config ||
        !cleanLabel ||
        (sourceEditBusyRef.current !== null &&
          timerSourceKey(configRef.current ?? config, sourceId) === sourceEditBusyRef.current) ||
        earlyStopRef.current ||
        finishingTimerRef.current !== null ||
        plannedCommitRef.current
      )
        return;

      const requestId = ++timerStartRequestRef.current;
      const previousTimer = activeTimerRef.current;
      if (previousTimer) {
        if (!(await finishTimer(previousTimer, "switch"))) return;
      }

      if (requestId !== timerStartRequestRef.current) return;
      setDoNowCompletionHold(null);
      setCompletionPrompt(null);
      const start = new Date();
      const timerConfig = configRef.current ?? config;
      const directTodayItem = sourceId.startsWith("today:")
        ? timerConfig.today.items.find(
            (item, index) => todayTimerSourceId(item, index) === sourceId,
          )
        : undefined;
      const sourceGenerationId = sourceId.startsWith("today:")
        ? directTodayItem?.sourceGenerationId
        : projectId !== null && sourceId === projectId
          ? timerConfig.projects.find((project) => project.id === projectId)?.nextStep?.generationId
          : undefined;
      const resolvedTargetMinutes =
        mode === "countdown" ? (targetMinutes ?? config.settings.defaultTimerMinutes) : null;
      const fallbackNote =
        projectId !== null
          ? (config.projects.find((project) => project.id === projectId)?.nextStep?.text ?? "")
          : cleanLabel;
      const note = noteOverride?.trim() || fallbackNote;
      const startedNextStepText =
        projectId !== null && sourceId === projectId
          ? timerConfig.projects.find((project) => project.id === projectId)?.nextStep?.text
          : undefined;
      const actionText =
        (sourceId.startsWith("today:") ? directTodayItem?.text : startedNextStepText)?.trim() ||
        cleanLabel;
      setNow(start.getTime());
      const nextTimer: ActiveTimer = {
        instanceId: requestId,
        sourceId,
        ...(sourceGenerationId ? { sourceGenerationId } : {}),
        projectId,
        label: cleanLabel,
        note,
        actionText,
        ...(doNowProject && {
          doNowSnapshot: {
            projectId: doNowProject.id,
            projectName: doNowProject.name,
            colorId: doNowProject.colorId,
            taskText: doNowProject.nextStep?.text.trim() || note,
          },
        }),
        mode,
        startedAtMs: start.getTime(),
        startedAt: formatStartedAt(start),
        targetMinutes: resolvedTargetMinutes,
        paused: false,
        pausedStartedAtMs: null,
        pausedTotalMs: 0,
      };
      activeTimerRef.current = nextTimer;
      setActiveTimer(nextTimer);
      setExpandedTimerOpen(expandOnStart);

      if (actions.length > 0) {
        void runActions(sourceId, actions);
      }

      const project = projectId ? config.projects.find((item) => item.id === projectId) : undefined;
      const instructionPath = instructionPathOverride?.trim() || project?.nextStep?.instructionPath;
      const opensInstruction = instructionPathOverride?.trim()
        ? instructionOpenOnStartOverride !== false
        : project?.nextStep?.instructionOpenOnStart !== false;
      if (instructionPath && opensInstruction) {
        void openInstructionWindow({ path: instructionPath, focus: false }).catch((error) => {
          showToast(
            "warn",
            `タイマーは開始しましたが、手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
      if (expandOnStart) {
        const mainWindow = getCurrentWindow();
        const [visible, minimized] = await Promise.all([
          mainWindow.isVisible().catch(() => true),
          mainWindow.isMinimized().catch(() => false),
        ]);
        if (!visible || minimized) void returnToMain().catch(() => undefined);
      }
    },
    [config, finishTimer, returnToMain, runActions, showToast, sourceEditBusyRef],
  );

  const markNextStepReviewed = async (projectId: string) => {
    if (!config) return false;
    // P10-05: one press at a time — the button is disabled while the save runs.
    if (nextStepReviewBusy === projectId) return false;
    setNextStepReviewBusy(projectId);
    const reviewedAt = new Date().toISOString();
    const saved = await persistConfig({
      ...config,
      projects: config.projects.map((project) =>
        project.id === projectId && project.nextStep
          ? { ...project, nextStep: { ...project.nextStep, reviewedAt } }
          : project,
      ),
    });
    if (saved) {
      setStaleNextStepProjectIds((ids) => ids.filter((id) => id !== projectId));
    }
    setNextStepReviewBusy(null);
    return saved;
  };

  const refreshMissingLaunchTargets = useCallback(async () => {
    const requestId = ++missingTargetsRequestRef.current;
    try {
      const response = await loadMissingLaunchTargets();
      if (requestId !== missingTargetsRequestRef.current) return;
      setMissingButtonIds(new Set(response.missingButtonIds));
      setMissingInstructionProjectIds(new Set(response.missingInstructionProjectIds));
    } catch {
      // Quietly keep the previous missing-target state when checking fails.
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    const timer = window.setTimeout(() => {
      void refreshMissingLaunchTargets();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [config, refreshMissingLaunchTargets]);

  useEffect(() => {
    const handleFocus = () => {
      if (!configRef.current) return;
      void refreshMissingLaunchTargets();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshMissingLaunchTargets]);

  const prevCompletionPromptRef = useRef<TimerCompletionPrompt | null>(null);
  useEffect(() => {
    const previous = prevCompletionPromptRef.current;
    prevCompletionPromptRef.current = completionPrompt;
    if (!previous && completionPrompt) {
      const project = completionPrompt.projectId
        ? configRef.current?.projects.find(
            (candidate) => candidate.id === completionPrompt.projectId,
          )
        : undefined;
      setTimerResumeDraft(project?.nextStep?.resumeNote ?? "");
      setCompletionExtendDraft(
        String(configRef.current?.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES),
      );
    } else if (!completionPrompt) {
      setTimerResumeDraft("");
    }
  }, [completionPrompt]);

  // V163-B4: an empty or invalid entry falls back to the setting (or 15), then stays in 1..240.
  const completionExtendMinutes = (() => {
    const fallback = config?.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES;
    const parsed = Number.parseInt(completionExtendDraft, 10);
    return normalizeTimerMinutes(Number.isFinite(parsed) && parsed > 0 ? parsed : fallback);
  })();

  const continueCompletedTimer = () => {
    if (
      !completionPrompt ||
      completionResumeSavingRef.current ||
      plannedCommitRef.current ||
      finishingTimerRef.current !== null
    )
      return;
    if (!activeTimer || activeTimerRef.current?.instanceId !== activeTimer.instanceId) return;
    setCompletionPrompt(null);
    const continuedAt = Date.now();
    setNow(continuedAt);
    setActiveTimer((timer) => {
      if (
        !timer ||
        timer.sourceId !== completionPrompt.sourceId ||
        timer.targetMinutes !== completionPrompt.targetMinutes
      ) {
        return timer;
      }

      // V151-S7: the time spent on the prompt is not counted; the extension starts from the press.
      const waitedMs =
        timer.expiredAtMs != null ? Math.max(0, continuedAt - timer.expiredAtMs) : 0;
      const extended = {
        ...timer,
        continuedAfterCompletion: true,
        targetMinutes:
          (timer.targetMinutes ?? completionPrompt.targetMinutes) + completionExtendMinutes,
        pausedTotalMs: timer.pausedTotalMs + waitedMs,
        expiredAtMs: null,
      };
      activeTimerRef.current = extended;
      return extended;
    });
  };

  const finishCompletedTimer = () => {
    if (plannedCommitRef.current || finishingTimerRef.current !== null || earlyStopRef.current)
      return;
    const completedTimer = activeTimerRef.current;
    if (!completedTimer || activeTimer?.instanceId !== completedTimer.instanceId) return;
    if (
      !completedTimer.continuedAfterCompletion &&
      (!completionPrompt || completedTimer.sourceId !== completionPrompt.sourceId)
    ) {
      setCompletionPrompt(null);
      return;
    }

    plannedCommitRef.current = true;
    const stoppedAt = Date.now();
    if (completedTimer.doNowSnapshot && completedTimer.continuedAfterCompletion && configRef.current) {
      setDoNowCompletionHold({
        ...completedTimer.doNowSnapshot,
        date: configRef.current.today.date,
        minutes: sessionMinutes(completedTimer, stoppedAt),
      });
      setDoNowCompletionSaving(true);
    }
    let completed = false;
    void finishTimer(completedTimer, "complete")
      .then(async (finished) => {
        if (!finished) return false;
        const current = configRef.current;
        if (!current) return true;
        const completedEntry = findTodayEntryForTimer(
          todayEntries(current.today.items),
          completedTimer,
        );
        const prepared = completedEntry
          ? completeTodayItemAndPrepareSource(
              current,
              completedEntry.sourceKey,
              new Date().toISOString(),
              createStableId(),
            )
          : { config: current, source: null };
        if (prepared.config !== current && !(await persistConfig(prepared.config))) return false;

        showTimerCompletionFeedback(
          completedTimer,
          current,
          prepared.config.today.items,
          completedEntry?.sourceKey ?? null,
          stoppedAt,
        );
        if (completedEntry) {
          queueCompletionFollowup(
            `timer:${current.today.date}:${completedTimer.instanceId}:${completedEntry.sourceKey}`,
            prepared.source,
            completedEntry.item.text,
            prepared.source?.projectId
              ? current.projects.find((project) => project.id === prepared.source!.projectId)
                  ?.nextStep
              : undefined,
            sessionMinutes(completedTimer, stoppedAt),
            new Date(completedTimer.startedAtMs).toISOString(),
            new Date(stoppedAt).toISOString(),
          );
        }
        completed = true;
        return true;
      })
      .finally(() => {
        if (completedTimer.doNowSnapshot && completedTimer.continuedAfterCompletion) {
          setDoNowCompletionSaving(false);
          if (!completed) setDoNowCompletionHold(null);
        }
        plannedCommitRef.current = false;
      });
  };

  const finishActiveTimer = (timer: ActiveTimer) => {
    if (activeTimerRef.current?.instanceId !== timer.instanceId) return;
    if (timer.continuedAfterCompletion && timer.doNowSnapshot) finishCompletedTimer();
    else void finishTimer(timer);
  };
  finishActiveTimerRef.current = finishActiveTimer;

  const togglePause = useCallback(() => {
    if (earlyStopRef.current || finishingTimerRef.current !== null || plannedCommitRef.current)
      return;
    // Compute the next state once, outside the state updater: the updater may be called more than
    // once and must not read the clock or write the ref. The display clock (`now`) is aligned to the
    // moment of the press so that rapid pause/resume never leaves it behind pausedTotalMs.
    const timer = activeTimerRef.current;
    // V151-S7: while the planned-time prompt waits, the timer is already stopped at its end.
    if (!timer || timer.expiredAtMs != null) return;
    const current = Date.now();
    const pausedDelta = timer.pausedStartedAtMs ? current - timer.pausedStartedAtMs : 0;
    const nextTimer: ActiveTimer = timer.paused
      ? {
          ...timer,
          paused: false,
          pausedStartedAtMs: null,
          pausedTotalMs: timer.pausedTotalMs + pausedDelta,
        }
      : { ...timer, paused: true, pausedStartedAtMs: current };
    activeTimerRef.current = nextTimer;
    setNow(current);
    setActiveTimer(nextTimer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: Array<() => void> = [];

    const setup = async () => {
      const unlistenReady = await listen(MINI_READY_EVENT, () => {
        void emit(MINI_TIMER_SNAPSHOT_EVENT, miniSnapshotRef.current);
      });
      const unlistenCommand = await listen<MiniTimerCommand>(MINI_TIMER_COMMAND_EVENT, (event) => {
        if (event.payload.action === "pause") {
          togglePause();
          return;
        }
        if (event.payload.action === "finish" && activeTimer) {
          finishActiveTimerRef.current(activeTimer);
        }
      });
      const unlistenReturn = await listen(MINI_RETURN_EVENT, () => {
        void returnToMain().catch((error) =>
          console.error("[mini-mode] メイン復帰に失敗しました", error),
        );
      });

      if (disposed) {
        unlistenReady();
        unlistenCommand();
        unlistenReturn();
      } else {
        cleanup = [unlistenReady, unlistenCommand, unlistenReturn];
      }
    };

    void setup();

    return () => {
      disposed = true;
      cleanup.forEach((dispose) => dispose());
    };
  }, [activeTimer, returnToMain, togglePause]);

  useEffect(() => {
    void emit(MINI_TIMER_SNAPSHOT_EVENT, miniSnapshot);
  }, [miniSnapshot]);

  useEffect(() => {
    if (config?.settings.miniMode !== false) return;
    void hideMiniWindow().catch(() => undefined);
  }, [hideMiniWindow, config?.settings.miniMode]);

  const toggleAutoStart = async () => {
    if (!config) return;
    const nextAutoStart = !config.settings.autoStart;
    try {
      // テスト用の起動では、普段のアプリの自動起動の登録を書き換えない。
      if (!testProfile?.testProfile) {
        if (nextAutoStart) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      }
      await persistConfig({
        ...config,
        settings: { ...config.settings, autoStart: nextAutoStart },
      });
      showToast(
        nextAutoStart ? "ok" : "neutral",
        nextAutoStart ? "PC起動時に開くようにしました" : "PC起動時の起動を止めました",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `自動起動を変更できません: ${message}`);
    }
  };

  const updateVictoryText = (text: string) => {
    if (!config) return Promise.resolve(false);
    if (!text.trim()) {
      seenCompletionFeedbackRef.current.delete(`victory:${config.today.date}`);
      setCompletionFeedback((current) => (current?.kind === "victory" ? null : current));
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
    void persistConfig({ ...current, today: { ...current.today, victory } }).then((saved) => {
      if (saved && victory.done) {
        showCompletionFeedback({
          key: `victory:${current.today.date}`,
          kind: "victory",
          label: text,
        });
      } else if (saved) {
        seenCompletionFeedbackRef.current.delete(`victory:${current.today.date}`);
        setCompletionFeedback((feedback) => (feedback?.kind === "victory" ? null : feedback));
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
    void (victorySaveRef.current ?? Promise.resolve(true)).then((saved) => {
      if (saved) leaveVictoryEditing();
    });
  };

  const sourceSnapshotForUndo = (current: AppConfig, sourceKey: string): unknown | null => {
    if (sourceKey.startsWith("project:")) {
      return current.projects.find((project) => `project:${project.id}` === sourceKey) ?? null;
    }
    if (sourceKey.startsWith("wishlist:")) {
      return current.inbox.find((item) => `wishlist:${item.id}` === sourceKey) ?? null;
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
      (item, itemIndex) => todaySourceKey(item, itemIndex) === sourceKey,
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
    const stableItems = current.today.items.map((item, itemIndex) =>
      item.sourceKey?.trim() ? item : { ...item, sourceKey: todaySourceKey(item, itemIndex) },
    );
    const removedItem = stableItems[index];
    const operationId = createStableId();
    const previousSourceKey = index > 0 ? (stableItems[index - 1]?.sourceKey ?? null) : null;
    const nextSourceKey = stableItems[index + 1]?.sourceKey ?? null;
    const items = stableItems.filter((_, itemIndex) => itemIndex !== index);
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
    const items = config.today.items.map((item, itemIndex) => {
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
    const items = notesHistory.entries.find((entry) => entry.date === date)?.items ?? [];
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

    const nextEntries = notesHistory.entries.map((entry) => {
      if (entry.date !== date) return entry;
      const nextItems = toThreeNoteDraft(entry.items).map((item, itemIndex) =>
        itemIndex === index ? text : item,
      );
      return { ...entry, items: nextItems };
    });
    setNotesHistory({ ...notesHistory, entries: nextEntries });

    scheduleNotesSave(`history-${date}`, async () => {
      try {
        const response = await saveNotesForDate({
          date,
          items: nextEntries.find((entry) => entry.date === date)?.items ?? [],
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
      current.today.items.some((item, index) => matchingSourceKeys.has(todaySourceKey(item, index)))
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
      const rebuilt = current.today.items.map((item) => ({
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
      todayPickerDraftItems.some((item, index) =>
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
    }).find((entry) => entry.sourceKey === wishlistSourceKey(wish, 0));
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
    setTodayPickerDraftItems(todayPickerDraftItems.filter((_, itemIndex) => itemIndex !== index));
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
    if (!config || !allTodayItemsCompleted) return;
    const saved = await persistConfig({
      ...config,
      today: { ...config.today, items: [], selectionMutationTokens: {} },
    });
    if (!saved) return;
    showToast("ok", "次の3件を選べます");
  };


  useEffect(() => {
    const projects = config?.projects ?? [];
    const anchor = projectListAnchorRef.current;
    if (!anchor || projects.length === 0) return;
    const mayRestoreFocus = () => {
      const active = document.activeElement;
      return document.hasFocus() && (active === document.body || active?.matches(".nextStepCard"));
    };
    if (!mayRestoreFocus()) return;
    let index = projects.findIndex((project) => project.id === anchor.id);
    if (index < 0) index = Math.min(anchor.index, projects.length - 1);
    const project = projects[index];
    if (!project) return;
    projectListAnchorRef.current = { id: project.id, index };
    if (projects.length > PROJECT_CARD_COMPACT_LIMIT && index >= PROJECT_CARD_COMPACT_LIMIT) {
      setProjectsListExpanded(true);
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!mayRestoreFocus()) return;
        document
          .querySelector<HTMLElement>(`.nextStepCard[data-project-id="${CSS.escape(project.id)}"]`)
          ?.focus();
      });
    });
  }, [config?.projects]);

  useEffect(() => {
    const items = config?.inbox ?? [];
    const anchor = inboxListAnchorRef.current;
    if (!anchor || items.length === 0) return;
    const mayRestoreFocus = () => {
      const active = document.activeElement;
      return document.hasFocus() && (active === document.body || active?.matches(".inboxRow"));
    };
    if (!mayRestoreFocus()) return;
    let index = items.findIndex((item) => item.id === anchor.id);
    if (index < 0) index = Math.min(anchor.index, items.length - 1);
    const item = items[index];
    if (!item?.id || !config) return;
    inboxListAnchorRef.current = { id: item.id, index };
    const group = groupWishlist(config).find((candidate) =>
      candidate.items.some((entry) => entry.item.id === item.id),
    );
    if (group) {
      const groupIndex = group.items.findIndex((entry) => entry.item.id === item.id);
      setWishlistGroupViews((current) => ({
        ...current,
        [group.key]: {
          ...current[group.key],
          collapsed: false,
          ...(group.items.length >= SOURCE_LIST_PAGINATION_THRESHOLD
            ? { page: Math.floor(groupIndex / SOURCE_LIST_PAGE_SIZE) + 1 }
            : group.items.length > SOURCE_LIST_COMPACT_LIMIT &&
                groupIndex >= SOURCE_LIST_COMPACT_LIMIT
              ? { expanded: true }
              : {}),
        },
      }));
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!mayRestoreFocus()) return;
        document
          .querySelector<HTMLElement>(`[data-inbox-id="${CSS.escape(item.id ?? "")}"]`)
          ?.focus();
      });
    });
  }, [config]);

  useEffect(() => {
    const cancelPointerDrag = (event?: globalThis.KeyboardEvent) => {
      if (event && event.key !== "Escape") return;
      const hadDrag = Boolean(
        todayPointerDragRef.current ||
        projectPointerDragRef.current ||
        inboxPointerDragRef.current ||
        wishlistGroupPointerDragRef.current,
      );
      if (!hadDrag) return;
      event?.preventDefault();
      todayPointerDragRef.current = null;
      projectPointerDragRef.current = null;
      inboxPointerDragRef.current = null;
      setTodayPointerDrag(null);
      setProjectPointerDrag(null);
      setInboxPointerDrag(null);
      projectAutoScrollSpeedRef.current = 0;
      if (projectAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(projectAutoScrollFrameRef.current);
        projectAutoScrollFrameRef.current = null;
      }
    };
    const onBlur = () => cancelPointerDrag();
    window.addEventListener("keydown", cancelPointerDrag);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", cancelPointerDrag);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // V163-C7: the closed 「やりたいこと」 header shows every group without shrinking them; when the
  // row does not fit, its right edge fades and hovering the header scrolls it slowly in a loop.
  // The measurement runs again whenever the row resizes (ResizeObserver), so it does not need
  // the group list in its dependencies.
  const inboxSummaryRef = useRef<HTMLSpanElement | null>(null);
  const [inboxSummaryOverflow, setInboxSummaryOverflow] = useState(false);
  useLayoutEffect(() => {
    const summary = inboxSummaryRef.current;
    if (!summary) return;
    const measure = () => {
      const track = summary.querySelector<HTMLElement>(".inboxGroupSummaryTrack");
      if (!track) return;
      const items = Array.from(track.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && !child.classList.contains("inboxGroupSummaryItem--copy"),
      );
      const ownWidth = items.reduce(
        (sum, item) => sum + item.getBoundingClientRect().width,
        Math.max(0, items.length - 1) * 10,
      );
      // A hidden row (narrow windows) never shows the copy and never fades.
      const available = summary.clientWidth;
      const overflow = available > 0 && ownWidth > available + 0.5;
      setInboxSummaryOverflow(overflow);
      summary.style.setProperty("--inbox-summary-loop", `${Math.round(ownWidth + 10)}px`);
      summary.style.setProperty("--inbox-summary-duration", `${(ownWidth + 10) / 30}s`);
    };
    measure();
    // The first layout (and the bundled fonts) can change the widths after the effect runs, so
    // measure once more after paint and watch the header too.
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(summary);
    if (summary.parentElement) observer.observe(summary.parentElement);
    const track = summary.querySelector<HTMLElement>(".inboxGroupSummaryTrack");
    if (track) observer.observe(track);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [config, inboxOpen, loading]);

  if (loading) {
    return (
      <main className="appShell appShell--loading">
        <div className="loadingMark" />
      </main>
    );
  }

  if (!config) {
    return (
      <main className="appShell">
        <section className="emptyState">設定を読み込めませんでした</section>
      </main>
    );
  }

  const todayCompletedCount = config.today.items.filter((item) => item.done).length;
  const visibleProjects = projectsListExpanded
    ? config.projects
    : config.projects.slice(0, PROJECT_CARD_COMPACT_LIMIT);
  const wishlistGroups = groupWishlistForDisplay(config);
  const inboxSummaryTitle = wishlistGroups
    .map((group) => `${group.name} ${group.items.length}件`)
    .join("、");
  const renderInboxGroupSummaryItems = (copy: boolean) =>
    wishlistGroups.map((group) => (
      <span
        aria-hidden={copy ? "true" : undefined}
        className={
          copy ? "inboxGroupSummaryItem inboxGroupSummaryItem--copy" : "inboxGroupSummaryItem"
        }
        key={`${copy ? "copy:" : ""}${group.key}`}
      >
        <span
          aria-hidden="true"
          className="inboxGroupSummaryDot"
          data-project-color={
            group.projectId
              ? resolveProjectColorId(
                  group.projectId,
                  projectsById.get(group.projectId)?.colorId ?? null,
                )
              : undefined
          }
        />
        {group.name} {group.items.length}件
      </span>
    ));
  const inboxNeighborIndex = (index: number, offset: -1 | 1) => {
    const item = config.inbox[index];
    if (!item) return undefined;
    const projectIds = new Set(config.projects.map((project) => project.id));
    const key = wishlistGroupKey(item, projectIds);
    const indexes = config.inbox.flatMap((candidate, candidateIndex) =>
      wishlistGroupKey(candidate, projectIds) === key ? [candidateIndex] : [],
    );
    return indexes[indexes.indexOf(index) + offset];
  };
  const todayAllCompleted =
    config.today.items.length > 0 && todayCompletedCount === config.today.items.length;
  const victoryText = config.today.victory.text.trim();
  const victoryDone = Boolean(victoryText && config.today.victory.done);
  const victorySuggestions = uniqueSuggestions(
    [
      morningVictorySuggestion,
      ...config.projects.slice(0, 3).map((project) => project.nextStep?.text ?? ""),
      config.inbox[0]?.text,
    ],
    5,
  );
  const rawTodayBuilderCandidates = buildTodayCandidates(config);
  const todayCandidateSelected = (candidate: TodayCandidate) => {
    const matchingSourceKeys = new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])]);
    return config.today.items.some((item, index) =>
      matchingSourceKeys.has(todaySourceKey(item, index)),
    );
  };
  const todayPickerCandidateSelected = (candidate: TodayCandidate) => {
    const matchingSourceKeys = new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])]);
    return todayPickerDraftItems.some((item, index) =>
      matchingSourceKeys.has(todaySourceKey(item, index)),
    );
  };
  // P10-12 (D15): the "add to Today3" item exists only in the Next Step / Wishlist menus and
  // answers the T key while that menu is open.
  const contextMenuTodayAdd = (() => {
    if (!contextMenu) return null;
    if (contextMenu.kind === "nextStep") {
      const sourceKey = `project:${contextMenu.project.id}`;
      const candidate = rawTodayBuilderCandidates.find(
        (item) => item.sourceKey === sourceKey || (item.sourceAliases ?? []).includes(sourceKey),
      );
      if (!candidate) return null;
      return {
        candidate,
        disabled:
          config.today.items.length >= TODAY_ITEM_LIMIT || todayCandidateSelected(candidate),
        reason: todayCandidateSelected(candidate)
          ? "今日の3件にあります"
          : config.today.items.length >= TODAY_ITEM_LIMIT
            ? "今日の3件は3件埋まっています"
            : undefined,
      };
    }
    if (contextMenu.kind === "inbox") {
      const item = config.inbox[contextMenu.index];
      if (!item) return null;
      const sourceKey = wishlistSourceKey(item, contextMenu.index);
      const candidate = rawTodayBuilderCandidates.find(
        (entry) =>
          entry.sourceKey === sourceKey || (entry.sourceAliases ?? []).includes(sourceKey),
      );
      if (!candidate) return null;
      return {
        candidate,
        disabled:
          config.today.items.length >= TODAY_ITEM_LIMIT || todayCandidateSelected(candidate),
        reason: todayCandidateSelected(candidate)
          ? "今日の3件にあります"
          : config.today.items.length >= TODAY_ITEM_LIMIT
            ? "今日の3件は3件埋まっています"
            : undefined,
      };
    }
    return null;
  })();
  const handleContextMenuShortcut = (key: string) => {
    if (key !== "t" || !contextMenuTodayAdd || contextMenuTodayAdd.disabled) return false;
    const candidate = contextMenuTodayAdd.candidate;
    setContextMenu(null);
    void addCandidateToToday(candidate);
    return true;
  };
  // V163-B7: quick-added wishes join the candidates at once, and the filter pills narrow the two
  // source groups to one project (or to 未分類). The two source groups always stay.
  const todayPickerInbox =
    todayPickerAddedWishes.length > 0
      ? [...config.inbox, ...todayPickerAddedWishes]
      : config.inbox;
  const todayPickerCandidates =
    todayPickerAddedWishes.length > 0
      ? buildTodayCandidates({ ...config, inbox: todayPickerInbox })
      : rawTodayBuilderCandidates;
  const todayPickerNextStepCandidates = todayPickerCandidates.filter(
    (candidate) => candidate.source === "次の一手",
  );
  const todayPickerWishlistCandidates = todayPickerCandidates.filter(
    (candidate) => candidate.source === "やりたいこと",
  );
  const todayPickerWishlistCandidatesBySourceKey = new Map(
    todayPickerWishlistCandidates.map((candidate) => [candidate.sourceKey, candidate]),
  );
  const todayPickerWishlistGroups = wishlistGroups
    .map((group) => ({
      ...group,
      candidates: group.items.flatMap(({ item, index }) => {
        const candidate = todayPickerWishlistCandidatesBySourceKey.get(
          wishlistSourceKey(item, index),
        );
        return candidate ? [candidate] : [];
      }),
    }))
    .filter((group) => group.candidates.length > 0);
  const todayPickerWishlistFlatCandidates = [
    ...todayPickerWishlistGroups.flatMap((group) => group.candidates),
    // Wishes added in the Picker are not in the settings yet: they come after the grouped list.
    ...todayPickerAddedWishes.flatMap((item) => {
      const candidate = todayPickerWishlistCandidatesBySourceKey.get(wishlistSourceKey(item, 0));
      return candidate ? [candidate] : [];
    }),
  ];
  const todayPickerFilterProjectId =
    todayPickerFilter !== "all" && todayPickerFilter !== "unassigned" ? todayPickerFilter : null;
  const todayPickerFilterMatches = (candidate: TodayCandidate) => {
    if (todayPickerFilter === "all") return true;
    if (todayPickerFilter === "unassigned") return !candidate.projectId;
    return candidate.projectId === todayPickerFilterProjectId;
  };
  const todayPickerVisibleNextSteps =
    todayPickerFilter === "unassigned"
      ? []
      : todayPickerNextStepCandidates.filter(todayPickerFilterMatches);
  const todayPickerVisibleWishlist = todayPickerWishlistFlatCandidates.filter(
    todayPickerFilterMatches,
  );
  const todayPickerHasUnassignedWish = todayPickerInbox.some(
    (item) => item.text.trim().length > 0 && !item.projectId,
  );
  const todayPickerPills = [
    { key: "all", label: "すべて", color: null as string | null },
    ...config.projects.map((project) => ({
      key: project.id,
      label: project.name,
      color: resolveProjectColorId(project.id, project.colorId) as string | null,
    })),
    ...(todayPickerHasUnassignedWish
      ? [{ key: "unassigned", label: "未分類", color: null as string | null }]
      : []),
  ];
  const todayPickerQuickProject = todayPickerFilterProjectId
    ? projectsById.get(todayPickerFilterProjectId)
    : undefined;
  const wishlistItemIsCurrentNextStep = (item: AppConfig["inbox"][number]) => {
    if (!item.id || !item.projectId) return false;
    const nextStep = projectsById.get(item.projectId)?.nextStep;
    if (!nextStep?.text.trim()) return false;
    return nextStep.sourceWishlistId
      ? nextStep.sourceWishlistId === item.id
      : nextStep.text.trim() === item.text.trim();
  };

  const allTodayItemsCompleted =
    config.today.items.length === TODAY_ITEM_LIMIT && config.today.items.every((item) => item.done);
  const displayedDayKey = topMenuDayKey;
  // P10-14d (M1): the date and the victory band share the first row of the main content.
  const headerDateLabel = formatDateKeyForHeader(displayedDayKey);
  const headerDateParts = headerDateLabel.split(" ");
  const headerDateMain = headerDateParts[0] ?? headerDateLabel;
  const headerDateWeekday = headerDateParts.slice(1).join(" ");

  const todayActivityCount =
    todayActivityDate === displayedDayKey ? todayActivityEntries.length : 0;
  const shortcutConflicts = settingsDraft
    ? findShortcutConflicts(
        SHORTCUT_DRAFT_FIELDS.map(({ field, label }) => ({
          field,
          label,
          value: settingsDraft[field],
        })),
      )
    : [];
  const timerStatus = completionPrompt
    ? "完了確認中"
    : activeTimer
      ? activeTimer.paused
        ? "一時停止"
        : activeTimer.mode === "measure"
          ? "計測中"
          : "実行中"
      : "待機中";
  const timerClock = currentTimerMetrics
    ? formatClock(
        activeTimer?.mode === "measure"
          ? currentTimerMetrics.elapsedSeconds
          : Math.max(0, currentTimerMetrics.remainingSeconds ?? 0),
      )
    : "00:00";
  const activeTimerProject = activeTimer?.projectId
    ? config.projects.find((project) => project.id === activeTimer.projectId)
    : undefined;
  const completionProject = completionPrompt?.projectId
    ? config.projects.find((project) => project.id === completionPrompt.projectId)
    : undefined;
  const completionCanEditResume = Boolean(
    completionPrompt &&
      completionProject &&
      completionProject.nextStep?.text.trim() &&
      activeTimer &&
      timerMatchesProjectNextStep(
        activeTimer,
        completionProject.id,
        completionProject.nextStep.generationId,
      ) &&
      sameSourceGeneration(
        completionProject.nextStep.generationId,
        activeTimer.sourceGenerationId,
      ) &&
      !findTodayEntryForTimer(todayEntries(config.today.items), activeTimer),
  );
  const submitCompletedTimer = async () => {
    if (
      completionResumeSavingRef.current ||
      plannedCommitRef.current ||
      finishingTimerRef.current !== null ||
      earlyStopRef.current
    ) {
      return;
    }
    if (completionCanEditResume && completionProject?.nextStep) {
      const trimmed = timerResumeDraft.trim();
      const currentResume = completionProject.nextStep.resumeNote?.trim() ?? "";
      if (trimmed !== currentResume) {
        const currentConfig = configRef.current;
        const liveProject = currentConfig?.projects.find(
          (project) => project.id === completionProject.id,
        );
        if (
          currentConfig &&
          liveProject?.nextStep &&
          sameSourceGeneration(
            liveProject.nextStep.generationId,
            completionProject.nextStep.generationId,
          )
        ) {
          completionResumeSavingRef.current = true;
          setCompletionResumeSaving(true);
          try {
            const nextStep: LauncherNextStep = { ...liveProject.nextStep };
            if (trimmed) {
              nextStep.resumeNote = trimmed;
            } else {
              delete nextStep.resumeNote;
            }
            const nextConfig: AppConfig = {
              ...currentConfig,
              projects: currentConfig.projects.map((project) =>
                project.id === liveProject.id ? { ...project, nextStep } : project,
              ),
            };
            await persistConfig(nextConfig, false, {
              errorToastMessage: "次はここからを保存できませんでした",
            });
          } finally {
            completionResumeSavingRef.current = false;
            setCompletionResumeSaving(false);
          }
        }
      }
    }
    finishCompletedTimer();
  };
  const nextStepSetupProject =
    config.projects.find((project) => !project.nextStep?.text.trim()) ?? config.projects[0];
  const doNowCandidates = (doNowResponse?.candidates ?? [])
    .filter((candidate) => candidate.projectId !== doNowExcludedProjectId)
    .flatMap((candidate) => {
      const project = config.projects.find((item) => item.id === candidate.projectId);
      return project ? [{ candidate, project }] : [];
    });
  const doNowOnlyExcluded =
    doNowExcludedProjectId !== null &&
    (doNowResponse?.candidates.length ?? 0) > 0 &&
    doNowCandidates.length === 0;
  const doNowPickedIndex =
    doNowPickedProjectId === null
      ? -1
      : doNowCandidates.findIndex(({ project }) => project.id === doNowPickedProjectId);
  const doNowCandidateIndex = Math.max(0, doNowPickedIndex);
  const doNowSelection = doNowCandidates[doNowCandidateIndex];
  const doNowCopyKey = doNowSelection
    ? `${doNowSelection.project.id}:${doNowSelection.project.nextStep?.generationId ?? ""}`
    : null;
  if (doNowCopyKey && doNowInitialCopyKeyRef.current === null) {
    doNowInitialCopyKeyRef.current = doNowCopyKey;
  }
  const doNowCopyShouldAnimate =
    doNowCopyKey !== null && doNowInitialCopyKeyRef.current !== doNowCopyKey;
  const doNowRestartPreferred = Boolean(
    doNowSelection?.candidate.restartEligible && (config.settings.restartShortFirst ?? true),
  );
  const doNowReason = doNowSelection
    ? doNowRestartPreferred
      ? "14日以上空いているため、短時間から再開できます"
      : doNowCandidateIndex > 0
        ? "「他の一手」で選んだ候補です"
        : doNowSelection.candidate.reason === "today3"
          ? "今日の3件に入っている一手です"
          : doNowSelection.candidate.reason === "noToday"
          ? doNowSelection.project.weeklyFocus === true
            ? "今週の重点で、今日はまだ取り組んでいません"
            : "今日はまだ取り組んでいない候補です"
          : doNowSelection.candidate.reason === "manualOrder"
            ? "ほかの条件が同じなので、次の一手の並びで上のプロジェクトを選びました"
            : "最後に取り組んでから、いちばん間があいている一手です"
    : "";
  const doNowDefaultTimerMinutes = doNowSelection
    ? (doNowSelection.project.nextStep?.defaultTimerMinutes ?? config.settings.defaultTimerMinutes)
    : config.settings.defaultTimerMinutes;
  const doNowShortTimerMinutes = doNowSelection
    ? (doNowSelection.project.nextStep?.shortTimerMinutes ?? config.settings.shortTimerMinutes)
    : config.settings.shortTimerMinutes;
  const doNowInstructionPath = doNowSelection?.project.nextStep?.instructionPath?.trim() ?? "";
  const isDoNowRunning = Boolean(
    doNowSelection &&
      activeTimer &&
      timerMatchesProjectNextStep(
        activeTimer,
        doNowSelection.project.id,
        doNowSelection.project.nextStep?.generationId,
      ),
  );
  // One running state derived from the single activeTimer, using the same "same action" rule as
  // completion, so Do Now and Today3 cannot disagree.
  const isTimerOnTodayItem = (item: TodayItem, index: number) =>
    timerRunsTodayItem(
      todayEntries(config?.today.items ?? []),
      activeTimer,
      todayTimerSourceId(item, index),
      todaySourceKey(item, index),
    );
  const startDoNowProject = (
    project: LauncherProject,
    timerKind: "short" | "normal" | "measure",
  ) => {
    setDoNowExcludedProjectId(null);
    const actions = (project.nextStep?.buttonIds ?? []).flatMap(
      (buttonId) => buttonsById.get(buttonId)?.actions ?? [],
    );
    void startTimer(
      project.id,
      project.name,
      project.id,
      actions,
      timerKind === "short"
        ? (project.nextStep?.shortTimerMinutes ?? config.settings.shortTimerMinutes)
        : timerKind === "normal"
          ? (project.nextStep?.defaultTimerMinutes ?? config.settings.defaultTimerMinutes)
          : undefined,
      project.nextStep?.startNoteTemplate,
      undefined,
      undefined,
      timerKind === "measure" ? "measure" : "countdown",
      project,
      project.nextStep?.expandTimerOnStart === true,
    );
  };
  const showNextDoNowCandidate = () => {
    if (doNowCandidates.length <= 1) return;
    const next = doNowCandidates[(doNowCandidateIndex + 1) % doNowCandidates.length];
    setDoNowPickedProjectId(next === doNowCandidates[0] ? null : next.project.id);
  };

  // P10-11 (§8.2): the first-run guide replaces the main screen only while there is nothing to
  // show, the guide has never been finished (no stamp), and saving is not blocked.
  const firstRunReady = Boolean(
    config &&
      !configSaveBlocked &&
      activeView === "main" &&
      !config.settings.firstRunDoneAt &&
      config.projects.length === 0 &&
      config.inbox.length === 0 &&
      config.today.items.length === 0,
  );
  // Keep the guide mounted while its own save runs, so a failure never clears the inputs.
  const firstRunVisible = firstRunReady || firstRunSaving;
  if (firstRunVisible && !firstRunIdsRef.current) {
    firstRunIdsRef.current = {
      projectId: createStableId(),
      generationId: createStableId(),
    };
  }
  const submitFirstRun = async (projectName: string, stepText: string) => {
    const current = configRef.current;
    const ids = firstRunIdsRef.current;
    if (!current || !ids || firstRunSaving) return;
    setFirstRunSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = current.projects.find((project) => project.id === ids.projectId);
      const project: LauncherProject =
        existing ?? {
          id: ids.projectId,
          name: projectName,
          colorId: resolveProjectColorId(ids.projectId, undefined),
          nextStep: {
            text: stepText,
            generationId: ids.generationId,
            buttonIds: [],
            defaultTimerMinutes: current.settings.defaultTimerMinutes,
            shortTimerMinutes: current.settings.shortTimerMinutes,
            updatedAt: now,
          },
        };
      const saved = await persistConfig({
        ...current,
        projects: existing ? current.projects : [...current.projects, project],
        settings: {
          ...current.settings,
          firstRunDoneAt: current.settings.firstRunDoneAt ?? now,
        },
      });
      if (!saved) return;
      try {
        startDoNowProject(project, "short");
      } catch (error) {
        showToast(
          "warn",
          `タイマーを始められませんでした: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      setFirstRunSaving(false);
    }
  };
  const laterFirstRun = async () => {
    const current = configRef.current;
    if (!current || firstRunSaving) return;
    setFirstRunSaving(true);
    try {
      const now = new Date().toISOString();
      await persistConfig({
        ...current,
        settings: {
          ...current.settings,
          firstRunDoneAt: current.settings.firstRunDoneAt ?? now,
        },
      });
    } finally {
      setFirstRunSaving(false);
    }
  };
  const copyFirstRunPrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard API is not available");
      await navigator.clipboard.writeText(IMPORT_PROMPT_FIRST);
    } catch (error) {
      showToast("warn", "プロンプトをコピーできませんでした");
      throw error;
    }
  };

  // P10-12 (§8.3): keys on the row itself (not on a button inside it).
  const handleRowShortcutKey = (
    event: KeyboardEvent<HTMLElement>,
    handlers: { activate?: () => void; edit?: () => void; remove?: () => void },
  ): boolean => {
    if (event.target !== event.currentTarget) return false;
    if (event.nativeEvent.isComposing || event.key === "Process") return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    const action =
      event.key === "Enter"
        ? handlers.activate
        : event.key === "F2"
          ? handlers.edit
          : event.key === "Delete"
            ? handlers.remove
            : undefined;
    if (!action) return false;
    event.preventDefault();
    event.stopPropagation();
    action();
    return true;
  };
  const startProjectShort = (project: LauncherProject) => {
    if (!project.nextStep?.text.trim()) return;
    startDoNowProject(project, "short");
  };
  // P10-14 (§4.3): the card's 5分 button and the row's Enter share this one path.
  const startTodayItemShort = (
    item: TodayItem,
    index: number,
    timerSourceId: string,
    minutes: number,
  ) => {
    if (item.done || !item.text.trim()) return;
    if (isTimerOnTodayItem(item, index)) return;
    const project = item.projectId ? projectsById.get(item.projectId) : undefined;
    void startTimer(
      timerSourceId,
      item.projectId && project ? project.name : item.text,
      item.projectId && project ? item.projectId : null,
      (item.buttonIds ?? []).flatMap((buttonId) => buttonsById.get(buttonId)?.actions ?? []),
      minutes,
      item.text,
      item.instructionPath,
      item.instructionOpenOnStart,
      "countdown",
      undefined,
      item.sourceKey?.startsWith("project:") && item.expandTimerOnStart === true,
    );
  };
  const editTodayRowItem = (index: number) => {
    const current = configRef.current;
    const item = current?.today.items[index];
    if (!current || !item?.sourceKey) return;
    const key = canonicalSourceKey(current, item.sourceKey);
    if (!key) return;
    const project = current.projects.find((p) => `project:${p.id}` === key);
    if (project) openNextStepEditor(project, { origin: "today" });
    else {
      const inboxIndex = current.inbox.findIndex((i) => `wishlist:${i.id}` === key);
      if (inboxIndex >= 0) beginInboxEdit(inboxIndex, "today");
    }
  };
  const acknowledgeDoNowCompletion = async () => {
    if (!(await refreshDoNow())) return;
    setDoNowExcludedProjectId(doNowCompletionHold?.projectId ?? null);
    setDoNowPickedProjectId(null);
    setDoNowCompletionHold(null);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".doNowStartPrimary, .doNowEmptyContent button")
        ?.focus({ preventScroll: true });
    });
  };
  const renderButtonIcon = (button: LauncherButton, className: string) => {
    const source = buttonIconSources[button.id];
    if (source) {
      return (
        <img alt="" className={`${className} buttonIconImage`} draggable={false} src={source} />
      );
    }

    return (
      <span className={className}>
        {button.icon ?? iconForAction(button.actions[0] ?? makeAction("open_file"))}
      </span>
    );
  };

  // P10-14e (6): a sidebar row without a picture shows the first letter of its
  // name in a small square. The colour comes from the button id, so it is stable.
  const renderSidebarButtonIcon = (button: LauncherButton) => {
    const source = buttonIconSources[button.id];
    if (source) {
      return (
        <span className="quickButtonIcon">
          <img alt="" draggable={false} src={source} />
        </span>
      );
    }
    return (
      <span
        className="uiLetterIcon"
        data-project-color={resolveProjectColorId(button.id)}
      >
        {buttonGlyph(button)}
      </span>
    );
  };
  const skipLinkBlocked = Boolean(
    settingsDraft ||
    helpGuideOpen ||
    confirmDialog ||
    softwareResetChoiceOpen ||
    softwareResetStage !== "idle" ||
    earlyStop ||
    manualSessionDraft ||
    sessionEditDraft ||
    buttonEditDraft ||
    projectEditDraft ||
    dropDraft ||
    importDialogOpen ||
    groupDraft !== null ||
    groupRenameDraft ||
    completionPrompt,
  );

  const focusSkipTarget = () => {
    const scrollArea = mainScrollAreaRef.current;
    if (!scrollArea) return;
    const target =
      activeView === "records"
        ? scrollArea.querySelector<HTMLElement>("[data-skip-target='records']")
        : (scrollArea.querySelector<HTMLElement>(".doNowStartPrimary:not(:disabled)") ??
          scrollArea.querySelector<HTMLElement>(
            "[data-skip-target='main'] button:not(:disabled)",
          ) ??
          scrollArea.querySelector<HTMLElement>("[data-skip-target='main']"));
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", inline: "nearest" });
  };
  // --- P10-03: the search window (D4) ---------------------------------------
  const { closeSearchPalette, openSearchPalette, runSearchItem, searchSections } =
    // useSearchPalette returns what a hook would, but it holds no React state of its own, so
    // calling it after the loading guards keeps the effect order exactly as it was.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSearchPalette({
      actions: {
        openDictionaryManually,
        openInstructionWindow,
        openInstructionsManually,
        openSettingsCenter,
        promoteInboxToNextStep,
        refreshInstructionChoices,
        runActions,
        setActiveView,
        setHelpGuideOpen,
        showToast,
        startDoNowProject,
        toggleMiniMode,
      },
      config,
      configRef,
      doNowSelection,
      instructionChoices,
      instructionChoicesLoading,
      openSearchRef,
      searchBusy,
      searchOpenerRef,
      searchOpen,
      searchQuery,
      setSearchBusy,
      setSearchOpen,
      setSearchQuery,
    });
  return (
    <main
      className={
        dragActive
          ? "appShell appShell--dashboard appShell--dragging"
          : "appShell appShell--dashboard"
      }
      data-main-display-size={config.settings.mainDisplaySize ?? "standard"}
      onDragOver={handleDomDragOver}
      onDrop={handleDomDrop}
    >
      {windowTimerLine && (
        <div
          aria-hidden="true"
          className={
            windowTimerLine.paused
              ? "windowTimerLine windowTimerLine--paused"
              : "windowTimerLine windowTimerLine--running"
          }
        >
          <div className="windowTimerLineGroove" />
          <div
            className="windowTimerLineFill"
            key={windowTimerLine.resetKey}
            style={{ width: `${windowTimerLine.percent}%` }}
          />
        </div>
      )}
      {jsonDrop && (
        <div aria-hidden="true" className="importDropOverlay">
          <motion.div
            animate={{ scale: jsonDrop === "sidebar" ? 1.02 : 1 }}
            className={[
              "importDropZone importDropZone--sidebar",
              jsonDrop === "sidebar" ? "importDropZone--active is-dragover" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            initial={jsonDrop === "sidebar" ? { scale: 1.02 } : { scale: 1 }}
            transition={springSnappy}
          >
            <span>ボタンとして登録</span>
          </motion.div>
          <motion.div
            animate={{ scale: jsonDrop === "main" ? 1.02 : 1 }}
            className={[
              "importDropZone importDropZone--main",
              jsonDrop === "main" ? "importDropZone--active is-dragover" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            initial={jsonDrop === "main" ? { scale: 1.02 } : { scale: 1 }}
            transition={springSnappy}
          >
            <strong>まとめて取り込む</strong>
            <small>プロジェクト・次の一手・やりたいこと</small>
          </motion.div>
        </div>
      )}
      {!skipLinkBlocked && (
        <a
          className="skipLink"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            focusSkipTarget();
          }}
        >
          メイン領域へ移動
        </a>
      )}
      {dictionaryVisible && (
        <div
          aria-hidden="true"
          className={
            dictionaryLocked
              ? "dictionaryMainScrim dictionaryMainScrim--locked"
              : "dictionaryMainScrim"
          }
          onPointerDown={
            dictionaryLocked
              ? (event) => {
                  event.preventDefault();
                  void (async () => {
                    const focused = await focusDictionaryWindowIfVisible();
                    if (focused) return;
                    // The dictionary is gone or hidden: nothing may stay locked.
                    setDictionaryVisible(false);
                    setDictionaryLocked(false);
                  })();
                }
              : undefined
          }
          role="presentation"
        />
      )}
      <TopBar
        activeView={activeView}
        config={config}
        openContextMenu={openContextMenu}
        openInstructionsManually={openInstructionsManually}
        openSearchPalette={openSearchPalette}
        openSettingsCenter={openSettingsCenter}
        setActiveView={setActiveView}
        shortcutRegistration={shortcutRegistration}
        testProfile={testProfile}
        toggleAutoStart={toggleAutoStart}
        topMenuBarRef={topMenuBarRef}
        topMenuLabelLevel={topMenuLabelLevel}
        topMenuPillsRef={topMenuPillsRef}
      />
      <WindowControls closeShortcutDisabled={closeShortcutDisabled} />

      <div className="appBody">
      <SidebarQuickLaunch
        actions={{
          cancelNumberInputDrag,
          cancelSidebarGroupPointerDrag,
          cancelSidebarPointerDrag,
          finishActiveTimer,
          finishNumberInputDrag,
          finishSidebarGroupPointerDrag,
          finishSidebarPointerDrag,
          openContextMenu,
          openContextMenuFromKeyboard,
          openDictionaryManually,
          renderSidebarButtonIcon,
          runActions,
          saveDefaultTimerMinutes,
          setDefaultTimerDraft,
          setExpandedTimerOpen,
          startNumberInputDrag,
          startSidebarGroupPointerDrag,
          startSidebarPointerDrag,
          toggleGroupCollapsed,
          toggleMiniMode,
          togglePause,
          updateNumberInputDrag,
          updateSidebarGroupPointerDrag,
          updateSidebarPointerDrag,
        }}
        data={{
          activeTimer,
          activeTimerProject,
          collapsedGroups,
          completionPrompt,
          config,
          defaultTimerDraft,
          miniTransitioning,
          numberInputDragging,
          pendingActionId,
          shortcutRegistration,
          sidebarGroupPointerDrag,
          sidebarPointerDrag,
          timerClock,
          timerProgressPercent,
          timerStatus,
          visibleGroups: visibleSidebarButtonGroups,
        }}
        expandTimerButtonRef={expandTimerButtonRef}
      />

      <section
        className="mainPanel"
        data-main-display-size={config.settings.mainDisplaySize ?? "standard"}
      >
        <div className="mainScrollArea app-scrollbar" id="main-content" ref={mainScrollAreaRef}>
          <div
            className="mainScrollContent"
            data-main-display-size={
              activeView === "main" ? (config.settings.mainDisplaySize ?? "standard") : undefined
            }
          >
            <h1
              className={
                activeView === "records"
                  ? "topTitle topTitle--records"
                  : "topTitle topTitle--main visuallyHidden"
              }
            >
              {activeView === "records" ? "記録" : formatDateKeyForHeader(displayedDayKey)}
            </h1>
            {banner && (
              <section className="banner">
                <span>{banner}</span>
                {backupPath && (
                  <button
                    className="bannerButton mainActionButton mainActionButton--neutral"
                    onClick={openBackupFolder}
                    type="button"
                  >
                    バックアップから復元: フォルダを開く
                  </button>
                )}
              </section>
            )}

            {activeView === "records" ? (
              <RecordsView
                allSessions={recordsAllSessions}
                config={config}
                filteredSessions={sessionEntries}
                notesHistory={notesHistory}
                onAddSession={openManualSessionDialog}
                onDateScopeChange={setSessionDateScope}
                onRewriteNextStep={(project) =>
                  openNextStepEditor(project, { mode: "edit" })
                }
                reviewingProjectId={nextStepReviewBusy}
                onHistoryNoteBlur={flushHistoryNotesSave}
                onHistoryNoteChange={updateHistoryNoteText}
                onMarkReviewed={(projectId) => void markNextStepReviewed(projectId)}
                onCopyError={() => showToast("warn", "プロンプトをコピーできませんでした")}
                onDone={() => setActiveView("main")}
                onOpenImport={() => openImportDialog("")}
                onOpenSessionMenu={(session, x, y, opener) =>
                  openContextMenu({ kind: "session", session }, x, y, opener)
                }
                onProjectFilterChange={setSessionProjectFilter}
                onSearchChange={setSessionSearch}
                onWeeklyFocusChange={setWeeklyReviewProjectFocus}
                sessionDateScope={sessionDateScope}
                sessionProjectFilter={sessionProjectFilter}
                sessionSearch={sessionSearch}
                sessionSummary={sessionSummary}
                staleNextStepProjects={staleNextStepProjects}
                staleNextStepDays={staleNextStepMap}
                weekSessions={recordsWeekSessions}
                weeklyReview={weeklyReview}
              />
            ) : firstRunVisible ? (
              <FirstRunBand
                onCopyPrompt={copyFirstRunPrompt}
                onLater={() => void laterFirstRun()}
                onOpenImport={() => openImportDialog("")}
                onStart={(projectName, stepText) => void submitFirstRun(projectName, stepText)}
                saving={firstRunSaving}
                shortTimerMinutes={config.settings.shortTimerMinutes}
              />
            ) : (
              <>
                <MainHeaderVictoryBand
                  actions={{
                    applyVictorySuggestion,
                    clearVictoryAutoFocus,
                    enterVictoryEditing,
                    handleVictoryKeyDown,
                    leaveVictoryEditing,
                    toggleVictoryDone,
                    updateVictoryText,
                  }}
                  completionFeedback={completionFeedback}
                  dateMain={headerDateMain}
                  dateWeekday={headerDateWeekday}
                  done={victoryDone}
                  editing={victoryEditing}
                  refs={{
                    input: victoryInputRef,
                    navigation: victoryNavigationRef,
                    save: victorySaveRef,
                    suggestions: victorySuggestionsRef,
                  }}
                  setEditing={setVictoryEditing}
                  suggestions={victorySuggestions}
                  text={victoryText}
                  value={config.today.victory.text}
                />

                <DoNowBand
                  actions={{
                    acknowledgeDoNowCompletion,
                    finishActiveTimer,
                    openContextMenu,
                    openContextMenuFromKeyboard,
                    openInstructionWindow,
                    openNextStepEditor,
                    openProjectAddDialog,
                    setDoNowExcludedProjectId,
                    setDoNowPickedProjectId,
                    showNextDoNowCandidate,
                    showToast,
                    startDoNowProject,
                    togglePause,
                  }}
                  data={{
                    activeTimer,
                    buttonsById,
                    doNowBookPage,
                    doNowCandidates,
                    doNowCompletionHold,
                    doNowCompletionSaving,
                    doNowCopyKey,
                    doNowCopyShouldAnimate,
                    doNowDefaultTimerMinutes,
                    doNowInstructionPath,
                    doNowOnlyExcluded,
                    doNowReason,
                    doNowSelection,
                    doNowShortTimerMinutes,
                    isDoNowRunning,
                    missingButtonIds,
                    missingInstructionProjectIds,
                    nextStepSetupProject,
                    timerClock,
                  }}
                />

                <TodayThreeSection
                  actions={{
                    beginTodayTriggerEdit,
                    cancelTodayPointerDrag,
                    cancelTodayTriggerEdit,
                    editTodayRowItem,
                    finishActiveTimer,
                    finishTodayPointerDrag,
                    handleRowShortcutKey,
                    handleTodayTriggerKeyDown,
                    openContextMenu,
                    openContextMenuFromKeyboard,
                    openInstructionWindow,
                    openTodayPicker,
                    removeTodayItem,
                    setTodayOpen,
                    setTodayTriggerDraft,
                    showToast,
                    startNextTodayBatch,
                    startTimer,
                    startTodayItemShort,
                    startTodayPointerDrag,
                    togglePause,
                    updateTodayPointerDrag,
                  }}
                  data={{
                    activeTimer,
                    allTodayItemsCompleted,
                    buttonsById,
                    completionFeedback,
                    config,
                    doNowSelection,
                    isTimerOnTodayItem,
                    projectsById,
                    timerClock,
                    todayAllCompleted,
                    todayCompletedCount,
                    todayOpen,
                    todayTriggerDraft,
                    todayTriggerEditingIndex,
                  }}
                  drag={{ inboxPointerDrag, projectPointerDrag, todayPointerDrag }}
                  dragActive={dragActive}
                />


                <NextStepsSection
                  actions={{
                    addCandidateToToday,
                    cancelProjectPointerDrag,
                    clearProjectNextStep,
                    finishProjectPointerDrag,
                    handleRowShortcutKey,
                    markNextStepReviewed,
                    openContextMenu,
                    openContextMenuFromKeyboard,
                    openImportDialog,
                    openNextStepEditor,
                    openProjectAddDialog,
                    setProjectsListExpanded,
                    setProjectsOpen,
                    sourceEditBlockReason,
                    sourceEditBlocked,
                    startProjectPointerDrag,
                    startProjectShort,
                    todayCandidateSelected,
                    updateProjectPointerDrag,
                  }}
                  config={config}
                  drag={{ inboxPointerDrag, projectPointerDrag }}
                  dragActive={dragActive}
                  nextStepReviewBusy={nextStepReviewBusy}
                  projectListAnchorRef={projectListAnchorRef}
                  projectsListExpanded={projectsListExpanded}
                  projectsOpen={projectsOpen}
                  rawTodayBuilderCandidates={rawTodayBuilderCandidates}
                  staleNextStepMap={staleNextStepMap}
                  visibleProjects={visibleProjects}
                />

                <WishlistSection
                  actions={{
                    beginInboxEdit,
                    cancelInboxPointerDrag,
                    cancelWishlistGroupPointerDrag,
                    deleteInboxItem,
                    finishInboxPointerDrag,
                    finishWishlistGroupPointerDrag,
                    handleRowShortcutKey,
                    openContextMenu,
                    openContextMenuFromKeyboard,
                    openInboxAddDialog,
                    promoteInboxToNextStep,
                    setInboxOpen,
                    setWishlistGroupViews,
                    sourceEditBlockReason,
                    sourceEditBlocked,
                    startInboxPointerDrag,
                    startWishlistGroupPointerDrag,
                    toggleWishlistGroup,
                    updateInboxPointerDrag,
                    updateWishlistGroupPointerDrag,
                  }}
                  config={config}
                  drag={{ inboxPointerDrag, projectPointerDrag, wishlistGroupPointerDrag }}
                  dragActive={dragActive}
                  inboxAddOpen={inboxAddOpen}
                  inboxListAnchorRef={inboxListAnchorRef}
                  inboxOpen={inboxOpen}
                  inboxSummaryOverflow={inboxSummaryOverflow}
                  inboxSummaryRef={inboxSummaryRef}
                  inboxSummaryTitle={inboxSummaryTitle}
                  projectsById={projectsById}
                  renderInboxGroupSummaryItems={renderInboxGroupSummaryItems}
                  wishlistGroups={wishlistGroups}
                  wishlistGroupViews={wishlistGroupViews}
                  wishlistItemIsCurrentNextStep={wishlistItemIsCurrentNextStep}
                />

                <TodayActivitySection
                  count={todayActivityCount}
                  dragActive={dragActive}
                  entries={todayActivityEntries}
                  onToggle={() => setTodayActivityOpen((open) => !open)}
                  open={todayActivityOpen}
                  projects={config.projects}
                />
              </>
            )}
          </div>
        </div>
      </section>
      </div>

      <div aria-live="polite" className="reorderAnnouncement" role="status">
        {reorderAnnouncement}
      </div>

      {(completionFeedback?.kind === "victory" || completionFeedback?.kind === "todayAll") && (
        <div aria-hidden="true" className="completionParticleLayer">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="completionParticle" key={index} />
          ))}
        </div>
      )}

      <ToastStack
        onAction={(id) => void runToastAction(id)}
        onDismiss={dismissToast}
        onPause={pauseToast}
        toasts={toasts}
      />

      <DashboardContextMenu
        actions={{
          addCandidateToToday,
          beginInboxEdit,
          clearProjectNextStep,
          completeInboxItem,
          deleteButton,
          deleteGroup,
          deleteInboxItem,
          dismissContextMenu,
          handleContextMenuShortcut,
          moveInboxItemByOffset,
          moveSidebarButtonByOffset,
          moveSidebarButtonToDictionary,
          moveSidebarGroupByOffset,
          moveTodayItemByOffset,
          openButtonBuilder,
          openButtonEditDialog,
          openGroupDialog,
          openGroupRenameDialog,
          openImportDialog,
          openInboxAddDialog,
          openNextStepEditor,
          openProjectAddDialog,
          openProjectEditDialog,
          openProjectManagement,
          openSessionEditDialog,
          promoteInboxToNextStep,
          removeTodayItem,
          requestProjectDeletion,
          requestSessionDelete,
          revealButtonInExplorer,
          setContextMenu,
          showNextDoNowCandidate,
          sourceEditBlockReason,
          sourceEditBlocked,
          wishlistItemIsCurrentNextStep,
        }}
        config={config}
        configRef={configRef}
        contextMenu={contextMenu}
        contextMenuReturnFocusRef={contextMenuReturnFocusRef}
        contextMenuTodayAdd={contextMenuTodayAdd}
        inboxNeighborIndex={inboxNeighborIndex}
        isTimerActiveForSource={isTimerActiveForSource}
        isTimerOnTodayItem={isTimerOnTodayItem}
      />

      <AnimatePresence initial={false}>
        {inboxEditingIndex !== null && config.inbox[inboxEditingIndex] && (
          <ExitPresence key="inbox-edit">
            {(exiting, exitProps) => (
              <InboxEditDialog
                exitProps={exitProps}
                config={config}
                inboxEditDraft={inboxEditDraft}
                inboxEditProjectId={inboxEditProjectId}
                inboxEditButtonIds={inboxEditButtonIds}
                inboxEditInstructionPath={inboxEditInstructionPath}
                inboxEditInstructionOpenOnStart={inboxEditInstructionOpenOnStart}
                instructionChoices={instructionChoices}
                instructionChoicesError={instructionChoicesError}
                instructionChoicesLoading={instructionChoicesLoading}
                overlayPages={overlayPages}
                projectSelectableButtons={projectSelectableButtons}
                renderButtonIcon={renderButtonIcon}
                setInboxEditDraft={setInboxEditDraft}
                setInboxEditProjectId={setInboxEditProjectId}
                setInboxEditButtonIds={setInboxEditButtonIds}
                setInboxEditInstructionPath={setInboxEditInstructionPath}
                setInboxEditInstructionOpenOnStart={setInboxEditInstructionOpenOnStart}
                refreshInstructionChoices={refreshInstructionChoices}
                closeInboxEditDialog={closeInboxEditDialog}
                commitInboxEdit={commitInboxEdit}
                sourceEditSaving={sourceEditSaving}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {todayPickerOpen && (
          <ExitPresence key="today-picker">
            {(exiting, exitProps) => (
              <TodayPickerDialog
                exitProps={exitProps}
                todayPickerDraftItems={todayPickerDraftItems}
                todayPickerDragIndex={todayPickerDragIndex}
                todayPickerFilter={todayPickerFilter}
                todayPickerPills={todayPickerPills}
                todayPickerQuickProject={todayPickerQuickProject}
                todayPickerQuickText={todayPickerQuickText}
                todayPickerSaving={todayPickerSaving}
                todayPickerVisibleNextSteps={todayPickerVisibleNextSteps}
                todayPickerVisibleWishlist={todayPickerVisibleWishlist}
                setTodayPickerFilter={setTodayPickerFilter}
                setTodayPickerQuickText={setTodayPickerQuickText}
                addTodayPickerQuickWish={addTodayPickerQuickWish}
                moveTodayPickerItemToIndex={moveTodayPickerItemToIndex}
                requestCloseTodayPicker={requestCloseTodayPicker}
                rows={{
                  activeTimer,
                  chooseTodayCandidate,
                  moveTodayPickerItem,
                  projectsById,
                  removeTodayPickerDraftItem,
                  setTodayPickerDragIndex,
                  todayPickerCandidateSelected,
                }}
                saveTodayPickerDraft={saveTodayPickerDraft}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {groupDraft !== null && (
          <ExitPresence key="group-add">
            {(exiting, exitProps) => (
              <GroupNameDialog
                exitProps={exitProps}
                mode="add"
                onCancel={() => setGroupDraft(null)}
                onChange={setGroupDraft}
                onConfirm={confirmGroupAddition}
                value={groupDraft}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {groupRenameDraft && (
          <ExitPresence key="group-rename">
            {(exiting, exitProps) => (
              <GroupNameDialog
                exitProps={exitProps}
                mode="rename"
                onCancel={() => setGroupRenameDraft(null)}
                onChange={(to) => setGroupRenameDraft({ ...groupRenameDraft, to })}
                onConfirm={confirmGroupRename}
                value={groupRenameDraft.to}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {settingsDraft && (
          <ExitPresence key="settings">
            {(exiting, exitProps) => (
              <SettingsDialog
                exitProps={exitProps}
                config={config}
                data={{
                  dailyActivityCopying,
                  instructionSettingsBusy,
                  numberInputDragging,
                  settingsDraft,
                  settingsSection,
                  shortcutConflicts,
                  shortcutRecordingField,
                  softwareResetStage,
                  testProfile,
                }}
                actions={{
                  beginShortcutRecording,
                  cancelNumberInputDrag,
                  finishNumberInputDrag,
                  finishShortcutRecording,
                  requestCloseSettings,
                  saveSettingsCenter,
                  setHelpGuideOpen,
                  setSettingsDraft,
                  setSettingsSection,
                  showToast,
                  startNumberInputDrag,
                  updateNumberInputDrag,
                }}
                maintenance={{
                  addInstructionFolder,
                  chooseBackupFolder,
                  chooseBackupZipForRestore,
                  copyTodayActivityLog,
                  openBackupFolder,
                  openRuntimeDataFolder,
                  reloadInstructionList,
                  removeInstructionFolder,
                  requestClearBackupFolder,
                  requestIconCacheRegeneration,
                  requestInstructionWindowPositionReset,
                  requestMiniWindowPositionReset,
                  requestSoftwareReset,
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {manualSessionDraft && (
          <ExitPresence key="manual-session">
            {(exiting, exitProps) => (
              <ManualSessionDialog
                exitProps={exitProps}
                draft={manualSessionDraft}
                onCancel={() => setManualSessionDraft(null)}
                onDraftChange={setManualSessionDraft}
                onSave={saveManualSession}
                projects={config.projects}
                projectsById={projectsById}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {sessionEditDraft && (
          <ExitPresence key="session-edit">
            {(exiting, exitProps) => (
              <SessionEditDialog
                exitProps={exitProps}
                draft={sessionEditDraft}
                onCancel={() => setSessionEditDraft(null)}
                onDraftChange={setSessionEditDraft}
                onSave={saveSessionEdit}
                projects={config.projects}
                projectsById={projectsById}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {buttonEditDraft && (
          <ExitPresence key="button-edit">
            {(exiting, exitProps) => (
              <ButtonEditDialog
                exitProps={exitProps}
                actionDragId={actionDragId}
                buttonEditDraft={buttonEditDraft}
                groupNames={groupNames}
                moveButtonAction={moveButtonAction}
                moveButtonActionTo={moveButtonActionTo}
                overlayPages={overlayPages}
                requestCloseButtonEdit={requestCloseButtonEdit}
                saveButtonEdit={saveButtonEdit}
                setActionDragId={setActionDragId}
                setButtonEditDraft={setButtonEditDraft}
                updateButtonAction={updateButtonAction}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {inboxAddOpen && (
          <ExitPresence key="inbox-add">
            {(exiting, exitProps) => (
              <InboxAddDialog
                exitProps={exitProps}
                draft={inboxDraft}
                error={inboxAddError}
                onClose={() => closeInboxAddDialog()}
                onDraftChange={(value) => {
                  setInboxDraft(value);
                  if (inboxAddError) setInboxAddError(null);
                }}
                onProjectIdChange={setInboxAddProjectId}
                onSubmit={() => void addInboxItem()}
                projectId={inboxAddProjectId}
                projects={config.projects}
                saving={inboxAddSaving}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {completionFollowup?.source.kind === "nextStep" && (
          <ExitPresence key="completion-next-step">
            {(exiting, exitProps) => (
              <CompletionNextStepDialog
                actions={{
                  openNextStepEditor,
                  projectSelectableButtons,
                  promoteInboxToNextStep,
                  showToast,
                }}
                choice={completionFollowupChoice}
                config={config}
                configRef={configRef}
                exitProps={exitProps}
                followup={completionFollowup}
                setChoice={setCompletionFollowupChoice}
                setFollowup={setCompletionFollowup}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {nextStepEditDraft && (
          <ExitPresence key="next-step-edit">
            {(exiting, exitProps) => (
              <NextStepEditDialog
                exitProps={exitProps}
                config={config}
                draft={{
                  nextStepEditDraft,
                  nextStepOpenMenuOpen,
                  nextStepOpenPicker,
                }}
                data={{
                  buttonsById,
                  instructionChoices,
                  instructionChoicesError,
                  instructionChoicesLoading,
                  missingButtonIds,
                  missingInstructionProjectIds,
                  numberInputDragging,
                  overlayPages,
                  projectNextStepSuggestions,
                  projectSelectableButtons,
                  sourceEditSaving,
                }}
                actions={{
                  cancelNumberInputDrag,
                  chooseLegacyNextStepSettings,
                  closeNextStepEditDialog,
                  finishNumberInputDrag,
                  refreshInstructionChoices,
                  renderButtonIcon,
                  saveNextStepEdit,
                  selectNextStepDecisionMode,
                  selectNextStepProject,
                  setNextStepEditDraft,
                  setNextStepOpenMenuOpen,
                  setNextStepOpenPicker,
                  startNumberInputDrag,
                  updateNumberInputDrag,
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {projectEditDraft && (
          <ExitPresence key="project-edit">
            {(exiting, exitProps) => (
              <ProjectEditDialog
                exitProps={exitProps}
                config={config}
                projectEditDraft={projectEditDraft}
                projectEditSaving={projectEditSaving}
                setProjectEditDraft={setProjectEditDraft}
                setProjectWeeklyFocus={setProjectWeeklyFocus}
                closeProjectEditDialog={closeProjectEditDialog}
                requestProjectDeletion={requestProjectDeletion}
                saveProjectEdit={saveProjectEdit}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expandedTimerOpen && activeTimer && (
          <ExitPresence key="expanded-timer">
            {(exiting, exitProps) => (
              <ExpandedTimerOverlay
                exitProps={exitProps}
                clock={timerClock}
                complete={Boolean(completionPrompt)}
                identity={activeTimerProject ? (
                  <ProjectIdentity
                    colorId={activeTimerProject.colorId}
                    compact
                    name={activeTimerProject.name}
                    projectId={activeTimerProject.id}
                  />
                ) : undefined}
                label={timerActionText(activeTimer)}
                onClose={() => {
                  setExpandedTimerOpen(false);
                  window.requestAnimationFrame(() => expandTimerButtonRef.current?.focus({ preventScroll: true }));
                }}
                onFinish={() => {
                  setExpandedTimerOpen(false);
                  finishActiveTimer(activeTimer);
                }}
                onMini={() => {
                  setExpandedTimerOpen(false);
                  void toggleMiniMode();
                }}
                onPause={togglePause}
                paused={activeTimer.paused}
                planLabel={expandedTimerPlanLabel}
                progressPercent={timerProgressPercent}
                status={
                  activeTimer.paused
                    ? "一時停止中"
                    : activeTimer.mode === "measure"
                      ? "計測中"
                      : "実行中"
                }
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {completionPrompt && (
          <ExitPresence key="completion-prompt">
            {(exiting, exitProps) => (
              <CompletionFollowupDialog
                exitProps={exitProps}
                config={config}
                completionPrompt={completionPrompt}
                completionProject={completionProject}
                completionCanEditResume={completionCanEditResume}
                completionExtendDraft={completionExtendDraft}
                completionExtendMinutes={completionExtendMinutes}
                completionResumeSaving={completionResumeSaving}
                timerResumeDraft={timerResumeDraft}
                numberInputDragging={numberInputDragging}
                setCompletionExtendDraft={setCompletionExtendDraft}
                setTimerResumeDraft={setTimerResumeDraft}
                cancelNumberInputDrag={cancelNumberInputDrag}
                finishNumberInputDrag={finishNumberInputDrag}
                updateNumberInputDrag={updateNumberInputDrag}
                startNumberInputDrag={startNumberInputDrag}
                continueCompletedTimer={continueCompletedTimer}
                submitCompletedTimer={submitCompletedTimer}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {dropDraft && (
          <ExitPresence key="drop-register">
            {(exiting, exitProps) => (
              <DropRegisterDialog
                exitProps={exitProps}
                builderBusy={builderBusy}
                builderKind={builderKind}
                builderSource={builderSource}
                confirmDropRegistration={confirmDropRegistration}
                dropDraft={dropDraft}
                groupNames={groupNames}
                overlayPages={overlayPages}
                pickBuilderSource={pickBuilderSource}
                setBuilderKind={setBuilderKind}
                setBuilderLabelTouched={setBuilderLabelTouched}
                setBuilderModeDrafts={setBuilderModeDrafts}
                setDropDraft={setDropDraft}
                switchBuilderKind={switchBuilderKind}
                updateBuilderSource={updateBuilderSource}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {softwareResetChoiceOpen && (
          <ExitPresence key="reset-choice">
            {(exiting, exitProps) => (
              <SoftwareResetChoiceDialog
                exitProps={exitProps}
                busy={softwareResetChoiceBusy}
                onClose={() => closeSoftwareResetChoice()}
                onContinue={(withBackup) => void continueSoftwareReset(withBackup)}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {confirmDialog && (
          <ExitPresence key="confirm-dialog">
            {(exiting, exitProps) => (
              <ConfirmDialog {...confirmDialog} onCancel={closeConfirmDialog} exitProps={exitProps} open />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {softwareResetStage !== "idle" && (
          <ExitPresence key="reset-progress">
            {(exiting, exitProps) => (
              <SoftwareResetProgressDialog
                exitProps={exitProps}
                progressRef={softwareResetProgressRef}
                stage={softwareResetStage}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {searchOpen && (
          <ExitPresence key="search">
            {(exiting, exitProps) => (
              <SearchPalette
                exitProps={exitProps}
                busy={searchBusy}
                onActivate={(item, mode) => void runSearchItem(item, mode)}
                onClose={closeSearchPalette}
                onQueryChange={setSearchQuery}
                query={searchQuery}
                sections={searchSections}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {helpGuideOpen && (
          <ExitPresence key="help">
            {(exiting, exitProps) => (
              <HelpGuideDialog
                exitProps={exitProps}
                onClose={() => setHelpGuideOpen(false)}
                onCopyResult={(ok) =>
                  showToast(
                    ok ? "ok" : "error",
                    ok
                      ? "コピーしました"
                      : "コピーできませんでした。テキストを選択してコピーしてください。",
                  )
                }
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {earlyStop && (
          <ExitPresence key="early-stop">
            {(exiting, exitProps) => (
              <ConfirmDialog
                exitProps={exitProps}
                open
                title="今日の分は完了にしますか？"
                message="ここまでの実行は記録されます。"
                confirmLabel="今日の分は完了"
                cancelLabel="未完了のまま終了"
                tone="positive"
                initialFocus="cancel"
                isProcessing={earlyStopSaving}
                onConfirm={() => resolveEarlyStop(true)}
                onCancel={() => {
                  void resolveEarlyStop(false);
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <ImportDialog
        config={config}
        initialError={importInitialError}
        initialText={importInitialText}
        onClose={closeImportDialog}
        onImported={handleImported}
        onNotify={showToast}
        open={importDialogOpen}
      />
    </main>
  );
}
