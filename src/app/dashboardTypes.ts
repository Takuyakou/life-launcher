import { DropButtonDraft, LauncherAction, LauncherButton, LauncherNextStep, LauncherProject, OverlayPage, ProjectColorId, SessionEntryRow } from "../types";
import type { GroupMode } from "../components/GroupModeField";
import type { NextStepReplacementChoice } from "../nextStepWishlist";
import type { TimerMode } from "../timerRuntime";
import type { TodayCompletionSource } from "../completionFollowup";

export type ToastTone = "neutral" | "ok" | "warn" | "error" | "danger";
export type NotesSaveStatus = "saved" | "saving" | "error";

export type ActiveView = "main" | "records";
export type RecordsDateScope = "today" | "week" | "all";

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => Promise<boolean>;
  actionPending: boolean;
  durationMs: number;
  queued: boolean;
  paused: boolean;
  leaving: boolean;
};

export type ToastOptions = {
  detail?: string;
  actionLabel?: string;
  onAction?: () => Promise<boolean>;
  durationMs?: number;
};

export type ToastTimerState = {
  dismissTimer: number | null;
  removeTimer: number | null;
  remainingMs: number;
  startedAt: number | null;
  pointerInside: boolean;
  focusInside: boolean;
  documentHidden: boolean;
};

export type ActiveTimer = {
  instanceId: number;
  sourceId: string;
  sourceGenerationId?: string;
  projectId: string | null;
  label: string;
  note: string;
  // Display-only text captured at start; `note` is what gets recorded and may be a template.
  actionText?: string;
  doNowSnapshot?: DoNowCompletionSnapshot;
  continuedAfterCompletion?: boolean;
  startedAtMs: number;
  startedAt: string;
  mode: TimerMode;
  targetMinutes: number | null;
  paused: boolean;
  pausedStartedAtMs: number | null;
  pausedTotalMs: number;
  expiredAtMs?: number | null;
};

export type DoNowCompletionSnapshot = {
  projectId: string;
  projectName: string;
  colorId?: ProjectColorId | null;
  taskText: string;
};

export type DoNowCompletionHold = DoNowCompletionSnapshot & {
  date: string;
  minutes: number;
};

export type ButtonGroup = {
  name: string;
  buttons: LauncherButton[];
};

export type LauncherOverlayItem = {
  groupName: string;
  pageName: string;
  button: LauncherButton;
};

export type LauncherOverlayPageTab = {
  key: string;
  name: string;
};

export type OverlayPageDraft = {
  mode: "add" | "rename";
  pageId?: string;
  name: string;
  assignToButton?: boolean;
};

export type DropDialogState = DropButtonDraft & {
  label: string;
  group: string;
  groupMode: GroupMode;
  existingGroup: string;
  newGroup: string;
  showInSidebar: boolean;
  showInOverlay: boolean;
  overlayPageId: string | null;
};

export type ActionDraft = LauncherAction & {
  draftId: string;
};

export type ButtonEditDraft = {
  id: string;
  label: string;
  groupMode: GroupMode;
  existingGroup: string;
  newGroup: string;
  showInSidebar: boolean;
  showInOverlay: boolean;
  overlayPageId: string | null;
  aliasesInput: string;
  description: string;
  actions: ActionDraft[];
};

export type ProjectEditDraft = {
  id: string;
  name: string;
  northStar: string;
  weeklyFocus: boolean;
  colorId: ProjectColorId;
  isNew: boolean;
};

export type LegacyNextStepChoice = "inherit" | "discard" | null;

export type WishlistGroupView = {
  collapsed?: boolean;
  expanded?: boolean;
  page?: number;
};

export type NextStepDecisionMode = "new" | "wishlist";

export type NextStepEditDraft = {
  mode: "edit" | "set" | "promote";
  decisionMode: NextStepDecisionMode;
  projectId: string;
  projectLocked: boolean;
  text: string;
  originalText: string;
  trigger: string;
  resumeNote: string;
  buttonIds: string[];
  defaultTimerMinutes: string;
  shortTimerMinutes: string;
  startNoteTemplate: string;
  instructionPath: string;
  instructionOpenOnStart: boolean;
  expandTimerOnStart: boolean;
  legacyChoice: LegacyNextStepChoice;
  replacementChoice: NextStepReplacementChoice | null;
  replacedNextStep?: LauncherNextStep;
  promotedWishlistId?: string;
};

export type InstructionChoice = {
  path: string;
  label: string;
};

export type SettingsCenterDraft = {
  mainDisplaySize: "standard" | "large" | "xlarge";
  defaultTimerMinutes: string;
  shortTimerMinutes: string;
  dayStartHour: string;
  focusHotkey: string;
  launcherHotkey: string;
  miniHotkey: string;
  instructionHotkey: string;
  instructionFolders: string[];
  weeklyFocusProjectIds: string[];
  alwaysOnTop: boolean;
  autoStart: boolean;
  miniMode: boolean;
  restartShortFirst: boolean;
  backupFolder: string;
  backupKeep: string;
};

export type SettingsSectionKey = "basic" | "shortcuts" | "instructions" | "backup" | "maintenance";
export type ShortcutDraftField = "focusHotkey" | "launcherHotkey" | "miniHotkey" | "instructionHotkey";

export const SHORTCUT_DRAFT_FIELDS: ReadonlyArray<{
  field: ShortcutDraftField;
  label: string;
}> = [
  { field: "focusHotkey", label: "メイン呼び出し" },
  { field: "launcherHotkey", label: "辞書" },
  { field: "miniHotkey", label: "ミニタイマー切替" },
  { field: "instructionHotkey", label: "手順書" },
];

export const TOP_MENU_LABELS = navigator.language.toLocaleLowerCase().startsWith("en")
  ? {
      autoStart: "Startup",
      miniMode: "Mini",
      records: "Records",
      dashboard: "Home",
      instructions: "Instructions",
      guide: "Guide",
      settings: "Settings",
    }
  : {
      autoStart: "自動起動",
      miniMode: "ミニ",
      records: "記録",
      dashboard: "メイン",
      instructions: "手順書",
      guide: "使い方",
      settings: "設定",
    };
export const TOP_MENU_GROUP_LABELS = {
  // P10-02: [自動起動] [記録 / 手順書 / 設定] [窓のボタン] の 3 つに分けた(D5)。
  autoStart: TOP_MENU_LABELS.autoStart,
  work: `${TOP_MENU_LABELS.records} / ${TOP_MENU_LABELS.instructions} / ${TOP_MENU_LABELS.settings}`,
};
export type MainShellDropEvent = {
  windowLabel: string;
  stage: "dragEnter" | "dragOver" | "dragLeave" | "drop" | "error";
  message: string;
  paths: string[];
  url?: string | null;
  label?: string | null;
  shellSpecial?: "recycle_bin" | null;
  position?: { x: number; y: number } | null;
};

export type ManualSessionDraft = {
  projectId: string | null;
  date: string;
  startedAt: string;
  minutes: string;
  note: string;
};

export type SessionEditDraft = {
  rowKey: string;
  projectId: string | null;
  label: string;
  date: string;
  startedAt: string;
  minutes: string;
  note: string;
};

export type TimerCompletionPrompt = {
  sourceId: string;
  projectId: string | null;
  targetMinutes: number;
  label: string;
  actionText?: string;
};

export type CompletionFeedback = {
  key: string;
  kind: "victory" | "today" | "todayAll";
  label: string;
  sourceKey?: string;
};

export type CompletionFollowup = {
  key: string;
  source: TodayCompletionSource;
  text: string;
  /** P10-09 (§8.1): how long the finished Session actually ran. */
  minutes?: number;
  /** P10-14d (D1): the Session's wall-clock range, shown as HH:MM–HH:MM. */
  startedAt?: string;
  endedAt?: string;
  /** P10-09: the Next Step of the Project right before the completion (memory only). */
  previousNextStep?: LauncherNextStep;
};

export type ContextMenuTarget =
  | {
      kind: "overlayPage";
      page: OverlayPage;
    }
  | {
      kind: "button";
      button: LauncherButton;
    }
  | {
      kind: "sidebar";
      groupName?: string;
    }
  | {
      kind: "project";
      project: LauncherProject;
    }
  | {
      kind: "nextStep";
      project: LauncherProject;
    }
  | {
      kind: "today";
      index: number;
      itemText: string;
    }
  | {
      kind: "inbox";
      index: number;
      itemText: string;
    }
  | {
      kind: "doNow";
    }
  | {
      kind: "projects";
    }
  | {
      kind: "inboxes";
    }
  | {
      kind: "session";
      session: SessionEntryRow;
    };

export type ContextMenuState = ContextMenuTarget & {
  x: number;
  y: number;
};

export type InternalButtonDrag = {
  id: string;
  group: string;
};

export type SidebarPointerDrag = InternalButtonDrag & {
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type SidebarDragPreview = InternalButtonDrag & {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetIndicator?: {
    left: number;
    top: number;
    width: number;
    height?: number;
  };
  targetButtonId?: string;
  targetGroupName?: string;
};

export type SidebarGroupPointerDrag = {
  group: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type SidebarGroupDragPreview = {
  group: string;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetGroupName?: string;
  placement?: "before" | "after";
};

export type TodayPointerDrag = {
  index: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type TodayDragPreview = {
  index: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  removeEligible: boolean;
  removeTargetActive: boolean;
  targetIndex?: number;
  placement?: "before" | "after";
  targetIndicator?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type ProjectPointerDrag = {
  id: string;
  sourceKey: string;
  origin: "nextStep";
  dayKey: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type ProjectDragPreview = {
  id: string;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetId?: string;
  placement?: "before" | "after";
  targetIndicator?: {
    left: number;
    top: number;
    width: number;
    height?: number;
  };
  wishlistTarget: boolean;
  wishlistEligible: boolean;
  todayTargetIndex?: number;
  todayTargetIndicator?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  todayGuidanceActive: boolean;
};

export type InboxPointerDrag = {
  index: number;
  sourceKey: string;
  origin: "wishlist";
  dayKey: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type InboxDragPreview = {
  index: number;
  sourceKey: string;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetIndex?: number;
  placement?: "before" | "after";
  targetIndicator?: {
    left: number;
    top: number;
    width: number;
  };
  nextStepEligible: boolean;
  nextStepTargetProjectId?: string;
  todayTargetIndex?: number;
  todayTargetIndicator?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  todayGuidanceActive: boolean;
};

export type WishlistGroupPointerDrag = {
  key: string;
  name: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type WishlistGroupDragPreview = {
  key: string;
  name: string;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  targetKey?: string;
  placement?: "before" | "after";
  targetIndicator?: {
    left: number;
    top: number;
    width: number;
  };
};

export type NumberInputDragField =
  | "timer"
  | "settingsDefault"
  | "settingsShort"
  | "settingsDayStart"
  | "projectDefault"
  | "projectShort";

export type NumberInputDrag = {
  pointerId: number;
  field: NumberInputDragField;
  startY: number;
  startValue: number;
  moved: boolean;
};

export type MiniTimerSnapshot = {
  active: boolean;
  label: string;
  actionText: string;
  mode: TimerMode;
  remainingClock: string;
  paused: boolean;
  progressPercent: number | null;
  projectId: string | null;
  projectName: string;
  projectColorId: ProjectColorId | null;
};

export type MiniTimerCommand = {
  action: "pause" | "finish";
};
