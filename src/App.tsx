import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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
  DragEvent,
  KeyboardEvent,
  PointerEvent,
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
import { springCollapse, springSnappy, staggerMax, staggerStep } from "./motion";
import { SEARCH_GROUP_LIMIT, matchesSearchQuery } from "./searchMatch";
import { nextStepStaleDays } from "./nextStepFreshness";
import {
  DEFAULT_BUTTON_GROUP,
  DEFAULT_EXTEND_TIMER_MINUTES,
  EXECUTION_TRIGGER_MAX_CHARS,
  TIMER_TICK_MS,
  TODAY_ITEM_LIMIT,
  WEEKLY_FOCUS_LIMIT,
} from "./constants";
import {
  acknowledgeSoftwareResetRecovery,
  chooseLauncherTarget,
  chooseInstructionRoot,
  createSoftwareResetBackup,
  deleteSessionEntry,
  deleteButtonIconCache,
  enableMainShellDrop,
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
  listInstructionDirectory,
  listInstructionRoots,
  loadSessionEntries,
  loadSessionSummary,
  loadTodaySessionTotal,
  loadWeeklyReview,
  openConfigBackups,
  openDataFolder,
  prepareSoftwareReset,
  readImportJson,
  reapplyDashboardSettings,
  revealLauncherItem,
  resumeDashboardShortcuts,
  recordManualSession,
  recordSession,
  resolveDropItem,
  restoreBackup,
  notifyDictionaryConfigChanged,
  saveConfig,
  saveNotesForDate,
  setDisplayAwake,
  selectBackupFolder,
  selectBackupZip,
  softwareReset,
  suspendDashboardShortcuts,
  loadInstructionBookState,
  updateSessionEntry,
  updateInstructionReferences,
  undoImport,
  undoTodaySelection,
  loadTestProfileInfo,
  type ShortcutRegistrationStatus,
  type TestProfileInfo,
} from "./tauri";
import {
  AppConfig,
  DropResolveInput,
  DoNowResponse,
  ImportCommitResponse,
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
  SoftwareResetStorageSnapshot,
  SourceCompletion,
  WeeklyReviewResponse,
  TodayItem,
} from "./types";
import { ConfirmDialog, type ConfirmDialogRequest } from "./components/ConfirmDialog";
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
import { ContextMenu, ContextMenuItem } from "./components/ContextMenu";
import { HelpGuideDialog } from "./components/HelpGuideDialog";
import { SearchPalette, type SearchItem, type SearchSection } from "./components/SearchPalette";
import { ProjectIdentity } from "./components/ProjectIdentity";
import {
  prepareProjectDeletion,
  projectDeletionBlockReason,
  projectDeletionSummary,
  type ProjectDeletionMode,
} from "./projectDeletion";
import { RecordsView } from "./RecordsView";
import {
  canonicalSourceKey,
  resnapshotSource,
  SOURCE_EDIT_TIMER_REASON,
  SOURCE_LOCK_REASON,
  sourceLockedByUnfinishedToday,
  timerSourceKey,
  unfinishedTodayUsesSource,
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
import { canRevealLauncherButton } from "./launcherReveal";
import {
  groupWishlist,
  groupWishlistForDisplay,
  prepareNextStepRemoval,
  prepareWishlistPromotion,
  reorderWishlistGroups,
  sameNextStepSnapshot,
  wishlistGroupKey,
} from "./nextStepWishlist";
import { TimerPanel } from "./components/TimerPanel";
import { ExpandedTimerOverlay } from "./components/ExpandedTimerOverlay";
import {
  buildTodayCandidates,
  legacyWishlistSourceKey,
  todayCandidateFromConfig,
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
import { UiIcon } from "./components/UiIcon";
import { ShortcutBadge } from "./components/ShortcutBadge";
import { findShortcutConflicts } from "./shortcutConflicts";
import { localDayKey } from "./localDay";
import { useTopMenuLabelLevel } from "./topMenuLabels";
import { useHoverSuppressionAfterResize } from "./hoverSuppression";
import { installSettingsFieldEditing, navigateAppArrow } from "./keyboardNavigation";
import {
  searchOverlayButtons,
} from "./overlayPages";
import {
  INSTRUCTION_BOOK_STATE_CHANGED_EVENT,
  INSTRUCTION_RELOAD_TREE_EVENT,
  INSTRUCTION_WINDOW_SHOW_EVENT,
  openInstructionWindow,
  readLastInstructionPath,
  resetInstructionWindowPosition,
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
import { ACTION_DRAG_TYPE, MINI_READY_EVENT, MINI_RETURN_EVENT, MINI_TIMER_COMMAND_EVENT, MINI_TIMER_SNAPSHOT_EVENT, MINI_WINDOW_HEIGHT_PX, MINI_WINDOW_LABEL, MINI_WINDOW_WIDTH_PX, NUMBER_INPUT_DRAG_PIXELS_PER_STEP, NUMBER_INPUT_DRAG_THRESHOLD_PX, OVERLAY_PAGE_DRAG_TYPE, PROJECT_CARD_COMPACT_LIMIT, SIDEBAR_DRAG_THRESHOLD_PX, SOURCE_LIST_COMPACT_LIMIT, SOURCE_LIST_PAGE_SIZE, SOURCE_LIST_PAGINATION_THRESHOLD } from "./app/constants";
import { type ActionDraft, type ActiveTimer, type ActiveView, type ButtonEditDraft, type ButtonGroup, type CompletionFeedback, type CompletionFollowup, type ContextMenuState, type ContextMenuTarget, type DoNowCompletionHold, type DropDialogState, type InboxDragPreview, type InboxPointerDrag, type InstructionChoice, type InternalButtonDrag, type LegacyNextStepChoice, type MainShellDropEvent, type ManualSessionDraft, type MiniTimerCommand, type MiniTimerSnapshot, type NextStepDecisionMode, type NextStepEditDraft, type NotesSaveStatus, type NumberInputDrag, type NumberInputDragField, type ProjectDragPreview, type ProjectEditDraft, type ProjectPointerDrag, type RecordsDateScope, SHORTCUT_DRAFT_FIELDS, type SessionEditDraft, type SettingsCenterDraft, type SettingsSectionKey, type ShortcutDraftField, type SidebarDragPreview, type SidebarGroupDragPreview, type SidebarGroupPointerDrag, type SidebarPointerDrag, TOP_MENU_GROUP_LABELS, TOP_MENU_LABELS, type TimerCompletionPrompt, type TodayDragPreview, type TodayPointerDrag, type WishlistGroupDragPreview, type WishlistGroupPointerDrag, type WishlistGroupView } from "./app/dashboardTypes";
import { MiniModeApp } from "./components/MiniModeApp";
import { SOFTWARE_RESET_TIMER_MESSAGE, captureSoftwareResetStorage, clearSoftwareResetStorage, getSoftwareResetRecoveryForBoot, restoreSoftwareResetStorage } from "./app/softwareReset";
import { SectionCollapse } from "./components/SectionCollapse";
import { actionHasSuspiciousPath, actionValue, aliasesInputToList, aliasesListToInput, buttonGroupName, buttonHasIconCacheSource, createStableId, dropPositionToCss, firstDroppedUrl, formatActionSummary, formatClock, formatDateKeyForHeader, formatSessionRange, formatStartedAt, formatTodayActivityLog, iconForAction, isCloseShortcutValue, isEditableTarget, isValidStartedAt, limitToday, makeAction, matchesHotkey, normalizeOptionalText, normalizeTimerMinutes, readCollapsedGroups, shortcutFromKeyboardEvent, showButtonInOverlay, showButtonInSidebar, sourceListRange, stripActionDraft, toActionDraft, toThreeNoteDraft, todayEntries, todaySourceKey, todayTimerSourceId, toggleDisclosureFromBar, uniqueButtonId, uniqueGroupNames, uniqueProjectId, uniqueSuggestions, validateShortcutSettings, writeCollapsedGroups } from "./app/helpers";
import { clearMiniPosition, createMiniReadyWaiter, inactiveMiniSnapshot, isDictionaryView, isFiniteMiniPosition, isInstructionView, isMiniModeView, readMiniPosition, resolveSafeMiniPosition, sameMiniPosition, timerActionText, waitForMiniWindowCreated, writeMiniPosition } from "./app/miniWindow";
import { draggedCardTopWithinTodayRemoveDropZone, inboxDropTargetFromPoint, instructionPathKey, instructionPathWithin, isReorderBlockedTarget, notifyTimerComplete, pointWithinSelector, pointWithinTodayRemoveDropZone, projectDropIndicator, projectDropTargetFromPoint, sidebarDropTargetFromPoint, sidebarGroupDropTargetFromPoint, todayAdoptionDropTargetFromPoint, todayDropTargetFromPoint, wishlistGroupDropTargetFromPoint } from "./app/dropTargets";

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
  const sourceEditBusyRef = useRef<string | null>(null);
  const [sourceEditSaving, setSourceEditSaving] = useState(false);
  const [inboxEditDraft, setInboxEditDraft] = useState("");
  const [inboxEditProjectId, setInboxEditProjectId] = useState("");
  const [inboxEditButtonIds, setInboxEditButtonIds] = useState<string[]>([]);
  const [inboxEditInstructionPath, setInboxEditInstructionPath] = useState("");
  const [inboxEditInstructionOpenOnStart, setInboxEditInstructionOpenOnStart] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
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
  const [projectNextStepSuggestions, setProjectNextStepSuggestions] = useState<string[]>([]);
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
  const [projectEditDraft, setProjectEditDraft] = useState<ProjectEditDraft | null>(null);
  const [projectEditSaving, setProjectEditSaving] = useState(false);
  const [nextStepEditDraft, setNextStepEditDraft] = useState<NextStepEditDraft | null>(null);
  // P10-10 (§6.2): the "＋ ボタン・手順書を足す" choice and which picker dialog is open.
  const [nextStepOpenMenuOpen, setNextStepOpenMenuOpen] = useState(false);
  const [nextStepOpenPicker, setNextStepOpenPicker] = useState<"buttons" | "instructions" | null>(
    null,
  );
  const [instructionChoices, setInstructionChoices] = useState<InstructionChoice[]>([]);
  const [instructionChoicesLoading, setInstructionChoicesLoading] = useState(false);
  const [instructionChoicesError, setInstructionChoicesError] = useState<string | null>(null);
  const [instructionSettingsBusy, setInstructionSettingsBusy] = useState(false);
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
  const inboxAddSavingRef = useRef(false);
  const projectEditSavingRef = useRef(false);
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
  const inboxAddOpenerRef = useRef<HTMLButtonElement | null>(null);
  const inboxAddInitialProjectIdRef = useRef("");
  const todayPickerOpenerRef = useRef<HTMLElement | null>(null);
  const todayPickerInitialItemsRef = useRef<TodayItem[]>([]);
  // P10-11 (§8.2): the IDs for the first-run guide are created once per guide.
  const firstRunIdsRef = useRef<{ projectId: string; generationId: string } | null>(null);
  const [firstRunSaving, setFirstRunSaving] = useState(false);
  const projectEditInitialDraftRef = useRef<ProjectEditDraft | null>(null);
  const nextStepEditInitialDraftRef = useRef<NextStepEditDraft | null>(null);
  const sourceEditOriginRef = useRef<"source" | "today" | "builder">("source");
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
  const projectEditReturnFocusRef = useRef<HTMLElement | null>(null);
  const nextStepEditReturnFocusRef = useRef<HTMLElement | null>(null);
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
        if (returnTarget?.isConnected) returnTarget.focus();
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
        !activeElement.closest(".modalBackdrop")
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
          if (returnTarget?.isConnected) {
            returnTarget.focus();
            return;
          }
          if (fallbackSelector) document.querySelector<HTMLElement>(fallbackSelector)?.focus();
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
    window.requestAnimationFrame(() => returnTarget?.focus());
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

  const copyTodayActivityLog = async () => {
    if (dailyActivityCopying) return;
    setDailyActivityCopying(true);
    try {
      const sessions = await loadSessionEntries({ dateScope: "today" });
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard API is not available");
      }
      await navigator.clipboard.writeText(formatTodayActivityLog(sessions.date, sessions.entries));
      showToast("ok", "今日の活動ログをコピーしました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `今日の活動ログをコピーできません: ${message}`);
    } finally {
      setDailyActivityCopying(false);
    }
  };

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
  }, [showToast]);

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
  }, [requestDiscardConfirmation, settingsHaveUnsavedChanges]);

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
      window.requestAnimationFrame(() => opener?.focus());
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
    ],
  );

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
      // Never steal focus from a dialog that opened while the Picker was closing.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) return;
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
        ".modalBackdrop",
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
    [],
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
  }, []);

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
  }, [freezeFrontendForSoftwareReset, rejectSoftwareResetForTimer, showToast]);

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
  }, [executeSoftwareReset, requestConfirmation]);

  const closeSoftwareResetChoice = useCallback((restoreFocus = true) => {
    setSoftwareResetChoiceOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() =>
        softwareResetChoiceOpenerRef.current?.focus({ preventScroll: true }),
      );
    }
  }, []);

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
      rejectSoftwareResetForTimer,
      requestFinalSoftwareResetConfirmation,
      persistConfig,
      settingsDraft?.backupFolder,
      showToast,
      softwareResetChoiceBusy,
      closeSoftwareResetChoice,
    ],
  );

  const requestSoftwareReset = useCallback(() => {
    if (rejectSoftwareResetForTimer()) return;
    softwareResetChoiceOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSoftwareResetChoiceBusy(false);
    setSoftwareResetChoiceOpen(true);
  }, [rejectSoftwareResetForTimer]);

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

  const mainDropStateRef = useRef({
    config,
    groupNames,
    overlayPages,
  });
  mainDropStateRef.current = {
    config,
    groupNames,
    overlayPages,
  };

  const openDropDialog = useCallback(
    async (input: DropResolveInput, suggestedLabel?: string | null) => {
      const state = mainDropStateRef.current;
      if (!state.config) return;
      try {
        const draft = await resolveDropItem(
          input.kind === "url" ? { ...input, suggestedLabel } : input,
        );
        setBuilderKind(null);
        setDropDraft({
          ...draft,
          label: draft.label,
          group: draft.group?.trim() || state.groupNames[0] || DEFAULT_BUTTON_GROUP,
          groupMode: state.groupNames.length > 0 ? "existing" : "new",
          existingGroup: draft.group?.trim() || state.groupNames[0] || DEFAULT_BUTTON_GROUP,
          newGroup: "",
          showInSidebar: true,
          showInOverlay: true,
          overlayPageId: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `登録できません: ${message}`);
      }
    },
    [showToast],
  );

  const handleDroppedPaths = useCallback(
    async (paths: string[]) => {
      setDragActive(false);
      if (paths.length === 0) return;
      if (paths.length > 1) {
        showToast("warn", "複数ドロップ時は先頭の1件だけ登録します");
      }
      await openDropDialog({ kind: "path", value: paths[0] });
    },
    [openDropDialog, showToast],
  );

  const dropSideFromPosition = useCallback(
    (position: { x: number; y: number }): "main" | "sidebar" | null => {
      const element = document.elementFromPoint(position.x, position.y);
      if (element?.closest(".sidebar")) return "sidebar";
      if (element?.closest(".mainPanel")) return "main";
      return null;
    },
    [],
  );

  const dropModalOpen = useCallback(
    () => Boolean(document.querySelector(".modalBackdrop")),
    [],
  );

  const openImportDialog = useCallback(
    (text: string, error: string | null = null, opener?: HTMLElement | null) => {
      importOpenerRef.current =
        opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setImportInitialText(text);
      setImportInitialError(error);
      setImportDialogOpen(true);
    },
    [],
  );

  const closeImportDialog = useCallback(() => {
    setImportDialogOpen(false);
    const opener = importOpenerRef.current;
    importOpenerRef.current = null;
    window.requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  }, []);

  const handleImported = useCallback(
    (response: ImportCommitResponse) => {
      setConfig(response.config);
      closeImportDialog();
      const counts = response.preview.counts;
      const total =
        counts.newProjects + counts.existingProjects + counts.nextSteps + counts.wishes;
      showToast("ok", `${total}件を取り込みました`, {
        detail: counts.rejected > 0 ? `${counts.rejected}件は取り込めませんでした` : undefined,
        actionLabel: "元に戻す",
        onAction: async () => {
          try {
            const undone = await undoImport(response.importId, response.fingerprint);
            setConfig(undone.config);
            return true;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showToast("warn", message.replace(/^changed:/, ""));
            return false;
          }
        },
      });
    },
    [closeImportDialog, showToast],
  );

  const claimDrop = useCallback((paths: string[]) => {
    const signature = paths.join("\u0000");
    const now = Date.now();
    if (
      lastDropRef.current &&
      lastDropRef.current.signature === signature &&
      now - lastDropRef.current.at < 1000
    ) {
      return false;
    }
    lastDropRef.current = { signature, at: now };
    return true;
  }, []);

  const handleDropAt = useCallback(
    async (paths: string[], cssPosition: { x: number; y: number } | null) => {
      setDragActive(false);
      setJsonDrop(null);
      if (paths.length === 0) return;
      if (!claimDrop(paths)) return;
      const modalOpen = dropModalOpen();
      const side = cssPosition ? dropSideFromPosition(cssPosition) : null;
      if (
        paths.length === 1 &&
        /\.json$/i.test(paths[0]) &&
        side === "main" &&
        !modalOpen
      ) {
        try {
          const text = await readImportJson(paths[0]);
          openImportDialog(text);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          openImportDialog("", message);
        }
        return;
      }
      await handleDroppedPaths(paths);
    },
    [claimDrop, dropModalOpen, dropSideFromPosition, handleDroppedPaths, openImportDialog],
  );

  const openRecycleBinDropDialog = useCallback(() => {
    const state = mainDropStateRef.current;
    setDropDraft({
      label: "ごみ箱",
      group: state.groupNames[0] ?? DEFAULT_BUTTON_GROUP,
      groupMode: state.groupNames.length > 0 ? "existing" : "new",
      existingGroup: state.groupNames[0] ?? DEFAULT_BUTTON_GROUP,
      newGroup: "",
      iconSource: null,
      action: {
        type: "open_shell_special",
        payload: { item: "recycle_bin" },
      },
      source: "Windowsデスクトップのごみ箱",
      showInSidebar: true,
      showInOverlay: true,
      overlayPageId: null,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;

    listen<MainShellDropEvent>("main-shell-drop-result", (event) => {
      if (!mounted || event.payload.windowLabel !== "main") return;
      if (event.payload.stage === "error") {
        setDragActive(false);
        showToast("error", `D&Dを初期化できません: ${event.payload.message}`);
        return;
      }
      if (event.payload.stage === "dragEnter" || event.payload.stage === "dragOver") {
        const isJson =
          event.payload.paths.length === 1 && /\.json$/i.test(event.payload.paths[0]);
        if (isJson && event.payload.position && !dropModalOpen()) {
          setDragActive(false);
          setJsonDrop(dropSideFromPosition(dropPositionToCss(event.payload.position)));
        } else {
          setJsonDrop(null);
          setDragActive(true);
        }
        return;
      }
      if (event.payload.stage === "dragLeave") {
        setDragActive(false);
        setJsonDrop(null);
        return;
      }

      setDragActive(false);
      setJsonDrop(null);
      if (event.payload.paths.length > 0) {
        void handleDropAt(
          event.payload.paths,
          event.payload.position ? dropPositionToCss(event.payload.position) : null,
        );
        return;
      }
      if (event.payload.url) {
        void openDropDialog({ kind: "url", value: event.payload.url }, event.payload.label);
        return;
      }
      if (event.payload.shellSpecial === "recycle_bin") {
        openRecycleBinDropDialog();
      }
    })
      .then((dispose) => {
        if (mounted) {
          unlisten = dispose;
          void enableMainShellDrop().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            showToast("error", `D&Dを初期化できません: ${message}`);
          });
        } else {
          dispose();
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [dropModalOpen, dropSideFromPosition, handleDropAt, openDropDialog, openRecycleBinDropDialog, showToast]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter") {
          dragPathsRef.current = payload.paths;
          const isJson =
            payload.paths.length === 1 && /\.json$/i.test(payload.paths[0]);
          if (isJson && !dropModalOpen()) {
            setDragActive(false);
            setJsonDrop(dropSideFromPosition(dropPositionToCss(payload.position)));
          } else {
            setJsonDrop(null);
            setDragActive(true);
          }
        } else if (payload.type === "over") {
          const paths = dragPathsRef.current;
          const isJson = paths.length === 1 && /\.json$/i.test(paths[0]);
          if (isJson && !dropModalOpen()) {
            setDragActive(false);
            setJsonDrop(dropSideFromPosition(dropPositionToCss(payload.position)));
          } else {
            setJsonDrop(null);
            setDragActive(true);
          }
        } else if (payload.type === "leave") {
          dragPathsRef.current = [];
          setDragActive(false);
          setJsonDrop(null);
        } else if (payload.type === "drop") {
          dragPathsRef.current = [];
          void handleDropAt(payload.paths, dropPositionToCss(payload.position));
        }
      })
      .then((dispose) => {
        if (mounted) {
          unlisten = dispose;
        } else {
          dispose();
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `D&Dを初期化できません: ${message}`);
      });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [dropModalOpen, dropSideFromPosition, handleDropAt, showToast]);

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

  const handleDomDragOver = (event: DragEvent<HTMLElement>) => {
    if (
      event.dataTransfer.types.includes(ACTION_DRAG_TYPE) ||
      event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)
    ) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setJsonDrop(null);
    setDragActive(true);
  };

  const handleDomDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    setJsonDrop(null);

    if (event.dataTransfer.types.includes(ACTION_DRAG_TYPE)) {
      setActionDragId(null);
      return;
    }
    if (event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)) {
      setOverlayPageDragId(null);
      return;
    }

    const text =
      event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    const url = firstDroppedUrl(text);
    if (!url) return;
    try {
      const dropped = new URL(url);
      if (
        dropped.origin === window.location.origin ||
        dropped.hostname === "tauri.localhost" ||
        dropped.hostname === "asset.localhost"
      ) {
        return;
      }
    } catch {
      return;
    }

    void openDropDialog({ kind: "url", value: url });
  };

  const moveButtonInSidebar = (
    draggedButtonId: string,
    targetGroupName: string,
    targetButtonId?: string,
  ) => {
    if (!config) return;
    if (targetButtonId === draggedButtonId) return;
    const draggedButton = config.buttons.find((button) => button.id === draggedButtonId);
    if (!draggedButton) return;

    const targetGroup = targetGroupName === DEFAULT_BUTTON_GROUP ? undefined : targetGroupName;
    const movedButton = { ...draggedButton, group: targetGroup };
    const withoutDragged = config.buttons.filter((button) => button.id !== draggedButtonId);
    const targetIndex = targetButtonId
      ? withoutDragged.findIndex((button) => button.id === targetButtonId)
      : -1;
    const draggedIndex = config.buttons.findIndex((button) => button.id === draggedButtonId);
    const originalTargetIndex = targetButtonId
      ? config.buttons.findIndex((button) => button.id === targetButtonId)
      : -1;

    let insertIndex: number;
    if (targetIndex >= 0) {
      insertIndex = draggedIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
    } else {
      const buttonsInGroup = withoutDragged
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => buttonGroupName(button) === targetGroupName);
      const lastInGroup = buttonsInGroup[buttonsInGroup.length - 1];
      insertIndex = lastInGroup ? lastInGroup.index + 1 : withoutDragged.length;
    }

    const nextButtons = [...withoutDragged];
    nextButtons.splice(insertIndex, 0, movedButton);
    void persistConfig({ ...config, buttons: nextButtons });
  };

  const moveGroupInSidebar = (
    draggedGroupName: string,
    targetGroupName: string,
    placement: "before" | "after",
  ) => {
    if (!config || draggedGroupName === targetGroupName) return;

    const orderedGroups = uniqueGroupNames(config);
    const withoutDragged = orderedGroups.filter((name) => name !== draggedGroupName);
    const targetIndex = withoutDragged.indexOf(targetGroupName);
    if (targetIndex < 0) return;

    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    const nextGroups = [...withoutDragged];
    nextGroups.splice(insertIndex, 0, draggedGroupName);
    void persistConfig({ ...config, groups: nextGroups });
  };

  const moveTodayItem = (
    draggedIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) => {
    if (!config || draggedIndex === targetIndex) return;

    const draggedItem = config.today.items[draggedIndex];
    if (!draggedItem || !config.today.items[targetIndex]) return;

    const withoutDragged = config.today.items.filter((_, index) => index !== draggedIndex);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (placement === "after") {
      insertIndex += 1;
    }

    const items = [...withoutDragged];
    items.splice(insertIndex, 0, draggedItem);
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const moveProject = (
    draggedProjectId: string,
    targetProjectId: string,
    placement: "before" | "after",
  ) => {
    if (!config || draggedProjectId === targetProjectId) return;

    const draggedProject = config.projects.find((project) => project.id === draggedProjectId);
    const draggedIndex = config.projects.findIndex((project) => project.id === draggedProjectId);
    const targetIndex = config.projects.findIndex((project) => project.id === targetProjectId);
    if (!draggedProject || draggedIndex < 0 || targetIndex < 0) return;

    const withoutDragged = config.projects.filter((project) => project.id !== draggedProjectId);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (placement === "after") {
      insertIndex += 1;
    }

    const projects = [...withoutDragged];
    projects.splice(insertIndex, 0, draggedProject);
    void persistConfig({ ...config, projects });
  };

  const moveInboxItem = (
    draggedIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) => {
    if (!config || draggedIndex === targetIndex) return;
    const draggedItem = config.inbox[draggedIndex];
    const targetItem = config.inbox[targetIndex];
    if (!draggedItem || !targetItem) return;
    const projectIds = new Set(config.projects.map((project) => project.id));
    if (wishlistGroupKey(draggedItem, projectIds) !== wishlistGroupKey(targetItem, projectIds))
      return;

    const withoutDragged = config.inbox.filter((_, index) => index !== draggedIndex);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) insertIndex -= 1;
    if (placement === "after") insertIndex += 1;

    const inbox = [...withoutDragged];
    inbox.splice(insertIndex, 0, draggedItem);
    void persistConfig({ ...config, inbox });
  };

  const moveWishlistGroup = (
    draggedKey: string,
    targetKey: string,
    placement: "before" | "after",
  ) => {
    const current = configRef.current;
    if (!current || draggedKey === targetKey || draggedKey === "unassigned") return;
    const nextConfig = reorderWishlistGroups(
      current,
      draggedKey,
      targetKey,
      targetKey === "unassigned" ? "before" : placement,
    );
    if (nextConfig === current) return;
    void persistConfig(nextConfig);
  };

  const announceReorder = (label: string, position: number) => {
    setReorderAnnouncement(`「${label}」を${position}番目へ移動しました`);
  };

  const focusAfterReorder = (focusTarget: () => void) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(focusTarget);
    });
  };

  const moveSidebarButtonByOffset = async (buttonId: string, offset: -1 | 1) => {
    if (!config) return;
    const button = config.buttons.find((item) => item.id === buttonId);
    if (!button || !showButtonInSidebar(button)) return;
    const groupName = buttonGroupName(button);
    const groupButtons = config.buttons.filter(
      (item) => showButtonInSidebar(item) && buttonGroupName(item) === groupName,
    );
    const index = groupButtons.findIndex((item) => item.id === buttonId);
    const target = groupButtons[index + offset];
    if (index < 0 || !target) return;

    const withoutButton = config.buttons.filter((item) => item.id !== buttonId);
    const targetIndex = withoutButton.findIndex((item) => item.id === target.id);
    if (targetIndex < 0) return;
    const nextButtons = [...withoutButton];
    nextButtons.splice(targetIndex + (offset === 1 ? 1 : 0), 0, button);

    if (!(await persistConfig({ ...config, buttons: nextButtons }))) return;
    announceReorder(button.label, index + offset + 1);
    focusAfterReorder(() => {
      const wrapper = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-button-id]"),
      ).find((element) => element.dataset.sidebarButtonId === buttonId);
      wrapper?.querySelector<HTMLButtonElement>(".quickButton")?.focus();
    });
  };

  const moveSidebarGroupByOffset = async (groupName: string, offset: -1 | 1) => {
    if (!config) return;
    const groups = uniqueGroupNames(config);
    const index = groups.indexOf(groupName);
    const target = groups[index + offset];
    if (index < 0 || !target) return;
    const nextGroups = [...groups];
    [nextGroups[index], nextGroups[index + offset]] = [
      nextGroups[index + offset],
      nextGroups[index],
    ];

    if (!(await persistConfig({ ...config, groups: nextGroups }))) return;
    announceReorder(groupName, index + offset + 1);
    focusAfterReorder(() => {
      const header = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button[data-sidebar-group-name]"),
      ).find((element) => element.dataset.sidebarGroupName === groupName);
      header?.focus();
    });
  };

  const moveTodayItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!config) return;
    const targetIndex = index + offset;
    const item = config.today.items[index];
    if (!item || !config.today.items[targetIndex]) return;
    const items = [...config.today.items];
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];

    if (!(await persistConfig({ ...config, today: { ...config.today, items } }))) return;
    announceReorder(item.text || "未入力", targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-today-index="${targetIndex}"]`)?.focus();
    });
  };

  const moveInboxItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;
    const projectIds = new Set(config.projects.map((project) => project.id));
    const key = wishlistGroupKey(item, projectIds);
    const groupIndexes = config.inbox.flatMap((candidate, candidateIndex) =>
      wishlistGroupKey(candidate, projectIds) === key ? [candidateIndex] : [],
    );
    const groupIndex = groupIndexes.indexOf(index);
    const targetIndex = groupIndexes[groupIndex + offset];
    if (targetIndex === undefined || !config.inbox[targetIndex]) return;
    const inbox = [...config.inbox];
    [inbox[index], inbox[targetIndex]] = [inbox[targetIndex], inbox[index]];

    if (!(await persistConfig({ ...config, inbox }))) return;
    setContextMenu(null);
    announceReorder(item.text, targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-inbox-index="${targetIndex}"]`)?.focus();
    });
  };

  const startSidebarPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    drag: InternalButtonDrag,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    sidebarPointerDragRef.current = {
      ...drag,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateSidebarPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = sidebarPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (drag.hasMoved) {
      const target = sidebarDropTargetFromPoint(event.clientX, event.clientY, drag.id);
      setSidebarPointerDrag({
        id: drag.id,
        group: drag.group,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetIndicator: target?.indicator,
        targetButtonId: target?.buttonId,
        targetGroupName: target?.groupName,
      });
    }
  };

  const finishSidebarPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    button: LauncherButton,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = sidebarPointerDragRef.current;
    sidebarPointerDragRef.current = null;
    setSidebarPointerDrag(null);

    if (!drag) return;
    if (!drag.hasMoved) {
      void runActions(button.id, button.actions);
      return;
    }

    const target = sidebarDropTargetFromPoint(event.clientX, event.clientY, drag.id);
    if (!target || target.buttonId === drag.id) return;
    moveButtonInSidebar(drag.id, target.groupName, target.buttonId);
  };

  const cancelSidebarPointerDrag = () => {
    sidebarPointerDragRef.current = null;
    setSidebarPointerDrag(null);
  };

  const startSidebarGroupPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    groupName: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    sidebarGroupPointerDragRef.current = {
      group: groupName,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateSidebarGroupPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = sidebarGroupPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (drag.hasMoved) {
      const target = sidebarGroupDropTargetFromPoint(event.clientX, event.clientY);
      setSidebarGroupPointerDrag({
        group: drag.group,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetGroupName: target?.groupName,
        placement: target?.placement,
      });
    }
  };

  const finishSidebarGroupPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    groupName: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = sidebarGroupPointerDragRef.current;
    sidebarGroupPointerDragRef.current = null;
    setSidebarGroupPointerDrag(null);

    if (!drag) return;
    if (!drag.hasMoved) {
      toggleGroupCollapsed(groupName);
      return;
    }

    const target = sidebarGroupDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveGroupInSidebar(drag.group, target.groupName, target.placement);
  };

  const cancelSidebarGroupPointerDrag = () => {
    sidebarGroupPointerDragRef.current = null;
    setSidebarGroupPointerDrag(null);
  };

  const startTodayPointerDrag = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    todayPointerDragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateTodayPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = todayPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const current = configRef.current;
    const item = current?.today.items[drag.index];
    const removeEligible = Boolean(
      item && activeTimerRef.current?.sourceId !== todayTimerSourceId(item, drag.index),
    );
    const removeTargetActive =
      removeEligible &&
      (pointWithinTodayRemoveDropZone(event.clientX, event.clientY) ||
        draggedCardTopWithinTodayRemoveDropZone(
          event.clientX,
          event.clientY,
          drag.offsetX,
          drag.offsetY,
          drag.width,
        ));
    const target = todayDropTargetFromPoint(event.clientX, event.clientY);
    setTodayPointerDrag({
      index: drag.index,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      removeEligible,
      removeTargetActive,
      targetIndex: target?.index,
      placement: target?.placement,
      targetIndicator: target && target.index !== drag.index ? target.indicator : undefined,
    });
  };

  const finishTodayPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = todayPointerDragRef.current;
    const current = configRef.current;
    const item = current?.today.items[drag?.index ?? -1];
    const sourceKey = item && drag ? todaySourceKey(item, drag.index) : null;
    const removeDrop =
      Boolean(
        item &&
        drag?.hasMoved &&
        activeTimerRef.current?.sourceId !== todayTimerSourceId(item, drag.index),
      ) &&
      (pointWithinTodayRemoveDropZone(event.clientX, event.clientY) ||
        draggedCardTopWithinTodayRemoveDropZone(
          event.clientX,
          event.clientY,
          drag?.offsetX ?? 0,
          drag?.offsetY ?? 0,
          drag?.width ?? 0,
        ));
    todayPointerDragRef.current = null;
    setTodayPointerDrag(null);

    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;
    if (removeDrop && sourceKey) {
      void removeTodayItem(sourceKey);
      return;
    }

    const target = todayDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveTodayItem(drag.index, target.index, target.placement);
  };

  const cancelTodayPointerDrag = () => {
    todayPointerDragRef.current = null;
    setTodayPointerDrag(null);
  };

  const stopProjectAutoScroll = () => {
    projectAutoScrollSpeedRef.current = 0;
    if (projectAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(projectAutoScrollFrameRef.current);
      projectAutoScrollFrameRef.current = null;
    }
  };

  const continueProjectAutoScroll = () => {
    const scrollArea = mainScrollAreaRef.current;
    const speed = projectAutoScrollSpeedRef.current;
    if (!scrollArea || speed === 0) {
      projectAutoScrollFrameRef.current = null;
      return;
    }

    scrollArea.scrollTop += speed;
    projectAutoScrollFrameRef.current = window.requestAnimationFrame(continueProjectAutoScroll);
  };

  const updateProjectAutoScroll = (clientY: number) => {
    const scrollArea = mainScrollAreaRef.current;
    if (!scrollArea) return;

    const rect = scrollArea.getBoundingClientRect();
    const edgeSize = Math.min(72, rect.height * 0.2);
    let speed = 0;
    if (clientY < rect.top + edgeSize) {
      speed = -Math.max(4, Math.ceil((rect.top + edgeSize - clientY) / 4));
    } else if (clientY > rect.bottom - edgeSize) {
      speed = Math.max(4, Math.ceil((clientY - (rect.bottom - edgeSize)) / 4));
    }
    projectAutoScrollSpeedRef.current = Math.max(-18, Math.min(18, speed));

    if (projectAutoScrollSpeedRef.current === 0) {
      stopProjectAutoScroll();
    } else if (projectAutoScrollFrameRef.current === null) {
      projectAutoScrollFrameRef.current = window.requestAnimationFrame(continueProjectAutoScroll);
    }
  };

  const resolveProjectDropPlacement = (
    draggedId: string,
    target: { id: string; placement: "before" | "after" },
  ) => {
    const draggedIndex = config?.projects.findIndex((project) => project.id === draggedId) ?? -1;
    const targetIndex = config?.projects.findIndex((project) => project.id === target.id) ?? -1;
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return target.placement;
    }
    return draggedIndex < targetIndex ? "after" : "before";
  };

  const startProjectPointerDrag = (event: PointerEvent<HTMLElement>, projectId: string) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    const current = configRef.current;
    if (!current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    projectPointerDragRef.current = {
      id: projectId,
      sourceKey: `project:${projectId}`,
      origin: "nextStep",
      dayKey: current.today.date,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateProjectPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = projectPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) {
      drag.hasMoved = true;
    }
    if (drag.hasMoved) {
      const overWishlist = pointWithinSelector(event.clientX, event.clientY, ".inboxBand");
      const overToday = pointWithinSelector(event.clientX, event.clientY, ".todayGrid");
      const current = configRef.current;
      const project = current?.projects.find((candidate) => candidate.id === drag.id);
      const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
      const matchingSourceKeys = candidate
        ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
        : new Set<string>();
      const todayGuidanceActive = Boolean(
        candidate &&
        current &&
        current.today.date === drag.dayKey &&
        current.today.items.length < TODAY_ITEM_LIMIT &&
        !current.today.items.some((item, index) =>
          matchingSourceKeys.has(todaySourceKey(item, index)),
        ) &&
        !isTimerActiveForSource(
          [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
          candidate.projectId,
        ),
      );
      const todayTarget = todayGuidanceActive
        ? todayAdoptionDropTargetFromPoint(event.clientX, event.clientY)
        : null;
      const wishlistEligible = Boolean(
        project?.nextStep?.text.trim() && !sourceEditBlocked(drag.sourceKey),
      );
      const target =
        overWishlist || overToday
          ? null
          : projectDropTargetFromPoint(event.clientX, event.clientY);
      const placement = target ? resolveProjectDropPlacement(drag.id, target) : undefined;
      setProjectPointerDrag({
        id: drag.id,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetId: todayTarget ? undefined : target?.id,
        placement: todayTarget ? undefined : placement,
        targetIndicator:
          !todayTarget && target && target.id !== drag.id && placement
            ? projectDropIndicator(target.id, placement)
            : undefined,
        wishlistTarget: overWishlist && wishlistEligible,
        wishlistEligible,
        todayTargetIndex: todayTarget?.insertionIndex,
        todayTargetIndicator: todayTarget?.indicator,
        todayGuidanceActive,
      });
      updateProjectAutoScroll(event.clientY);
    }
  };

  const finishProjectPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = projectPointerDragRef.current;
    projectPointerDragRef.current = null;
    setProjectPointerDrag(null);
    stopProjectAutoScroll();

    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    const current = configRef.current;
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayTarget = todayAdoptionDropTargetFromPoint(event.clientX, event.clientY);
    const canAdoptToday = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    if (candidate && todayTarget && canAdoptToday) {
      void addCandidateToToday(candidate, todayTarget.insertionIndex);
      return;
    }
    if (pointWithinSelector(event.clientX, event.clientY, ".todayGrid")) return;

    if (pointWithinSelector(event.clientX, event.clientY, ".inboxBand")) {
      const project = configRef.current?.projects.find((candidate) => candidate.id === drag.id);
      if (project?.nextStep?.text.trim() && !sourceEditBlocked(drag.sourceKey)) {
        void removeProjectNextStep(project, "return");
      } else if (project?.nextStep?.text.trim()) {
        warnSourceEditBlocked(drag.sourceKey);
      }
      return;
    }

    const target = projectDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveProject(drag.id, target.id, resolveProjectDropPlacement(drag.id, target));
  };

  const cancelProjectPointerDrag = () => {
    if (!projectPointerDragRef.current) return;
    projectPointerDragRef.current = null;
    setProjectPointerDrag(null);
    stopProjectAutoScroll();
  };

  const startInboxPointerDrag = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    const current = configRef.current;
    const item = current?.inbox[index];
    if (!current || !item?.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    inboxPointerDragRef.current = {
      index,
      sourceKey: `wishlist:${item.id}`,
      origin: "wishlist",
      dayKey: current.today.date,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    if (!drag) return;
    const current = configRef.current;
    const sourceId = drag.sourceKey.slice("wishlist:".length);
    const sourceIndex = current?.inbox.findIndex((item) => item.id === sourceId) ?? -1;
    if (sourceIndex < 0) {
      cancelInboxPointerDrag();
      return;
    }
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const sourceItem = current?.inbox[sourceIndex];
    const sourceEditable = Boolean(
      sourceItem?.id && !sourceEditBlocked(`wishlist:${sourceItem.id}`),
    );
    const sourceProject = sourceItem?.projectId
      ? current?.projects.find((project) => project.id === sourceItem.projectId)
      : undefined;
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayGuidanceActive = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    const todayTarget = todayGuidanceActive
      ? todayAdoptionDropTargetFromPoint(event.clientX, event.clientY)
      : null;
    const nextStepEligible = Boolean(
      sourceEditable && sourceProject && !sourceEditBlocked(`project:${sourceProject.id}`),
    );
    const nextStepTargetProjectId =
      nextStepEligible && pointWithinSelector(event.clientX, event.clientY, ".projectsBand")
        ? sourceProject?.id
        : undefined;
    const candidateTarget =
      nextStepTargetProjectId || todayTarget
        ? null
        : inboxDropTargetFromPoint(event.clientX, event.clientY);
    const projectIds = new Set((current?.projects ?? []).map((project) => project.id));
    const targetItem = candidateTarget ? current?.inbox[candidateTarget.index] : undefined;
    const target =
      sourceItem &&
      targetItem &&
      wishlistGroupKey(sourceItem, projectIds) === wishlistGroupKey(targetItem, projectIds)
        ? candidateTarget
        : null;
    setInboxPointerDrag({
      index: sourceIndex,
      sourceKey: drag.sourceKey,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetIndex: todayTarget ? undefined : target?.index,
      placement: todayTarget ? undefined : target?.placement,
      targetIndicator:
        !todayTarget && target && target.index !== drag.index ? target.indicator : undefined,
      nextStepEligible,
      nextStepTargetProjectId,
      todayTargetIndex: todayTarget?.insertionIndex,
      todayTargetIndicator: todayTarget?.indicator,
      todayGuidanceActive,
    });
    updateProjectAutoScroll(event.clientY);
  };

  const finishInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    stopProjectAutoScroll();

    const current = configRef.current;
    const sourceIndex =
      current?.inbox.findIndex((item) => item.id === drag.sourceKey.slice("wishlist:".length)) ??
      -1;
    if (sourceIndex < 0) return;
    const sourceItem = current?.inbox[sourceIndex];
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayTarget = todayAdoptionDropTargetFromPoint(event.clientX, event.clientY);
    const canAdoptToday = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    if (candidate && todayTarget && canAdoptToday) {
      void addCandidateToToday(candidate, todayTarget.insertionIndex);
      return;
    }
    if (pointWithinSelector(event.clientX, event.clientY, ".todayGrid")) return;
    const sourceProject = sourceItem?.projectId
      ? current?.projects.find((project) => project.id === sourceItem.projectId)
      : undefined;
    const overNextStep = pointWithinSelector(event.clientX, event.clientY, ".projectsBand");
    if (
      overNextStep &&
      sourceItem?.id &&
      sourceProject &&
      !sourceEditBlocked(`wishlist:${sourceItem.id}`) &&
      !sourceEditBlocked(`project:${sourceProject.id}`)
    ) {
      void promoteWishlistToProject(sourceItem.id);
      return;
    }
    if (overNextStep) {
      const blockReason = sourceItem?.id
        ? (sourceEditBlockReason(`wishlist:${sourceItem.id}`) ??
          (sourceProject ? sourceEditBlockReason(`project:${sourceProject.id}`) : null))
        : null;
      showToast("warn", blockReason ?? "このやりたいことは次の一手へ移動できません");
      return;
    }
    const target = inboxDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    const placement =
      sourceIndex === target.index
        ? target.placement
        : sourceIndex < target.index
          ? "after"
          : "before";
    moveInboxItem(sourceIndex, target.index, placement);
  };

  const cancelInboxPointerDrag = () => {
    if (!inboxPointerDragRef.current) return;
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
    stopProjectAutoScroll();
  };

  const toggleWishlistGroup = (key: string) => {
    setWishlistGroupViews((current) => ({
      ...current,
      [key]: {
        ...current[key],
        collapsed: !current[key]?.collapsed,
      },
    }));
  };

  const startWishlistGroupPointerDrag = (
    event: PointerEvent<HTMLElement>,
    key: string,
    name: string,
  ) => {
    if (event.button !== 0 || key === "unassigned") return;
    const header = (event.target as Element).closest<HTMLElement>(".wishlistGroupHeader");
    if (!header || !event.currentTarget.contains(header)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = header.getBoundingClientRect();
    wishlistGroupPointerDragRef.current = {
      key,
      name,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateWishlistGroupPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = wishlistGroupPointerDragRef.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;
    const target = wishlistGroupDropTargetFromPoint(event.clientX, event.clientY);
    setWishlistGroupPointerDrag({
      key: drag.key,
      name: drag.name,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetKey: target?.key,
      placement: target?.placement,
      targetIndicator: target && target.key !== drag.key ? target.indicator : undefined,
    });
    updateProjectAutoScroll(event.clientY);
  };

  const finishWishlistGroupPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = wishlistGroupPointerDragRef.current;
    wishlistGroupPointerDragRef.current = null;
    setWishlistGroupPointerDrag(null);
    stopProjectAutoScroll();
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) {
      toggleWishlistGroup(drag.key);
      return;
    }
    const target = wishlistGroupDropTargetFromPoint(event.clientX, event.clientY);
    if (target && target.key !== drag.key) {
      moveWishlistGroup(drag.key, target.key, target.placement);
    }
  };

  const cancelWishlistGroupPointerDrag = () => {
    wishlistGroupPointerDragRef.current = null;
    setWishlistGroupPointerDrag(null);
    stopProjectAutoScroll();
  };

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
    [config, finishTimer, returnToMain, runActions, showToast],
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

  const removeTodayItem = async (sourceKey: string) => {
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
  };

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

  const sourceEditBlockReason = (key: string, allowTodaySourceSync = false) => {
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
  };

  const sourceEditBlocked = (key: string, allowTodaySourceSync = false) =>
    sourceEditBlockReason(key, allowTodaySourceSync) !== null;

  const warnSourceEditBlocked = (key: string, allowTodaySourceSync = false) => {
    const reason = sourceEditBlockReason(key, allowTodaySourceSync);
    if (reason) showToast("warn", reason);
    return Boolean(reason);
  };

  const saveSourceEdit = async (previous: AppConfig, next: AppConfig, key: string) => {
    const allowTodaySourceSync = sourceEditOriginRef.current === "today";
    if (warnSourceEditBlocked(key, allowTodaySourceSync)) {
      return null;
    }
    sourceEditBusyRef.current = key;
    setSourceEditSaving(true);
    try {
      const resnapshotted = resnapshotSource(previous, next, key);
      const todayUpdated = resnapshotted.today !== next.today;
      return (await persistConfig(resnapshotted)) ? { todayUpdated } : null;
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

  const isTimerActiveForSource = (sourceKeys: string[], projectId?: string) => {
    if (!activeTimer) return false;
    return (
      (projectId !== undefined && activeTimer.sourceId === projectId) ||
      sourceKeys.some((sourceKey) => activeTimer.sourceId === `today:${sourceKey}`)
    );
  };

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

  const addCandidateToToday = async (candidate: TodayCandidate, insertionIndex?: number) => {
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
  };

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

  const refreshInstructionChoices = async () => {
    setInstructionChoicesLoading(true);
    setInstructionChoicesError(null);
    try {
      const roots = (await listInstructionRoots()).filter((root) => root.available);
      const choices: InstructionChoice[] = [];
      const queue = roots.map((root) => ({ root, path: root.path }));
      let scanned = 0;
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        const entries = await listInstructionDirectory(current.path);
        for (const entry of entries) {
          scanned += 1;
          if (scanned > 50_000) throw new Error("手順書一覧が50,000項目を超えています");
          if (entry.kind === "folder") {
            queue.push({ root: current.root, path: entry.path });
          } else {
            const relative = entry.path
              .slice(current.root.path.length)
              .replace(/^[\\/]+/, "")
              .replace(/[\\/]+/g, " / ");
            choices.push({ path: entry.path, label: `${current.root.name} / ${relative}` });
          }
        }
      }
      choices.sort((left, right) => left.label.localeCompare(right.label, "ja"));
      setInstructionChoices(choices);
    } catch (error) {
      setInstructionChoices([]);
      setInstructionChoicesError(error instanceof Error ? error.message : String(error));
    } finally {
      setInstructionChoicesLoading(false);
    }
  };

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

  const openProjectAddDialog = () => {
    if (!config) return;
    captureDialogReturnFocus(projectEditReturnFocusRef);
    setContextMenu(null);
    const draft: ProjectEditDraft = {
      id: "",
      name: "",
      northStar: "",
      weeklyFocus: false,
      colorId: "amber",
      isNew: true,
    };
    projectEditInitialDraftRef.current = draft;
    setProjectEditDraft(draft);
  };

  const openProjectEditDialog = (
    project: LauncherProject,
    origin: "source" | "today" | "builder" = "source",
  ) => {
    sourceEditOriginRef.current = origin;
    captureDialogReturnFocus(projectEditReturnFocusRef);
    setContextMenu(null);
    const draft: ProjectEditDraft = {
      id: project.id,
      name: project.name,
      northStar: project.northStar ?? "",
      weeklyFocus: project.weeklyFocus === true,
      colorId: resolveProjectColorId(project.id, project.colorId),
      isNew: false,
    };
    projectEditInitialDraftRef.current = draft;
    setProjectEditDraft(draft);
  };

  const nextStepExecutionDraft = (
    execution?: Partial<LauncherNextStep>,
  ): Pick<
    NextStepEditDraft,
    | "buttonIds"
    | "defaultTimerMinutes"
    | "shortTimerMinutes"
    | "startNoteTemplate"
    | "instructionPath"
    | "instructionOpenOnStart"
    | "expandTimerOnStart"
  > => ({
    buttonIds: (execution?.buttonIds ?? []).filter((buttonId) =>
      projectSelectableButtons.some((button) => button.id === buttonId),
    ),
    defaultTimerMinutes: execution?.defaultTimerMinutes
      ? String(execution.defaultTimerMinutes)
      : "",
    shortTimerMinutes: execution?.shortTimerMinutes ? String(execution.shortTimerMinutes) : "",
    startNoteTemplate: execution?.startNoteTemplate ?? "",
    instructionPath: execution?.instructionPath ?? "",
    instructionOpenOnStart: Boolean(
      execution?.instructionPath && execution.instructionOpenOnStart !== false,
    ),
    expandTimerOnStart: execution?.expandTimerOnStart === true,
  });

  const openNextStepEditor = (
    project: LauncherProject,
    options?: {
      mode?: NextStepEditDraft["mode"];
      text?: string;
      promotedWishlistId?: string;
      projectLocked?: boolean;
      origin?: "source" | "today" | "builder";
      /** P10-09: values copied from the Next Step that was just finished. */
      prefill?: Partial<
        Pick<
          NextStepEditDraft,
          | "text"
          | "trigger"
          | "buttonIds"
          | "shortTimerMinutes"
          | "defaultTimerMinutes"
          | "instructionPath"
          | "instructionOpenOnStart"
          | "startNoteTemplate"
          | "expandTimerOnStart"
        >
      >;
    },
  ) => {
    const sourceKey = `project:${project.id}`;
    const origin = options?.origin ?? "source";
    if (warnSourceEditBlocked(sourceKey, origin === "today")) {
      setContextMenu(null);
      return;
    }
    const mode = options?.mode ?? (project.nextStep?.text.trim() ? "edit" : "set");
    const promotingWishlist = mode === "promote" && Boolean(options?.promotedWishlistId);
    const editingExisting = mode === "edit" && Boolean(project.nextStep);
    // P10-09 (§8.1): a prefilled Next Step ("same step again") starts on the free-text form so
    // the copied action and its execution settings are visible as they are.
    const initialDecisionMode: NextStepDecisionMode = options?.prefill
      ? "new"
      : promotingWishlist || mode === "set"
        ? "wishlist"
        : "new";
    sourceEditOriginRef.current = origin;
    captureDialogReturnFocus(nextStepEditReturnFocusRef);
    setContextMenu(null);
    const draft: NextStepEditDraft = {
      mode,
      decisionMode: initialDecisionMode,
      projectId: project.id,
      projectLocked: options?.projectLocked ?? true,
      text:
        initialDecisionMode === "wishlist" ? "" : (options?.text ?? project.nextStep?.text ?? ""),
      originalText: project.nextStep?.text ?? "",
      trigger: editingExisting ? (project.nextStep?.trigger ?? "") : "",
      resumeNote: editingExisting ? (project.nextStep?.resumeNote ?? "") : "",
      ...nextStepExecutionDraft(editingExisting ? project.nextStep : undefined),
      legacyChoice:
        !editingExisting && !project.nextStep && project.legacyNextStepSettings ? null : "discard",
      replacementChoice: null,
      replacedNextStep: promotingWishlist ? project.nextStep : undefined,
      ...(options?.promotedWishlistId ? { promotedWishlistId: options.promotedWishlistId } : {}),
      ...(options?.prefill ?? {}),
    };
    nextStepEditInitialDraftRef.current = draft;
    setNextStepOpenMenuOpen(false);
    setNextStepOpenPicker(null);
    setNextStepEditDraft(draft);
    void refreshNextStepSuggestions(project.id);
    void refreshInstructionChoices();
  };

  const promoteInboxToNextStep = (index: number) => {
    const current = configRef.current;
    const item = current?.inbox[index];
    if (!current || !item) return;
    if (!item.id) {
      setContextMenu(null);
      showToast("warn", "この項目にはstable IDがないため、先に編集して保存してください");
      return;
    }
    if (warnSourceEditBlocked(`wishlist:${item.id}`)) {
      setContextMenu(null);
      return;
    }
    const project = item.projectId
      ? current.projects.find((candidate) => candidate.id === item.projectId)
      : undefined;
    if (item.projectId && !project) {
      setContextMenu(null);
      showToast("warn", "所属プロジェクトが見つかりません");
      return;
    }
    if (project) {
      openNextStepEditor(project, {
        mode: "promote",
        text: item.text,
        promotedWishlistId: item.id,
        projectLocked: true,
      });
      return;
    }
    captureDialogReturnFocus(nextStepEditReturnFocusRef);
    setContextMenu(null);
    const draft: NextStepEditDraft = {
      mode: "promote",
      decisionMode: "wishlist",
      projectId: "",
      projectLocked: false,
      text: "",
      originalText: "",
      trigger: "",
      resumeNote: "",
      ...nextStepExecutionDraft(),
      legacyChoice: "discard",
      replacementChoice: null,
      replacedNextStep: undefined,
      promotedWishlistId: item.id,
    };
    nextStepEditInitialDraftRef.current = draft;
    setNextStepOpenMenuOpen(false);
    setNextStepOpenPicker(null);
    setNextStepEditDraft(draft);
    setProjectNextStepSuggestions([]);
    void refreshInstructionChoices();
  };

  const promoteWishlistToProject = async (wishlistId: string) => {
    const current = configRef.current;
    const item = current?.inbox.find((candidate) => candidate.id === wishlistId);
    const project = item?.projectId
      ? current?.projects.find((candidate) => candidate.id === item.projectId)
      : undefined;
    if (!current || !item || !project || sourceEditBusyRef.current) return false;
    if (project.nextStep?.sourceWishlistId === wishlistId) {
      showToast("warn", "すでに次の一手に設定されています");
      return true;
    }
    const projectId = project.id;
    const wishlistSource = `wishlist:${wishlistId}`;
    const projectSource = `project:${projectId}`;
    const blockReason =
      sourceEditBlockReason(wishlistSource) ?? sourceEditBlockReason(projectSource);
    if (blockReason) {
      showToast("warn", blockReason);
      return false;
    }

    const legacyExecution = project.nextStep ? undefined : project.legacyNextStepSettings;
    const instructionPath = item.instructionPath ?? legacyExecution?.instructionPath;
    const nextStep: LauncherNextStep = {
      text: item.text.trim(),
      generationId: createStableId(),
      buttonIds: [...(item.buttonIds ?? legacyExecution?.buttonIds ?? [])],
      ...(legacyExecution?.defaultTimerMinutes
        ? { defaultTimerMinutes: legacyExecution.defaultTimerMinutes }
        : {}),
      ...(legacyExecution?.shortTimerMinutes
        ? { shortTimerMinutes: legacyExecution.shortTimerMinutes }
        : {}),
      ...(legacyExecution?.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
      ...(legacyExecution?.startNoteTemplate
        ? { startNoteTemplate: legacyExecution.startNoteTemplate }
        : {}),
      ...(instructionPath
        ? {
            instructionPath,
            instructionOpenOnStart:
              item.instructionPath !== undefined
                ? item.instructionOpenOnStart !== false
                : legacyExecution?.instructionOpenOnStart !== false,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    let nextConfig: AppConfig;
    try {
      nextConfig = prepareWishlistPromotion(current, {
        wishlistId,
        projectId,
        nextStep,
        expectedCurrent: project.nextStep,
        createId: createStableId,
      });
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return false;
    }

    sourceEditBusyRef.current = projectSource;
    try {
      const saved = await persistConfig(nextConfig);
      if (saved) {
        showToast(
          "ok",
          project.nextStep?.text.trim() ? "次の一手を変更しました" : "次の一手に設定しました",
          {
            detail: project.nextStep?.text.trim()
              ? "元の次の一手はやりたいことへ戻しました"
              : undefined,
          },
        );
      }
      return saved;
    } finally {
      sourceEditBusyRef.current = null;
    }
  };

  const selectNextStepProject = (projectId: string) => {
    if (!nextStepEditDraft || nextStepEditDraft.projectLocked) return;
    const project = configRef.current?.projects.find((candidate) => candidate.id === projectId);
    if (project && warnSourceEditBlocked(`project:${project.id}`)) {
      return;
    }
    setNextStepEditDraft({
      ...nextStepEditDraft,
      mode:
        nextStepEditDraft.decisionMode === "wishlist"
          ? "promote"
          : project?.nextStep
            ? "edit"
            : "set",
      projectId,
      originalText: project?.nextStep?.text ?? "",
      trigger: "",
      resumeNote: "",
      ...nextStepExecutionDraft(),
      legacyChoice: project?.legacyNextStepSettings && !project.nextStep ? null : "discard",
      replacementChoice: null,
      replacedNextStep:
        nextStepEditDraft.decisionMode === "wishlist" ? project?.nextStep : undefined,
      promotedWishlistId: undefined,
    });
    void refreshNextStepSuggestions(projectId || null);
  };

  const selectNextStepDecisionMode = (decisionMode: NextStepDecisionMode) => {
    const draft = nextStepEditDraft;
    const current = configRef.current;
    if (!draft || !current || draft.decisionMode === decisionMode) return;
    const project = current.projects.find((candidate) => candidate.id === draft.projectId);
    const selectedWishlistStillMatches = current.inbox.some(
      (item) => item.id === draft.promotedWishlistId && item.projectId === draft.projectId,
    );
    if (decisionMode === "wishlist") {
      setNextStepEditDraft({
        ...draft,
        mode: "promote",
        decisionMode,
        trigger: "",
        resumeNote: "",
        ...nextStepExecutionDraft(),
        legacyChoice: "discard",
        replacementChoice: null,
        replacedNextStep: project?.nextStep,
        promotedWishlistId: selectedWishlistStillMatches ? draft.promotedWishlistId : undefined,
      });
      return;
    }
    setNextStepEditDraft({
      ...draft,
      mode: project?.nextStep ? "edit" : "set",
      decisionMode,
      resumeNote: project?.nextStep?.resumeNote ?? "",
      legacyChoice: project?.legacyNextStepSettings && !project.nextStep ? null : "discard",
      replacementChoice: null,
      replacedNextStep: undefined,
    });
  };

  const chooseLegacyNextStepSettings = (choice: Exclude<LegacyNextStepChoice, null>) => {
    if (!nextStepEditDraft) return;
    const project = configRef.current?.projects.find(
      (candidate) => candidate.id === nextStepEditDraft.projectId,
    );
    setNextStepEditDraft({
      ...nextStepEditDraft,
      ...nextStepExecutionDraft(choice === "inherit" ? project?.legacyNextStepSettings : undefined),
      legacyChoice: choice,
    });
  };

  const parseNextStepTimer = (raw: string, label: string) => {
    if (!raw.trim()) return undefined;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 1 || value > 240) {
      throw new Error(`${label}は1〜240分で入力してください`);
    }
    return value;
  };

  const saveNextStepEdit = async () => {
    const current = configRef.current;
    const draft = nextStepEditDraft;
    if (!current || !draft || sourceEditBusyRef.current) return;
    const project = current.projects.find((candidate) => candidate.id === draft.projectId);
    if (!project) {
      showToast("warn", "プロジェクトを選択してください");
      return;
    }

    const promotingWishlist = draft.decisionMode === "wishlist";
    const selectedWishlist =
      promotingWishlist && draft.promotedWishlistId
        ? current.inbox.find(
            (item) => item.id === draft.promotedWishlistId && item.projectId === project.id,
          )
        : undefined;
    if (promotingWishlist && !selectedWishlist) {
      showToast("warn", "やりたいことを選択してください");
      return;
    }
    if (selectedWishlist && project.nextStep?.sourceWishlistId === selectedWishlist.id) {
      showToast("warn", "すでに次の一手に設定されています");
      return;
    }
    const text = promotingWishlist ? (selectedWishlist?.text.trim() ?? "") : draft.text.trim();
    if (!text) {
      showToast("warn", "次の一手を入力してください");
      return;
    }
    if (promotingWishlist && !sameNextStepSnapshot(project.nextStep, draft.replacedNextStep)) {
      showToast("warn", "現在の次の一手が変更されたため、内容を確認し直してください");
      return;
    }
    if (
      !promotingWishlist &&
      !project.nextStep &&
      project.legacyNextStepSettings &&
      draft.legacyChoice === null
    ) {
      showToast("warn", "以前の実行設定を引き継ぐか破棄するか選んでください");
      return;
    }

    const replacingExisting = Boolean(promotingWishlist && project.nextStep?.text.trim());
    if (replacingExisting && draft.replacementChoice !== "return") {
      showToast("warn", "現在の次の一手をやりたいことへ戻すことを確認してください");
      return;
    }
    const projectSourceKey = `project:${project.id}`;
    const wishlistSourceKey = selectedWishlist ? `wishlist:${selectedWishlist.id}` : null;
    const allowTodaySourceSync = sourceEditOriginRef.current === "today" && !promotingWishlist;
    const blockReason =
      sourceEditBlockReason(projectSourceKey, allowTodaySourceSync) ??
      (wishlistSourceKey ? sourceEditBlockReason(wishlistSourceKey) : null);
    if (blockReason) {
      showToast("warn", blockReason);
      return;
    }
    if (selectedWishlist && unfinishedTodayUsesSource(current, `wishlist:${selectedWishlist.id}`)) {
      showToast("warn", "今日の3件で未完了のやりたいことは選べません");
      return;
    }
    if (
      replacingExisting &&
      unfinishedTodayUsesSource(current, projectSourceKey, project.nextStep?.generationId)
    ) {
      showToast("warn", "今日の3件で未完了の次の一手があるため変更できません");
      return;
    }

    let defaultTimerMinutes: number | undefined;
    let shortTimerMinutes: number | undefined;
    try {
      defaultTimerMinutes = parseNextStepTimer(draft.defaultTimerMinutes, "通常タイマー");
      shortTimerMinutes = parseNextStepTimer(draft.shortTimerMinutes, "短時間タイマー");
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return;
    }

    const now = new Date().toISOString();
    const existing = !promotingWishlist && draft.mode === "edit" ? project.nextStep : undefined;
    const nextStep: LauncherNextStep = {
      text,
      ...(existing ? { generationId: existing.generationId } : { generationId: createStableId() }),
      ...(existing?.sourceWishlistId ? { sourceWishlistId: existing.sourceWishlistId } : {}),
      buttonIds: [...draft.buttonIds],
      ...(draft.trigger.trim() ? { trigger: draft.trigger.trim() } : {}),
      ...(defaultTimerMinutes ? { defaultTimerMinutes } : {}),
      ...(shortTimerMinutes ? { shortTimerMinutes } : {}),
      ...(draft.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
      ...(draft.startNoteTemplate.trim()
        ? { startNoteTemplate: draft.startNoteTemplate.trim() }
        : {}),
      ...(draft.instructionPath
        ? {
            instructionPath: draft.instructionPath,
            instructionOpenOnStart: draft.instructionOpenOnStart,
          }
        : {}),
      updatedAt: existing?.updatedAt && text === draft.originalText ? existing.updatedAt : now,
      ...(existing?.reviewedAt ? { reviewedAt: existing.reviewedAt } : {}),
      ...(existing && draft.resumeNote.trim() ? { resumeNote: draft.resumeNote.trim() } : {}),
    };

    let nextConfig: AppConfig;
    if (promotingWishlist && selectedWishlist) {
      try {
        nextConfig = prepareWishlistPromotion(current, {
          wishlistId: selectedWishlist.id!,
          projectId: project.id,
          nextStep,
          expectedCurrent: draft.replacedNextStep,
          createId: createStableId,
        });
      } catch (error) {
        showToast("warn", error instanceof Error ? error.message : String(error));
        return;
      }
    } else {
      const nextProject: LauncherProject = {
        ...project,
        nextStep,
        legacyNextStepSettings: undefined,
      };
      nextConfig = {
        ...current,
        projects: current.projects.map((candidate) =>
          candidate.id === project.id ? nextProject : candidate,
        ),
      };
    }

    if (!promotingWishlist && draft.mode === "edit") {
      const result = await saveSourceEdit(current, nextConfig, projectSourceKey);
      if (!result) return;
      closeNextStepEditDialog(true);
      showToast("ok", "次の一手を保存しました", {
        detail: result.todayUpdated ? "今日の3件にも反映しました" : undefined,
      });
      return;
    }

    sourceEditBusyRef.current = projectSourceKey;
    setSourceEditSaving(true);
    try {
      if (!(await persistConfig(nextConfig))) return;
      closeNextStepEditDialog(true);
      showToast("ok", promotingWishlist ? "次の一手にしました" : "次の一手を保存しました", {
        detail: replacingExisting ? "元の次の一手はやりたいことへ戻しました" : undefined,
      });
    } finally {
      sourceEditBusyRef.current = null;
      setSourceEditSaving(false);
    }
  };

  const removeProjectNextStep = async (project: LauncherProject, choice: "return" | "delete") => {
    const current = configRef.current;
    const liveProject = current?.projects.find((candidate) => candidate.id === project.id);
    if (!current || !liveProject?.nextStep?.text.trim()) return false;
    const sourceKey = `project:${project.id}`;
    if (warnSourceEditBlocked(sourceKey)) {
      setContextMenu(null);
      return false;
    }
    let nextConfig: AppConfig;
    try {
      nextConfig = prepareNextStepRemoval(current, {
        projectId: liveProject.id,
        expectedCurrent: liveProject.nextStep,
        choice,
        createId: createStableId,
      });
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return false;
    }
    const saved = await persistConfig(nextConfig);
    if (saved) {
      setContextMenu(null);
      showToast(
        "neutral",
        choice === "return" ? "やりたいことへ戻しました" : "次の一手を未設定にしました",
      );
    }
    return saved;
  };

  const clearProjectNextStep = (project: LauncherProject) => {
    const current = configRef.current;
    const liveProject = current?.projects.find((candidate) => candidate.id === project.id);
    if (!current || !liveProject?.nextStep?.text.trim()) return;
    const sourceKey = `project:${project.id}`;
    if (warnSourceEditBlocked(sourceKey)) {
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    requestConfirmation({
      title: "次の一手を未設定にしますか？",
      subject: `「${liveProject.nextStep.text}」`,
      message: "今日の3件に採用済みの内容と実行記録は変更しません。",
      confirmLabel: "やりたいことへ戻す",
      alternateLabel: "削除して未設定にする",
      alternateTone: "danger",
      processingLabel: "保存しています…",
      alternateProcessingLabel: "保存しています…",
      tone: "warning",
      onConfirm: () => removeProjectNextStep(liveProject, "return"),
      onAlternate: () => removeProjectNextStep(liveProject, "delete"),
    });
  };

  const projectDeleteBlockReason = (projectId: string) => {
    const current = configRef.current;
    if (!current) return "設定を読み込んでから削除してください";
    if (sourceEditBusyRef.current !== null || projectEditSavingRef.current) {
      return "保存処理が完了してから削除してください";
    }
    return projectDeletionBlockReason(current, projectId, activeTimerRef.current?.sourceId);
  };

  const executeProjectDeletion = async (projectId: string, mode: ProjectDeletionMode) => {
    const current = configRef.current;
    if (!current) return false;
    const reason = projectDeleteBlockReason(projectId);
    if (reason) {
      showToast("warn", reason);
      return false;
    }
    const summary = projectDeletionSummary(current, projectId);
    if (!summary) {
      showToast("warn", "削除するプロジェクトが見つかりません");
      return false;
    }
    const nextConfig = prepareProjectDeletion(current, projectId, mode, {
      completedAt: new Date().toISOString(),
      createId: createStableId,
    });
    if (!nextConfig) return false;
    if (!(await persistConfig(nextConfig))) return false;

    if (projectEditDraft?.id === projectId) closeProjectEditDialog(true);
    showToast(
      "danger",
      mode === "complete"
        ? `残っている項目を完了扱いにして、プロジェクト「${summary.project.name}」を削除しました`
        : `プロジェクト「${summary.project.name}」を削除しました`,
    );
    return true;
  };

  const requestProjectDeletion = (project: LauncherProject) => {
    setContextMenu(null);
    const current = configRef.current;
    if (!current) return;
    const reason = projectDeleteBlockReason(project.id);
    if (reason) {
      showToast("warn", reason);
      return;
    }
    const summary = projectDeletionSummary(current, project.id);
    if (!summary) {
      showToast("warn", "削除するプロジェクトが見つかりません");
      return;
    }
    requestConfirmation({
      title: "プロジェクトを削除しますか？",
      subject: `「${summary.project.name}」と、現在登録されている関連項目が対象です。`,
      message: `次の一手: ${summary.nextStepCount}件\nやりたいこと: ${summary.wishlistCount}件\n\n過去の実行記録は残ります。`,
      confirmLabel: "関連項目も削除",
      alternateLabel: "残っている項目を完了扱いにして削除",
      processingLabel: "削除しています…",
      alternateProcessingLabel: "完了扱いにして削除しています…",
      tone: "danger",
      alternateTone: "danger",
      initialFocus: "cancel",
      onConfirm: () => executeProjectDeletion(project.id, "delete"),
      onAlternate: () => executeProjectDeletion(project.id, "complete"),
    });
  };

  const openProjectManagement = () => {
    setContextMenu(null);
    setProjectsOpen(true);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".projectsBand")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const saveProjectEdit = async () => {
    const config = configRef.current;
    if (!config || !projectEditDraft || projectEditSavingRef.current) return;
    if (!projectEditDraft.isNew && !config.projects.some((p) => p.id === projectEditDraft.id)) {
      showToast("warn", "元の登録が見つかりません");
      return;
    }
    const name = projectEditDraft.name.trim();
    if (!name) {
      showToast("warn", "プロジェクト名を入力してください");
      return;
    }

    const existingProject = projectEditDraft.isNew
      ? undefined
      : config.projects.find((item) => item.id === projectEditDraft.id);
    const project: LauncherProject = {
      ...(existingProject ?? {}),
      id: projectEditDraft.isNew ? uniqueProjectId(name, config.projects) : projectEditDraft.id,
      name,
      northStar: projectEditDraft.northStar.trim() || undefined,
      weeklyFocus: projectEditDraft.weeklyFocus || undefined,
      colorId: projectEditDraft.colorId,
    };

    const projects = projectEditDraft.isNew
      ? [...config.projects, project]
      : config.projects.map((item) => (item.id === project.id ? project : item));

    projectEditSavingRef.current = true;
    setProjectEditSaving(true);
    try {
      if (!(await persistConfig({ ...config, projects }))) return;
      closeProjectEditDialog(true);
      if (projectEditDraft.isNew) {
        showToast("ok", `${name} を追加しました`);
      } else {
        showToast("ok", "プロジェクトを保存しました");
      }
    } finally {
      projectEditSavingRef.current = false;
      setProjectEditSaving(false);
    }
  };

  const setProjectWeeklyFocus = (checked: boolean) => {
    if (!config || !projectEditDraft) return;
    const otherFocusedProjects = config.projects.filter(
      (project) => project.id !== projectEditDraft.id && project.weeklyFocus === true,
    ).length;
    if (checked && otherFocusedProjects >= WEEKLY_FOCUS_LIMIT) {
      showToast("neutral", `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます`);
      return;
    }
    setProjectEditDraft({ ...projectEditDraft, weeklyFocus: checked });
  };

  const setWeeklyReviewProjectFocus = (projectId: string, checked: boolean) => {
    if (!config) return;
    const otherFocusedProjects = config.projects.filter(
      (project) => project.id !== projectId && project.weeklyFocus === true,
    ).length;
    if (checked && otherFocusedProjects >= WEEKLY_FOCUS_LIMIT) {
      showToast("neutral", `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます`);
      return;
    }

    void persistConfig({
      ...config,
      projects: config.projects.map((project) =>
        project.id === projectId ? { ...project, weeklyFocus: checked || undefined } : project,
      ),
    });
  };

  const openManualSessionDialog = () => {
    if (!config) return;
    setManualSessionDraft({
      projectId: config.projects[0]?.id ?? null,
      date: config.today.date,
      startedAt: formatStartedAt(new Date()),
      minutes: String(config.settings.defaultTimerMinutes),
      note: "",
    });
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

  const saveManualSession = async () => {
    if (!config || !manualSessionDraft) return;
    const minutes = Number.parseInt(manualSessionDraft.minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast("warn", "分数は1以上で入力してください");
      return;
    }
    const startedAt = manualSessionDraft.startedAt.trim() || formatStartedAt(new Date());
    if (!isValidStartedAt(startedAt)) {
      showToast("warn", "開始時刻はHH:mm形式で入力してください");
      return;
    }

    const project = manualSessionDraft.projectId
      ? config.projects.find((item) => item.id === manualSessionDraft.projectId)
      : null;
    const label = project?.name ?? "手動の実行記録";

    try {
      const summary = await recordManualSession({
        projectId: project?.id ?? null,
        label,
        date: manualSessionDraft.date,
        startedAt,
        minutes,
        note: manualSessionDraft.note,
      });
      setSessionSummary(summary);
      await refreshSessions();
      await refreshTodayActivity();
      if (activeView === "records") {
        await refreshRecords();
      }
      setManualSessionDraft(null);
      showToast("ok", "実行記録を追加しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を追加できません: ${message}`);
    }
  };

  const openSessionEditDialog = (session: SessionEntryRow) => {
    setSessionEditDraft({
      rowKey: session.rowKey,
      projectId: session.projectId ?? null,
      label: session.label,
      date: session.date,
      startedAt: session.startedAt,
      minutes: String(session.minutes),
      note: session.note,
    });
  };

  const saveSessionEdit = async () => {
    if (!sessionEditDraft) return;
    const minutes = Number.parseInt(sessionEditDraft.minutes, 10);
    if (!sessionEditDraft.date.trim()) {
      showToast("warn", "日付を入力してください");
      return;
    }
    if (!sessionEditDraft.label.trim()) {
      showToast("warn", "ラベルを入力してください");
      return;
    }
    if (!sessionEditDraft.startedAt.trim()) {
      showToast("warn", "開始時刻を入力してください");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast("warn", "分数は1以上で入力してください");
      return;
    }

    try {
      const response = await updateSessionEntry({
        rowKey: sessionEditDraft.rowKey,
        projectId: sessionEditDraft.projectId,
        label: sessionEditDraft.label.trim(),
        date: sessionEditDraft.date,
        startedAt: sessionEditDraft.startedAt.trim(),
        minutes,
        note: sessionEditDraft.note,
      });
      setSessionEntries(response);
      await refreshTodayActivity();
      if (response.warning) {
        showToast("warn", response.warning);
      }
      await refreshSessions();
      await refreshRecords();
      setSessionEditDraft(null);
      showToast("ok", "実行記録を更新しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を更新できません: ${message}`);
    }
  };

  const confirmSessionDelete = async (session: SessionEntryRow) => {
    try {
      const response = await deleteSessionEntry({ rowKey: session.rowKey });
      setSessionEntries(response);
      await refreshTodayActivity();
      if (response.warning) {
        showToast("warn", response.warning);
      }
      await refreshSessions();
      await refreshRecords();
      showToast("neutral", "実行記録を削除しました");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を削除できません: ${message}`);
      return false;
    }
  };

  const requestSessionDelete = (session: SessionEntryRow) => {
    requestConfirmation({
      title: "実行記録を削除しますか？",
      subject: `${session.date} ${session.startedAt} / ${session.label} / ${session.minutes}分`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: () => confirmSessionDelete(session),
    });
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
  const renderTodayPickerSelectedItem = (item: TodayItem, index: number) => {
    const project = item.projectId ? projectsById.get(item.projectId) : undefined;
    const pickerItemRunning = timerRunsTodayItem(
      todayEntries(todayPickerDraftItems),
      activeTimer,
      todayTimerSourceId(item, index),
      todaySourceKey(item, index),
    );
    return (
      <div
        className={[
          "todayPickerSlot todayPickerSlot--selected todayPickerRow todayPickerRow--selected",
          todayPickerDragIndex === index ? "todayPickerSlot--dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-project-color={
          project ? resolveProjectColorId(project.id, project.colorId) : undefined
        }
        data-today-picker-slot-index={index}
        draggable={!todayPickerSaving}
        key={`today-selected:${todaySourceKey(item, index)}`}
        onDragEnd={() => setTodayPickerDragIndex(null)}
        onDragOver={(event) => {
          if (todayPickerDragIndex === null) return;
          event.preventDefault();
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(index));
          setTodayPickerDragIndex(index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          moveTodayPickerItemToIndex(index);
        }}
        onKeyDown={(event) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
          event.preventDefault();
          moveTodayPickerItem(index, event.key === "ArrowUp" ? index - 1 : index + 1);
        }}
        tabIndex={0}
      >
        <span aria-hidden="true" className="todayPickerSlotIndex">
          {index + 1}
        </span>
        <div className="todayPickerSlotCopy">
          {project && (
            <span className="todayPickerSlotProject">
              <span aria-hidden="true" className="todayPickerDot" />
              {project.name}
            </span>
          )}
          <strong className="todayPickerSlotTask" title={item.text}>
            {item.text}
          </strong>
        </div>
        <button
          aria-label="今日から外す"
          className="todayPickerRemoveButton"
          disabled={todayPickerSaving || pickerItemRunning}
          onClick={() => removeTodayPickerDraftItem(index)}
          onPointerDown={(event) => event.stopPropagation()}
          title={pickerItemRunning ? "タイマーを停止してから外してください" : undefined}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </div>
    );
  };
  const renderTodayPickerCandidate = (candidate: TodayCandidate) => {
    const project = candidate.projectId ? projectsById.get(candidate.projectId) : undefined;
    const selected = todayPickerCandidateSelected(candidate);
    return (
      <div
        className="todayPickerRow"
        data-project-color={
          project ? resolveProjectColorId(project.id, project.colorId) : "uncategorized"
        }
        key={candidate.key}
      >
        <div className="todayPickerCopy">
          <span className="todayPickerProject">
            <span aria-hidden="true" className="todayPickerDot" />
            {project?.name ?? "未分類"}
          </span>
          <strong className="todayPickerTask" title={candidate.text}>
            {candidate.text}
          </strong>
        </div>
        {selected ? (
          <span className="uiPill uiPill--good todayPickerSelectedStatus">✓ 選択済み</span>
        ) : (
          <button
            className="todayPickerAddButton"
            disabled={todayPickerSaving || todayPickerDraftItems.length >= TODAY_ITEM_LIMIT}
            onClick={() => void chooseTodayCandidate(candidate)}
            title={
              todayPickerDraftItems.length >= TODAY_ITEM_LIMIT
                ? "今日の3件は3件埋まっています"
                : undefined
            }
            type="button"
          >
            ＋ 今日へ
          </button>
        )}
      </div>
    );
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
  const searchActions = [
    { key: "mini", title: "ミニタイマーにする" },
    { key: "records", title: "記録を開く" },
    { key: "instructions", title: "手順書を開く" },
    { key: "settings", title: "設定を開く" },
    { key: "guide", title: "使い方を開く" },
    { key: "dictionary", title: "辞書を開く" },
  ];

  const openSearchPalette = () => {
    if (searchOpen) {
      const input = document.querySelector<HTMLInputElement>(".searchPaletteInput");
      input?.focus();
      input?.select();
      return;
    }
    const active = document.activeElement;
    searchOpenerRef.current = active instanceof HTMLElement ? active : null;
    setSearchQuery("");
    setSearchOpen(true);
    if (instructionChoices.length === 0 && !instructionChoicesLoading) {
      void refreshInstructionChoices();
    }
  };
  openSearchRef.current = openSearchPalette;

  const closeSearchPalette = () => {
    setSearchOpen(false);
    const opener = searchOpenerRef.current;
    searchOpenerRef.current = null;
    if (opener && document.contains(opener)) opener.focus();
  };

  const searchNextStepItem = (project: LauncherProject): SearchItem | null => {
    const step = project.nextStep;
    if (!step || !step.text.trim()) return null;
    return {
      id: `nextStep:${project.id}`,
      kind: "nextStep",
      title: step.text.trim(),
      subtitle: project.name,
      meta: step.trigger?.trim() || undefined,
    };
  };

  const buildSearchSections = (): SearchSection[] => {
    const query = searchQuery.trim();
    const sections: SearchSection[] = [];
    const push = (id: string, title: string, items: SearchItem[]) => {
      if (items.length === 0) return;
      sections.push({ id, title, items: items.slice(0, SEARCH_GROUP_LIMIT), total: items.length });
    };
    const linkedToday = new Set(
      config.today.items
        .filter((item) => !item.done)
        .map((item) => item.sourceKey?.trim())
        .filter((key): key is string => Boolean(key)),
    );

    if (!query) {
      const top = doNowSelection?.project;
      const topItem = top ? searchNextStepItem(top) : null;
      if (topItem) push("doNow", "今やる一手", [topItem]);
      push("today3", "今日の3件の次の一手", config.projects
        .filter((project) => linkedToday.has(`project:${project.id}`))
        .map(searchNextStepItem)
        .filter((item): item is SearchItem => item !== null));
      return sections;
    }

    push("nextStep", "次の一手", config.projects
      .filter((project) => {
        const step = project.nextStep;
        if (!step || !step.text.trim()) return false;
        return matchesSearchQuery([project.name, step.text, step.trigger ?? ""].join("\n"), query);
      })
      .map(searchNextStepItem)
      .filter((item): item is SearchItem => item !== null));

    push("wishlist", "やりたいこと", config.inbox
      .filter((item) => {
        const project = item.projectId
          ? config.projects.find((candidate) => candidate.id === item.projectId)
          : undefined;
        return matchesSearchQuery([item.text, project?.name ?? ""].join("\n"), query);
      })
      .map((item) => {
        const project = item.projectId
          ? config.projects.find((candidate) => candidate.id === item.projectId)
          : undefined;
        return {
          id: `wishlist:${item.id}`,
          kind: "wishlist" as const,
          title: item.text,
          subtitle: project?.name,
        };
      }));

    push("button", "ボタン", searchOverlayButtons(
      config.buttons,
      config.overlayPages ?? [],
      query,
      config.dictionaryOrder,
    ).map((button) => ({
      id: `button:${button.id}`,
      kind: "button" as const,
      title: button.label,
      subtitle: buttonGroupName(button),
    })));

    push("instruction", "手順書", instructionChoices
      .filter((choice) => matchesSearchQuery(choice.label, query))
      .map((choice) => ({
        id: `instruction:${choice.path}`,
        kind: "instruction" as const,
        title: choice.label.split(" / ").pop() ?? choice.label,
        subtitle: choice.label.split(" / ").slice(0, -1).join(" / "),
      })));

    push("action", "操作", searchActions
      .filter((action) => matchesSearchQuery(action.title, query))
      .map((action) => ({
        id: `action:${action.key}`,
        kind: "action" as const,
        title: action.title,
      })));

    return sections;
  };
  const searchSections = buildSearchSections();

  const runSearchItem = async (item: SearchItem, mode: "enter" | "shift") => {
    if (searchBusy) return;
    const missing = () => {
      setSearchBusy(false);
      showToast("warn", "見つかりません。一覧を作り直しました");
      return;
    };
    setSearchBusy(true);
    try {
    if (item.kind === "nextStep") {
      const projectId = item.id.replace("nextStep:", "");
      const project = configRef.current?.projects.find((candidate) => candidate.id === projectId);
      if (!project || !project.nextStep?.text.trim()) return missing();
      closeSearchPalette();
      startDoNowProject(project, mode === "shift" ? "normal" : "short");
      return;
    }
    if (item.kind === "wishlist") {
      const itemId = item.id.replace("wishlist:", "");
      const index = (configRef.current?.inbox ?? []).findIndex((entry) => entry.id === itemId);
      if (index < 0) return missing();
      closeSearchPalette();
      promoteInboxToNextStep(index);
      return;
    }
    if (item.kind === "button") {
      const buttonId = item.id.replace("button:", "");
      const button = (configRef.current?.buttons ?? []).find((entry) => entry.id === buttonId);
      if (!button) return missing();
      closeSearchPalette();
      void runActions(button.id, button.actions);
      return;
    }
    if (item.kind === "instruction") {
      const path = item.id.replace("instruction:", "");
      if (!instructionChoices.some((choice) => choice.path === path)) return missing();
      closeSearchPalette();
      await openInstructionWindow({ path, focus: true });
      return;
    }
    const key = item.id.replace("action:", "");
    closeSearchPalette();
    if (key === "mini") void toggleMiniMode();
    else if (key === "records") setActiveView("records");
    else if (key === "instructions") void openInstructionsManually();
    else if (key === "settings") openSettingsCenter();
    else if (key === "guide") setHelpGuideOpen(true);
    else if (key === "dictionary") void openDictionaryManually();
    } finally {
      setSearchBusy(false);
    }
  };
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
      <header
        className="topBar"
        data-tauri-drag-region=""
        data-top-menu-labels={topMenuLabelLevel}
        ref={topMenuBarRef}
      >
        <div
          className="topBrand"
          data-tauri-drag-region=""
          onContextMenu={(event) => {
            event.preventDefault();
            openContextMenu(
              { kind: "sidebar" },
              event.clientX,
              event.clientY,
              event.currentTarget,
            );
          }}
        >
          <span className="topBrandIcon" aria-hidden="true" data-tauri-drag-region="">
            <img alt="" draggable={false} src="/life-launcher-icon.svg" />
          </span>
          <span className="topBrandName" data-tauri-drag-region="">
            Life Launcher
          </span>
          {testProfile?.testProfile && (
            <span className="uiPill testProfileBadge" title="テスト用の起動（普段のデータとは別）">
              テスト
            </span>
          )}
          {shortcutRegistration && (
            <ShortcutBadge
              label="Life Launcherを表示/隠す"
              shortcut={config?.settings.focusHotkey}
              registered={shortcutRegistration.main}
            />
          )}
        </div>
        <button
          aria-keyshortcuts="Control+F"
          aria-label="一手・ボタン・手順書を検索(Ctrl+F)"
          className="topSearchButton"
          data-top-search=""
          onClick={() => openSearchPalette()}
          title="一手・ボタン・手順書を検索(Ctrl+F)"
          type="button"
        >
          <UiIcon name="search" size={18} />
          <span className="topSearchLabel">検索</span>
          <ShortcutBadge label="検索" registered shortcut="Ctrl+F" tone="muted" />
        </button>

        <div className="topPills" data-tauri-drag-region="" ref={topMenuPillsRef}>
          <div
            aria-label={TOP_MENU_GROUP_LABELS.autoStart}
            className="topPillGroup topPillGroup--autostart"
            role="group"
          >
            <button
              aria-label="Windows自動起動"
              aria-pressed={config.settings.autoStart === true}
              className={
                config.settings.autoStart
                  ? "viewToggleButton viewToggleButton--autoStart viewToggleButton--active"
                  : "viewToggleButton viewToggleButton--autoStart"
              }
              onClick={() => void toggleAutoStart()}
              title={config.settings.autoStart ? "Windows自動起動: ON" : "Windows自動起動: OFF"}
              type="button"
            >
              <UiIcon name="power" size={18} />
              {config.settings.autoStart && (
                <span aria-hidden="true" className="autoStartDot" />
              )}
            </button>
          </div>
          <span aria-hidden="true" className="topPillsDivider" />
          <div
            aria-label={TOP_MENU_GROUP_LABELS.work}
            className="topPillGroup topPillGroup--work"
            role="group"
          >
            <button
              className="viewToggleButton"
              data-view-toggle=""
              onClick={() => setActiveView((view) => (view === "records" ? "main" : "records"))}
              title={activeView === "records" ? "メイン画面に戻る" : "記録ビューを開く"}
              aria-label={activeView === "records" ? "メイン画面に戻る" : "記録ビューを開く"}
              type="button"
            >
              <UiIcon name={activeView === "records" ? "back" : "records"} size={18} />
              <span className="viewToggleButtonLabel">
                {activeView === "records" ? TOP_MENU_LABELS.dashboard : TOP_MENU_LABELS.records}
              </span>
            </button>
            <button
              aria-label="手順書を開く"
              className="viewToggleButton"
              data-menu-label-secondary=""
              onClick={() => void openInstructionsManually()}
              title="手順書を開く"
              type="button"
            >
              <UiIcon name="book" size={18} />
              <span className="viewToggleButtonLabel">
                {TOP_MENU_LABELS.instructions}
              </span>
            </button>
            <button
              className="viewToggleButton"
              data-menu-label-secondary=""
              onClick={openSettingsCenter}
              title="設定を開く"
              aria-label="設定を開く"
              type="button"
            >
              <UiIcon name="settings" size={18} />
              <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.settings}</span>
            </button>
          </div>
        </div>
      </header>
      <WindowControls closeShortcutDisabled={closeShortcutDisabled} />

      <div className="appBody">
      <aside
        className="sidebar"
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu(
            { kind: "sidebar" },
            event.clientX,
            event.clientY,
            event.currentTarget,
          );
        }}
        onKeyDown={(event) => openContextMenuFromKeyboard(event, { kind: "sidebar" })}
        tabIndex={-1}
      >
        <button
          className="launcherOpenButton"
          onClick={() => void openDictionaryManually()}
          type="button"
        >
          <span className="launcherOpenButtonLabel">
            <span aria-hidden="true" className="launcherOpenButtonIcon">
              <UiIcon name="search" size={16} />
            </span>
            <span>辞書を開く</span>
          </span>
          {shortcutRegistration && (
            <ShortcutBadge
              label="辞書"
              shortcut={config?.settings.launcherHotkey}
              registered={shortcutRegistration.launcher}
            />
          )}
        </button>

        <div className="quickList app-scrollbar" aria-label="クイック起動">
          {visibleSidebarButtonGroups.length === 0 ? (
            <p className="quietText quietText--small">
              サイドバー表示の項目がありません。アプリ、ショートカット、URLをドラッグして追加できます。
            </p>
          ) : (
            visibleSidebarButtonGroups.map((group) => {
              const collapsed = collapsedGroups[group.name] ?? false;
              // P10-02: while a sidebar drag is in flight the open/close is instant (D33).
              const sidebarDragActive =
                sidebarPointerDrag !== null || sidebarGroupPointerDrag !== null;
              return (
                <section
                  className={[
                    "quickGroup",
                    sidebarGroupPointerDrag?.group === group.name ? "quickGroup--dragging" : "",
                    sidebarGroupPointerDrag?.targetGroupName === group.name
                      ? sidebarGroupPointerDrag.placement === "after"
                        ? "quickGroup--drop-after"
                        : "quickGroup--drop-before"
                      : "",
                    sidebarPointerDrag?.targetGroupName === group.name &&
                    !sidebarPointerDrag.targetButtonId
                      ? "quickGroup--item-drop-target"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-sidebar-group-section={group.name}
                  key={group.name}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openContextMenu(
                      { kind: "sidebar", groupName: group.name },
                      event.clientX,
                      event.clientY,
                      event.currentTarget.querySelector<HTMLElement>(".quickGroupHeader"),
                    );
                  }}
                >
                  <button
                    aria-expanded={!collapsed}
                    className="quickGroupHeader"
                    data-sidebar-group-name={group.name}
                    onClick={(event) => {
                      if (event.detail === 0) toggleGroupCollapsed(group.name);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(
                        { kind: "sidebar", groupName: group.name },
                        event.clientX,
                        event.clientY,
                        event.currentTarget,
                      );
                    }}
                    onKeyDown={(event) =>
                      openContextMenuFromKeyboard(event, {
                        kind: "sidebar",
                        groupName: group.name,
                      })
                    }
                    onPointerCancel={cancelSidebarGroupPointerDrag}
                    onPointerDown={(event) => startSidebarGroupPointerDrag(event, group.name)}
                    onPointerMove={updateSidebarGroupPointerDrag}
                    onPointerUp={(event) => finishSidebarGroupPointerDrag(event, group.name)}
                    title={group.name}
                    type="button"
                  >
                    <UiIcon name={collapsed ? "chevronRight" : "chevronDown"} size={16} />
                    <strong>{group.name}</strong>
                    <small>{group.buttons.length}</small>
                  </button>
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        animate={{
                          height: "auto",
                          opacity: 1,
                          transitionEnd: { overflow: "visible" },
                        }}
                        className="quickGroupItems"
                        data-sidebar-group-name={group.name}
                        exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                        initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                        key="items"
                        transition={sidebarDragActive ? { duration: 0 } : springCollapse}
                      >
                        {group.buttons.length === 0 && (
                          <p className="quickGroupEmpty">見出しを右クリックしてボタンを追加</p>
                        )}
                        {group.buttons.map((button, buttonIndex) => (
                          <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className={
                              sidebarPointerDrag?.id === button.id
                                ? "quickButtonDrag quickButtonDrag--dragging"
                                : "quickButtonDrag"
                            }
                            data-sidebar-button-id={button.id}
                            data-sidebar-group-name={group.name}
                            exit={sidebarDragActive ? { opacity: 1 } : { opacity: 0 }}
                            initial={sidebarDragActive ? false : { opacity: 0, y: -4 }}
                            key={button.id}
                            transition={
                              sidebarDragActive
                                ? { duration: 0 }
                                : {
                                    delay: Math.min(buttonIndex * staggerStep, staggerMax),
                                    duration: 0.12,
                                  }
                            }
                          >
                          <button
                            className="quickButton"
                            onClick={(event) => {
                              if (event.detail === 0) void runActions(button.id, button.actions);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openContextMenu(
                                { kind: "button", button },
                                event.clientX,
                                event.clientY,
                                event.currentTarget,
                              );
                            }}
                            onKeyDown={(event) =>
                              openContextMenuFromKeyboard(event, { kind: "button", button })
                            }
                            onPointerCancel={cancelSidebarPointerDrag}
                            onPointerDown={(event) =>
                              startSidebarPointerDrag(event, { id: button.id, group: group.name })
                            }
                            onPointerMove={updateSidebarPointerDrag}
                            onPointerUp={(event) => finishSidebarPointerDrag(event, button)}
                            title={button.label}
                            type="button"
                          >
                            {pendingActionId === button.id ? (
                              <span className="quickIcon">
                                <span className="spinner spinner--small" />
                              </span>
                            ) : (
                              renderSidebarButtonIcon(button)
                            )}
                            <span>{button.label}</span>
                          </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })
          )}
        </div>

        {sidebarPointerDrag?.targetIndicator ? (
          <div
            aria-hidden="true"
            className="sidebarDropIndicator"
            style={{
              left: sidebarPointerDrag.targetIndicator.left,
              top: sidebarPointerDrag.targetIndicator.top,
              width: sidebarPointerDrag.targetIndicator.width,
            }}
          />
        ) : null}

        {sidebarPointerDrag
          ? (() => {
              const button = config.buttons.find((item) => item.id === sidebarPointerDrag.id);
              return button ? (
                <div
                  aria-hidden="true"
                  className="sidebarDragGhost"
                  style={{
                    height: sidebarPointerDrag.height,
                    left: sidebarPointerDrag.pointerX - sidebarPointerDrag.offsetX,
                    top: sidebarPointerDrag.pointerY - sidebarPointerDrag.offsetY,
                    width: sidebarPointerDrag.width,
                  }}
                >
                  {renderSidebarButtonIcon(button)}
                  <span>{button.label}</span>
                </div>
              ) : null;
            })()
          : null}
        {sidebarGroupPointerDrag ? (
          <div
            aria-hidden="true"
            className="sidebarGroupDragGhost"
            style={{
              height: sidebarGroupPointerDrag.height,
              left: sidebarGroupPointerDrag.pointerX - sidebarGroupPointerDrag.offsetX,
              top: sidebarGroupPointerDrag.pointerY - sidebarGroupPointerDrag.offsetY,
              width: sidebarGroupPointerDrag.width,
            }}
          >
            <UiIcon name="chevronDown" size={16} />
            <strong>{sidebarGroupPointerDrag.group}</strong>
          </div>
        ) : null}
        <TimerPanel
          active={Boolean(activeTimer)}
          expandButtonRef={expandTimerButtonRef}
          clock={
            activeTimer
              ? timerClock
              : String(
                  Number.parseInt(defaultTimerDraft, 10) || config.settings.defaultTimerMinutes,
                ) + "分"
          }
          clockAdjustable={!activeTimer}
          clockDragging={numberInputDragging === "timer"}
          identity={
            activeTimerProject ? (
              <ProjectIdentity
                colorId={activeTimerProject.colorId}
                compact
                name={activeTimerProject.name}
                projectId={activeTimerProject.id}
              />
            ) : undefined
          }
          actionText={activeTimer ? timerActionText(activeTimer) : undefined}
          label={activeTimer ? activeTimer.label : "通常タイマー"}
          onFinish={() => {
            if (activeTimer) finishActiveTimer(activeTimer);
          }}
          onExpand={() => setExpandedTimerOpen(true)}
          onClockPointerCancel={!activeTimer ? cancelNumberInputDrag : undefined}
          onClockPointerDown={
            !activeTimer
              ? (event) => startNumberInputDrag(event, "timer", config.settings.defaultTimerMinutes)
              : undefined
          }
          onClockPointerMove={!activeTimer ? updateNumberInputDrag : undefined}
          onClockPointerUp={!activeTimer ? finishNumberInputDrag : undefined}
          onPause={togglePause}
          paused={Boolean(activeTimer?.paused)}
          progressPercent={timerProgressPercent}
          state={
            completionPrompt
              ? "complete"
              : activeTimer?.paused
                ? "paused"
                : activeTimer
                  ? "running"
                  : "waiting"
          }
          status={timerStatus}
          variant="sidebar"
          onMini={() => void toggleMiniMode()}
          miniDisabled={!config.settings.miniMode || miniTransitioning}
          waitingContent={
            <div className="timerPresetControls" aria-label="通常タイマーの分数">
              <div className="timerPresetRow">
                <button
                  className="timerPresetButton"
                  onClick={() =>
                    void saveDefaultTimerMinutes(config.settings.defaultTimerMinutes - 5)
                  }
                  type="button"
                >
                  -
                </button>
                <label
                  className={
                    numberInputDragging === "timer"
                      ? "timerPresetInputWrap timerPresetInputWrap--dragging"
                      : "timerPresetInputWrap"
                  }
                  onPointerCancel={cancelNumberInputDrag}
                  onPointerDown={(event) =>
                    startNumberInputDrag(event, "timer", config.settings.defaultTimerMinutes)
                  }
                  onPointerMove={updateNumberInputDrag}
                  onPointerUp={finishNumberInputDrag}
                  title="上下にドラッグして分数を調整"
                >
                  <input autoComplete="off"
                    aria-label="通常タイマーの分数"
                    inputMode="numeric"
                    max={240}
                    min={1}
                    onBlur={() => void saveDefaultTimerMinutes(defaultTimerDraft)}
                    onChange={(event) => setDefaultTimerDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    type="number"
                    value={defaultTimerDraft}
                  />
                  <span>分</span>
                  <span aria-hidden="true" className="numberDragAffordance" />
                </label>
                <button
                  className="timerPresetButton"
                  onClick={() =>
                    void saveDefaultTimerMinutes(config.settings.defaultTimerMinutes + 5)
                  }
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          }
        />
      </aside>

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
                <div className="mainHeaderRow">
                  <div className="mainHeaderDate">
                    <span className="mainDateText">{headerDateMain}</span>
                    <span className="mainDateWeekday">{headerDateWeekday}</span>
                  </div>
                <div className="victoryBarWrap">
                <section
                  className={[
                    "victoryBar",
                    victoryDone ? "victoryBar--done" : "",
                    victoryText ? "" : "victoryBar--empty",
                    completionFeedback?.kind === "victory" ? "victoryBar--reward" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label="今日の勝利条件"
                >
                  {completionFeedback?.kind === "victory" && (
                    <span aria-hidden="true" className="victoryRewardSweep" />
                  )}
                  <span className="victoryIcon" aria-hidden="true">
                    <UiIcon name="flag" size={16} />
                  </span>
                  <span className="victoryLabel">今日の勝利条件</span>
                  <div className="victoryContent">
                    {victoryEditing ? (
                      <>
                        <input autoComplete="off"
                          aria-label="今日の勝利条件"
                          className={
                            victoryDone ? "victoryInput victoryInput--done" : "victoryInput"
                          }
                          maxLength={90}
                          onBlur={(event) => {
                            const next = event.relatedTarget;
                            if (next instanceof Node && victorySuggestionsRef.current?.contains(next)) {
                              return;
                            }
                            setVictoryEditing(false);
                          }}
                          onChange={(event) => {
                            victorySaveRef.current = updateVictoryText(event.target.value);
                          }}
                          onKeyDown={handleVictoryKeyDown}
                          placeholder="今日はこれができれば勝ち"
                          ref={victoryInputRef}
                          value={config.today.victory.text}
                        />
                      </>
                    ) : (
                      <button
                        aria-label="今日の勝利条件を編集"
                        className={
                          victoryDone
                            ? "victoryTextButton victoryTextButton--done"
                            : victoryText
                              ? "victoryTextButton"
                              : "victoryTextButton victoryTextButton--empty"
                        }
                        onBlur={clearVictoryAutoFocus}
                        onClick={enterVictoryEditing}
                        onKeyDown={clearVictoryAutoFocus}
                        ref={victoryNavigationRef}
                        type="button"
                      >
                        {config.today.victory.text || "今日はこれができれば勝ち"}
                      </button>
                    )}
                  </div>
                  {victoryDone ? (
                    <span
                      className={
                        completionFeedback?.kind === "victory"
                          ? "victoryBadge victoryBadge--reward"
                          : "victoryBadge"
                      }
                      role={completionFeedback?.kind === "victory" ? "status" : undefined}
                    >
                      ✓ 今日の勝利、達成
                    </span>
                  ) : null}
                  <input
                    aria-label="勝利条件を達成"
                    checked={victoryDone}
                    className="check victoryCheck"
                    disabled={!victoryText}
                    onChange={toggleVictoryDone}
                    type="checkbox"
                  />
                </section>
                {victoryEditing && !victoryText && victorySuggestions.length > 0 && (
                  <div
                    className="victorySuggestions"
                    aria-label="勝利条件の候補"
                    ref={victorySuggestionsRef}
                  >
                    {victorySuggestions.map((suggestion) => (
                      <button
                        className="suggestionChip"
                        key={suggestion}
                        onBlur={(event) => {
                          const next = event.relatedTarget;
                          if (
                            next instanceof Node &&
                            (next === victoryInputRef.current ||
                              victorySuggestionsRef.current?.contains(next))
                          ) {
                            return;
                          }
                          setVictoryEditing(false);
                        }}
                        onClick={() => applyVictorySuggestion(suggestion)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            leaveVictoryEditing();
                          }
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                </div>
                </div>

                <section
                  className="doNowBand"
                  aria-labelledby="do-now-title"
                  data-skip-target="main"
                  tabIndex={-1}
                >
                  {doNowCompletionHold ? (
                    <div
                      className="doNowContent doNowContent--hold"
                      data-project-color={resolveProjectColorId(
                        doNowCompletionHold.projectId,
                        doNowCompletionHold.colorId,
                      )}
                    >
                      <div className="doNowCopy">
                        <div className="doNowKicker">
                          <h2 id="do-now-title">今やる一手</h2>
                          <span className="uiPill doNowProjectChip">
                            <ProjectIdentity
                              colorId={doNowCompletionHold.colorId}
                              compact
                              name={doNowCompletionHold.projectName}
                              projectId={doNowCompletionHold.projectId}
                            />
                          </span>
                        </div>
                        <strong className="doNowHoldTitle" role="status">✓ 一手進みました</strong>
                        <span className="doNowHoldTask">{doNowCompletionHold.taskText}</span>
                        {doNowCompletionHold.minutes > 0 && (
                          <span className="doNowHoldMinutes">実行 {doNowCompletionHold.minutes}分</span>
                        )}
                      </div>
                                            <div className="doNowFooter">
                        <button
                          className="mainActionButton mainActionButton--neutral doNowHoldButton"
                          disabled={doNowCompletionSaving}
                          onClick={() => void acknowledgeDoNowCompletion()}
                          type="button"
                        >
                          次の一手を見る
                          <UiIcon name="chevronRight" size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : doNowSelection ? (
                    <div
                      className="doNowContent doNowContent--active"
                      data-project-color={resolveProjectColorId(
                        doNowSelection.project.id,
                        doNowSelection.project.colorId,
                      )}
                      onContextMenu={(event) => {
                        if (doNowCandidates.length <= 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(
                          { kind: "doNow" },
                          event.clientX,
                          event.clientY,
                          event.currentTarget,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (doNowCandidates.length > 1) {
                          openContextMenuFromKeyboard(event, { kind: "doNow" });
                        }
                      }}
                      tabIndex={doNowCandidates.length > 1 ? 0 : undefined}
                    >
                      <motion.div
                        animate={{ opacity: 1, x: 0 }}
                        className="doNowCopy"
                        initial={doNowCopyShouldAnimate ? { opacity: 0, x: 12 } : false}
                        key={doNowCopyKey ?? undefined}
                        transition={springSnappy}
                      >
                        <div className="doNowKicker">
                          <span aria-hidden="true" className="doNowStatusDot" />
                          <h2 id="do-now-title">今やる一手</h2>
                          <span className="uiPill doNowProjectChip">
                            <ProjectIdentity
                              colorId={doNowSelection.project.colorId}
                              compact
                              name={doNowSelection.project.name}
                              projectId={doNowSelection.project.id}
                            />
                          </span>
                          {isDoNowRunning && activeTimer && (
                            <span
                              className={
                                activeTimer.paused
                                  ? "uiPill uiPill--paused runningBadge runningBadge--paused"
                                  : "uiPill uiPill--running runningBadge runningBadge--running"
                              }
                            >
                              {activeTimer.paused
                                ? "一時停止"
                                : activeTimer.mode === "measure"
                                  ? "計測中"
                                  : "実行中"}
                            </span>
                          )}
                          <span className="doNowReason">{doNowReason}</span>
                        </div>
                        <strong title={doNowSelection.project.nextStep?.text}>
                          {doNowSelection.project.nextStep?.text}
                        </strong>
                        {(() => {
                          const resumeNote = doNowSelection.project.nextStep?.resumeNote?.trim();
                          return resumeNote ? (
                            <p className="doNowResume" title={resumeNote}>
                              <span className="doNowResumeLabel">次はここから</span>
                              <span className="doNowResumeText">{resumeNote}</span>
                            </p>
                          ) : null;
                        })()}
                        {(() => {
                          const openButtons = (doNowSelection.project.nextStep?.buttonIds ?? [])
                            .map((id) => buttonsById.get(id))
                            .filter((button): button is LauncherButton => Boolean(button));
                          const trigger = doNowSelection.project.nextStep?.trigger?.trim();
                          const instructionName = doNowInstructionPath
                            ?.split(/[\\/]/)
                            .filter(Boolean)
                            .pop();
                          const instructionMissing = missingInstructionProjectIds.has(
                            doNowSelection.project.id,
                          );
                          if (!openButtons.length && !doNowInstructionPath && !trigger) return null;
                          return (
                            <div className="doNowMeta">
                              {trigger ? (
                                <span className="doNowMetaItem doNowTrigger" title={trigger}>
                                  <UiIcon name="clock" size={16} />
                                  {trigger}
                                </span>
                              ) : null}
                              {trigger && (openButtons.length || doNowInstructionPath) ? (
                                <span aria-hidden="true" className="doNowDivider" />
                              ) : null}
                              {openButtons.length || doNowInstructionPath ? (
                                <span className="doNowMetaLabel">始めると一緒に開く</span>
                              ) : null}
                              {openButtons.map((button) => {
                                const missing = missingButtonIds.has(button.id);
                                return (
                                  <span
                                    className={
                                      missing
                                        ? "doNowOpenChip doNowOpenChip--missing"
                                        : "doNowOpenChip"
                                    }
                                    key={button.id}
                                    title={
                                      missing
                                        ? "見つかりません。次の一手の編集で選び直してください"
                                        : undefined
                                    }
                                  >
                                    <UiIcon name={missing ? "alert" : "external"} size={12} />
                                    {button.label}
                                    {missing && (
                                      <span className="doNowMissingText">見つかりません</span>
                                    )}
                                  </span>
                                );
                              })}
                              {doNowInstructionPath ? (
                                <button
                                  className={
                                    instructionMissing
                                      ? "doNowOpenChip doNowOpenChip--button doNowOpenChip--missing"
                                      : "doNowOpenChip doNowOpenChip--button"
                                  }
                                  onClick={() => {
                                    void openInstructionWindow({
                                      path: doNowInstructionPath,
                                      focus: true,
                                    }).catch((error) => {
                                      showToast(
                                        "error",
                                        `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
                                      );
                                    });
                                  }}
                                  aria-label={
                                    doNowBookPage !== null && !instructionMissing
                                      ? `${instructionName || "手順書"}、${doNowBookPage}ページから`
                                      : undefined
                                  }
                                  title={
                                    instructionMissing
                                      ? "見つかりません。次の一手の編集で選び直してください"
                                      : undefined
                                  }
                                  type="button"
                                >
                                  <UiIcon name={instructionMissing ? "alert" : "book"} size={12} />
                                  {instructionName || "手順書"}
                                  {doNowBookPage !== null && !instructionMissing ? (
                                    <span className="doNowOpenChipPage">p.{doNowBookPage}</span>
                                  ) : null}
                                  {instructionMissing && (
                                    <span className="doNowMissingText">見つかりません</span>
                                  )}
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </motion.div>
                      <div className="doNowFooter">
                        <div className="doNowActions">
                          {isDoNowRunning && activeTimer ? (
                            <>
                              {activeTimer.mode === "measure" && (
                                <span className="measureElapsedClock">{timerClock}</span>
                              )}
                              <button
                                aria-label={
                                  activeTimer.paused
                                    ? "このセッションを再開"
                                    : "このセッションを一時停止"
                                }
                                className="runningPauseButton"
                                onClick={togglePause}
                                type="button"
                              >
                                <UiIcon name={activeTimer.paused ? "play" : "pause"} size={16} />
                                {activeTimer.paused ? "再開" : "一時停止"}
                              </button>
                              <button
                                className="runningStopButton"
                                onClick={() => finishActiveTimer(activeTimer)}
                                type="button"
                              >
                                <UiIcon name="stop" size={16} /> 終了
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={`短時間タイマー${doNowShortTimerMinutes}分で始める`}
                                className="doNowStartPrimary"
                                onClick={() => startDoNowProject(doNowSelection.project, "short")}
                                type="button"
                              >
                                <span className="timerStartDuration">
                                  {doNowShortTimerMinutes}分で始める
                                </span>
                                <span aria-hidden="true" className="timerStartHoverGlyph">
                                  <UiIcon name="play" size={16} />
                                </span>
                              </button>
                              <button
                                aria-label={`通常タイマー${doNowDefaultTimerMinutes}分で開始`}
                                className="doNowStartSecondary"
                                onClick={() => startDoNowProject(doNowSelection.project, "normal")}
                                type="button"
                              >
                                <span className="timerStartDuration">
                                  通常 {doNowDefaultTimerMinutes}分
                                </span>
                                <span aria-hidden="true" className="timerStartHoverGlyph">
                                  <UiIcon name="play" size={16} />
                                </span>
                              </button>
                              <button
                                aria-label="時間を決めずに計測"
                                className="doNowMeasureButton"
                                onClick={() => startDoNowProject(doNowSelection.project, "measure")}
                                title="時間を決めずに計測"
                                type="button"
                              >
                                <UiIcon name="clock" size={16} />
                                <span>計測</span>
                              </button>
                            </>
                          )}
                        </div>
                        <div className="doNowSecondaryActions">
                          {doNowCandidates.length > 1 && (
                            <button
                              className="uiSmallButton doNowAlternateButton"
                              onClick={showNextDoNowCandidate}
                              type="button"
                            >
                              <UiIcon name="refresh" size={16} />
                              他の一手
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="doNowHeading">
                        <h2 id="do-now-title">今やる一手</h2>
                      </div>
                      <div className="doNowEmpty">
                        <div className="doNowEmptyContent">
                          <strong>
                            {doNowOnlyExcluded
                              ? "今は他に提案できる一手がありません。"
                              : nextStepSetupProject
                              ? "次の一手を設定すると、ここに提案されます。"
                              : "プロジェクトを作り、次の一手を設定すると提案されます。"}
                          </strong>
                          <span>
                            {doNowOnlyExcluded
                              ? "取り組んだ一手は、もう一度候補を見ると表示できます。"
                              : "迷ったときに、今の状況から始めやすい「次にやること」を1つだけ提示します。"}
                          </span>
                          <button
                            className={doNowOnlyExcluded
                              ? "mainActionButton mainActionButton--neutral"
                              : "mainActionButton mainActionButton--gold"}
                            onClick={() => {
                              if (doNowOnlyExcluded) {
                                setDoNowExcludedProjectId(null);
                                setDoNowPickedProjectId(null);
                              } else if (nextStepSetupProject) {
                                openNextStepEditor(nextStepSetupProject);
                              } else {
                                openProjectAddDialog();
                              }
                            }}
                            type="button"
                          >
                            <UiIcon name={doNowOnlyExcluded ? "refresh" : "add"} size={16} />
                            {doNowOnlyExcluded
                              ? "候補をもう一度見る"
                              : nextStepSetupProject ? "次の一手を設定" : "プロジェクトを追加"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <section className="focusBand">
                  <div
                    className="todaySectionBar"
                    onClick={(event) =>
                      toggleDisclosureFromBar(event, () => setTodayOpen((open) => !open))
                    }
                  >
                    <button
                      aria-expanded={todayOpen}
                      className="todaySectionDisclosure"
                      onClick={() => setTodayOpen((open) => !open)}
                      type="button"
                    >
                      <UiIcon name={todayOpen ? "chevronDown" : "chevronRight"} size={16} />
                      <h2>今日の3件</h2>
                    </button>
                    {config.today.items.length === 0 ? (
                      <span className="todaySectionCount">0件</span>
                    ) : (
                      <span
                        className={
                          todayAllCompleted
                            ? "todayCompletionSummary todayCompletionSummary--complete"
                            : "todayCompletionSummary"
                        }
                      >
                        {todayCompletedCount} / {config.today.items.length} 完了
                      </span>
                    )}
                    <span className="todaySectionDescription">
                      今日やると決めたもの。タイマーから開始します。
                    </span>
                  </div>
                  <SectionCollapse open={todayOpen} dragActive={dragActive}>
                    <>
                      <div className="todayGridRegion">
                        <div
                          className={[
                            "todayGrid",
                            config.today.items.length === 0 ? "todayGrid--empty" : "",
                            completionFeedback?.kind === "todayAll"
                              ? "todayGrid--allCompleteReward"
                              : "",
                            projectPointerDrag?.todayGuidanceActive ||
                            inboxPointerDrag?.todayGuidanceActive
                              ? "todayGrid--dropGuidance"
                              : "",
                            projectPointerDrag?.todayTargetIndicator ||
                            inboxPointerDrag?.todayTargetIndicator
                              ? "todayGrid--dropTarget"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {(projectPointerDrag?.todayGuidanceActive ||
                            inboxPointerDrag?.todayGuidanceActive) && (
                            <div aria-hidden="true" className="todayDropGuidanceOverlay">
                              <span className="dropHintLabel">↓ ここにドロップして「今日の3件」に追加</span>
                            </div>
                          )}
                          {config.today.items.length === 0 && (
                            <div className="todayEmptyState">
                              <div className="todayEmptyStateContent">
                                <strong>今日やるものを選びましょう</strong>
                                <span>次の一手・やりたいことから選べます</span>
                                <button
                                  className="mainActionButton mainActionButton--gold"
                                  onClick={(event) => openTodayPicker(event.currentTarget)}
                                  type="button"
                                >
                                  <UiIcon name="add" size={16} />
                                  今日やるものを選ぶ
                                </button>
                              </div>
                            </div>
                          )}
                          {config.today.items.map((item, index) => {
                            const timerSourceId = todayTimerSourceId(item, index);
                            const isRunningTodayItem = activeTimer !== null && isTimerOnTodayItem(item, index);
                            const project = item.projectId
                              ? projectsById.get(item.projectId)
                              : undefined;
                            const todayInstructionPath =
                              item.instructionPath?.trim() ||
                              project?.nextStep?.instructionPath?.trim();
                            const hasLinkedSource =
                              (item.sourceKey?.startsWith("project:") &&
                                Boolean(project?.nextStep)) ||
                              (item.sourceKey?.startsWith("wishlist:") &&
                                config.inbox.some(
                                  (source, sourceIndex) =>
                                    wishlistSourceKey(source, sourceIndex) === item.sourceKey,
                                ));
                            const shortMinutes =
                              hasLinkedSource && project?.nextStep?.shortTimerMinutes == null
                                ? config.settings.shortTimerMinutes
                                : (item.shortTimerMinutes ??
                                  project?.nextStep?.shortTimerMinutes ??
                                  config.settings.shortTimerMinutes);
                            const defaultMinutes =
                              hasLinkedSource && project?.nextStep?.defaultTimerMinutes == null
                                ? config.settings.defaultTimerMinutes
                                : (item.defaultTimerMinutes ??
                                  project?.nextStep?.defaultTimerMinutes ??
                                  config.settings.defaultTimerMinutes);
                            // P10-04's rule, used again here: the unfinished card adopted from
                            // the current Next Step of the Project shown in "Do Now".
                            const hereNowProject = doNowSelection?.project;
                            const isHereNowTodayItem =
                              !item.done &&
                              Boolean(hereNowProject) &&
                              item.sourceKey?.trim() === `project:${hereNowProject.id}` &&
                              item.sourceGenerationId === hereNowProject.nextStep?.generationId;
                            return (
                              <article
                                className={[
                                  "todayRow",
                                  todayPointerDrag?.index === index ? "todayRow--dragging" : "",
                                  isRunningTodayItem ? "todayRow--running" : "",
                                  item.done ? "todayRow--complete" : "",
                                  completionFeedback?.kind === "today" &&
                                  completionFeedback.sourceKey === todaySourceKey(item, index)
                                    ? "todayRow--justCompleted"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-today-index={index}
                                data-project-color={
                                  project
                                    ? resolveProjectColorId(project.id, project.colorId)
                                    : undefined
                                }
                                key={todaySourceKey(item, index)}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openContextMenu(
                                    { kind: "today", index, itemText: item.text },
                                    event.clientX,
                                    event.clientY,
                                    event.currentTarget,
                                  );
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    handleRowShortcutKey(event, {
                                      activate: () =>
                                        startTodayItemShort(
                                          item,
                                          index,
                                          timerSourceId,
                                          shortMinutes,
                                        ),
                                      edit: () => editTodayRowItem(index),
                                      remove: () =>
                                        void removeTodayItem(todaySourceKey(item, index)),
                                    })
                                  )
                                    return;
                                  openContextMenuFromKeyboard(event, {
                                    kind: "today",
                                    index,
                                    itemText: item.text,
                                  });
                                }}
                                onPointerCancel={cancelTodayPointerDrag}
                                onPointerDown={(event) => startTodayPointerDrag(event, index)}
                                onPointerMove={updateTodayPointerDrag}
                                onPointerUp={finishTodayPointerDrag}
                                tabIndex={0}
                              >
                                <div className="todayRowTopActions">
                                  {isHereNowTodayItem && (
                                    <span
                                      aria-label="今やる一手"
                                      className="uiPill uiPill--project todayHereBadge"
                                      data-project-color={
                                        project
                                          ? resolveProjectColorId(project.id, project.colorId)
                                          : undefined
                                      }
                                      role="status"
                                    >
                                      今やる一手
                                    </span>
                                  )}
                                  <span aria-hidden="true" className="uiKey rowKeyHint">
                                    Enter
                                  </span>
                                  <button
                                    aria-label={`${item.text || "未入力"}の操作`}
                                    aria-haspopup="menu"
                                    className="sourceRowMenu todayRowMenu"
                                    onClick={(event) => {
                                      const rect = event.currentTarget.getBoundingClientRect();
                                      openContextMenu(
                                        { kind: "today", index, itemText: item.text },
                                        rect.left,
                                        rect.bottom,
                                        event.currentTarget,
                                      );
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    title="操作メニュー"
                                    type="button"
                                  >
                                    <span aria-hidden="true">…</span>
                                  </button>
                                </div>
                                <span
                                  aria-label={item.done ? "今日の分は完了" : "未完了"}
                                  className={
                                    item.done
                                      ? "todayCompletionStatus todayCompletionStatus--complete"
                                      : "todayCompletionStatus"
                                  }
                                  role="status"
                                >
                                  {item.done ? "✓" : "○"}
                                </span>
                                <div
                                  className={
                                    project
                                      ? "todayItemCopy"
                                      : "todayItemCopy todayItemCopy--withoutIdentity"
                                  }
                                >
                                  <div className="todayItemMeta">
                                    {item.projectId && projectsById.has(item.projectId) && (
                                      <span className="todayProjectIdentity">
                                        <ProjectIdentity
                                          colorId={projectsById.get(item.projectId)?.colorId}
                                          compact
                                          name={projectsById.get(item.projectId)?.name ?? ""}
                                          projectId={item.projectId}
                                        />
                                      </span>
                                    )}
                                    {/* P10-05 (§4.3): the card linked to this moment's step. */}
                                    {isRunningTodayItem && (
                                      <span
                                        className={
                                          activeTimer.paused
                                            ? "uiPill uiPill--paused runningBadge runningBadge--paused"
                                            : "uiPill uiPill--running runningBadge runningBadge--running"
                                        }
                                      >
                                        {activeTimer.paused
                                          ? "一時停止"
                                          : activeTimer.mode === "measure"
                                            ? "計測中"
                                            : "実行中"}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={
                                      item.done
                                        ? "todayTextButton todayTextButton--done"
                                        : "todayTextButton"
                                    }
                                    title={item.text || "未入力"}
                                  >
                                    {item.text || "未入力"}
                                  </span>
                                </div>
                                <div className="todayCardFooter">
                                  <div className="todayCardSecondaryActions">
                                    {todayInstructionPath && (
                                      <button
                                        aria-label={`${item.text || "未入力"}の手順書を開く`}
                                        className="doNowInstructionButton todayInstructionButton mainActionButton mainActionButton--neutral"
                                        onClick={() => {
                                          void openInstructionWindow({
                                            path: todayInstructionPath,
                                            focus: true,
                                          }).catch((error) => {
                                            showToast(
                                              "error",
                                              `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
                                            );
                                          });
                                        }}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        title="手順書を開く"
                                        type="button"
                                      >
                                        <UiIcon name="book" size={16} /> 手順書
                                      </button>
                                    )}
                                    <button
                                      aria-label="今日の3件から外す"
                                      className="todayRemoveButton mainActionButton mainActionButton--neutral"
                                      disabled={isRunningTodayItem}
                                      onClick={() =>
                                        void removeTodayItem(todaySourceKey(item, index))
                                      }
                                      onPointerDown={(event) => event.stopPropagation()}
                                      title={
                                        isRunningTodayItem
                                          ? "タイマーを停止してから外してください"
                                          : "今日の3件から外す"
                                      }
                                      type="button"
                                    >
                                      <UiIcon name="back" size={16} />
                                      <span className="todayRemoveLabel">外す</span>
                                    </button>
                                  </div>
                                  <div className="todayTimerCluster">
                                    <div className="todayTriggerZone">
                                      {todayTriggerEditingIndex === index ? (
                                        <input autoComplete="off"
                                          aria-label="いつ・何の後にやる？"
                                          autoFocus
                                          className="todayTriggerInput"
                                          maxLength={EXECUTION_TRIGGER_MAX_CHARS}
                                          onBlur={cancelTodayTriggerEdit}
                                          onChange={(event) =>
                                            setTodayTriggerDraft(event.target.value)
                                          }
                                          onKeyDown={(event) =>
                                            handleTodayTriggerKeyDown(event, index)
                                          }
                                          onPointerDown={(event) => event.stopPropagation()}
                                          placeholder="例: 21時 / 夕食後"
                                          value={todayTriggerDraft}
                                        />
                                      ) : (
                                        <button
                                          className={
                                            item.trigger
                                              ? "todayTriggerButton"
                                              : "todayTriggerButton todayTriggerButton--empty"
                                          }
                                          onClick={() => beginTodayTriggerEdit(index)}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          type="button"
                                        >
                                          {item.trigger ? `${item.trigger} ▸` : "+ きっかけ"}
                                        </button>
                                      )}
                                    </div>
                                    {item.done ? (
                                      <span className="todayCompletedLabel">今日の分は完了</span>
                                    ) : isRunningTodayItem ? (
                                      <div
                                        className={
                                          activeTimer.mode === "measure"
                                            ? "todayTimerActions todayTimerActions--running todayTimerActions--measure"
                                            : "todayTimerActions todayTimerActions--running"
                                        }
                                      >
                                        {activeTimer.mode === "measure" && (
                                          <span className="measureElapsedClock">{timerClock}</span>
                                        )}
                                        <button
                                          aria-label={
                                            activeTimer.paused
                                              ? "このセッションを再開"
                                              : "このセッションを一時停止"
                                          }
                                          className="runningPauseButton"
                                          onClick={togglePause}
                                          title={
                                            activeTimer.paused
                                              ? "このセッションを再開"
                                              : "このセッションを一時停止"
                                          }
                                          type="button"
                                        >
                                          <UiIcon
                                            name={activeTimer.paused ? "play" : "pause"}
                                            size={16}
                                          />
                                          {activeTimer.paused
                                            ? "再開"
                                            : activeTimer.mode === "measure"
                                              ? "停止"
                                              : "一時停止"}
                                        </button>
                                        <button
                                          className="runningStopButton"
                                          onClick={() => finishActiveTimer(activeTimer)}
                                          title="このセッションを終了"
                                          type="button"
                                        >
                                          <UiIcon name="stop" size={16} /> 終了
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="todayTimerActions">
                                        <button
                                          aria-label={`短時間タイマー${shortMinutes}分で開始`}
                                          className="todayStartButton todayStartButton--short"
                                          disabled={!item.text.trim()}
                                          onClick={() => void startTodayItemShort(item, index, timerSourceId, shortMinutes)}
                                          title={`短時間タイマー: ${shortMinutes}分`}
                                          type="button"
                                        >
                                          <span aria-hidden="true" className="nextStepStartGlyph">
                                            <UiIcon name="play" size={16} />
                                          </span>
                                          <span
                                            aria-hidden="true"
                                            className="nextStepStartDuration"
                                          >
                                            {shortMinutes}分
                                          </span>
                                        </button>
                                        <button
                                          aria-label={`通常タイマー${defaultMinutes}分で開始`}
                                          className="todayStartButton todayStartButton--normal"
                                          disabled={!item.text.trim()}
                                          onClick={() =>
                                            void startTimer(
                                              timerSourceId,
                                              item.projectId && projectsById.has(item.projectId)
                                                ? (projectsById.get(item.projectId)?.name ??
                                                    item.text)
                                                : item.text,
                                              item.projectId && projectsById.has(item.projectId)
                                                ? item.projectId
                                                : null,
                                              (item.buttonIds ?? []).flatMap(
                                                (buttonId) =>
                                                  buttonsById.get(buttonId)?.actions ?? [],
                                              ),
                                              defaultMinutes,
                                              item.text,
                                              item.instructionPath,
                                              item.instructionOpenOnStart,
                                              "countdown",
                                              undefined,
                                              item.sourceKey?.startsWith("project:") &&
                                                item.expandTimerOnStart === true,
                                            )
                                          }
                                          title={`通常タイマー: ${defaultMinutes}分`}
                                          type="button"
                                        >
                                          <span aria-hidden="true" className="nextStepStartGlyph">
                                            <UiIcon name="play" size={16} />
                                          </span>
                                          <span
                                            aria-hidden="true"
                                            className="nextStepStartDuration"
                                          >
                                            {defaultMinutes}分
                                          </span>
                                        </button>
                                        <button
                                          aria-label="時間を決めずに計測"
                                          className="todayMeasureButton"
                                          disabled={!item.text.trim()}
                                          onClick={() =>
                                            void startTimer(
                                              timerSourceId,
                                              item.projectId && projectsById.has(item.projectId)
                                                ? (projectsById.get(item.projectId)?.name ??
                                                    item.text)
                                                : item.text,
                                              item.projectId && projectsById.has(item.projectId)
                                                ? item.projectId
                                                : null,
                                              (item.buttonIds ?? []).flatMap(
                                                (buttonId) =>
                                                  buttonsById.get(buttonId)?.actions ?? [],
                                              ),
                                              undefined,
                                              item.text,
                                              item.instructionPath,
                                              item.instructionOpenOnStart,
                                              "measure",
                                              undefined,
                                              item.sourceKey?.startsWith("project:") &&
                                                item.expandTimerOnStart === true,
                                            )
                                          }
                                          title="時間を決めずに計測"
                                          type="button"
                                        >
                                          <UiIcon name="clock" size={16} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                          {config.today.items.length > 0 &&
                            config.today.items.length < TODAY_ITEM_LIMIT &&
                            !todayPointerDrag && (
                              <button
                                className="todayPickerEntry"
                                onClick={(event) => openTodayPicker(event.currentTarget)}
                                type="button"
                              >
                                <span className="todayPickerEntryVisual">
                                  <UiIcon name="add" size={16} />
                                  今日やるものを選ぶ
                                </span>
                              </button>
                            )}
                          {todayPointerDrag?.targetIndicator && (
                            <div
                              aria-hidden="true"
                              className="todayDropIndicator"
                              style={todayPointerDrag.targetIndicator}
                            />
                          )}
                          {todayPointerDrag &&
                            (() => {
                              const draggedItem = config.today.items[todayPointerDrag.index];
                              if (!draggedItem) return null;
                              const draggedProject = draggedItem.projectId
                                ? projectsById.get(draggedItem.projectId)
                                : undefined;
                              return (
                                <div
                                  aria-hidden="true"
                                  className="todayDragGhost"
                                  data-project-color={
                                    draggedProject
                                      ? resolveProjectColorId(
                                          draggedProject.id,
                                          draggedProject.colorId,
                                        )
                                      : undefined
                                  }
                                  style={{
                                    height: todayPointerDrag.height,
                                    left: todayPointerDrag.pointerX - todayPointerDrag.offsetX,
                                    top: todayPointerDrag.pointerY - todayPointerDrag.offsetY,
                                    width: todayPointerDrag.width,
                                  }}
                                >
                                  {draggedProject && (
                                    <span className="todayProjectIdentity">
                                      <ProjectIdentity
                                        colorId={draggedProject.colorId}
                                        compact
                                        name={draggedProject.name}
                                        projectId={draggedProject.id}
                                      />
                                    </span>
                                  )}
                                  <strong>{draggedItem.text || "未入力"}</strong>
                                </div>
                              );
                            })()}
                        </div>

                        {todayPointerDrag && (
                          <div
                            aria-disabled={!todayPointerDrag.removeEligible}
                            className={[
                              "todayRemoveDropZone",
                              todayPointerDrag.removeTargetActive
                                ? "todayRemoveDropZone--active"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <span className="dropHintLabel">↓ ここにドロップして今日の3件から外す</span>
                          </div>
                        )}
                      </div>

                      {completionFeedback?.kind === "todayAll" && (
                        <div className="todayAllCompletionReward" role="status">
                          <span aria-hidden="true">✓</span>
                          今日の3件、完了！
                        </div>
                      )}

                      {allTodayItemsCompleted && (
                        <div className="todayNextBatch">
                          <button
                            className="secondaryButton mainActionButton mainActionButton--neutral"
                            onClick={() => void startNextTodayBatch()}
                            type="button"
                          >
                            <UiIcon name="add" size={16} />
                            次の3件を選ぶ
                          </button>
                          <span>まだやりたいときだけ、次の枠を作れます。</span>
                        </div>
                      )}
                    </>
                  </SectionCollapse>
                </section>


                <section
                  className={[
                    "projectsBand",
                    inboxPointerDrag?.nextStepEligible ? "sourceReturnBand--target" : "",
                    inboxPointerDrag?.nextStepTargetProjectId ? "sourceReturnBand--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openContextMenu(
                      { kind: "projects" },
                      event.clientX,
                      event.clientY,
                      event.currentTarget,
                    );
                  }}
                  tabIndex={-1}
                >
                  <div
                    className="disclosureHeader"
                    onClick={(event) =>
                      toggleDisclosureFromBar(event, () => setProjectsOpen((open) => !open))
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openContextMenu(
                        { kind: "projects" },
                        event.clientX,
                        event.clientY,
                        event.currentTarget,
                      );
                    }}
                    tabIndex={-1}
                  >
                    <button
                      aria-expanded={projectsOpen}
                      className="disclosure"
                      onClick={() => setProjectsOpen((open) => !open)}
                      type="button"
                    >
                      <UiIcon name={projectsOpen ? "chevronDown" : "chevronRight"} size={16} />
                      <span className="disclosureLabel">
                        <strong>次の一手</strong>
                      </span>
                    </button>
                    <span className="disclosureCount">{config.projects.length}件</span>
                    <span className="disclosureDescription">
                      迷ったときに戻る再開地点。プロジェクトごとに1つだけ設定。
                    </span>
                    <div className="disclosureHeaderActions">
                      <button
                        className="sectionGhostButton mainActionButton mainActionButton--neutral"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          openImportDialog("", null, event.currentTarget);
                        }}
                        title="ChatGPTやClaudeに作ってもらった内容を、まとめて足します"
                        type="button"
                      >
                        ＋ まとめて取り込む
                      </button>
                      <button
                        aria-label="プロジェクトを追加"
                        className="uiSmallButton sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--project mainActionButton mainActionButton--neutral"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          openProjectAddDialog();
                        }}
                        title="プロジェクトを追加"
                        type="button"
                      >
                        ＋ プロジェクト
                      </button>
                      <button
                        aria-label="次の一手の操作"
                        aria-haspopup="menu"
                        className="sectionMenuButton"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          openContextMenu(
                            { kind: "projects" },
                            rect.left,
                            rect.bottom,
                            event.currentTarget,
                          );
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        title="次の一手の操作"
                        type="button"
                      >
                        <span aria-hidden="true">…</span>
                      </button>
                    </div>
                  </div>
                  {inboxPointerDrag?.nextStepEligible && (
                    <div
                      className={
                        inboxPointerDrag.nextStepTargetProjectId
                          ? "sourceReturnDropZone sourceReturnDropZone--active"
                          : "sourceReturnDropZone"
                      }
                    >
                      <span className="dropHintLabel">
                        <span aria-hidden="true">↓</span>
                        <span>ここにドロップして次の一手を設定する</span>
                      </span>
                    </div>
                  )}
                  <SectionCollapse open={projectsOpen} dragActive={dragActive}>
                    <div
                      className={
                        config.projects.length === 0
                          ? "nextStepBody nextStepBody--empty"
                          : "nextStepBody"
                      }
                    >
                      {config.projects.length === 0 && (
                        <div className="sectionEmptyState">
                          <div className="sectionEmptyStateContent">
                            <strong>プロジェクトを設定しましょう</strong>
                            <span>取り組みたいことをまとめると、次の一手を決められます</span>
                            <button
                              className="mainActionButton mainActionButton--gold"
                              onClick={openProjectAddDialog}
                              type="button"
                            >
                              <UiIcon name="add" size={16} />
                              プロジェクトを設定
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="projectGrid">
                        {visibleProjects.map((project) => {
                          const projectSourceKey = `project:${project.id}`;
                          const placeholderActionable =
                            !project.nextStep?.text.trim() && !sourceEditBlocked(projectSourceKey);
                          const sourceLocked = Boolean(
                            project.nextStep &&
                            sourceLockedByUnfinishedToday(config, projectSourceKey),
                          );
                          const todayCandidate = rawTodayBuilderCandidates.find(
                            (candidate) => candidate.sourceKey === projectSourceKey,
                          );
                          const alreadySelected = Boolean(
                            todayCandidate && todayCandidateSelected(todayCandidate),
                          );
                          return (
                            <article
                              className={[
                                "nextStepRow sourceListRow",
                                "nextStepCard",
                                projectPointerDrag?.id === project.id
                                  ? "nextStepRow--dragging"
                                  : "",
                                inboxPointerDrag?.nextStepTargetProjectId === project.id
                                  ? "nextStepCard--dropTarget"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              data-project-color={resolveProjectColorId(
                                project.id,
                                project.colorId,
                              )}
                              data-project-id={project.id}
                              key={project.id}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                openContextMenu(
                                  { kind: "nextStep", project },
                                  event.clientX,
                                  event.clientY,
                                  event.currentTarget,
                                );
                              }}
                              onFocus={() => {
                                const index = config.projects.findIndex(
                                  (item) => item.id === project.id,
                                );
                                projectListAnchorRef.current = { id: project.id, index };
                              }}
                              onBlur={(event) => {
                                if (!(event.relatedTarget instanceof Node) ||
                                    !event.currentTarget.contains(event.relatedTarget)) {
                                  projectListAnchorRef.current = null;
                                }
                              }}
                              onKeyDown={(event) => {
                                if (
                                  handleRowShortcutKey(event, {
                                    activate: () => startProjectShort(project),
                                    edit: () => openNextStepEditor(project),
                                    remove: () => clearProjectNextStep(project),
                                  })
                                )
                                  return;
                                openContextMenuFromKeyboard(event, { kind: "nextStep", project });
                              }}
                              onPointerCancel={cancelProjectPointerDrag}
                              onPointerDown={(event) => startProjectPointerDrag(event, project.id)}
                              onPointerMove={updateProjectPointerDrag}
                              onPointerUp={finishProjectPointerDrag}
                              tabIndex={0}
                            >
                              {/* P10-14 (§4.4): one horizontal row: Project / action text / actions. */}
                              <div
                                className="nextStepProjectRegion"
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openContextMenu(
                                    { kind: "nextStep", project },
                                    event.clientX,
                                    event.clientY,
                                    event.currentTarget,
                                  );
                                }}
                                onKeyDown={(event) =>
                                  openContextMenuFromKeyboard(event, { kind: "nextStep", project })
                                }
                                tabIndex={0}
                              >
                                <h3>
                                  <ProjectIdentity
                                    compact
                                    colorId={project.colorId}
                                    name={project.name}
                                    projectId={project.id}
                                  />
                                </h3>
                              </div>
                              <div
                                className="nextStepActionRegion"
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openContextMenu(
                                    { kind: "nextStep", project },
                                    event.clientX,
                                    event.clientY,
                                    event.currentTarget,
                                  );
                                }}
                                onKeyDown={(event) =>
                                  openContextMenuFromKeyboard(event, { kind: "nextStep", project })
                                }
                                tabIndex={0}
                              >
                                <div className="nextStepTextRegion">
                                  <p
                                    className={
                                      project.nextStep?.text.trim()
                                        ? ""
                                        : placeholderActionable
                                          ? "projectNextStepPlaceholder projectNextStepPlaceholder--action"
                                          : "projectNextStepPlaceholder"
                                    }
                                    onClick={
                                      placeholderActionable
                                        ? (event) => {
                                            event.stopPropagation();
                                            openNextStepEditor(project);
                                          }
                                        : undefined
                                    }
                                    onPointerDown={
                                      placeholderActionable
                                        ? (event) => event.stopPropagation()
                                        : undefined
                                    }
                                    title={
                                      project.nextStep?.text.trim() || "まだ次の一手がありません"
                                    }
                                  >
                                    {project.nextStep?.trigger?.trim() && (
                                      <span className="projectNextStepTrigger">
                                        {project.nextStep.trigger.trim()} ▸{" "}
                                      </span>
                                    )}
                                    {project.nextStep?.text.trim() || "まだ次の一手がありません"}
                                  </p>
                                  {staleNextStepMap.has(project.id) && (
                                    <div className="nextStepFreshness">
                                      <span>
                                        {staleNextStepMap.get(project.id)}日同じ一手です。大きすぎるかもしれません
                                      </span>
                                      <span className="nextStepFreshnessActions">
                                        <button
                                          className="uiSmallButton nextStepFreshnessButton"
                                          onClick={() => openNextStepEditor(project, { mode: "edit" })}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          type="button"
                                        >
                                          小さくする
                                        </button>
                                        <button
                                          className="uiSmallButton nextStepFreshnessButton"
                                          disabled={nextStepReviewBusy === project.id}
                                          onClick={() => void markNextStepReviewed(project.id)}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          type="button"
                                        >
                                          このまま
                                        </button>
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="nextStepRowMeta">
                                  {sourceLocked && (
                                    <span
                                      aria-label="今日の3件で使用中のためロック中"
                                      className="sourceLockBadge"
                                      tabIndex={0}
                                      title={SOURCE_LOCK_REASON}
                                    >
                                      <UiIcon name="lock" size={16} />
                                    </span>
                                  )}
                                  {alreadySelected && (
                                    <span className="uiPill uiPill--good nextStepTodayStatus">✓ 今日の3件</span>
                                  )}
                                  {project.nextStep?.text.trim() ? (
                                    !sourceLocked && (
                                      <div className="nextStepCardActions">
                                        <button
                                          className="uiSmallButton nextStepRowAction nextStepRowAction--change mainActionButton mainActionButton--neutral"
                                          disabled={sourceEditBlocked(projectSourceKey)}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openNextStepEditor(project);
                                          }}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          title={sourceEditBlockReason(projectSourceKey) ?? undefined}
                                          type="button"
                                        >
                                          編集
                                        </button>
                                        <button
                                          className="nextStepTodayAdd mainActionButton mainActionButton--neutral"
                                          disabled={
                                            !todayCandidate ||
                                            alreadySelected ||
                                            config.today.items.length >= TODAY_ITEM_LIMIT
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (todayCandidate)
                                              void addCandidateToToday(todayCandidate);
                                          }}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          title={
                                            alreadySelected
                                              ? "今日の3件にあります"
                                              : config.today.items.length >= TODAY_ITEM_LIMIT
                                                ? "今日の3件は3件埋まっています"
                                                : "今日の3件に追加"
                                          }
                                          type="button"
                                        >
                                          ＋ 今日へ
                                        </button>
                                      </div>
                                    )
                                  ) : (
                                    <button
                                      className="uiSmallButton nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral"
                                      disabled={sourceEditBlocked(projectSourceKey)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openNextStepEditor(project);
                                      }}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      title={sourceEditBlockReason(projectSourceKey) ?? undefined}
                                      type="button"
                                    >
                                      次の一手を設定
                                    </button>
                                  )}
                                </div>
                                <span aria-hidden="true" className="uiKey rowKeyHint">
                                  Enter
                                </span>
                                <button
                                  aria-label={`${project.name}の次の一手の操作`}
                                  aria-haspopup="menu"
                                  className="sourceRowMenu nextStepRegionMenu"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    openContextMenu(
                                      { kind: "nextStep", project },
                                      rect.left,
                                      rect.bottom,
                                      event.currentTarget,
                                    );
                                  }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  title="次の一手の操作"
                                  type="button"
                                >
                                  <span aria-hidden="true">…</span>
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {config.projects.length > PROJECT_CARD_COMPACT_LIMIT && (
                        <div className="sourceListControls nextStepCardControls">
                          <button
                            className="mainActionButton mainActionButton--neutral"
                            onClick={() => {
                              projectListAnchorRef.current = null;
                              setProjectsListExpanded((expanded) => !expanded);
                            }}
                            type="button"
                          >
                            {projectsListExpanded
                              ? "− 折りたたむ"
                              : `＋ 残り${config.projects.length - PROJECT_CARD_COMPACT_LIMIT}件を表示`}
                          </button>
                        </div>
                      )}
                      {projectPointerDrag?.targetIndicator && (
                        <div
                          aria-hidden="true"
                          className="projectDropIndicator"
                          style={projectPointerDrag.targetIndicator}
                        />
                      )}
                      {projectPointerDrag?.todayTargetIndicator && (
                        <div
                          aria-hidden="true"
                          className="todayDropIndicator"
                          style={projectPointerDrag.todayTargetIndicator}
                        />
                      )}
                      {projectPointerDrag && (
                        <div
                          aria-hidden="true"
                          className={
                            projectPointerDrag.todayTargetIndex !== undefined
                              ? "projectDragGhost projectDragGhost--today"
                              : "projectDragGhost"
                          }
                          style={{
                            left: projectPointerDrag.pointerX - projectPointerDrag.offsetX,
                            top: projectPointerDrag.pointerY - projectPointerDrag.offsetY,
                            width: Math.min(300, projectPointerDrag.width),
                          }}
                        >
                          {(() => {
                            const project = config.projects.find(
                              (item) => item.id === projectPointerDrag.id,
                            );
                            return project ? (
                              <>
                                <ProjectIdentity
                                  colorId={project.colorId}
                                  compact
                                  name={project.name}
                                  projectId={project.id}
                                />
                                <strong>{project.nextStep?.text || "次の一手を書く"}</strong>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </SectionCollapse>
                </section>

                <section
                  className={[
                    "inboxBand",
                    projectPointerDrag?.wishlistEligible ? "sourceReturnBand--target" : "",
                    projectPointerDrag?.wishlistTarget ? "sourceReturnBand--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openContextMenu(
                      { kind: "inboxes" },
                      event.clientX,
                      event.clientY,
                      event.currentTarget,
                    );
                  }}
                >
                  <div
                    className="disclosureHeader"
                    data-inbox-header
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(
                        { kind: "inboxes" },
                        event.clientX,
                        event.clientY,
                        event.currentTarget,
                      );
                    }}
                    onKeyDown={(event) => openContextMenuFromKeyboard(event, { kind: "inboxes" })}
                    tabIndex={-1}
                    onClick={(event) =>
                      toggleDisclosureFromBar(event, () => setInboxOpen((open) => !open))
                    }
                  >
                    <button
                      aria-describedby="wishlist-group-summary"
                      aria-expanded={inboxOpen}
                      className="disclosure"
                      onClick={() => setInboxOpen((open) => !open)}
                      type="button"
                    >
                      <UiIcon name={inboxOpen ? "chevronDown" : "chevronRight"} size={16} />
                      <span className="disclosureLabel">
                        <strong>やりたいこと</strong>
                      </span>
                    </button>
                    <span className="disclosureCount">{config.inbox.length}件</span>
                    {inboxOpen ? (
                      <span className="disclosureDescription">
                        他にやりたいこと。今日やるものは「今日の3件」から選べます。
                      </span>
                    ) : (
                      // P10-06 (D26): closed, the header shows the groups as dots and counts.
                      <span
                        aria-hidden="true"
                        className="disclosureDescription inboxGroupSummary"
                        data-overflow={inboxSummaryOverflow ? "true" : "false"}
                        ref={inboxSummaryRef}
                        title={inboxSummaryTitle}
                      >
                        <span className="inboxGroupSummaryTrack">
                          {renderInboxGroupSummaryItems(false)}
                          {inboxSummaryOverflow ? renderInboxGroupSummaryItems(true) : null}
                        </span>
                      </span>
                    )}
                    <span className="visuallyHidden" id="wishlist-group-summary">
                      {`やりたいこと ${config.inbox.length}件。${wishlistGroups
                        .map((group) => `${group.name} ${group.items.length}件`)
                        .join("、")}`}
                    </span>
                    <div className="disclosureHeaderActions">
                      <button
                        aria-label="やりたいことを追加"
                        className="uiSmallButton sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--wishlist mainActionButton mainActionButton--neutral"
                        disabled={inboxAddOpen}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          openInboxAddDialog(event.currentTarget);
                        }}
                        title="やりたいことを追加"
                        type="button"
                      >
                        ＋ やりたいこと
                      </button>
                      <button
                        aria-label="やりたいことの操作"
                        aria-haspopup="menu"
                        className="sectionMenuButton"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          openContextMenu(
                            { kind: "inboxes" },
                            rect.left,
                            rect.bottom,
                            event.currentTarget,
                          );
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        title="やりたいことの操作"
                        type="button"
                      >
                        <span aria-hidden="true">…</span>
                      </button>
                    </div>
                  </div>

                  {projectPointerDrag?.wishlistEligible && (
                    <div
                      className={
                        projectPointerDrag?.wishlistTarget
                          ? "sourceReturnDropZone sourceReturnDropZone--active"
                          : "sourceReturnDropZone"
                      }
                    >
                      <span className="dropHintLabel">
                        <span aria-hidden="true">↓</span>
                        <span>ここにドロップしてやりたいことへ戻す</span>
                      </span>
                    </div>
                  )}

                  <SectionCollapse open={inboxOpen} dragActive={dragActive}>
                    <div className="inboxBody">
                      {config.inbox.length === 0 && (
                        <div className="sectionEmptyState">
                          <div className="sectionEmptyStateContent">
                            <strong>やりたいことを設定しましょう</strong>
                            <span>あとでやりたいことを登録して、今日やる候補にできます</span>
                            <button
                              className="mainActionButton mainActionButton--gold"
                              disabled={inboxAddOpen}
                              onClick={(event) => openInboxAddDialog(event.currentTarget)}
                              type="button"
                            >
                              <UiIcon name="add" size={16} />
                              やりたいことを追加する
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="inboxGroups">
                        {wishlistGroups.map((group) => {
                          const view = wishlistGroupViews[group.key] ?? {};
                          const range = sourceListRange(
                            group.items.length,
                            Boolean(view.expanded),
                            view.page ?? 1,
                          );
                          const collapsed = Boolean(view.collapsed);
                          const visibleItems = group.items.slice(range.start, range.end);
                          const groupProject = group.projectId
                            ? projectsById.get(group.projectId)
                            : undefined;
                          // P10-06 (D25): a Project group with no Next Step asks for one.
                          const groupNeedsNextStep = Boolean(
                            group.key !== "unassigned" && groupProject && !groupProject.nextStep?.text.trim(),
                          );
                          return (
                            <section
                              className={[
                                "wishlistGroup",
                                group.key === "unassigned" ? "wishlistGroup--unassigned" : "",
                                wishlistGroupPointerDrag?.key === group.key
                                  ? "wishlistGroup--dragging"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              data-project-color={
                                groupProject
                                  ? resolveProjectColorId(groupProject.id, groupProject.colorId)
                                  : undefined
                              }
                              data-wishlist-group={group.key}
                              key={group.key}
                              onPointerCancel={cancelWishlistGroupPointerDrag}
                              onPointerDown={(event) =>
                                startWishlistGroupPointerDrag(event, group.key, group.name)
                              }
                              onPointerMove={updateWishlistGroupPointerDrag}
                              onPointerUp={finishWishlistGroupPointerDrag}
                            >
                              <button
                                aria-expanded={!collapsed}
                                className={
                                  group.key === "unassigned"
                                    ? "wishlistGroupHeader wishlistGroupHeader--fixed"
                                    : "wishlistGroupHeader"
                                }
                                onClick={(event) => {
                                  if (event.detail === 0 || group.key === "unassigned") {
                                    toggleWishlistGroup(group.key);
                                  }
                                }}
                                onContextMenu={(event) => {
                                  if (!groupProject) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openContextMenu(
                                    { kind: "project", project: groupProject },
                                    event.clientX,
                                    event.clientY,
                                    event.currentTarget,
                                  );
                                }}
                                onKeyDown={(event) => {
                                  if (groupProject) {
                                    openContextMenuFromKeyboard(event, {
                                      kind: "project",
                                      project: groupProject,
                                    });
                                  }
                                }}
                                title={
                                  group.key === "unassigned"
                                    ? "未分類は並べ替えできません"
                                    : groupProject
                                      ? `${group.name}（ドラッグでグループを並べ替え、右クリックで編集）`
                                      : "ドラッグでグループを並べ替え"
                                }
                                type="button"
                              >
                                <UiIcon
                                  name={collapsed ? "chevronRight" : "chevronDown"}
                                  size={16}
                                />
                                {groupProject ? (
                                  <ProjectIdentity
                                    colorId={groupProject.colorId}
                                    compact
                                    name={group.name}
                                    projectId={groupProject.id}
                                  />
                                ) : (
                                  <strong>未分類</strong>
                                )}
                                {groupNeedsNextStep && (
                                  <span className="uiPill wishlistNextStepMissing">次の一手が未設定</span>
                                )}
                                <span>{group.items.length}件</span>
                              </button>
                              <SectionCollapse open={!collapsed} dragActive={dragActive}>
                                <>
                                  <div className="inboxList">
                                    {visibleItems.map(({ item, index }) => {
                                      const sourceKey = item.id ? `wishlist:${item.id}` : null;
                                      const sourceLocked = Boolean(
                                        sourceKey &&
                                        sourceLockedByUnfinishedToday(config, sourceKey),
                                      );
                                      const selected = Boolean(
                                        sourceKey &&
                                        config.today.items.some((todayItem) => {
                                          if (todayItem.sourceKey) {
                                            return (
                                              canonicalSourceKey(config, todayItem.sourceKey) ===
                                              sourceKey
                                            );
                                          }
                                          return (
                                            todayItem.projectId === item.projectId &&
                                            todayItem.text.trim() === item.text.trim()
                                          );
                                        }),
                                      );
                                      const nextStepSelected = wishlistItemIsCurrentNextStep(item);
                                      return (
                                        <div
                                          className={
                                            inboxPointerDrag?.index === index
                                              ? "inboxRow sourceListRow inboxRow--dragging"
                                              : "inboxRow sourceListRow"
                                          }
                                          data-inbox-index={index}
                                          data-inbox-id={item.id}
                                          key={item.id ?? `${item.text}-${index}`}
                                          onFocus={() => {
                                            if (item.id)
                                              inboxListAnchorRef.current = { id: item.id, index };
                                          }}
                                          onBlur={(event) => {
                                            if (!(event.relatedTarget instanceof Node) ||
                                                !event.currentTarget.contains(event.relatedTarget)) {
                                              inboxListAnchorRef.current = null;
                                            }
                                          }}
                                          onContextMenu={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            openContextMenu(
                                              { kind: "inbox", index, itemText: item.text },
                                              event.clientX,
                                              event.clientY,
                                              event.currentTarget,
                                            );
                                          }}
                                          onKeyDown={(event) => {
                                            if (
                                              handleRowShortcutKey(event, {
                                                activate: () => promoteInboxToNextStep(index),
                                                edit: () => beginInboxEdit(index),
                                                remove: () => deleteInboxItem(index),
                                              })
                                            )
                                              return;
                                            openContextMenuFromKeyboard(event, {
                                              kind: "inbox",
                                              index,
                                              itemText: item.text,
                                            });
                                          }}
                                          onPointerCancel={cancelInboxPointerDrag}
                                          onPointerDown={(event) =>
                                            startInboxPointerDrag(event, index)
                                          }
                                          onPointerMove={updateInboxPointerDrag}
                                          onPointerUp={finishInboxPointerDrag}
                                          tabIndex={0}
                                        >
                                          <span className="inboxItemText" title={item.text}>
                                            {sourceLocked && (
                                              <span
                                                aria-label="今日の3件で使用中のためロック中"
                                                className="sourceLockBadge sourceLockBadge--wishlist"
                                                tabIndex={0}
                                                title={SOURCE_LOCK_REASON}
                                              >
                                                <UiIcon name="lock" size={16} />
                                              </span>
                                            )}
                                            {item.text}
                                          </span>
                                          <div className="wishlistRowActions">
                                            <span className="wishlistNextStepSlot">
                                              {!nextStepSelected && !sourceLocked ? (
                                                <button
                                                  aria-label={`${item.text}の次の一手にする`}
                                                  className={
  groupNeedsNextStep
    ? "wishlistNextStepAction nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--gold"
    : "wishlistNextStepAction nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral"
}
                                                  disabled={
                                                    !item.id ||
                                                    sourceEditBlocked(`wishlist:${item.id}`)
                                                  }
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    promoteInboxToNextStep(index);
                                                  }}
                                                  onPointerDown={(event) => event.stopPropagation()}
                                                  title={
                                                    item.id
                                                      ? (sourceEditBlockReason(
                                                          `wishlist:${item.id}`,
                                                        ) ?? "次の一手にする")
                                                      : "次の一手にする"
                                                  }
                                                  type="button"
                                                >
                                                  ▷ 次の一手にする
                                                </button>
                                              ) : null}
                                            </span>
                                            {nextStepSelected && (
                                              <span className="wishlistNextStepStatus">
                                                ✓ 次の一手に設定済み
                                              </span>
                                            )}
                                            {selected && (
                                              <span className="wishlistTodayStatus">
                                                ✓ 今日の3件に設定済み
                                              </span>
                                            )}
                                            <span aria-hidden="true" className="uiKey rowKeyHint">
                                              Enter
                                            </span>
                                            <button
                                              aria-label={`${item.text}の操作`}
                                              aria-haspopup="menu"
                                              className="sourceRowMenu"
                                              onClick={(event) => {
                                                const rect =
                                                  event.currentTarget.getBoundingClientRect();
                                                openContextMenu(
                                                  { kind: "inbox", index, itemText: item.text },
                                                  rect.left,
                                                  rect.bottom,
                                                  event.currentTarget,
                                                );
                                              }}
                                              title="操作メニュー"
                                              type="button"
                                            >
                                              <span aria-hidden="true">…</span>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {group.items.length > SOURCE_LIST_COMPACT_LIMIT &&
                                    group.items.length < SOURCE_LIST_PAGINATION_THRESHOLD && (
                                      <div className="sourceListControls">
                                        <button
                                          className="mainActionButton mainActionButton--neutral"
                                          onClick={() =>
                                            setWishlistGroupViews((current) => ({
                                              ...current,
                                              [group.key]: {
                                                ...current[group.key],
                                                expanded: !view.expanded,
                                              },
                                            }))
                                          }
                                          type="button"
                                        >
                                          {view.expanded
                                            ? "5件だけ表示"
                                            : `残り${group.items.length - SOURCE_LIST_COMPACT_LIMIT}件をもっと見る`}
                                        </button>
                                      </div>
                                    )}
                                  {group.items.length >= SOURCE_LIST_PAGINATION_THRESHOLD && (
                                    <nav
                                      aria-label={`${group.name}のやりたいことページ`}
                                      className="sourceListPagination"
                                    >
                                      <button
                                        className="mainActionButton mainActionButton--neutral"
                                        disabled={range.page <= 1}
                                        onClick={() =>
                                          setWishlistGroupViews((current) => ({
                                            ...current,
                                            [group.key]: {
                                              ...current[group.key],
                                              page: Math.max(1, range.page - 1),
                                            },
                                          }))
                                        }
                                        type="button"
                                      >
                                        <UiIcon name="chevronLeft" size={16} /> 前へ
                                      </button>
                                      <span>
                                        {range.page} / {range.pageCount}
                                      </span>
                                      <button
                                        className="mainActionButton mainActionButton--neutral"
                                        disabled={range.page >= range.pageCount}
                                        onClick={() =>
                                          setWishlistGroupViews((current) => ({
                                            ...current,
                                            [group.key]: {
                                              ...current[group.key],
                                              page: Math.min(range.pageCount, range.page + 1),
                                            },
                                          }))
                                        }
                                        type="button"
                                      >
                                        次へ <UiIcon name="chevronRight" size={16} />
                                      </button>
                                    </nav>
                                  )}
                                </>
                              </SectionCollapse>
                            </section>
                          );
                        })}
                      </div>
                      {inboxPointerDrag?.targetIndicator && (
                        <div
                          aria-hidden="true"
                          className="inboxDropIndicator"
                          style={inboxPointerDrag.targetIndicator}
                        />
                      )}
                      {inboxPointerDrag?.todayTargetIndicator && (
                        <div
                          aria-hidden="true"
                          className="todayDropIndicator"
                          style={inboxPointerDrag.todayTargetIndicator}
                        />
                      )}
                      {wishlistGroupPointerDrag?.targetIndicator && (
                        <div
                          aria-hidden="true"
                          className="wishlistGroupDropIndicator"
                          style={wishlistGroupPointerDrag.targetIndicator}
                        />
                      )}
                      {wishlistGroupPointerDrag && (
                        <div
                          aria-hidden="true"
                          className="wishlistGroupDragGhost"
                          style={{
                            left:
                              wishlistGroupPointerDrag.pointerX - wishlistGroupPointerDrag.offsetX,
                            top:
                              wishlistGroupPointerDrag.pointerY - wishlistGroupPointerDrag.offsetY,
                            width: Math.min(320, wishlistGroupPointerDrag.width),
                          }}
                        >
                          {wishlistGroupPointerDrag.name}
                        </div>
                      )}
                      {inboxPointerDrag &&
                        (() => {
                          const item = config.inbox.find(
                            (entry) =>
                              entry.id === inboxPointerDrag.sourceKey.slice("wishlist:".length),
                          );
                          const project = item?.projectId
                            ? projectsById.get(item.projectId)
                            : undefined;
                          return item ? (
                            <div
                              aria-hidden="true"
                              className="inboxDragGhost"
                              style={{
                                left: inboxPointerDrag.pointerX - inboxPointerDrag.offsetX,
                                top: inboxPointerDrag.pointerY - inboxPointerDrag.offsetY,
                                width: Math.min(300, inboxPointerDrag.width),
                              }}
                            >
                              <span className="inboxProjectIdentity">
                                {project ? (
                                  <ProjectIdentity
                                    colorId={project.colorId}
                                    compact
                                    name={project.name}
                                    projectId={project.id}
                                  />
                                ) : (
                                  <span className="sourceProjectNone">プロジェクトなし</span>
                                )}
                              </span>
                              <strong>{item.text}</strong>
                            </div>
                          ) : null;
                        })()}
                    </div>
                  </SectionCollapse>
                </section>

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

      {contextMenu && (
        <ContextMenu
          ariaLabel="操作メニュー"
          onClose={() => dismissContextMenu(false)}
          onShortcutKey={handleContextMenuShortcut}
          opener={contextMenuReturnFocusRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          {contextMenu.kind === "doNow" ? (
            <ContextMenuItem onClick={showNextDoNowCandidate} type="button">
              他の一手
            </ContextMenuItem>
          ) : contextMenu.kind === "button" ? (
            <>
              {showButtonInSidebar(contextMenu.button) && (
                <>
                  <ContextMenuItem
                    disabled={
                      (config?.buttons ?? [])
                        .filter(
                          (button) =>
                            showButtonInSidebar(button) &&
                            buttonGroupName(button) === buttonGroupName(contextMenu.button),
                        )
                        .findIndex((button) => button.id === contextMenu.button.id) <= 0
                    }
                    onClick={() => void moveSidebarButtonByOffset(contextMenu.button.id, -1)}
                    type="button"
                  >
                    上へ移動
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={(() => {
                      const groupButtons = (config?.buttons ?? []).filter(
                        (button) =>
                          showButtonInSidebar(button) &&
                          buttonGroupName(button) === buttonGroupName(contextMenu.button),
                      );
                      return (
                        groupButtons.findIndex((button) => button.id === contextMenu.button.id) >=
                        groupButtons.length - 1
                      );
                    })()}
                    onClick={() => void moveSidebarButtonByOffset(contextMenu.button.id, 1)}
                    type="button"
                  >
                    下へ移動
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuItem
                onClick={() => openButtonEditDialog(contextMenu.button)}
                type="button"
              >
                編集
              </ContextMenuItem>
              {canRevealLauncherButton(contextMenu.button) ? (
                <ContextMenuItem
                  onClick={() => void revealButtonInExplorer(contextMenu.button)}
                  type="button"
                >
                  エクスプローラーで表示する
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuSeparatorBefore"
                onClick={() => void moveSidebarButtonToDictionary(contextMenu.button)}
                type="button"
              >
                辞書に移動
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => deleteButton(contextMenu.button)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "today" ? (
            <>
              <ContextMenuItem
                disabled={
                  !config.today.items[contextMenu.index]?.sourceKey ||
                  !canonicalSourceKey(config, config.today.items[contextMenu.index].sourceKey!) ||
                  sourceEditBlocked(
                    canonicalSourceKey(config, config.today.items[contextMenu.index].sourceKey!) ??
                      "",
                    true,
                  )
                }
                title={
                  config.today.items[contextMenu.index]?.sourceKey
                    ? (sourceEditBlockReason(
                        canonicalSourceKey(
                          config,
                          config.today.items[contextMenu.index].sourceKey!,
                        ) ?? "",
                        true,
                      ) ?? undefined)
                    : undefined
                }
                onClick={() => {
                  const current = configRef.current;
                  const item = current?.today.items[contextMenu.index];
                  if (!current || !item?.sourceKey) return;
                  const key = canonicalSourceKey(current, item.sourceKey);
                  if (!key || sourceEditBlocked(key, true)) return;
                  const project = current.projects.find((p) => `project:${p.id}` === key);
                  if (project) openNextStepEditor(project, { origin: "today" });
                  else {
                    const index = current.inbox.findIndex((i) => `wishlist:${i.id}` === key);
                    if (index >= 0) beginInboxEdit(index, "today");
                  }
                }}
                shortcut="F2"
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index <= 0}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                左へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index >= (config?.today.items.length ?? 0) - 1}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                右へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !!config?.today.items[contextMenu.index] &&
                  isTimerOnTodayItem(config.today.items[contextMenu.index], contextMenu.index)
                }
                title={
                  config?.today.items[contextMenu.index] &&
                  isTimerOnTodayItem(config.today.items[contextMenu.index], contextMenu.index)
                    ? "タイマーを停止してから外してください"
                    : undefined
                }
                onClick={() => {
                  setContextMenu(null);
                  const item = config?.today.items[contextMenu.index];
                  if (item) void removeTodayItem(todaySourceKey(item, contextMenu.index));
                }}
                shortcut="Delete"
                type="button"
              >
                今日の3件から外す
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "inbox" ? (
            <>
              <ContextMenuItem
                disabled={
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  Boolean(
                    config?.inbox[contextMenu.index] &&
                    wishlistItemIsCurrentNextStep(config.inbox[contextMenu.index]),
                  )
                }
                onClick={() => promoteInboxToNextStep(contextMenu.index)}
                title={
                  sourceEditBlockReason(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ??
                  undefined
                }
                type="button"
              >
                {config?.inbox[contextMenu.index] &&
                wishlistItemIsCurrentNextStep(config.inbox[contextMenu.index])
                  ? "次の一手に設定済み"
                  : "次の一手にする"}
              </ContextMenuItem>
              <ContextMenuItem
                disabled={inboxNeighborIndex(contextMenu.index, -1) === undefined}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={inboxNeighborIndex(contextMenu.index, 1) === undefined}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={sourceEditBlocked(`wishlist:${config.inbox[contextMenu.index]?.id}`)}
                title={
                  sourceEditBlockReason(`wishlist:${config.inbox[contextMenu.index]?.id}`) ??
                  undefined
                }
                onClick={() => beginInboxEdit(contextMenu.index)}
                shortcut="F2"
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !config?.inbox[contextMenu.index] ||
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  isTimerActiveForSource([
                    wishlistSourceKey(config.inbox[contextMenu.index], contextMenu.index),
                    legacyWishlistSourceKey(config.inbox[contextMenu.index]),
                  ])
                }
                onClick={() => completeInboxItem(contextMenu.index)}
                type="button"
              >
                完了にする
              </ContextMenuItem>
              {contextMenuTodayAdd ? (
                <ContextMenuItem
                  disabled={contextMenuTodayAdd.disabled}
                  onClick={() => {
                    const candidate = contextMenuTodayAdd.candidate;
                    setContextMenu(null);
                    void addCandidateToToday(candidate);
                  }}
                  shortcut="T"
                  title={contextMenuTodayAdd.reason}
                  type="button"
                >
                  今日の3件に入れる
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuDanger"
                disabled={
                  !config?.inbox[contextMenu.index] ||
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  isTimerActiveForSource([
                    wishlistSourceKey(config.inbox[contextMenu.index], contextMenu.index),
                    legacyWishlistSourceKey(config.inbox[contextMenu.index]),
                  ])
                }
                onClick={() => deleteInboxItem(contextMenu.index)}
                shortcut="Delete"
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "nextStep" ? (
            <>
              <ContextMenuItem
                onClick={() => openProjectEditDialog(contextMenu.project)}
                type="button"
              >
                プロジェクトを編集
              </ContextMenuItem>
              {contextMenu.project.nextStep?.text.trim() ? (
                <>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() => openNextStepEditor(contextMenu.project)}
                    shortcut="F2"
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    次の一手を編集
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() =>
                      openNextStepEditor(contextMenu.project, {
                        mode: "promote",
                        text: "",
                        projectLocked: true,
                      })
                    }
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    別の行動に入れ替える
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() => clearProjectNextStep(contextMenu.project)}
                    shortcut="Delete"
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    次の一手を未設定にする
                  </ContextMenuItem>
                </>
              ) : (
                <ContextMenuItem
                  disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                  onClick={() => openNextStepEditor(contextMenu.project)}
                  title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                  type="button"
                >
                  次の一手を設定
                </ContextMenuItem>
              )}
              {contextMenuTodayAdd ? (
                <ContextMenuItem
                  disabled={contextMenuTodayAdd.disabled}
                  onClick={() => {
                    const candidate = contextMenuTodayAdd.candidate;
                    setContextMenu(null);
                    void addCandidateToToday(candidate);
                  }}
                  shortcut="T"
                  title={contextMenuTodayAdd.reason}
                  type="button"
                >
                  今日の3件に入れる
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => requestProjectDeletion(contextMenu.project)}
                type="button"
              >
                プロジェクトを削除…
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "project" ? (
            <>
              <ContextMenuItem
                onClick={() => openProjectEditDialog(contextMenu.project)}
                type="button"
              >
                プロジェクトを編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuSeparatorBefore"
                onClick={openProjectManagement}
                type="button"
              >
                プロジェクトを管理
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => requestProjectDeletion(contextMenu.project)}
                type="button"
              >
                プロジェクトを削除…
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "projects" ? (
            <>
              <ContextMenuItem onClick={openProjectAddDialog} type="button">
                プロジェクトを追加
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openImportDialog("")} type="button">
                まとめて取り込む
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "inboxes" ? (
            <>
              <ContextMenuItem onClick={() => openInboxAddDialog()} type="button">
                やりたいことを追加
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openImportDialog("")} type="button">
                まとめて取り込む
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "session" ? (
            <>
              <ContextMenuItem
                onClick={() => openSessionEditDialog(contextMenu.session)}
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => requestSessionDelete(contextMenu.session)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={openGroupDialog} type="button">
                グループを追加
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => openButtonBuilder(contextMenu.groupName)}
                type="button"
              >
                ボタンを追加
              </ContextMenuItem>
              {contextMenu.groupName && (
                <>
                  <ContextMenuItem
                    disabled={uniqueGroupNames(config).indexOf(contextMenu.groupName) <= 0}
                    onClick={() => void moveSidebarGroupByOffset(contextMenu.groupName!, -1)}
                    type="button"
                  >
                    上へ移動
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={
                      uniqueGroupNames(config).indexOf(contextMenu.groupName) >=
                      uniqueGroupNames(config).length - 1
                    }
                    onClick={() => void moveSidebarGroupByOffset(contextMenu.groupName!, 1)}
                    type="button"
                  >
                    下へ移動
                  </ContextMenuItem>
                </>
              )}
              {!contextMenu.groupName ? null : contextMenu.groupName === DEFAULT_BUTTON_GROUP ? (
                <ContextMenuItem disabled type="button">
                  その他は削除不可
                </ContextMenuItem>
              ) : (
                <>
                  <ContextMenuItem
                    onClick={() => openGroupRenameDialog(contextMenu.groupName)}
                    type="button"
                  >
                    名前を変更
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="contextMenuDanger"
                    onClick={() => {
                      if (contextMenu.groupName) deleteGroup(contextMenu.groupName);
                    }}
                    type="button"
                  >
                    {contextMenu.groupName ? `${contextMenu.groupName}を削除` : "グループ削除"}
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenu>
      )}

      {inboxEditingIndex !== null && config.inbox[inboxEditingIndex] && (
        <InboxEditDialog
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

      {todayPickerOpen && (
        <TodayPickerDialog
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
          renderTodayPickerCandidate={renderTodayPickerCandidate}
          renderTodayPickerSelectedItem={renderTodayPickerSelectedItem}
          requestCloseTodayPicker={requestCloseTodayPicker}
          saveTodayPickerDraft={saveTodayPickerDraft}
        />
      )}

      {groupDraft !== null && (
        <GroupNameDialog
          mode="add"
          onCancel={() => setGroupDraft(null)}
          onChange={setGroupDraft}
          onConfirm={confirmGroupAddition}
          value={groupDraft}
        />
      )}

      {groupRenameDraft && (
        <GroupNameDialog
          mode="rename"
          onCancel={() => setGroupRenameDraft(null)}
          onChange={(to) => setGroupRenameDraft({ ...groupRenameDraft, to })}
          onConfirm={confirmGroupRename}
          value={groupRenameDraft.to}
        />
      )}

      {settingsDraft && (
        <SettingsDialog
          config={config}
          dailyActivityCopying={dailyActivityCopying}
          instructionSettingsBusy={instructionSettingsBusy}
          numberInputDragging={numberInputDragging}
          settingsDraft={settingsDraft}
          settingsSection={settingsSection}
          shortcutConflicts={shortcutConflicts}
          shortcutRecordingField={shortcutRecordingField}
          softwareResetStage={softwareResetStage}
          testProfile={testProfile}
          setHelpGuideOpen={setHelpGuideOpen}
          setSettingsDraft={setSettingsDraft}
          setSettingsSection={setSettingsSection}
          showToast={showToast}
          addInstructionFolder={addInstructionFolder}
          beginShortcutRecording={beginShortcutRecording}
          cancelNumberInputDrag={cancelNumberInputDrag}
          chooseBackupFolder={chooseBackupFolder}
          chooseBackupZipForRestore={chooseBackupZipForRestore}
          copyTodayActivityLog={copyTodayActivityLog}
          finishNumberInputDrag={finishNumberInputDrag}
          finishShortcutRecording={finishShortcutRecording}
          openBackupFolder={openBackupFolder}
          openRuntimeDataFolder={openRuntimeDataFolder}
          reloadInstructionList={reloadInstructionList}
          removeInstructionFolder={removeInstructionFolder}
          requestClearBackupFolder={requestClearBackupFolder}
          requestCloseSettings={requestCloseSettings}
          requestIconCacheRegeneration={requestIconCacheRegeneration}
          requestInstructionWindowPositionReset={requestInstructionWindowPositionReset}
          requestMiniWindowPositionReset={requestMiniWindowPositionReset}
          requestSoftwareReset={requestSoftwareReset}
          saveSettingsCenter={saveSettingsCenter}
          startNumberInputDrag={startNumberInputDrag}
          updateNumberInputDrag={updateNumberInputDrag}
        />
      )}

      {manualSessionDraft && (
        <ManualSessionDialog
          draft={manualSessionDraft}
          onCancel={() => setManualSessionDraft(null)}
          onDraftChange={setManualSessionDraft}
          onSave={saveManualSession}
          projects={config.projects}
          projectsById={projectsById}
        />
      )}

      {sessionEditDraft && (
        <SessionEditDialog
          draft={sessionEditDraft}
          onCancel={() => setSessionEditDraft(null)}
          onDraftChange={setSessionEditDraft}
          onSave={saveSessionEdit}
          projects={config.projects}
          projectsById={projectsById}
        />
      )}

      {buttonEditDraft && (
        <ButtonEditDialog
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

      {inboxAddOpen && (
        <InboxAddDialog
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

      {completionFollowup?.source.kind === "nextStep" &&
        (() => {
          const projectId = completionFollowup.source.projectId;
          const followupProject = config.projects.find((project) => project.id === projectId);
          const followupWishlist = config.inbox.filter(
            (item): item is AppConfig["inbox"][number] & { id: string } =>
              item.projectId === projectId && Boolean(item.id),
          );
          const previous = completionFollowup.previousNextStep;
          const decide = () => {
            const live = configRef.current;
            const project = live?.projects.find((candidate) => candidate.id === projectId);
            if (!project) {
              setCompletionFollowup(null);
              showToast("warn", "プロジェクトが見つかりません");
              return;
            }
            if (project.nextStep?.text.trim()) {
              setCompletionFollowup(null);
              showToast("warn", "次の一手はもう決まっています");
              return;
            }
            if (completionFollowupChoice === "none") {
              setCompletionFollowup(null);
              return;
            }
            if (completionFollowupChoice.startsWith("wishlist:")) {
              const wishlistId = completionFollowupChoice.slice("wishlist:".length);
              const index = live?.inbox.findIndex((item) => item.id === wishlistId) ?? -1;
              if (index < 0) {
                // P10-14 (§8.1): the chosen wishlist item vanished while the dialog was open.
                const firstWishlist = live?.inbox.find(
                  (item) => item.projectId === projectId && Boolean(item.id),
                );
                setCompletionFollowupChoice(
                  firstWishlist?.id
                    ? `wishlist:${firstWishlist.id}`
                    : previous
                      ? "repeat"
                      : "write",
                );
                showToast("warn", "選んだやりたいことが見つかりません");
                return;
              }
              setCompletionFollowup(null);
              promoteInboxToNextStep(index);
              return;
            }
            if (completionFollowupChoice === "repeat" && previous) {
              // Only the buttons that still exist and can be chosen in the editor are copied.
              const liveButtons = new Set(projectSelectableButtons.map((button) => button.id));
              setCompletionFollowup(null);
              openNextStepEditor(project, {
                mode: "set",
                prefill: {
                  text: previous.text,
                  trigger: previous.trigger ?? "",
                  buttonIds: previous.buttonIds.filter((id) => liveButtons.has(id)),
                  shortTimerMinutes:
                    previous.shortTimerMinutes === undefined
                      ? ""
                      : String(previous.shortTimerMinutes),
                  defaultTimerMinutes:
                    previous.defaultTimerMinutes === undefined
                      ? ""
                      : String(previous.defaultTimerMinutes),
                  instructionPath: previous.instructionPath ?? "",
                  instructionOpenOnStart: previous.instructionOpenOnStart ?? false,
                  startNoteTemplate: previous.startNoteTemplate ?? "",
                  expandTimerOnStart: previous.expandTimerOnStart ?? false,
                },
              });
              return;
            }
            setCompletionFollowup(null);
            openNextStepEditor(project, { mode: "set" });
          };
          const choiceClass = (selected: boolean) =>
            selected
              ? "completionFollowupChoice completionFollowupChoice--selected"
              : "completionFollowupChoice";
          return (
            <div className="modalBackdrop" role="presentation">
              <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
              <section
                aria-label="一手進みました"
                aria-modal="true"
                className="dropDialog completionFollowupDialog"
                role="dialog"
                tabIndex={-1}
              >
                <div className="completionDoneHeader">
                  <span aria-hidden="true" className="completionDoneMark">
                    ✓
                  </span>
                  <div>
                    <p className="eyebrow">Session</p>
                    <h2>一手進みました</h2>
                  </div>
                </div>
                <div className="completionDoneSubject">
                  {followupProject && (
                    <ProjectIdentity
                      colorId={followupProject.colorId}
                      compact
                      name={followupProject.name}
                      projectId={followupProject.id}
                    />
                  )}
                  <strong title={completionFollowup.text}>{completionFollowup.text}</strong>
                  {completionFollowup.minutes ? (
                    <span className="completionDoneMinutes">
                      {formatSessionRange(completionFollowup) ??
                        `実行 ${completionFollowup.minutes}分`}
                    </span>
                  ) : null}
                </div>
                <h3 className="completionFollowupQuestion" id="completion-followup-question">
                  次はどこから始めますか
                </h3>
                <div
                  aria-labelledby="completion-followup-question"
                  className="completionFollowupChoices"
                  role="radiogroup"
                >
                  {followupWishlist.map((item) => {
                    const key = `wishlist:${item.id}`;
                    return (
                      <label className={choiceClass(completionFollowupChoice === key)} key={key}>
                        <input
                          aria-label={item.text}
                          checked={completionFollowupChoice === key}
                          onChange={() => setCompletionFollowupChoice(key)}
                          type="radio"
                        />
                        <span>{item.text}</span>
                        <small>やりたいことから</small>
                      </label>
                    );
                  })}
                  {previous && (
                    <label className={choiceClass(completionFollowupChoice === "repeat")}>
                      <input
                        aria-label={`同じ一手をもう一度（${previous.text}）`}
                        checked={completionFollowupChoice === "repeat"}
                        onChange={() => setCompletionFollowupChoice("repeat")}
                        type="radio"
                      />
                      <span>同じ一手をもう一度（{previous.text}）</span>
                    </label>
                  )}
                  <label className={choiceClass(completionFollowupChoice === "write")}>
                    <input
                      aria-label="自分で書く"
                      checked={completionFollowupChoice === "write"}
                      onChange={() => setCompletionFollowupChoice("write")}
                      type="radio"
                    />
                    <span>自分で書く</span>
                  </label>
                  <label className={choiceClass(completionFollowupChoice === "none")}>
                    <input
                      aria-label="今は決めない"
                      checked={completionFollowupChoice === "none"}
                      onChange={() => setCompletionFollowupChoice("none")}
                      type="radio"
                    />
                    <span>今は決めない</span>
                  </label>
                </div>
                <div className="dialogActions formDialogActions">
                  <button
                    className="primaryButton completionFollowupDecide"
                    onClick={decide}
                    type="button"
                  >
                    決定
                  </button>
                  <button
                    className="secondaryButton dialogCancelButton"
                    onClick={() => setCompletionFollowup(null)}
                    type="button"
                  >
                    閉じる
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

      {nextStepEditDraft && (
        <NextStepEditDialog
          config={config}
          nextStepEditDraft={nextStepEditDraft}
          buttonsById={buttonsById}
          instructionChoices={instructionChoices}
          instructionChoicesError={instructionChoicesError}
          instructionChoicesLoading={instructionChoicesLoading}
          missingButtonIds={missingButtonIds}
          missingInstructionProjectIds={missingInstructionProjectIds}
          nextStepOpenMenuOpen={nextStepOpenMenuOpen}
          nextStepOpenPicker={nextStepOpenPicker}
          numberInputDragging={numberInputDragging}
          overlayPages={overlayPages}
          projectNextStepSuggestions={projectNextStepSuggestions}
          projectSelectableButtons={projectSelectableButtons}
          sourceEditSaving={sourceEditSaving}
          setNextStepEditDraft={setNextStepEditDraft}
          setNextStepOpenMenuOpen={setNextStepOpenMenuOpen}
          setNextStepOpenPicker={setNextStepOpenPicker}
          renderButtonIcon={renderButtonIcon}
          cancelNumberInputDrag={cancelNumberInputDrag}
          finishNumberInputDrag={finishNumberInputDrag}
          updateNumberInputDrag={updateNumberInputDrag}
          startNumberInputDrag={startNumberInputDrag}
          chooseLegacyNextStepSettings={chooseLegacyNextStepSettings}
          closeNextStepEditDialog={closeNextStepEditDialog}
          refreshInstructionChoices={refreshInstructionChoices}
          saveNextStepEdit={saveNextStepEdit}
          selectNextStepDecisionMode={selectNextStepDecisionMode}
          selectNextStepProject={selectNextStepProject}
        />
      )}

      {projectEditDraft && (
        <ProjectEditDialog
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

      {expandedTimerOpen && activeTimer && (
        <ExpandedTimerOverlay
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

      {completionPrompt && (
        <CompletionFollowupDialog
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

      {dropDraft && (
        <DropRegisterDialog
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

      {softwareResetChoiceOpen && (
        <SoftwareResetChoiceDialog
          busy={softwareResetChoiceBusy}
          onClose={() => closeSoftwareResetChoice()}
          onContinue={(withBackup) => void continueSoftwareReset(withBackup)}
        />
      )}
      {confirmDialog && <ConfirmDialog {...confirmDialog} onCancel={closeConfirmDialog} open />}
      {softwareResetStage !== "idle" && (
        <SoftwareResetProgressDialog
          progressRef={softwareResetProgressRef}
          stage={softwareResetStage}
        />
      )}
      {searchOpen && (
        <SearchPalette
          busy={searchBusy}
          onActivate={(item, mode) => void runSearchItem(item, mode)}
          onClose={closeSearchPalette}
          onQueryChange={setSearchQuery}
          query={searchQuery}
          sections={searchSections}
        />
      )}
      {helpGuideOpen && (
        <HelpGuideDialog
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
      {earlyStop && (
        <ConfirmDialog
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
