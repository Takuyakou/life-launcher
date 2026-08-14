import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { emit, listen } from "@tauri-apps/api/event";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, primaryMonitor, type Monitor } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from "@tauri-apps/plugin-autostart";
import type { DragEvent, KeyboardEvent, PointerEvent } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BUTTON_GROUP,
  EXECUTION_TRIGGER_MAX_CHARS,
  GROUP_COLLAPSE_STORAGE_KEY,
  OVERLAY_PAGE_NAME_MAX_CHARS,
  TIMER_TICK_MS,
  TODAY_ITEM_LIMIT,
  TOAST_TIMEOUT_MS,
  WEEKLY_FOCUS_LIMIT,
  WEEKLY_REVIEW_SEEN_STORAGE_KEY,
} from "./constants";
import {
  chooseInstructionRoot,
  deleteSessionEntry,
  deleteButtonIconCache,
  enableMainShellDrop,
  ensureButtonIconCache,
  executeActions,
  focusDashboardWindow,
  listenForConfigChanges,
  loadConfig,
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
  reapplyDashboardSettings,
  resumeDashboardShortcuts,
  recordManualSession,
  recordSession,
  resolveDropItem,
  restoreBackup,
  saveConfig,
  saveNotesForDate,
  selectBackupFolder,
  selectBackupZip,
  suspendDashboardShortcuts,
  updateSessionEntry,
  updateInstructionReferences,
} from "./tauri";
import {
  ActionResult,
  AppConfig,
  DropButtonDraft,
  DropResolveInput,
  DoNowResponse,
  LauncherAction,
  LauncherButton,
  OverlayPage,
  LauncherProject,
  ProjectColorId,
  MiniWindowPosition,
  NotesHistoryResponse,
  SessionEntriesResponse,
  SessionEntryRow,
  SessionSummaryResponse,
  WeeklyReviewResponse,
  WeeklyReviewProjectSummary,
} from "./types";
import { ConfirmDialog, type ConfirmDialogRequest } from "./components/ConfirmDialog";
import { ContextMenu, ContextMenuItem } from "./components/ContextMenu";
import { HelpGuideDialog } from "./components/HelpGuideDialog";
import { ProjectIdentity } from "./components/ProjectIdentity";
import {
  PROJECT_COLOR_IDS,
  PROJECT_COLOR_LABELS,
  resolveProjectColorId,
} from "./projectIdentity";
import { TimerPanel } from "./components/TimerPanel";
import { UiIcon } from "./components/UiIcon";
import {
  getButtonsForOverlayPage,
  getOverlayPageCounts,
  getOverlayDropPageId,
  getOverlayPageNameForButton,
  isOverlayPageKeyAvailable,
  OVERLAY_ALL_PAGE_KEY,
  OVERLAY_UNCLASSIFIED_PAGE_KEY,
  overlayCustomPageKey,
  overlayPageIdFromKey,
  searchOverlayButtons,
} from "./overlayPages";
import {
  INSTRUCTION_RELOAD_TREE_EVENT,
  INSTRUCTION_WINDOW_SHOW_EVENT,
  openInstructionWindow,
  readLastInstructionPath,
  resetInstructionWindowPosition,
  type InstructionWindowOpenOptions,
} from "./instructionWindow";
import {
  DICTIONARY_VISIBILITY_EVENT,
  openDictionaryWindow,
  toggleDictionaryWindow,
} from "./dictionaryWindow";

type ToastTone = "neutral" | "ok" | "warn" | "error";
type NotesSaveStatus = "saved" | "saving" | "error";

type ActiveView = "main" | "records";
type RecordsDateScope = "today" | "week" | "all";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  leaving: boolean;
};

type WeeklyReviewDisplayProject = {
  summary: WeeklyReviewProjectSummary;
  project?: LauncherProject;
};

type ActiveTimer = {
  sourceId: string;
  projectId: string | null;
  label: string;
  note: string;
  startedAtMs: number;
  startedAt: string;
  targetMinutes: number;
  paused: boolean;
  pausedStartedAtMs: number | null;
  pausedTotalMs: number;
};

type TimerMetrics = {
  elapsedSeconds: number;
  remainingSeconds: number;
};

type ButtonGroup = {
  name: string;
  buttons: LauncherButton[];
};

type LauncherOverlayItem = {
  groupName: string;
  pageName: string;
  button: LauncherButton;
};

type LauncherOverlayPageTab = {
  key: string;
  name: string;
};

type OverlayPageDraft = {
  mode: "add" | "rename";
  pageId?: string;
  name: string;
  assignToButton?: boolean;
};

type DropDialogState = DropButtonDraft & {
  label: string;
  group: string;
  showInSidebar: boolean;
  showInOverlay: boolean;
  overlayPageId: string | null;
};

type ActionDraft = LauncherAction & {
  draftId: string;
};

type ButtonEditDraft = {
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

type ProjectEditDraft = {
  id: string;
  name: string;
  northStar: string;
  weeklyFocus: boolean;
  nextStep: string;
  nextStepTrigger: string;
  buttonIds: string[];
  defaultTimerMinutes: string;
  shortTimerMinutes: string;
  startNoteTemplate: string;
  instructionPath: string;
  instructionOpenOnStart: boolean;
  colorId: ProjectColorId;
  isNew: boolean;
};

type InstructionChoice = {
  path: string;
  label: string;
};

type SettingsCenterDraft = {
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

type SettingsSectionKey = "basic" | "shortcuts" | "instructions" | "backup" | "maintenance";
type ShortcutDraftField =
  | "focusHotkey"
  | "launcherHotkey"
  | "miniHotkey"
  | "instructionHotkey";

const SHORTCUT_DRAFT_FIELDS: ReadonlyArray<{
  field: ShortcutDraftField;
  label: string;
}> = [
  { field: "focusHotkey", label: "メイン呼び出し" },
  { field: "launcherHotkey", label: "辞書" },
  { field: "miniHotkey", label: "ミニモード切替" },
  { field: "instructionHotkey", label: "手順書" },
];

const TOP_MENU_LABELS =
  navigator.language.toLocaleLowerCase().startsWith("en")
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
const TOP_MENU_GROUP_LABELS = {
  window: `${TOP_MENU_LABELS.autoStart} / ${TOP_MENU_LABELS.miniMode}`,
  work: `${TOP_MENU_LABELS.records} / ${TOP_MENU_LABELS.instructions}`,
  support: `${TOP_MENU_LABELS.guide} / ${TOP_MENU_LABELS.settings}`,
};
type MainShellDropEvent = {
  windowLabel: string;
  stage: "dragEnter" | "dragLeave" | "drop" | "error";
  message: string;
  paths: string[];
  url?: string | null;
  label?: string | null;
  shellSpecial?: "recycle_bin" | null;
};

type ManualSessionDraft = {
  projectId: string | null;
  date: string;
  startedAt: string;
  minutes: string;
  note: string;
};

type SessionEditDraft = {
  rowKey: string;
  projectId: string | null;
  label: string;
  date: string;
  startedAt: string;
  minutes: string;
  note: string;
};

type TimerCompletionPrompt = {
  sourceId: string;
  projectId: string | null;
  targetMinutes: number;
  label: string;
};

type TodayBuilderCandidate = {
  key: string;
  text: string;
  source: string;
  trigger?: string;
  projectId?: string;
};

type ContextMenuTarget =
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
      kind: "todayBuilder";
      index: number;
      candidateKey: string;
    }
  | {
      kind: "projects";
    };

type ContextMenuState = ContextMenuTarget & {
  x: number;
  y: number;
};

type InternalButtonDrag = {
  id: string;
  group: string;
};

type SidebarPointerDrag = InternalButtonDrag & {
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type SidebarDragPreview = InternalButtonDrag & {
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
  };
  targetButtonId?: string;
  targetGroupName?: string;
};

type SidebarGroupPointerDrag = {
  group: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type SidebarGroupDragPreview = {
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

type TodayPointerDrag = {
  index: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
};

type ProjectPointerDrag = {
  id: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type ProjectDragPreview = {
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
    height: number;
  };
};

type InboxPointerDrag = {
  index: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type InboxDragPreview = {
  index: number;
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
};

type TodayBuilderPointerDrag = {
  index: number;
  startX: number;
  startY: number;
  hasMoved: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type TodayBuilderDragPreview = {
  index: number;
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
};

type NumberInputDragField =
  | "timer"
  | "settingsDefault"
  | "settingsShort"
  | "settingsDayStart"
  | "projectDefault"
  | "projectShort";

type NumberInputDrag = {
  pointerId: number;
  field: NumberInputDragField;
  startY: number;
  startValue: number;
  moved: boolean;
};

type MiniTimerSnapshot = {
  active: boolean;
  label: string;
  remainingClock: string;
  paused: boolean;
  progressPercent: number;
  projectId: string | null;
  projectName: string;
  projectColorId: ProjectColorId | null;
};

type MiniTimerCommand = {
  action: "pause" | "finish";
};

const ACTION_DRAG_TYPE = "application/x-life-launcher-action";
const OVERLAY_PAGE_DRAG_TYPE = "application/x-life-launcher-overlay-page";
const SIDEBAR_DRAG_THRESHOLD_PX = 6;
const MINI_WINDOW_LABEL = "life-launcher-mini";
const MINI_TIMER_SNAPSHOT_EVENT = "mini-timer-snapshot";
const MINI_TIMER_COMMAND_EVENT = "mini-timer-command";
const MINI_RETURN_EVENT = "mini-return-requested";
const MINI_READY_EVENT = "mini-ready";
const MINI_POSITION_STORAGE_KEY = "life-launcher-mini-position";
const MINI_WINDOW_WIDTH_PX = 288;
const MINI_WINDOW_HEIGHT_PX = 136;
const MINI_WINDOW_SAFE_MARGIN_PX = 16;
const NUMBER_INPUT_DRAG_THRESHOLD_PX = 4;
const NUMBER_INPUT_DRAG_PIXELS_PER_STEP = 8;

function formatActionSummary(results: ActionResult[]): { tone: ToastTone; message: string } {
  const failed = results.filter((result) => !result.ok);
  if (failed.length === 0) {
    return { tone: "ok", message: "起動しました" };
  }

  const first = failed[0];
  return {
    tone: "warn",
    message: `${failed.length}件失敗: ${first.actionType} - ${first.message}`,
  };
}

function limitToday(config: AppConfig): AppConfig {
  return {
    ...config,
    today: {
      ...config.today,
      items: config.today.items.slice(0, TODAY_ITEM_LIMIT),
    },
  };
}

function uniqueSuggestions(candidates: Array<string | null | undefined>, limit: number): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    suggestions.push(text);
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

function isMiniModeView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "mini";
}

function isInstructionView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "instruction";
}

function isDictionaryView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "dictionary";
}

function inactiveMiniSnapshot(): MiniTimerSnapshot {
  return {
    active: false,
    label: "",
    remainingClock: "00:00",
    paused: false,
    progressPercent: 0,
    projectId: null,
    projectName: "",
    projectColorId: null,
  };
}

function readMiniPosition(): MiniWindowPosition | null {
  try {
    const raw = window.localStorage.getItem(MINI_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const position = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (!isFiniteMiniPosition(position)) return null;
    return { x: position.x, y: position.y };
  } catch {
    return null;
  }
}

function writeMiniPosition(x: number, y: number) {
  window.localStorage.setItem(MINI_POSITION_STORAGE_KEY, JSON.stringify({ x, y }));
}

function clearMiniPosition() {
  window.localStorage.removeItem(MINI_POSITION_STORAGE_KEY);
}

function isFiniteMiniPosition(position: {
  x?: unknown;
  y?: unknown;
} | null): position is MiniWindowPosition {
  return (
    typeof position?.x === "number" &&
    typeof position.y === "number" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
  );
}

function monitorWorkArea(monitor: Monitor) {
  return {
    left: monitor.workArea.position.x,
    top: monitor.workArea.position.y,
    right: monitor.workArea.position.x + monitor.workArea.size.width,
    bottom: monitor.workArea.position.y + monitor.workArea.size.height,
  };
}

function isMiniPositionInMonitor(position: MiniWindowPosition, monitor: Monitor): boolean {
  const workArea = monitorWorkArea(monitor);
  return (
    position.x >= workArea.left &&
    position.y >= workArea.top &&
    position.x + MINI_WINDOW_WIDTH_PX <= workArea.right &&
    position.y + MINI_WINDOW_HEIGHT_PX <= workArea.bottom
  );
}

function bottomRightMiniPosition(monitor: Monitor): MiniWindowPosition {
  const workArea = monitorWorkArea(monitor);
  const x = Math.max(
    workArea.left + MINI_WINDOW_SAFE_MARGIN_PX,
    workArea.right - MINI_WINDOW_WIDTH_PX - MINI_WINDOW_SAFE_MARGIN_PX,
  );
  const y = Math.max(
    workArea.top + MINI_WINDOW_SAFE_MARGIN_PX,
    workArea.bottom - MINI_WINDOW_HEIGHT_PX - MINI_WINDOW_SAFE_MARGIN_PX,
  );
  return { x: Math.round(x), y: Math.round(y) };
}

async function resolveSafeMiniPosition(
  savedPosition: MiniWindowPosition | null,
): Promise<MiniWindowPosition> {
  const monitors = await availableMonitors();
  if (
    savedPosition &&
    monitors.some((monitor) => isMiniPositionInMonitor(savedPosition, monitor))
  ) {
    return { x: Math.round(savedPosition.x), y: Math.round(savedPosition.y) };
  }

  const monitor = (await primaryMonitor()) ?? monitors[0];
  return monitor ? bottomRightMiniPosition(monitor) : { x: 16, y: 16 };
}

function waitForMiniWindowCreated(miniWindow: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const rejectOnce = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    void miniWindow.once("tauri://created", resolveOnce).catch((error) => {
      rejectOnce(error instanceof Error ? error.message : String(error));
    });
    void miniWindow.once<unknown>("tauri://error", (event) => {
      rejectOnce(event.payload ? String(event.payload) : "ミニウィンドウの作成に失敗しました");
    }).catch((error) => {
      rejectOnce(error instanceof Error ? error.message : String(error));
    });
  });
}

async function createMiniReadyWaiter(timeoutMs = 10_000): Promise<{
  promise: Promise<void>;
  dispose: () => void;
}> {
  let settled = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timeoutId = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectReady(new Error("ミニウィンドウの準備がタイムアウトしました"));
  }, timeoutMs);
  const unlisten = await listen(MINI_READY_EVENT, () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    resolveReady();
  });

  return {
    promise,
    dispose: () => {
      settled = true;
      window.clearTimeout(timeoutId);
      unlisten();
    },
  };
}

function sameMiniPosition(
  left: MiniWindowPosition | null | undefined,
  right: MiniWindowPosition,
): boolean {
  return left ? Math.round(left.x) === right.x && Math.round(left.y) === right.y : false;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function matchesHotkey(
  event: globalThis.KeyboardEvent,
  hotkey: string | null | undefined,
): boolean {
  const cleanHotkey = hotkey?.trim() || "Ctrl+K";
  const parts = cleanHotkey.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantsCtrl = parts.includes("ctrl");
  const wantsAlt = parts.includes("alt");
  const wantsShift = parts.includes("shift");

  return (
    event.key.toLowerCase() === key &&
    event.ctrlKey === wantsCtrl &&
    event.altKey === wantsAlt &&
    event.shiftKey === wantsShift
  );
}

function formatStartedAt(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function formatDateKeyForHeader(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return dateKey;
  }

  return `${month}月${day}日 ${weekdays[date.getUTCDay()]}曜日`;
}

function isValidStartedAt(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function timerMetrics(timer: ActiveTimer, now: number): TimerMetrics {
  const currentPauseMs =
    timer.paused && timer.pausedStartedAtMs ? now - timer.pausedStartedAtMs : 0;
  const elapsedMs = Math.max(0, now - timer.startedAtMs - timer.pausedTotalMs - currentPauseMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const targetSeconds = timer.targetMinutes * 60;

  return {
    elapsedSeconds,
    remainingSeconds: targetSeconds - elapsedSeconds,
  };
}

function sessionMinutes(timer: ActiveTimer, now: number): number {
  return Math.floor(timerMetrics(timer, now).elapsedSeconds / 60);
}

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUP_COLLAPSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeCollapsedGroups(groups: Record<string, boolean>) {
  window.localStorage.setItem(GROUP_COLLAPSE_STORAGE_KEY, JSON.stringify(groups));
}

function buttonGroupName(button: LauncherButton): string {
  const group = button.group?.trim();
  return group || DEFAULT_BUTTON_GROUP;
}

function showButtonInSidebar(button: LauncherButton): boolean {
  return button.showInSidebar !== false;
}

function showButtonInOverlay(button: LauncherButton): boolean {
  return button.showInOverlay !== false;
}

function aliasesInputToList(input: string): string[] {
  const aliases: string[] = [];
  input
    .split(/[,\n]/)
    .map((alias) => alias.trim())
    .filter(Boolean)
    .forEach((alias) => {
      if (!aliases.includes(alias) && aliases.length < 20) {
        aliases.push(alias);
      }
    });
  return aliases;
}

function aliasesListToInput(aliases: string[] | null | undefined): string {
  return aliases?.join(", ") ?? "";
}

function normalizeOptionalText(input: string): string | undefined {
  const clean = input.trim();
  return clean || undefined;
}

function uniqueGroupNames(config: AppConfig): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string | null | undefined) => {
    const cleanName = name?.trim();
    if (!cleanName || seen.has(cleanName)) return;
    seen.add(cleanName);
    names.push(cleanName);
  };

  config.groups.forEach(add);
  config.buttons.forEach((button) => add(buttonGroupName(button)));
  add(DEFAULT_BUTTON_GROUP);

  return names;
}

function uniqueButtonId(label: string, existingButtons: LauncherButton[]): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "button";
  const existingIds = new Set(existingButtons.map((button) => button.id));
  let id = base;
  let index = 2;
  while (existingIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function toThreeNoteDraft(items: string[]): string[] {
  return Array.from({ length: TODAY_ITEM_LIMIT }, (_, index) => items[index] ?? "");
}

function uniqueProjectId(name: string, existingProjects: LauncherProject[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "project";
  const existingIds = new Set(existingProjects.map((project) => project.id));
  let id = base;
  let index = 2;
  while (existingIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function draftId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toActionDraft(action: LauncherAction): ActionDraft {
  return { ...action, draftId: draftId() } as ActionDraft;
}

function stripActionDraft(action: ActionDraft): LauncherAction {
  const cleanAction = { ...action };
  delete (cleanAction as Partial<ActionDraft>).draftId;
  return cleanAction;
}

function makeAction(type: LauncherAction["type"], value = ""): ActionDraft {
  if (type === "open_url") {
    return { draftId: draftId(), type, payload: { url: value } };
  }

  if (type === "open_shell_special") {
    return { draftId: draftId(), type, payload: { item: "recycle_bin" } };
  }

  return { draftId: draftId(), type, payload: { path: value } };
}

function actionValue(action: LauncherAction): string {
  if (action.type === "open_url") return action.payload.url;
  if (action.type === "open_shell_special") return "ごみ箱";
  return action.payload.path;
}

function setActionValue(action: ActionDraft, value: string): ActionDraft {
  if (action.type === "open_url") {
    return { ...action, payload: { url: value } };
  }

  if (action.type === "open_shell_special") return action;

  return { ...action, payload: { ...action.payload, path: value } };
}

function actionHasSuspiciousPath(action: LauncherAction): boolean {
  if (action.type === "open_url") {
    return !/^https?:\/\//i.test(action.payload.url.trim());
  }

  if (action.type === "open_shell_special") return false;

  const path = action.payload.path.trim();
  return Boolean(path && !/^[a-zA-Z]:[\\/]/.test(path) && !path.startsWith("%"));
}

function iconForAction(action: LauncherAction): string {
  switch (action.type) {
    case "open_app":
      return "▣";
    case "open_folder":
      return "□";
    case "open_url":
      return "↗";
    case "run_script":
      return ">";
    case "open_shell_special":
      return "♻";
    case "open_file":
    default:
      return "◇";
  }
}

function isSafeIconSourcePath(path: string): boolean {
  const cleanPath = path.trim();
  return Boolean(cleanPath) && !/^https?:\/\//i.test(cleanPath);
}

function buttonHasIconCacheSource(button: LauncherButton): boolean {
  if (button.iconSource?.trim()) return isSafeIconSourcePath(button.iconSource);
  return button.actions.some((action) => {
    const value = actionValue(action).trim();
    if (!value) return false;
    return action.type === "open_url" ? /^https?:\/\//i.test(value) : true;
  });
}

function normalizeTimerMinutes(value: number): number {
  return Math.min(240, Math.max(1, Math.round(value)));
}

function formatTodayActivityLog(date: string, entries: SessionEntryRow[]): string {
  const totalMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);
  const projectTotals = new Map<string, { label: string; minutes: number }>();
  entries.forEach((entry) => {
    const key = entry.projectId ?? `label:${entry.label}`;
    const existing = projectTotals.get(key);
    if (existing) {
      existing.minutes += entry.minutes;
    } else {
      projectTotals.set(key, { label: entry.label || "未分類", minutes: entry.minutes });
    }
  });
  const lines = [
    "Life Launcher 今日の活動ログ",
    `日付: ${date}`,
    `集中時間: ${totalMinutes}分`,
    "",
    "活動したプロジェクト・項目",
  ];

  if (projectTotals.size === 0) {
    lines.push("- 記録はまだありません");
  } else {
    projectTotals.forEach((project) => {
      lines.push(`- ${project.label}: ${project.minutes}分`);
    });
  }

  lines.push("", "活動明細");
  if (entries.length === 0) {
    lines.push("- 記録はまだありません");
  } else {
    entries.forEach((entry) => {
      const note = entry.note.trim();
      lines.push(`- ${entry.startedAt} | プロジェクト・項目: ${entry.label || "未分類"} | ${entry.minutes}分 | 次の一手・作業名: ${note || "記録なし"}`);
    });
  }

  return lines.join("\n");
}

function actionDescription(action: LauncherAction): string {
  switch (action.type) {
    case "open_app":
    case "run_script":
      return `${action.type}: ${action.payload.path}`;
    case "open_folder":
    case "open_file":
      return `${action.type}: ${action.payload.path}`;
    case "open_url":
      return `${action.type}: ${action.payload.url}`;
    case "open_shell_special":
      return "Windows特殊項目: ごみ箱";
  }
}

function actionKindLabel(action: LauncherAction | undefined): string {
  switch (action?.type) {
    case "open_app":
      return "アプリ";
    case "open_folder":
      return "フォルダ";
    case "open_file":
      return "ファイル";
    case "open_url":
      return "URL";
    case "run_script":
      return "スクリプト";
    case "open_shell_special":
      return "Windows特殊項目";
    default:
      return "項目";
  }
}

function firstDroppedUrl(text: string): string | null {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && /^https?:\/\//i.test(line)) ?? null
  );
}

const SHORTCUT_PATTERN = /^(?:(?:Ctrl|Alt|Shift|Super|Command)\+)*(?:[A-Za-z0-9]|F(?:[1-9]|1[0-2])|Space)$/i;

function shortcutFromKeyboardEvent(
  event: globalThis.KeyboardEvent,
): string | null | undefined {
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return undefined;

  let key: string | null = null;
  if (/^Key[A-Z]$/.test(event.code)) {
    key = event.code.slice(3);
  } else if (/^Digit[0-9]$/.test(event.code)) {
    key = event.code.slice(5);
  } else if (/^F(?:[1-9]|1[0-2])$/.test(event.key)) {
    key = event.key.toUpperCase();
  } else if (event.code === "Space") {
    key = "Space";
  }
  if (!key) return null;

  const modifiers = [
    event.ctrlKey ? "Ctrl" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    event.metaKey ? "Super" : null,
  ].filter((modifier): modifier is string => Boolean(modifier));
  return [...modifiers, key].join("+");
}

function shortcutValidationMessage(value: string, others: string[]): string {
  const clean = value.trim();
  if (!clean) return "未設定";
  if (!SHORTCUT_PATTERN.test(clean)) return "Ctrl+Kのような形式で入力してください";
  if (others.some((other) => other.trim().toLowerCase() === clean.toLowerCase())) {
    return "競合しています";
  }
  if (["ctrl+esc", "ctrl+alt+delete"].includes(clean.toLowerCase())) {
    return "OS予約キーのため登録できません。別のキーを入力してください";
  }
  return "登録済み（保存時に再登録）";
}

function validateShortcutSettings(draft: SettingsCenterDraft): string | null {
  const values = [
    draft.focusHotkey,
    draft.launcherHotkey,
    draft.miniHotkey,
    draft.instructionHotkey,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const duplicates = values.find((value, index) =>
    values.some((other, otherIndex) => otherIndex !== index && other.toLowerCase() === value.toLowerCase()),
  );
  if (duplicates) return `ショートカットが重複しています: ${duplicates}`;
  const invalid = values.find((value) => !SHORTCUT_PATTERN.test(value));
  if (invalid) return `ショートカットの形式を確認してください: ${invalid}`;
  const reserved = values.find((value) =>
    ["ctrl+esc", "ctrl+alt+delete"].includes(value.toLowerCase()),
  );
  return reserved ? `OS予約キーは登録できません。別のキーを入力してください: ${reserved}` : null;
}

function instructionPathKey(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLocaleLowerCase();
}

function instructionPathWithin(path: string, root: string): boolean {
  const normalizedPath = instructionPathKey(path);
  const normalizedRoot = instructionPathKey(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}\\`);
}

function sidebarDropTargetFromPoint(
  x: number,
  y: number,
  sourceId?: string,
): {
  groupName: string;
  buttonId?: string;
  indicator?: { left: number; top: number; width: number };
} | null {
  const groupElement = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sidebar-group-section]"),
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const groupName = groupElement?.dataset.sidebarGroupSection;
  if (!groupElement || !groupName) return null;

  const allButtons = Array.from(
    groupElement.querySelectorAll<HTMLElement>("[data-sidebar-button-id]"),
  );
  const buttons = allButtons.filter(
    (element) => element.dataset.sidebarButtonId !== sourceId,
  );
  if (buttons.length === 0) return allButtons.length === 0 ? { groupName } : null;

  const target = buttons.reduce((closest, candidate) => {
    const closestRect = closest.getBoundingClientRect();
    const candidateRect = candidate.getBoundingClientRect();
    return Math.abs(y - (candidateRect.top + candidateRect.height / 2)) <
      Math.abs(y - (closestRect.top + closestRect.height / 2))
      ? candidate
      : closest;
  });
  const buttonId = target.dataset.sidebarButtonId;
  if (!buttonId) return { groupName };
  const targetRect = target.getBoundingClientRect();
  return {
    buttonId,
    groupName,
    indicator: {
      left: targetRect.left + 4,
      top: targetRect.bottom + 1,
      width: Math.max(0, targetRect.width - 8),
    },
  };
}

function sidebarGroupDropTargetFromPoint(
  x: number,
  y: number,
): { groupName: string; placement: "before" | "after" } | null {
  const groupElement = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sidebar-group-section]"),
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const groupName = groupElement?.dataset.sidebarGroupSection;
  if (!groupElement || !groupName) return null;

  const rect = groupElement.getBoundingClientRect();
  return {
    groupName,
    placement: y < rect.top + rect.height / 2 ? "before" : "after",
  };
}

function todayDropTargetFromPoint(
  x: number,
  y: number,
): { index: number; placement: "before" | "after" } | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return null;

  const rowElement = element.closest<HTMLElement>("[data-today-index]");
  const index = Number(rowElement?.dataset.todayIndex);
  if (!rowElement || Number.isNaN(index)) return null;

  const rect = rowElement.getBoundingClientRect();
  return {
    index,
    placement: y < rect.top + rect.height / 2 ? "before" : "after",
  };
}

function projectDropTargetFromPoint(
  x: number,
  y: number,
): { id: string; placement: "before" | "after" } | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return nearestProjectDropTargetFromPoint(x, y);

  const cardElement = element.closest<HTMLElement>("[data-project-id]");
  if (!cardElement) return nearestProjectDropTargetFromPoint(x, y);
  return projectDropTargetFromCard(cardElement, x);
}

function projectDropTargetFromCard(
  cardElement: HTMLElement,
  x: number,
): { id: string; placement: "before" | "after" } | null {
  const id = cardElement.dataset.projectId;
  if (!id) return null;
  const rect = cardElement.getBoundingClientRect();
  return {
    id,
    placement: x < rect.left + rect.width / 2 ? "before" : "after",
  };
}

function nearestProjectDropTargetFromPoint(
  x: number,
  y: number,
): { id: string; placement: "before" | "after" } | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-project-id]"));
  if (cards.length === 0) return null;

  const nearest = cards.reduce<{ card: HTMLElement; distance: number } | null>((best, card) => {
    const rect = card.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) {
      return { card, distance };
    }
    return best;
  }, null);

  return nearest ? projectDropTargetFromCard(nearest.card, x) : null;
}

function inboxDropTargetFromPoint(
  x: number,
  y: number,
): { index: number; placement: "before" | "after"; indicator: { left: number; top: number; width: number } } | null {
  const row = Array.from(
    document.querySelectorAll<HTMLElement>("[data-inbox-index]"),
  ).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  if (!row) return null;

  const index = Number(row.dataset.inboxIndex);
  if (Number.isNaN(index)) return null;
  const rect = row.getBoundingClientRect();
  const placement = y < rect.top + rect.height / 2 ? "before" : "after";
  return {
    index,
    placement,
    indicator: {
      left: rect.left + 6,
      top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
      width: Math.max(0, rect.width - 12),
    },
  };
}

function todayBuilderDropTargetFromPoint(
  x: number,
  y: number,
): { index: number; placement: "before" | "after"; indicator: { left: number; top: number; width: number } } | null {
  const row = Array.from(
    document.querySelectorAll<HTMLElement>("[data-today-builder-index]"),
  ).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  if (!row) return null;

  const index = Number(row.dataset.todayBuilderIndex);
  if (Number.isNaN(index)) return null;
  const rect = row.getBoundingClientRect();
  const placement = y < rect.top + rect.height / 2 ? "before" : "after";
  return {
    index,
    placement,
    indicator: {
      left: rect.left + 6,
      top: placement === "before" ? rect.top - 2 : rect.bottom + 1,
      width: Math.max(0, rect.width - 12),
    },
  };
}

function projectDropIndicator(
  id: string,
  placement: "before" | "after",
): { left: number; top: number; height: number } | undefined {
  const card = document.querySelector<HTMLElement>(`[data-project-id="${CSS.escape(id)}"]`);
  if (!card) return undefined;
  const rect = card.getBoundingClientRect();
  return {
    left: placement === "before" ? rect.left - 2 : rect.right - 1,
    top: rect.top + 6,
    height: Math.max(0, rect.height - 12),
  };
}

function isReorderBlockedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, textarea, select, a, [role='button']"))
  );
}

async function notifyTimerComplete(label: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification("Life Launcher", {
      body: `${label} が満了しました`,
    });
  }
}

function MiniModeApp() {
  const [snapshot, setSnapshot] = useState<MiniTimerSnapshot>(inactiveMiniSnapshot);
  const miniWindow = useMemo(() => WebviewWindow.getCurrent(), []);

  useEffect(() => {
    const unlisten = listen<MiniTimerSnapshot>(MINI_TIMER_SNAPSHOT_EVENT, (event) => {
      setSnapshot(event.payload);
    });
    void emit(MINI_READY_EVENT);

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const unlisten = miniWindow.onMoved((event) => {
      writeMiniPosition(event.payload.x, event.payload.y);
    });

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, [miniWindow]);

  const sendCommand = (action: MiniTimerCommand["action"]) => {
    void emit(MINI_TIMER_COMMAND_EVENT, { action } satisfies MiniTimerCommand);
  };

  const startMiniDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    void miniWindow.startDragging().catch(() => undefined);
  };

  const requestMainFromMini = () => {
    void emit(MINI_RETURN_EVENT).catch(() => undefined);
  };

  return (
    <main className="miniShell" onDoubleClick={requestMainFromMini} onPointerDown={startMiniDrag}>
      <div className="miniTopline">
        <span>ミニタイマー</span>
        <div className="miniToplineActions">
          <button
            aria-label="メイン画面に戻る"
            className="miniExpandButton"
            onClick={requestMainFromMini}
            title="メイン画面に戻る"
            type="button"
          >
            <UiIcon name="external" size={16} />
          </button>
          <button
            aria-label="ミニ画面を閉じる"
            className="miniCloseButton"
            onClick={requestMainFromMini}
            title="ミニ画面を閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>
      </div>
      <TimerPanel
        active={snapshot.active}
        clock={snapshot.remainingClock}
        identity={
          snapshot.projectId ? (
            <ProjectIdentity
              colorId={snapshot.projectColorId}
              compact
              name={snapshot.projectName}
              projectId={snapshot.projectId}
            />
          ) : undefined
        }
        label={snapshot.active ? snapshot.label : "待機中"}
        onFinish={() => sendCommand("finish")}
        onPause={() => sendCommand("pause")}
        paused={snapshot.paused}
        progressPercent={snapshot.progressPercent}
        state={snapshot.active ? (snapshot.paused ? "paused" : "running") : "waiting"}
        status={snapshot.active ? (snapshot.paused ? "一時停止中" : "実行中") : "待機中"}
        variant="mini"
      />
    </main>
  );
}

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
  const [backupPath, setBackupPath] = useState("");
  const [todaySessionMinutes, setTodaySessionMinutes] = useState(0);
  const [morningVictorySuggestion, setMorningVictorySuggestion] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dictionaryVisible, setDictionaryVisible] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [todayDraft, setTodayDraft] = useState("");
  const [todayEditingIndex, setTodayEditingIndex] = useState<number | null>(null);
  const [todayTriggerEditingIndex, setTodayTriggerEditingIndex] = useState<number | null>(null);
  const [todayTriggerDraft, setTodayTriggerDraft] = useState("");
  const [todayAddOpen, setTodayAddOpen] = useState(false);

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
    });
    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);
  const [defaultTimerDraft, setDefaultTimerDraft] = useState("");
  const [victoryEditing, setVictoryEditing] = useState(false);
  const [inboxDraft, setInboxDraft] = useState("");
  const [inboxAddOpen, setInboxAddOpen] = useState(false);
  const [inboxEditingIndex, setInboxEditingIndex] = useState<number | null>(null);
  const [inboxEditDraft, setInboxEditDraft] = useState("");
  const [inboxEditProjectId, setInboxEditProjectId] = useState("");
  const [inboxEditButtonIds, setInboxEditButtonIds] = useState<string[]>([]);
  const [inboxEditInstructionPath, setInboxEditInstructionPath] = useState("");
  const [inboxEditInstructionOpenOnStart, setInboxEditInstructionOpenOnStart] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [todayBuilderOpen, setTodayBuilderOpen] = useState(false);
  const [todayBuilderDestinations, setTodayBuilderDestinations] = useState<Record<string, string>>({});
  const [todayBuilderAddOpen, setTodayBuilderAddOpen] = useState(false);
  const [todayBuilderDraft, setTodayBuilderDraft] = useState("");
  const [todayBuilderPointerDrag, setTodayBuilderPointerDrag] = useState<TodayBuilderDragPreview | null>(null);
  const [todayActivityOpen, setTodayActivityOpen] = useState(false);
  const [, setNotesSaveStatus] = useState<NotesSaveStatus>("saved");
  const [launcherOverlayOpen, setLauncherOverlayOpen] = useState(false);
  const [launcherSearch, setLauncherSearch] = useState("");
  const [launcherSelectedIndex, setLauncherSelectedIndex] = useState(0);
  const [selectedOverlayPageKey, setSelectedOverlayPageKey] = useState(OVERLAY_ALL_PAGE_KEY);
  const [launcherTabScrollState, setLauncherTabScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const [buttonIconSources, setButtonIconSources] = useState<Record<string, string>>({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryResponse | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewResponse | null>(null);
  const [staleNextStepProjectIds, setStaleNextStepProjectIds] = useState<string[]>([]);
  const [weeklyReviewBannerOpen, setWeeklyReviewBannerOpen] = useState(false);
  const [doNowResponse, setDoNowResponse] = useState<DoNowResponse | null>(null);
  const [doNowCandidateIndex, setDoNowCandidateIndex] = useState(0);
  const [sessionEntries, setSessionEntries] = useState<SessionEntriesResponse | null>(null);
  const [todayActivityEntries, setTodayActivityEntries] = useState<SessionEntryRow[]>([]);
  const [todayActivityDate, setTodayActivityDate] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionProjectFilter, setSessionProjectFilter] = useState("");
  const [sessionDateScope, setSessionDateScope] = useState<RecordsDateScope>("week");
  const [notesHistory, setNotesHistory] = useState<NotesHistoryResponse | null>(null);
  const [completionNextStepSuggestions, setCompletionNextStepSuggestions] = useState<string[]>([]);
  const [projectNextStepSuggestions, setProjectNextStepSuggestions] = useState<string[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const timerStartRequestRef = useRef(0);
  const activeTimerRef = useRef<ActiveTimer | null>(null);
  const [completionPrompt, setCompletionPrompt] = useState<TimerCompletionPrompt | null>(null);
  const [now, setNow] = useState(Date.now());
  const [collapsedGroups, setCollapsedGroups] =
    useState<Record<string, boolean>>(readCollapsedGroups);
  const [dropDraft, setDropDraft] = useState<DropDialogState | null>(null);
  const [groupDraft, setGroupDraft] = useState<string | null>(null);
  const [groupRenameDraft, setGroupRenameDraft] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [overlayPageDraft, setOverlayPageDraft] = useState<OverlayPageDraft | null>(null);
  const [overlayPageDragId, setOverlayPageDragId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsCenterDraft | null>(null);
  const [shortcutRecordingField, setShortcutRecordingField] =
    useState<ShortcutDraftField | null>(null);
  const [helpGuideOpen, setHelpGuideOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionKey>("basic");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogRequest | null>(null);
  const [manualSessionDraft, setManualSessionDraft] = useState<ManualSessionDraft | null>(null);
  const [sessionEditDraft, setSessionEditDraft] = useState<SessionEditDraft | null>(null);
  const [buttonEditDraft, setButtonEditDraft] = useState<ButtonEditDraft | null>(null);
  const [buttonEditInitialDraft, setButtonEditInitialDraft] = useState<ButtonEditDraft | null>(null);
  const [projectEditDraft, setProjectEditDraft] = useState<ProjectEditDraft | null>(null);
  const [instructionChoices, setInstructionChoices] = useState<InstructionChoice[]>([]);
  const [instructionChoicesLoading, setInstructionChoicesLoading] = useState(false);
  const [instructionChoicesError, setInstructionChoicesError] = useState<string | null>(null);
  const [instructionSettingsBusy, setInstructionSettingsBusy] = useState(false);
  const [dailyActivityCopying, setDailyActivityCopying] = useState(false);
  const [sidebarPointerDrag, setSidebarPointerDrag] = useState<SidebarDragPreview | null>(null);
  const [sidebarGroupPointerDrag, setSidebarGroupPointerDrag] = useState<SidebarGroupDragPreview | null>(null);
  const [todayPointerDrag, setTodayPointerDrag] = useState<number | null>(null);
  const [projectPointerDrag, setProjectPointerDrag] = useState<ProjectDragPreview | null>(null);
  const [inboxPointerDrag, setInboxPointerDrag] = useState<InboxDragPreview | null>(null);
  const [miniTransitioning, setMiniTransitioning] = useState(false);
  const [numberInputDragging, setNumberInputDragging] = useState<NumberInputDragField | null>(null);
  const [actionDragId, setActionDragId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const sidebarPointerDragRef = useRef<SidebarPointerDrag | null>(null);
  const sidebarGroupPointerDragRef = useRef<SidebarGroupPointerDrag | null>(null);
  const todayPointerDragRef = useRef<TodayPointerDrag | null>(null);
  const projectPointerDragRef = useRef<ProjectPointerDrag | null>(null);
  const inboxPointerDragRef = useRef<InboxPointerDrag | null>(null);
  const todayBuilderPointerDragRef = useRef<TodayBuilderPointerDrag | null>(null);
  const mainScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const projectAutoScrollFrameRef = useRef<number | null>(null);
  const projectAutoScrollSpeedRef = useRef(0);
  const numberInputDragRef = useRef<NumberInputDrag | null>(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<
    Map<number, { dismissTimer: number; removeTimer: number | null }>
  >(new Map());
  const lastBackupErrorRef = useRef<string | null>(null);
  const lastSettingsApplyErrorRef = useRef<string | null>(null);
  const shortcutCaptureActiveRef = useRef(false);
  const victoryInputRef = useRef<HTMLInputElement | null>(null);
  const launcherSearchRef = useRef<HTMLInputElement | null>(null);
  const launcherOverlayOpenerRef = useRef<HTMLElement | null>(null);
  const launcherOverlayTabsRef = useRef<HTMLDivElement | null>(null);
  const launcherPageTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const launcherPageAddRef = useRef<HTMLButtonElement | null>(null);
  const overlayPageDialogOpenerRef = useRef<HTMLElement | null>(null);
  const contextMenuReturnFocusRef = useRef<HTMLElement | null>(null);
  const confirmFocusReturnRef = useRef<HTMLElement | null>(null);
  const morningFocusDateRef = useRef<string | null>(null);
  const miniWindowRef = useRef<WebviewWindow | null>(null);
  const miniModeOpenRef = useRef(false);
  const miniTransitioningRef = useRef(false);
  const miniSnapshotRef = useRef<MiniTimerSnapshot>(inactiveMiniSnapshot());
  const iconRequestIdsRef = useRef<Set<string>>(new Set());
  const notesSaveTimersRef = useRef<Map<string, number>>(new Map());

  const requestConfirmation = useCallback((request: ConfirmDialogRequest) => {
    setConfirmDialog((current) => current ?? request);
  }, []);

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

  const openLauncherOverlay = useCallback((opener?: HTMLElement | null) => {
    launcherOverlayOpenerRef.current =
      opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setLauncherOverlayOpen(true);
  }, []);

  const closeLauncherOverlay = useCallback((restoreFocus = true) => {
    const returnTarget = launcherOverlayOpenerRef.current;
    launcherOverlayOpenerRef.current = null;
    setLauncherOverlayOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    }
  }, []);
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
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenu(target, rect.left, rect.bottom + 4, event.currentTarget);
    },
    [openContextMenu],
  );

  const closeConfirmDialog = useCallback(() => {
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

  const weeklyReviewProjects = useMemo<WeeklyReviewDisplayProject[]>(() => {
    if (!config || !weeklyReview) return [];
    const summariesByProjectId = new Map(
      weeklyReview.projects
        .filter((summary) => summary.projectId)
        .map((summary) => [summary.projectId as string, summary]),
    );
    const ordered = config.projects.flatMap((project) => {
      const summary = summariesByProjectId.get(project.id);
      return summary ? [{ summary, project }] : [];
    });
    const knownIds = new Set(config.projects.map((project) => project.id));
    const unmatched = weeklyReview.projects
      .filter((summary) => !summary.projectId || !knownIds.has(summary.projectId))
      .map((summary) => ({ summary }));
    return [...ordered, ...unmatched];
  }, [config, weeklyReview]);

  const staleNextStepProjects = useMemo(() => {
    if (!config) return [];
    const staleIds = new Set(staleNextStepProjectIds);
    return config.projects.filter(
      (project) => staleIds.has(project.id) && project.nextStep.trim(),
    );
  }, [config, staleNextStepProjectIds]);

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
  const visibleSidebarButtonGroups = useMemo(
    () =>
      buttonGroups
        .map((group) => ({
          name: group.name,
          buttons: group.buttons.filter(showButtonInSidebar),
        }))
        .filter((group) => group.buttons.length > 0),
    [buttonGroups],
  );
  const visibleSidebarButtons = useMemo(
    () => visibleSidebarButtonGroups.flatMap((group) => group.buttons),
    [visibleSidebarButtonGroups],
  );
  const dictionaryOnlyButtons = useMemo(
    () =>
      (config?.buttons ?? []).filter(
        (button) => showButtonInOverlay(button) && !showButtonInSidebar(button),
      ),
    [config?.buttons],
  );
  const projectSelectableButtons = useMemo(
    () =>
      (config?.buttons ?? []).filter(
        (button) => showButtonInSidebar(button) || showButtonInOverlay(button),
      ),
    [config?.buttons],
  );
  const overlayPages = useMemo(() => config?.overlayPages ?? [], [config?.overlayPages]);
  const overlayPageCounts = useMemo(
    () => getOverlayPageCounts(config?.buttons ?? [], overlayPages),
    [config?.buttons, overlayPages],
  );
  const launcherOverlayPageTabs = useMemo<LauncherOverlayPageTab[]>(
    () => [
      { key: OVERLAY_ALL_PAGE_KEY, name: "すべて" },
      { key: OVERLAY_UNCLASSIFIED_PAGE_KEY, name: "未分類" },
      ...overlayPages.map((page) => ({ key: overlayCustomPageKey(page.id), name: page.name })),
    ],
    [overlayPages],
  );
  const selectedOverlayPageButtons = useMemo(
    () =>
      getButtonsForOverlayPage(
        config?.buttons ?? [],
        selectedOverlayPageKey,
        overlayPages,
        config?.dictionaryOrder,
      ),
    [config?.buttons, config?.dictionaryOrder, overlayPages, selectedOverlayPageKey],
  );
  const launcherOverlayItems = useMemo<LauncherOverlayItem[]>(() => {
    return searchOverlayButtons(
      config?.buttons ?? [],
      overlayPages,
      launcherSearch,
      config?.dictionaryOrder,
    ).map(
      (button) => ({
        groupName: buttonGroupName(button),
        pageName: getOverlayPageNameForButton(button, overlayPages),
        button,
      }),
    );
  }, [config?.buttons, config?.dictionaryOrder, launcherSearch, overlayPages]);
  const launcherDisplayedItems = useMemo<LauncherOverlayItem[]>(
    () =>
      launcherSearch.trim()
        ? launcherOverlayItems
        : selectedOverlayPageButtons.map((button) => ({
            groupName: buttonGroupName(button),
            pageName: getOverlayPageNameForButton(button, overlayPages),
            button,
          })),
    [launcherOverlayItems, launcherSearch, overlayPages, selectedOverlayPageButtons],
  );
  const timerProgressPercent =
    activeTimer && currentTimerMetrics
      ? Math.min(
          100,
          Math.max(
            0,
            (currentTimerMetrics.elapsedSeconds / (activeTimer.targetMinutes * 60)) * 100,
          ),
        )
      : 0;
  const miniSnapshot = useMemo<MiniTimerSnapshot>(() => {
    if (!activeTimer) return inactiveMiniSnapshot();
    const project = activeTimer.projectId
      ? config?.projects.find((item) => item.id === activeTimer.projectId)
      : undefined;
    const metrics = timerMetrics(activeTimer, now);
    const progressPercent = Math.min(
      100,
      Math.max(0, (metrics.elapsedSeconds / (activeTimer.targetMinutes * 60)) * 100),
    );

    return {
      active: true,
      label: activeTimer.label,
      remainingClock: formatClock(Math.max(0, metrics.remainingSeconds)),
      paused: activeTimer.paused,
      progressPercent,
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      projectColorId: project?.colorId ?? null,
    };
  }, [activeTimer, config?.projects, now]);
  miniSnapshotRef.current = miniSnapshot;

  const showToast = useCallback((tone: ToastTone, message: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current, { id, tone, message, leaving: false }]);

    const dismissTimer = window.setTimeout(() => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
      );
      const removeTimer = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        toastTimersRef.current.delete(id);
      }, 200);
      const timers = toastTimersRef.current.get(id);
      if (timers) timers.removeTimer = removeTimer;
    }, TOAST_TIMEOUT_MS);

    toastTimersRef.current.set(id, { dismissTimer, removeTimer: null });
  }, []);

  const refreshButtonIcon = useCallback(
    async (button: LauncherButton, force = false) => {
      if (!buttonHasIconCacheSource(button)) return;
      if (iconRequestIdsRef.current.has(button.id)) return;

      iconRequestIdsRef.current.add(button.id);
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
        if (force) {
          setButtonIconSources((current) => {
            const next = { ...current };
            delete next[button.id];
            return next;
          });
        }
      } finally {
        iconRequestIdsRef.current.delete(button.id);
      }
    },
    [],
  );

  const refreshDoNow = useCallback(async () => {
    try {
      const response = await loadDoNowCandidates();
      setDoNowResponse(response);
      setDoNowCandidateIndex((current) =>
        response.candidates.length > 0 ? Math.min(current, response.candidates.length - 1) : 0,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `今やる一手を読めません: ${message}`);
    }
  }, [showToast]);

  const refreshSessions = useCallback(async () => {
    try {
      const [response, doNow] = await Promise.all([
        loadTodaySessionTotal(),
        loadDoNowCandidates(),
      ]);
      setTodaySessionMinutes(response.totalMinutes);
      setDoNowResponse(doNow);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `セッションを読めません: ${message}`);
    }
  }, [showToast]);

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
    if (window.localStorage.getItem(WEEKLY_REVIEW_SEEN_STORAGE_KEY) !== response.weekKey) {
      window.localStorage.setItem(WEEKLY_REVIEW_SEEN_STORAGE_KEY, response.weekKey);
      setWeeklyReviewBannerOpen(true);
    }
  }, []);

  const refreshWeeklyReview = useCallback(async () => {
    try {
      const [review, freshness] = await Promise.all([
        loadWeeklyReview(),
        loadNextStepFreshness(),
      ]);
      applyWeeklyReview(review);
      setStaleNextStepProjectIds(freshness.staleProjectIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `先週のふりかえりを読めません: ${message}`);
    }
  }, [applyWeeklyReview, showToast]);

  const refreshRecords = useCallback(async () => {
    try {
      const [summary, entries, history, review, freshness] = await Promise.all([
        loadSessionSummary(),
        loadSessionEntries({
          query: sessionSearch,
          projectId: sessionProjectFilter || null,
          dateScope: sessionDateScope,
        }),
        loadNotesHistory(),
        loadWeeklyReview(),
        loadNextStepFreshness(),
      ]);
      setSessionSummary(summary);
      setSessionEntries(entries);
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

  const refreshNextStepSuggestions = useCallback(
    async (projectId: string | null | undefined, target: "completion" | "project") => {
      if (!projectId) {
        if (target === "completion") {
          setCompletionNextStepSuggestions([]);
        } else {
          setProjectNextStepSuggestions([]);
        }
        return;
      }

      try {
        const suggestions = await loadNextStepSuggestions(projectId);
        if (target === "completion") {
          setCompletionNextStepSuggestions(suggestions);
        } else {
          setProjectNextStepSuggestions(suggestions);
        }
      } catch {
        if (target === "completion") {
          setCompletionNextStepSuggestions([]);
        } else {
          setProjectNextStepSuggestions([]);
        }
      }
    },
    [],
  );

  const refreshConfig = useCallback(
    async (toastOnSuccess = false) => {
      try {
        const response = await loadConfig();
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
        let settingsApplyFailed = false;
        try {
          await reapplyDashboardSettings();
          lastSettingsApplyErrorRef.current = null;
        } catch (error) {
          settingsApplyFailed = true;
          const message = error instanceof Error ? error.message : String(error);
          if (message !== lastSettingsApplyErrorRef.current) {
            lastSettingsApplyErrorRef.current = message;
            showToast(
              "warn",
              `設定は読み込みました。ショートカットを登録できません: ${message}`,
            );
          }
        }
        await refreshSessions();
        await refreshTodayActivity();
        if (toastOnSuccess && !settingsApplyFailed) {
          showToast("ok", "設定を再読み込みしました");
        }
      } catch (error) {
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

  useEffect(() => {
    void refreshConfig();
    const unlisten = listenForConfigChanges(() => {
      window.setTimeout(() => void refreshConfig(true), 250);
    });
    const notesSaveTimers = notesSaveTimersRef.current;
    const toastTimers = toastTimersRef.current;

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
      toastTimers.forEach(({ dismissTimer, removeTimer }) => {
        window.clearTimeout(dismissTimer);
        if (removeTimer !== null) window.clearTimeout(removeTimer);
      });
      toastTimers.clear();
      notesSaveTimers.forEach((timer) => window.clearTimeout(timer));
      notesSaveTimers.clear();
    };
  }, [refreshConfig]);

  useEffect(() => {
    if (!todayBuilderAddOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>("[data-today-builder-add-input]")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [todayBuilderAddOpen]);

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
    setVictoryEditing(true);
    window.requestAnimationFrame(() => {
      victoryInputRef.current?.focus();
      victoryInputRef.current?.select();
    });
  }, [activeView, config]);

  useEffect(() => {
    if (!activeTimer) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [activeTimer]);

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

  useEffect(() => {
    void refreshNextStepSuggestions(completionPrompt?.projectId, "completion");
  }, [completionPrompt?.projectId, refreshNextStepSuggestions]);

  const persistConfig = useCallback(
    async (nextConfig: AppConfig) => {
      const safeConfig = limitToday(nextConfig);
      setConfig(safeConfig);
      try {
        const response = await saveConfig(safeConfig);
        setConfig(response.config);
        setBanner(null);
        await reapplyDashboardSettings();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setBanner(message);
        showToast("error", `保存できません: ${message}`);
        return false;
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

  const ensureMiniWindow = useCallback(async (shouldShow = true) => {
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
  }, [configuredMiniPosition]);

  const openMiniMode = useCallback(async () => {
    if (!config?.settings.miniMode) {
      showToast("warn", "設定でミニモードを有効にしてください");
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
      showToast("warn", `ミニモードを開けません (${stage}): ${message}`);
    }
  }, [config?.settings.miniMode, ensureMiniWindow, miniSnapshot, showToast]);

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
        void returnToMain().catch((error) => console.error("[mini-mode] メイン復帰に失敗しました", error));
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
  }, [openInstructionsManually, returnToMain, toggleDictionaryFromShortcut, toggleMiniMode]);

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
    const parsed =
      typeof rawValue === "number" ? rawValue : Number.parseInt(rawValue.trim(), 10);
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
    showToast("ok", `通常タイマーを${minutes}分にしました`);
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
      await navigator.clipboard.writeText(
        formatTodayActivityLog(sessions.date, sessions.entries),
      );
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
      defaultTimerMinutes: String(config.settings.defaultTimerMinutes),
      shortTimerMinutes: String(config.settings.shortTimerMinutes),
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
      (settingsDraft.defaultTimerMinutes !== String(config.settings.defaultTimerMinutes) ||
        settingsDraft.shortTimerMinutes !== String(config.settings.shortTimerMinutes) ||
        settingsDraft.dayStartHour !== String(config.settings.dayStartHour) ||
        settingsDraft.focusHotkey !== (config.settings.focusHotkey ?? "") ||
        settingsDraft.launcherHotkey !== (config.settings.launcherHotkey ?? "") ||
        settingsDraft.miniHotkey !== (config.settings.miniHotkey ?? "") ||
        settingsDraft.instructionHotkey !== (config.settings.instructionHotkey ?? "") ||
        JSON.stringify(settingsDraft.instructionFolders) !==
          JSON.stringify(config.settings.instructionFolders) ||
        JSON.stringify(settingsDraft.weeklyFocusProjectIds) !==
          JSON.stringify(
            config.projects.filter((project) => project.weeklyFocus === true).map((project) => project.id),
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
      requestConfirmation({
        title: "変更を破棄しますか？",
        message: "保存していない設定内容は失われます。",
        confirmLabel: "破棄して閉じる",
        cancelLabel: "編集を続ける",
        tone: "danger",
        onConfirm: () => setSettingsDraft(null),
      });
      return;
    }
    setSettingsDraft(null);
  }, [requestConfirmation, settingsHaveUnsavedChanges]);

  const requestCloseButtonEdit = useCallback(() => {
    if (!buttonEditDraft) return;
    const hasChanges =
      !buttonEditInitialDraft ||
      JSON.stringify(buttonEditDraft) !== JSON.stringify(buttonEditInitialDraft);
    if (hasChanges) {
      requestConfirmation({
        title: "変更を破棄しますか？",
        message: "保存していないボタン編集内容は失われます。",
        confirmLabel: "破棄して閉じる",
        cancelLabel: "編集を続ける",
        tone: "danger",
        onConfirm: () => {
          setButtonEditDraft(null);
          setButtonEditInitialDraft(null);
        },
      });
      return;
    }
    setButtonEditDraft(null);
    setButtonEditInitialDraft(null);
  }, [buttonEditDraft, buttonEditInitialDraft, requestConfirmation]);

  const closeOverlayPageDialog = useCallback(() => {
    setOverlayPageDraft(null);
    const opener = overlayPageDialogOpenerRef.current;
    overlayPageDialogOpenerRef.current = null;
    window.requestAnimationFrame(() => opener?.focus());
  }, []);

  const dismissNonCriticalModal = useCallback(() => {
    if (inboxEditingIndex !== null) {
      setInboxEditingIndex(null);
      setInboxEditDraft("");
      setInboxEditProjectId("");
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
    if (overlayPageDraft) {
      closeOverlayPageDialog();
      return;
    }
    if (buttonEditDraft) {
      requestCloseButtonEdit();
      return;
    }
    if (projectEditDraft) {
      setProjectEditDraft(null);
      return;
    }
    if (groupRenameDraft) {
      setGroupRenameDraft(null);
      return;
    }
    if (groupDraft !== null) setGroupDraft(null);
  }, [
    buttonEditDraft,
    closeOverlayPageDialog,
    dropDraft,
    groupDraft,
    groupRenameDraft,
    helpGuideOpen,
    inboxEditingIndex,
    manualSessionDraft,
    overlayPageDraft,
    projectEditDraft,
    requestCloseButtonEdit,
    requestCloseSettings,
    sessionEditDraft,
    settingsDraft,
  ]);

  const hasDismissibleModal = Boolean(
    inboxEditingIndex !== null ||
      helpGuideOpen ||
      settingsDraft ||
      dropDraft ||
      sessionEditDraft ||
      manualSessionDraft ||
      buttonEditDraft ||
      projectEditDraft ||
      groupRenameDraft ||
      overlayPageDraft ||
      groupDraft !== null,
  );

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || completionPrompt || confirmDialog || !hasDismissibleModal) return;
      event.preventDefault();
      dismissNonCriticalModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [completionPrompt, confirmDialog, dismissNonCriticalModal, hasDismissibleModal]);

  useEffect(() => {
    const closeOnBackdrop = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.classList.contains("modalBackdrop")) {
        return;
      }
      if (confirmDialog) return;
      if (!completionPrompt) dismissNonCriticalModal();
    };
    document.addEventListener("click", closeOnBackdrop);
    return () => document.removeEventListener("click", closeOnBackdrop);
  }, [completionPrompt, confirmDialog, dismissNonCriticalModal]);

  useEffect(() => {
    if (
      confirmDialog ||
      helpGuideOpen ||
      (!hasDismissibleModal && !completionPrompt && !launcherOverlayOpen)
    ) {
      return;
    }

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const topSurface = () => {
      const surfaces = document.querySelectorAll<HTMLElement>(
        ".modalBackdrop, .launcherOverlayBackdrop",
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
      (focusableInside(surface)[0] ?? surface).focus();
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
  }, [completionPrompt, confirmDialog, hasDismissibleModal, helpGuideOpen, launcherOverlayOpen]);

  const setNumberDragValue = (field: NumberInputDragField, value: number) => {
    if (field === "timer") {
      setDefaultTimerDraft(String(value));
      return;
    }
    if (field === "projectDefault" || field === "projectShort") {
      if (!projectEditDraft) return;
      setProjectEditDraft({
        ...projectEditDraft,
        [field === "projectDefault" ? "defaultTimerMinutes" : "shortTimerMinutes"]: String(value),
      });
      return;
    }
    if (!settingsDraft) return;
    if (field === "settingsDefault") {
      setSettingsDraft({ ...settingsDraft, defaultTimerMinutes: String(value) });
    } else if (field === "settingsShort") {
      setSettingsDraft({ ...settingsDraft, shortTimerMinutes: String(value) });
    } else {
      setSettingsDraft({ ...settingsDraft, dayStartHour: String(value) });
    }
  };

  const startNumberInputDrag = (
    event: PointerEvent<HTMLLabelElement>,
    field: NumberInputDragField,
    value: number,
  ) => {
    if (event.button !== 0) return;
    numberInputDragRef.current = {
      pointerId: event.pointerId,
      field,
      startY: event.clientY,
      startValue: value,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateNumberInputDrag = (event: PointerEvent<HTMLLabelElement>) => {
    const drag = numberInputDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.abs(event.clientY - drag.startY);
    if (!drag.moved && distance < NUMBER_INPUT_DRAG_THRESHOLD_PX) return;

    drag.moved = true;
    const max = drag.field === "settingsDayStart" ? 23 : 240;
    const min = drag.field === "settingsDayStart" ? 0 : 1;
    const value = Math.min(
      max,
      Math.max(min, drag.startValue + Math.round((drag.startY - event.clientY) / NUMBER_INPUT_DRAG_PIXELS_PER_STEP)),
    );
    setNumberDragValue(drag.field, value);
    setNumberInputDragging(drag.field);
    event.preventDefault();
  };

  const finishNumberInputDrag = (event: PointerEvent<HTMLLabelElement>) => {
    const drag = numberInputDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    numberInputDragRef.current = null;
    setNumberInputDragging(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;

    const max = drag.field === "settingsDayStart" ? 23 : 240;
    const min = drag.field === "settingsDayStart" ? 0 : 1;
    const value = Math.min(
      max,
      Math.max(min, drag.startValue + Math.round((drag.startY - event.clientY) / NUMBER_INPUT_DRAG_PIXELS_PER_STEP)),
    );
    if (drag.field === "timer") {
      void saveDefaultTimerMinutes(value);
    }
  };

  const cancelNumberInputDrag = (event: PointerEvent<HTMLLabelElement>) => {
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
          project.instructionPath && instructionPathWithin(project.instructionPath, path),
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
          showToast("ok", "手順書フォルダの登録を解除しました");
          return true;
        } catch (error) {
          throw new Error(
            `登録を解除できません: ${error instanceof Error ? error.message : String(error)}`,
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
    const shortcutError = validateShortcutSettings(settingsDraft);
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
    const dayStartHour = Math.min(
      23,
      Math.max(0, Math.round(Number.parseInt(settingsDraft.dayStartHour, 10))),
    );
    const keep = Number.parseInt(settingsDraft.backupKeep, 10);
    const backupKeep = Number.isFinite(keep) && keep > 0 ? keep : 30;

    try {
      if (settingsDraft.autoStart !== config.settings.autoStart) {
        if (settingsDraft.autoStart) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      }

      const previousConfig = config;
      const weeklyFocusIds = new Set(settingsDraft.weeklyFocusProjectIds);
      const saved = await persistConfig({
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
          defaultTimerMinutes,
          shortTimerMinutes,
          dayStartHour: Number.isFinite(dayStartHour) ? dayStartHour : config.settings.dayStartHour,
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
      });
      if (!saved) {
        try {
          const restored = await saveConfig(previousConfig);
          setConfig(restored.config);
          await reapplyDashboardSettings();
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
      setDefaultTimerDraft(String(defaultTimerMinutes));
      await emit(INSTRUCTION_RELOAD_TREE_EVENT);
      setSettingsDraft(null);
      showToast("ok", "設定を保存しました");
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
    try {
      const response = await restoreBackup(zipPath);
      setConfig(response.config);
      setMorningVictorySuggestion(response.morningVictorySuggestion ?? null);
      setBackupPath(response.backupPath);
      setBanner(response.error ?? null);
      setActiveTimer(null);
      setCompletionPrompt(null);
      await reapplyDashboardSettings();
      await refreshSessions();
      await refreshTodayActivity();
      if (activeView === "records") {
        await refreshRecords();
      }
      setSettingsDraft(null);
      showToast("ok", "バックアップから復元しました");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `復元できません: ${message}`);
      return false;
    }
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
    launcherOverlayOpen,
    launcherSearch,
    overlayPages,
    selectedOverlayPageKey,
  });
  mainDropStateRef.current = {
    config,
    groupNames,
    launcherOverlayOpen,
    launcherSearch,
    overlayPages,
    selectedOverlayPageKey,
  };

  const currentDropOverlayPageId = useCallback((): string | null => {
    const state = mainDropStateRef.current;
    return getOverlayDropPageId(
      state.selectedOverlayPageKey,
      state.overlayPages,
      state.launcherOverlayOpen,
      Boolean(state.launcherSearch.trim()),
    );
  }, []);

  const openDropDialog = useCallback(
    async (input: DropResolveInput, suggestedLabel?: string | null) => {
      const state = mainDropStateRef.current;
      if (!state.config) return;
      try {
        const draft = await resolveDropItem(
          input.kind === "url" ? { ...input, suggestedLabel } : input,
        );
        setDropDraft({
          ...draft,
          label: draft.label,
          group: draft.group?.trim() || state.groupNames[0] || DEFAULT_BUTTON_GROUP,
          showInSidebar: true,
          showInOverlay: true,
          overlayPageId: currentDropOverlayPageId(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `登録できません: ${message}`);
      }
    },
    [currentDropOverlayPageId, showToast],
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

  const openRecycleBinDropDialog = useCallback(() => {
    const state = mainDropStateRef.current;
    setDropDraft({
      label: "ごみ箱",
      group: state.groupNames[0] ?? DEFAULT_BUTTON_GROUP,
      iconSource: null,
      action: {
        type: "open_shell_special",
        payload: { item: "recycle_bin" },
      },
      source: "Windowsデスクトップのごみ箱",
      showInSidebar: true,
      showInOverlay: true,
      overlayPageId: currentDropOverlayPageId(),
    });
  }, [currentDropOverlayPageId]);

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
      if (event.payload.stage === "dragEnter") {
        setDragActive(true);
        return;
      }
      if (event.payload.stage === "dragLeave") {
        setDragActive(false);
        return;
      }

      setDragActive(false);
      if (event.payload.paths.length > 0) {
        void handleDroppedPaths(event.payload.paths);
        return;
      }
      if (event.payload.url) {
        void openDropDialog(
          { kind: "url", value: event.payload.url },
          event.payload.label,
        );
        return;
      }
      if (event.payload.shellSpecial === "recycle_bin") {
        openRecycleBinDropDialog();
        showToast("ok", "ごみ箱を登録できます。確定するまで開きません");
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
  }, [handleDroppedPaths, openDropDialog, openRecycleBinDropDialog, showToast]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragActive(true);
        } else if (event.payload.type === "leave") {
          setDragActive(false);
        } else if (event.payload.type === "drop") {
          void handleDroppedPaths(event.payload.paths);
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
  }, [handleDroppedPaths, showToast]);


  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (launcherOverlayOpen && event.key === "Escape" && !isEditableTarget(event.target)) {
        event.preventDefault();
        closeLauncherOverlay();
        return;
      }

      if (isEditableTarget(event.target)) return;
      if (matchesHotkey(event, config?.settings.launcherHotkey)) {
        event.preventDefault();
        const visualQa = Boolean(
          (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: boolean })
            .__LIFE_LAUNCHER_VISUAL_QA__,
        );
        if (isTauri() && !visualQa) {
          void toggleDictionaryFromShortcut();
        } else {
          openLauncherOverlay();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    closeLauncherOverlay,
    config?.settings.launcherHotkey,
    launcherOverlayOpen,
    openLauncherOverlay,
    toggleDictionaryFromShortcut,
  ]);

  useEffect(() => {
    if (!launcherOverlayOpen) {
      dismissContextMenu(false);
      return;
    }
    setLauncherSearch("");
    setLauncherSelectedIndex(0);
    window.setTimeout(() => launcherSearchRef.current?.focus(), 0);
  }, [dismissContextMenu, launcherOverlayOpen]);

  useEffect(() => {
    setLauncherSelectedIndex((current) =>
      Math.min(Math.max(0, current), Math.max(0, launcherDisplayedItems.length - 1)),
    );
  }, [launcherDisplayedItems.length]);

  useEffect(() => {
    if (isOverlayPageKeyAvailable(selectedOverlayPageKey, overlayPages)) return;
    setSelectedOverlayPageKey(OVERLAY_ALL_PAGE_KEY);
    setLauncherSelectedIndex(0);
  }, [overlayPages, selectedOverlayPageKey]);

  useEffect(() => {
    if (!launcherOverlayOpen) return;
    const frame = window.requestAnimationFrame(() => {
      launcherPageTabRefs.current.get(selectedOverlayPageKey)?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [launcherOverlayOpen, selectedOverlayPageKey]);

  useEffect(() => {
    if (!launcherOverlayOpen) {
      setLauncherTabScrollState({ canScrollLeft: false, canScrollRight: false });
      return;
    }

    const tabs = launcherOverlayTabsRef.current;
    if (!tabs) return;
    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
      const nextState = {
        canScrollLeft: tabs.scrollLeft > 1,
        canScrollRight: tabs.scrollLeft < maxScrollLeft - 1,
      };
      setLauncherTabScrollState((current) =>
        current.canScrollLeft === nextState.canScrollLeft &&
        current.canScrollRight === nextState.canScrollRight
          ? current
          : nextState,
      );
    };

    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [launcherOverlayOpen, launcherOverlayPageTabs.length]);

  const handleDomDragOver = (event: DragEvent<HTMLElement>) => {
    if (
      event.dataTransfer.types.includes(ACTION_DRAG_TYPE) ||
      event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)
    ) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setDragActive(true);
  };

  const handleDomDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

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

    let insertIndex = withoutDragged.length;
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
    if (!draggedItem || !config.inbox[targetIndex]) return;

    const withoutDragged = config.inbox.filter((_, index) => index !== draggedIndex);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) insertIndex -= 1;
    if (placement === "after") insertIndex += 1;

    const inbox = [...withoutDragged];
    inbox.splice(insertIndex, 0, draggedItem);
    void persistConfig({ ...config, inbox });
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
      const wrapper = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-button-id]"))
        .find((element) => element.dataset.sidebarButtonId === buttonId);
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
    [nextGroups[index], nextGroups[index + offset]] = [nextGroups[index + offset], nextGroups[index]];

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

  const moveProjectByOffset = async (projectId: string, offset: -1 | 1) => {
    if (!config) return;
    const index = config.projects.findIndex((project) => project.id === projectId);
    const project = config.projects[index];
    const targetIndex = index + offset;
    if (!project || !config.projects[targetIndex]) return;
    const projects = [...config.projects];
    [projects[index], projects[targetIndex]] = [projects[targetIndex], projects[index]];

    if (!(await persistConfig({ ...config, projects }))) return;
    announceReorder(project.name, targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-project-id="${projectId}"]`)?.focus();
    });
  };

  const moveInboxItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!config) return;
    const targetIndex = index + offset;
    const item = config.inbox[index];
    if (!item || !config.inbox[targetIndex]) return;
    const inbox = [...config.inbox];
    [inbox[index], inbox[targetIndex]] = [inbox[targetIndex], inbox[index]];

    if (!(await persistConfig({ ...config, inbox }))) return;
    setContextMenu(null);
    announceReorder(item.text, targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-inbox-index="${targetIndex}"]`)?.focus();
    });
  };

  const moveOverlayPageByOffset = async (pageId: string, offset: -1 | 1) => {
    if (!config) return;
    const index = overlayPages.findIndex((page) => page.id === pageId);
    const page = overlayPages[index];
    const targetIndex = index + offset;
    if (!page || !overlayPages[targetIndex]) return;
    const nextPages = [...overlayPages];
    [nextPages[index], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[index]];

    if (!(await persistConfig({ ...config, overlayPages: nextPages }))) return;
    announceReorder(page.name, targetIndex + 1);
    focusAfterReorder(() => {
      launcherPageTabRefs.current.get(overlayCustomPageKey(pageId))?.focus();
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

  const startTodayPointerDrag = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    todayPointerDragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
    };
  };

  const updateTodayPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = todayPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) {
      drag.hasMoved = true;
      setTodayPointerDrag(drag.index);
    }
  };

  const finishTodayPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = todayPointerDragRef.current;
    todayPointerDragRef.current = null;
    setTodayPointerDrag(null);

    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

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

  const stepProjectTimer = (field: "defaultTimerMinutes" | "shortTimerMinutes", delta: number) => {
    if (!config || !projectEditDraft) return;
    const fallback =
      field === "defaultTimerMinutes"
        ? config.settings.defaultTimerMinutes
        : config.settings.shortTimerMinutes;
    const current = Number.parseInt(projectEditDraft[field], 10);
    const value = Math.min(240, Math.max(1, (Number.isFinite(current) ? current : fallback) + delta));
    setProjectEditDraft({ ...projectEditDraft, [field]: String(value) });
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
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    projectPointerDragRef.current = {
      id: projectId,
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
      const target = projectDropTargetFromPoint(event.clientX, event.clientY);
      const placement = target ? resolveProjectDropPlacement(drag.id, target) : undefined;
      setProjectPointerDrag({
        id: drag.id,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetId: target?.id,
        placement,
        targetIndicator:
          target && target.id !== drag.id && placement
            ? projectDropIndicator(target.id, placement)
            : undefined,
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

    const target = projectDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveProject(drag.id, target.id, resolveProjectDropPlacement(drag.id, target));
  };

  const cancelProjectPointerDrag = () => {
    projectPointerDragRef.current = null;
    setProjectPointerDrag(null);
    stopProjectAutoScroll();
  };

  const startInboxPointerDrag = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    inboxPointerDragRef.current = {
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

  const updateInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const target = inboxDropTargetFromPoint(event.clientX, event.clientY);
    setInboxPointerDrag({
      index: drag.index,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetIndex: target?.index,
      placement: target?.placement,
      targetIndicator:
        target && target.index !== drag.index ? target.indicator : undefined,
    });
  };

  const finishInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    const target = inboxDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    const placement =
      drag.index === target.index
        ? target.placement
        : drag.index < target.index
          ? "after"
          : "before";
    moveInboxItem(drag.index, target.index, placement);
  };

  const cancelInboxPointerDrag = () => {
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
  };

  const startTodayBuilderPointerDrag = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    todayBuilderPointerDragRef.current = {
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

  const updateTodayBuilderPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = todayBuilderPointerDragRef.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const target = todayBuilderDropTargetFromPoint(event.clientX, event.clientY);
    setTodayBuilderPointerDrag({
      index: drag.index,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetIndex: target?.index,
      placement: target?.placement,
      targetIndicator: target && target.index !== drag.index ? target.indicator : undefined,
    });
  };

  const finishTodayBuilderPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = todayBuilderPointerDragRef.current;
    todayBuilderPointerDragRef.current = null;
    setTodayBuilderPointerDrag(null);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    const target = todayBuilderDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveTodayBuilderCandidate(drag.index, target.index, target.placement);
  };

  const cancelTodayBuilderPointerDrag = () => {
    todayBuilderPointerDragRef.current = null;
    setTodayBuilderPointerDrag(null);
  };

  const confirmDropRegistration = () => {
    if (!config || !dropDraft) return;
    const label = dropDraft.label.trim();
    if (!label) {
      showToast("warn", "ラベルを入力してください");
      return;
    }

    const group = dropDraft.group.trim();
    const button: LauncherButton = {
      id: uniqueButtonId(label, config.buttons),
      label,
      icon: iconForAction(dropDraft.action),
      iconSource: dropDraft.iconSource ?? undefined,
      group: group && group !== DEFAULT_BUTTON_GROUP ? group : undefined,
      showInSidebar: dropDraft.showInSidebar,
      showInOverlay: dropDraft.showInOverlay,
      overlayPageId: dropDraft.overlayPageId ?? undefined,
      aliases: [],
      actions: [dropDraft.action],
    };

    setDropDraft(null);
    void persistConfig({
      ...config,
      buttons: [...config.buttons, button],
    });
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
            buttonIds: project.buttonIds.filter((buttonId) => buttonId !== button.id),
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
        showToast("ok", `${button.label} を削除しました`);
        return true;
      },
    });
  };

  const openGroupDialog = () => {
    if (!config) return;
    setContextMenu(null);
    setGroupDraft("");
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
        showToast("ok", `${cleanGroupName} を削除しました`);
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

  const overlayPageNameError = (name: string, pageId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "ページ名を入力してください";
    if (trimmed.length > OVERLAY_PAGE_NAME_MAX_CHARS) {
      return `ページ名は${OVERLAY_PAGE_NAME_MAX_CHARS}文字以内で入力してください`;
    }
    if (["すべて", "未分類"].includes(trimmed)) {
      return `${trimmed} は固定ページ名のため使用できません`;
    }
    const duplicate = overlayPages.some(
      (page) =>
        page.id !== pageId &&
        page.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
    );
    return duplicate ? `${trimmed} はすでにあります` : null;
  };

  const openOverlayPageDialog = (page?: OverlayPage, assignToButton = false) => {
    overlayPageDialogOpenerRef.current = page
      ? launcherPageTabRefs.current.get(overlayCustomPageKey(page.id)) ?? null
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : launcherPageAddRef.current;
    contextMenuReturnFocusRef.current = null;
    setContextMenu(null);
    setOverlayPageDraft(
      page
        ? { mode: "rename", pageId: page.id, name: page.name }
        : { mode: "add", name: "", assignToButton },
    );
  };

  const saveOverlayPageDraft = async () => {
    if (!config || !overlayPageDraft) return;
    const name = overlayPageDraft.name.trim();
    const error = overlayPageNameError(name, overlayPageDraft.pageId);
    if (error) {
      showToast("warn", error);
      return;
    }

    const previousConfig = config;
    if (overlayPageDraft.mode === "add") {
      const existingIds = new Set(overlayPages.map((page) => page.id));
      let pageId = `overlay-page-${draftId()}`;
      while (existingIds.has(pageId)) pageId = `overlay-page-${draftId()}`;
      const saved = await persistConfig({
        ...config,
        overlayPages: [...overlayPages, { id: pageId, name }],
      });
      if (!saved) {
        setConfig(previousConfig);
        return;
      }
      closeOverlayPageDialog();
      setSelectedOverlayPageKey(overlayCustomPageKey(pageId));
      setLauncherSelectedIndex(0);
      if (overlayPageDraft.assignToButton) {
        setButtonEditDraft((draft) => (draft ? { ...draft, overlayPageId: pageId } : draft));
      }
      showToast("ok", `${name} を追加しました`);
      return;
    }

    const pageId = overlayPageDraft.pageId;
    if (!pageId || !overlayPages.some((page) => page.id === pageId)) {
      showToast("warn", "ページが見つかりません");
      return;
    }
    const saved = await persistConfig({
      ...config,
      overlayPages: overlayPages.map((page) => (page.id === pageId ? { ...page, name } : page)),
    });
    if (!saved) {
      setConfig(previousConfig);
      return;
    }
    closeOverlayPageDialog();
    showToast("ok", `${name} に変更しました`);
  };

  const deleteOverlayPage = (page: OverlayPage) => {
    if (!config) return;
    confirmFocusReturnRef.current =
      launcherPageTabRefs.current.get(overlayCustomPageKey(page.id)) ?? null;
    contextMenuReturnFocusRef.current = null;
    setContextMenu(null);
    const affectedCount = config.buttons.filter(
      (button) => button.overlayPageId === page.id,
    ).length;
    requestConfirmation({
      title: "辞書ページを削除しますか？",
      subject: `「${page.name}」`,
      message: `${affectedCount}件は「未分類」へ移動します。ボタン自体は削除されません。`,
      confirmLabel: "ページを削除",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: async () => {
        const previousConfig = config;
        const saved = await persistConfig({
          ...config,
          overlayPages: overlayPages.filter((item) => item.id !== page.id),
          buttons: config.buttons.map((button) =>
            button.overlayPageId === page.id ? { ...button, overlayPageId: undefined } : button,
          ),
        });
        if (!saved) {
          setConfig(previousConfig);
          return false;
        }
        const deletedPageWasSelected =
          selectedOverlayPageKey === overlayCustomPageKey(page.id);
        if (deletedPageWasSelected) {
          setSelectedOverlayPageKey(OVERLAY_UNCLASSIFIED_PAGE_KEY);
          setLauncherSelectedIndex(0);
        }
        confirmFocusReturnRef.current =
          launcherPageTabRefs.current.get(
            deletedPageWasSelected ? OVERLAY_UNCLASSIFIED_PAGE_KEY : selectedOverlayPageKey,
          ) ?? launcherSearchRef.current;
        showToast("ok", `${page.name} を削除しました`);
        return true;
      },
    });
  };

  const moveOverlayPage = async (
    draggedPageId: string,
    targetPageId: string,
    placement: "before" | "after",
  ) => {
    if (!config || draggedPageId === targetPageId) return;
    const previousConfig = config;
    const nextPages = [...overlayPages];
    const draggedIndex = nextPages.findIndex((page) => page.id === draggedPageId);
    if (draggedIndex < 0) return;
    const [draggedPage] = nextPages.splice(draggedIndex, 1);
    const targetIndex = nextPages.findIndex((page) => page.id === targetPageId);
    if (targetIndex < 0) return;
    nextPages.splice(targetIndex + (placement === "after" ? 1 : 0), 0, draggedPage);
    if (nextPages.every((page, index) => page.id === overlayPages[index]?.id)) return;

    const saved = await persistConfig({ ...config, overlayPages: nextPages });
    if (!saved) {
      setConfig(previousConfig);
      return;
    }
    showToast("ok", "辞書ページの順番を保存しました");
  };

  const openButtonEditDialog = (button: LauncherButton) => {
    setContextMenu(null);
    const draft: ButtonEditDraft = {
      id: button.id,
      label: button.label,
      icon: button.icon ?? "",
      group: buttonGroupName(button),
      showInSidebar: showButtonInSidebar(button),
      showInOverlay: showButtonInOverlay(button),
      overlayPageId: overlayPages.some((page) => page.id === button.overlayPageId)
        ? button.overlayPageId ?? null
        : null,
      aliasesInput: aliasesListToInput(button.aliases),
      description: button.description ?? "",
      actions: button.actions.map(toActionDraft),
    };
    setButtonEditDraft(draft);
    setButtonEditInitialDraft(draft);
  };

  const saveButtonEdit = () => {
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
    const group = buttonEditDraft.group.trim();
    const aliases = aliasesInputToList(buttonEditDraft.aliasesInput);
    const description = normalizeOptionalText(buttonEditDraft.description);
    const nextButtons = config.buttons.map((button) =>
      button.id === buttonEditDraft.id
        ? {
            ...button,
            label,
            icon: buttonEditDraft.icon.trim() || undefined,
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
    const nextProjects = buttonEditDraft.showInSidebar || buttonEditDraft.showInOverlay
      ? config.projects
      : config.projects.map((project) => ({
          ...project,
          buttonIds: project.buttonIds.filter((buttonId) => buttonId !== buttonEditDraft.id),
        }));

    setButtonEditDraft(null);
    setButtonEditInitialDraft(null);
    void persistConfig({
      ...config,
      groups: nextGroups,
      buttons: nextButtons,
      projects: nextProjects,
    });
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

  const finishTimer = useCallback(
    async (timer: ActiveTimer, reason: "manual" | "switch" | "complete" = "manual") => {
      setCompletionPrompt((current) => (current?.sourceId === timer.sourceId ? null : current));
      if (activeTimerRef.current?.sourceId === timer.sourceId) {
        activeTimerRef.current = null;
      }
      setActiveTimer((current) => (current?.sourceId === timer.sourceId ? null : current));
      const minutes = sessionMinutes(timer, Date.now());

      if (minutes < 1) {
        if (reason === "manual") {
          showToast("warn", "1分未満なので記録しませんでした");
        }
        return;
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
        await refreshDoNow();
        await refreshTodayActivity();
        showToast("ok", `${timer.label} ${minutes}分を記録しました`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `記録できません: ${message}`);
      }
    },
    [refreshDoNow, refreshTodayActivity, showToast],
  );

  useEffect(() => {
    if (!activeTimer || activeTimer.paused || !currentTimerMetrics) return;
    if (currentTimerMetrics.remainingSeconds <= 0) {
      if (
        completionPrompt?.sourceId === activeTimer.sourceId &&
        completionPrompt.targetMinutes === activeTimer.targetMinutes
      ) {
        return;
      }

      setCompletionPrompt({
        sourceId: activeTimer.sourceId,
        projectId: activeTimer.projectId,
        targetMinutes: activeTimer.targetMinutes,
        label: activeTimer.label,
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
    ) => {
      const cleanLabel = label.trim();
      if (!config || !cleanLabel) return;

      const requestId = ++timerStartRequestRef.current;
      const previousTimer = activeTimerRef.current;
      if (previousTimer) {
        await finishTimer(previousTimer, "switch");
      }

      if (requestId !== timerStartRequestRef.current) return;
      setCompletionPrompt(null);
      const start = new Date();
      const resolvedTargetMinutes = targetMinutes ?? config.settings.defaultTimerMinutes;
      const fallbackNote =
        projectId !== null
          ? (config.projects.find((project) => project.id === projectId)?.nextStep ?? "")
          : cleanLabel;
      const note = noteOverride?.trim() || fallbackNote;
      setNow(start.getTime());
      const nextTimer: ActiveTimer = {
        sourceId,
        projectId,
        label: cleanLabel,
        note,
        startedAtMs: start.getTime(),
        startedAt: formatStartedAt(start),
        targetMinutes: resolvedTargetMinutes,
        paused: false,
        pausedStartedAtMs: null,
        pausedTotalMs: 0,
      };
      activeTimerRef.current = nextTimer;
      setActiveTimer(nextTimer);

      showToast("ok", "タイマーを開始しました");

      if (actions.length > 0) {
        void runActions(sourceId, actions);
      }

      const project = projectId
        ? config.projects.find((item) => item.id === projectId)
        : undefined;
      const instructionPath = instructionPathOverride?.trim() || project?.instructionPath;
      const opensInstruction = instructionPathOverride?.trim()
        ? instructionOpenOnStartOverride !== false
        : project?.instructionOpenOnStart !== false;
      if (instructionPath && opensInstruction) {
        void openInstructionWindow({ path: instructionPath, focus: false }).catch((error) => {
          showToast(
            "warn",
            `タイマーは開始しましたが、手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    },
    [config, finishTimer, runActions, showToast],
  );

  const markNextStepReviewed = async (projectId: string) => {
    if (!config) return false;
    const reviewedAt = new Date().toISOString();
    const saved = await persistConfig({
      ...config,
      projects: config.projects.map((project) =>
        project.id === projectId ? { ...project, nextStepReviewedAt: reviewedAt } : project,
      ),
    });
    if (saved) {
      setStaleNextStepProjectIds((ids) => ids.filter((id) => id !== projectId));
    }
    return saved;
  };

  const tryStaleNextStepForShortTime = async (project: LauncherProject) => {
    if (!config || !project.nextStep.trim()) return;
    const actions = project.buttonIds.flatMap(
      (buttonId) => buttonsById.get(buttonId)?.actions ?? [],
    );
    await startTimer(
      project.id,
      project.name,
      project.id,
      actions,
      project.shortTimerMinutes ?? config.settings.shortTimerMinutes,
      project.startNoteTemplate,
    );
    await markNextStepReviewed(project.id);
  };

  const continueCompletedTimer = () => {
    if (!completionPrompt) return;
    setCompletionPrompt(null);
    setNow(Date.now());
    setActiveTimer((timer) => {
      if (
        !timer ||
        timer.sourceId !== completionPrompt.sourceId ||
        timer.targetMinutes !== completionPrompt.targetMinutes
      ) {
        return timer;
      }

      return {
        ...timer,
        targetMinutes: timer.targetMinutes + 15,
      };
    });
  };

  const finishCompletedTimer = () => {
    if (!activeTimer || !completionPrompt || activeTimer.sourceId !== completionPrompt.sourceId) {
      setCompletionPrompt(null);
      return;
    }

    setCompletionPrompt(null);
    void finishTimer(activeTimer, "complete");
  };

  const updateCompletionNextStep = (text: string) => {
    if (!config || !completionPrompt?.projectId) return;
    const timestamp = new Date().toISOString();
    const projects = config.projects.map((project) =>
      project.id === completionPrompt.projectId
        ? {
            ...project,
            nextStep: text,
            nextStepUpdatedAt: timestamp,
            nextStepReviewedAt: timestamp,
          }
        : project,
    );
    void persistConfig({ ...config, projects }).then((saved) => {
      if (saved) {
        setStaleNextStepProjectIds((ids) =>
          ids.filter((id) => id !== completionPrompt.projectId),
        );
      }
    });
  };

  const togglePause = useCallback(() => {
    setActiveTimer((timer) => {
      if (!timer) return timer;
      const current = Date.now();
      if (!timer.paused) {
        const nextTimer = { ...timer, paused: true, pausedStartedAtMs: current };
        activeTimerRef.current = nextTimer;
        showToast("neutral", "タイマーを一時停止しました");
        return nextTimer;
      }

      const pausedDelta = timer.pausedStartedAtMs ? current - timer.pausedStartedAtMs : 0;
      const nextTimer = {
        ...timer,
        paused: false,
        pausedStartedAtMs: null,
        pausedTotalMs: timer.pausedTotalMs + pausedDelta,
      };
      activeTimerRef.current = nextTimer;
      return nextTimer;
    });
  }, [showToast]);

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
          void finishTimer(activeTimer, "manual");
        }
      });
      const unlistenReturn = await listen(MINI_RETURN_EVENT, () => {
        void returnToMain().catch((error) => console.error("[mini-mode] メイン復帰に失敗しました", error));
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
  }, [activeTimer, finishTimer, returnToMain, togglePause]);

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
      if (nextAutoStart) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      await persistConfig({
        ...config,
        settings: { ...config.settings, autoStart: nextAutoStart },
      });
      showToast(
        "ok",
        nextAutoStart ? "PC起動時に開くようにしました" : "PC起動時の起動を止めました",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `自動起動を変更できません: ${message}`);
    }
  };

  const updateVictoryText = (text: string) => {
    if (!config) return;
    const victory = {
      text,
      done: text.trim() ? config.today.victory.done : false,
    };
    void persistConfig({ ...config, today: { ...config.today, victory } });
  };

  const applyVictorySuggestion = (text: string) => {
    updateVictoryText(text);
    setVictoryEditing(true);
    window.requestAnimationFrame(() => {
      victoryInputRef.current?.focus();
    });
  };

  const toggleVictoryDone = () => {
    if (!config) return;
    const text = config.today.victory.text.trim();
    if (!text) {
      showToast("warn", "勝利条件を入力してください");
      return;
    }

    const victory = {
      ...config.today.victory,
      done: !config.today.victory.done,
    };
    void persistConfig({ ...config, today: { ...config.today, victory } });
  };

  const handleVictoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const updateTodayText = (index: number, text: string) => {
    if (!config) return;
    const items = config.today.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, text } : item,
    );
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const toggleTodayDone = (index: number) => {
    if (!config) return;
    const items = config.today.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item,
    );
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const removeTodayItem = (index: number) => {
    if (!config) return;
    const items = config.today.items.filter((_, itemIndex) => itemIndex !== index);
    if (todayEditingIndex === index) {
      setTodayEditingIndex(null);
    }
    setTodayTriggerEditingIndex(null);
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const beginTodayTriggerEdit = (index: number) => {
    if (!config) return;
    setTodayEditingIndex(null);
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

  const handleTodayTriggerKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
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

  const addTodayItem = () => {
    if (!config) return;
    const text = todayDraft.trim();
    if (!text || config.today.items.length >= TODAY_ITEM_LIMIT) return;
    const items = [...config.today.items, { text, done: false }];
    setTodayDraft("");
    setTodayAddOpen(false);
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const handleTodayEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      setTodayEditingIndex(null);
      event.currentTarget.blur();
    }
  };

  const handleTodayAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setTodayDraft("");
      setTodayAddOpen(false);
      event.currentTarget.blur();
    }
  };

  const addInboxItem = () => {
    if (!config) return;
    const text = inboxDraft.trim();
    if (!text) return;
    setInboxDraft("");
    setInboxAddOpen(false);
    void persistConfig({ ...config, inbox: [...config.inbox, { text }] });
  };

  const beginInboxEdit = (index: number) => {
    const item = config?.inbox[index];
    if (!item) return;
    setContextMenu(null);
    setInboxOpen(true);
    setInboxEditingIndex(index);
    setInboxEditDraft(item.text);
    setInboxEditProjectId(item.projectId ?? "");
    setInboxEditButtonIds(item.buttonIds ?? []);
    setInboxEditInstructionPath(item.instructionPath ?? "");
    setInboxEditInstructionOpenOnStart(
      Boolean(item.instructionPath && item.instructionOpenOnStart !== false),
    );
    void refreshInstructionChoices();
  };

  const commitInboxEdit = () => {
    if (!config || inboxEditingIndex === null) return;
    const text = inboxEditDraft.trim();
    if (!text) {
      cancelInboxEdit();
      return;
    }
    const inbox = config.inbox.map((item, index) =>
      index === inboxEditingIndex
        ? {
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
    setInboxEditingIndex(null);
    setInboxEditDraft("");
    setInboxEditProjectId("");
    setInboxEditButtonIds([]);
    setInboxEditInstructionPath("");
    setInboxEditInstructionOpenOnStart(false);
    void persistConfig({ ...config, inbox });
  };

  const cancelInboxEdit = () => {
    setInboxEditingIndex(null);
    setInboxEditDraft("");
    setInboxEditProjectId("");
    setInboxEditButtonIds([]);
    setInboxEditInstructionPath("");
    setInboxEditInstructionOpenOnStart(false);
  };

  const deleteInboxItem = (index: number) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;
    setContextMenu(null);
    requestConfirmation({
      title: "やりたいことから削除しますか？",
      subject: `「${item.text}」`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: async () =>
        persistConfig({
          ...config,
          inbox: config.inbox.filter((_, itemIndex) => itemIndex !== index),
        }),
    });
  };

  const scheduleNotesSave = (key: string, save: () => Promise<void>, immediate = false) => {
    const existing = notesSaveTimersRef.current.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    const run = () => {
      notesSaveTimersRef.current.delete(key);
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

  const moveInboxItemToToday = (index: number) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;

    if (config.today.items.length >= TODAY_ITEM_LIMIT) {
      showToast("warn", "今日の3件がいっぱいです");
      return;
    }

    void persistConfig({
      ...config,
      today: {
        ...config.today,
        items: [
          ...config.today.items,
          {
            text: item.text,
            done: false,
            ...(item.projectId ? { projectId: item.projectId } : {}),
            ...(item.buttonIds?.length ? { buttonIds: item.buttonIds } : {}),
            ...(item.instructionPath
              ? {
                  instructionPath: item.instructionPath,
                  instructionOpenOnStart: item.instructionOpenOnStart !== false,
                }
              : {}),
          },
        ],
      },
      inbox: config.inbox.filter((_, itemIndex) => itemIndex !== index),
    });
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

  const openProjectAddDialog = () => {
    if (!config) return;
    setContextMenu(null);
    setProjectNextStepSuggestions([]);
    void refreshInstructionChoices();
    setProjectEditDraft({
      id: "",
      name: "",
      northStar: "",
      weeklyFocus: false,
      nextStep: "",
      nextStepTrigger: "",
      buttonIds: [],
      defaultTimerMinutes: "",
      shortTimerMinutes: "",
      startNoteTemplate: "",
      instructionPath: "",
      instructionOpenOnStart: false,
      colorId: "amber",
      isNew: true,
    });
  };

  const openProjectEditDialog = (project: LauncherProject) => {
    setContextMenu(null);
    void refreshNextStepSuggestions(project.id, "project");
    void refreshInstructionChoices();
    setProjectEditDraft({
      id: project.id,
      name: project.name,
      northStar: project.northStar ?? "",
      weeklyFocus: project.weeklyFocus === true,
      nextStep: project.nextStep,
      nextStepTrigger: project.nextStepTrigger ?? "",
      buttonIds: project.buttonIds.filter((buttonId) =>
        projectSelectableButtons.some((button) => button.id === buttonId),
      ),
      defaultTimerMinutes: project.defaultTimerMinutes ? String(project.defaultTimerMinutes) : "",
      shortTimerMinutes: project.shortTimerMinutes ? String(project.shortTimerMinutes) : "",
      startNoteTemplate: project.startNoteTemplate ?? "",
      instructionPath: project.instructionPath ?? "",
      instructionOpenOnStart: Boolean(
        project.instructionPath && project.instructionOpenOnStart !== false,
      ),
      colorId: resolveProjectColorId(project.id, project.colorId),
      isNew: false,
    });
  };

  const saveProjectEdit = () => {
    if (!config || !projectEditDraft) return;
    const name = projectEditDraft.name.trim();
    if (!name) {
      showToast("warn", "プロジェクト名を入力してください");
      return;
    }
    const defaultTimerMinutes = projectEditDraft.defaultTimerMinutes.trim()
      ? Number(projectEditDraft.defaultTimerMinutes)
      : undefined;
    const shortTimerMinutes = projectEditDraft.shortTimerMinutes.trim()
      ? Number(projectEditDraft.shortTimerMinutes)
      : undefined;
    if (
      [defaultTimerMinutes, shortTimerMinutes].some(
        (minutes) => minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 240),
      )
    ) {
      showToast("warn", "タイマー分数は1〜240の整数で入力してください");
      return;
    }

    const existingProject = projectEditDraft.isNew
      ? undefined
      : config.projects.find((item) => item.id === projectEditDraft.id);
    const nextStep = projectEditDraft.nextStep.trim();
    const nextStepChanged = existingProject
      ? existingProject.nextStep !== nextStep
      : Boolean(nextStep);
    const nextStepTimestamp = nextStepChanged ? new Date().toISOString() : null;
    const project: LauncherProject = {
      id: projectEditDraft.isNew ? uniqueProjectId(name, config.projects) : projectEditDraft.id,
      name,
      ...(projectEditDraft.northStar.trim()
        ? { northStar: projectEditDraft.northStar.trim() }
        : {}),
      ...(projectEditDraft.weeklyFocus ? { weeklyFocus: true } : {}),
      nextStep,
      ...(projectEditDraft.nextStepTrigger.trim()
        ? { nextStepTrigger: projectEditDraft.nextStepTrigger.trim() }
        : {}),
      buttonIds: projectEditDraft.buttonIds.filter((buttonId) =>
        projectSelectableButtons.some((button) => button.id === buttonId),
      ),
      ...(defaultTimerMinutes !== undefined ? { defaultTimerMinutes } : {}),
      ...(shortTimerMinutes !== undefined ? { shortTimerMinutes } : {}),
      ...(projectEditDraft.startNoteTemplate.trim()
        ? { startNoteTemplate: projectEditDraft.startNoteTemplate.trim() }
        : {}),
      ...(projectEditDraft.instructionPath
        ? {
            instructionPath: projectEditDraft.instructionPath,
            instructionOpenOnStart: projectEditDraft.instructionOpenOnStart,
          }
        : {}),
      colorId: projectEditDraft.colorId,
      ...(nextStepTimestamp
        ? {
            nextStepUpdatedAt: nextStepTimestamp,
            nextStepReviewedAt: nextStepTimestamp,
          }
        : {
            ...(existingProject?.nextStepUpdatedAt
              ? { nextStepUpdatedAt: existingProject.nextStepUpdatedAt }
              : {}),
            ...(existingProject?.nextStepReviewedAt
              ? { nextStepReviewedAt: existingProject.nextStepReviewedAt }
              : {}),
          }),
    };

    const projects = projectEditDraft.isNew
      ? [...config.projects, project]
      : config.projects.map((item) => (item.id === project.id ? project : item));

    setProjectEditDraft(null);
    void persistConfig({ ...config, projects }).then((saved) => {
      if (saved && nextStepChanged) {
        setStaleNextStepProjectIds((ids) => ids.filter((id) => id !== project.id));
      }
    });
    showToast("ok", `${name} を保存しました`);
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
        project.id === projectId
          ? { ...project, weeklyFocus: checked || undefined }
          : project,
      ),
    });
  };

  const deleteProject = (project: LauncherProject) => {
    if (!config) return;
    requestConfirmation({
      title: "プロジェクトを削除しますか？",
      subject: `「${project.name}」`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: async () => {
        const saved = await persistConfig({
          ...config,
          projects: config.projects.filter((item) => item.id !== project.id),
        });
        if (!saved) {
          setConfig(config);
          return false;
        }
        setContextMenu(null);
        showToast("ok", `${project.name} を削除しました`);

        return true;
      },
    });
  };

  const saveTodayBuilderOrder = (keys: string[]) => {
    window.localStorage.setItem("life-launcher-today-builder-order", JSON.stringify(keys));
  };

  function moveTodayBuilderCandidate(
    fromIndex: number,
    toIndex: number,
    placement?: "before" | "after",
  ) {
    if (fromIndex === toIndex) return;
    const keys = todayBuilderCandidates.map((candidate) => candidate.key);
    const [key] = keys.splice(fromIndex, 1);
    const adjustedTargetIndex = placement
      ? toIndex - (fromIndex < toIndex ? 1 : 0) + (placement === "after" ? 1 : 0)
      : toIndex;
    keys.splice(adjustedTargetIndex, 0, key);
    saveTodayBuilderOrder(keys);
    setTodayBuilderDestinations((current) => ({ ...current }));
  }

  const moveTodayBuilderCandidateByOffset = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= todayBuilderCandidates.length) return;
    moveTodayBuilderCandidate(index, targetIndex);
    setContextMenu(null);
  };

  const addTodayBuilderDraft = () => {
    const text = todayBuilderDraft.trim();
    if (!config || !text) return;
    if (!config.inbox.some((item) => item.text === text)) {
      void persistConfig({ ...config, inbox: [{ text }, ...config.inbox] });
    }
    setTodayBuilderDraft("");
    setTodayBuilderAddOpen(false);
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

  const addTodayBuilderCandidate = (text: string, trigger?: string, projectId?: string) => {
    if (!config) return;
    if (config.today.items.length >= TODAY_ITEM_LIMIT) {
      showToast("warn", "今日の3件がいっぱいです");
      return;
    }
    void persistConfig({
      ...config,
      today: {
        ...config.today,
        items: [
          ...config.today.items,
          {
            text,
            done: false,
            ...(trigger?.trim() ? { trigger: trigger.trim() } : {}),
            ...(projectId ? { projectId } : {}),
          },
        ],
      },
    });
  };

  const setTodayBuilderVictory = (text: string) => {
    updateVictoryText(text);
    setVictoryEditing(false);
    showToast("ok", "勝利条件にセットしました");
  };

  const addTodayBuilderInbox = (text: string, projectId?: string) => {
    if (!config || config.inbox.some((item) => item.text === text)) return;
    void persistConfig({
      ...config,
      inbox: [
        ...config.inbox,
        { text, ...(projectId ? { projectId } : {}) },
      ],
    });
  };

  const applyTodayBuilderCandidate = (
    candidate: TodayBuilderCandidate,
    destination: string,
  ) => {
    if (!config) return;
    const { text } = candidate;
    if (destination === "victory") {
      if (config.today.victory.text.trim() && config.today.victory.text.trim() !== text) {
        showToast("warn", "勝利条件は既に入力されています。編集して変更してください。");
        return;
      }
      setTodayBuilderVictory(text);
      return;
    }
    if (destination === "today") {
      if (config.today.items.some((item) => item.text === text)) {
        showToast("warn", "今日の3件に既にあります");
        return;
      }
      addTodayBuilderCandidate(text, candidate.trigger, candidate.projectId);
      return;
    }
    if (config.inbox.some((item) => item.text === text)) {
      showToast("warn", "やりたいことに既にあります");
      return;
    }
    addTodayBuilderInbox(text, candidate.projectId);
  };

  const toggleTodayBuilder = () => {
    setTodayBuilderOpen((open) => !open);
    if (!sessionSummary) {
      void loadSessionSummary().then(setSessionSummary).catch(() => undefined);
    }
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
    const label = project?.name ?? "手動セッション";

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
      showToast("ok", "セッションを追加しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `セッションを追加できません: ${message}`);
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
      showToast("ok", "セッションを更新しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `セッションを更新できません: ${message}`);
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
      showToast("ok", "セッションを削除しました");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `セッションを削除できません: ${message}`);
      return false;
    }
  };

  const requestSessionDelete = (session: SessionEntryRow) => {
    requestConfirmation({
      title: "セッションを削除しますか？",
      subject: `${session.date} ${session.startedAt} / ${session.label} / ${session.minutes}分`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: () => confirmSessionDelete(session),
    });
  };

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

  const todayRemaining = TODAY_ITEM_LIMIT - config.today.items.length;
  const victoryText = config.today.victory.text.trim();
  const victoryDone = Boolean(victoryText && config.today.victory.done);
  const victorySuggestions = uniqueSuggestions(
    [
      morningVictorySuggestion,
      ...config.projects.slice(0, 3).map((project) => project.nextStep),
      config.inbox[0]?.text,
    ],
    5,
  );
  const unsortedTodayBuilderCandidates = uniqueSuggestions(
    [
      morningVictorySuggestion,
      ...config.projects.map((project) => project.nextStep),
      config.inbox[0]?.text,
      ...((sessionSummary?.recentSessions ?? []).map((session) => session.note)),
    ],
    8,
  ).map((text): TodayBuilderCandidate => {
    const project = config.projects.find((item) => item.nextStep.trim() === text);
    if (project) {
      return {
        key: `project:${project.id}`,
        text,
        source: "次の一手",
        projectId: project.id,
        ...(project.nextStepTrigger?.trim() ? { trigger: project.nextStepTrigger.trim() } : {}),
      };
    }
    if (text === morningVictorySuggestion) return { key: `victory:${text}`, text, source: "昨日の勝利条件" };
    const inboxIndex = config.inbox.findIndex((item) => item.text === text);
    if (inboxIndex >= 0) {
      const inboxItem = config.inbox[inboxIndex];
      return {
        key: `inbox:${text}`,
        text,
        source: "やりたいこと",
        ...(inboxItem.projectId ? { projectId: inboxItem.projectId } : {}),
      };
    }
    return { key: `session:${text}`, text, source: "最近のnote" };
  });
  const todayBuilderCandidates = (() => {
    let savedOrder: string[] = [];
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem("life-launcher-today-builder-order") ?? "[]",
      );
      if (Array.isArray(parsed)) {
        savedOrder = parsed.filter((key): key is string => typeof key === "string");
      }
    } catch {
      savedOrder = [];
    }
    const order = new Map(savedOrder.map((key, index) => [key, index]));
    return [...unsortedTodayBuilderCandidates].sort((left, right) => {
      const leftIndex = order.get(left.key);
      const rightIndex = order.get(right.key);
      if (leftIndex === undefined && rightIndex === undefined) return 0;
      if (leftIndex === undefined) return 1;
      if (rightIndex === undefined) return -1;
      return leftIndex - rightIndex;
    });
  })();
  const todayActivityCount = todayActivityDate === config.today.date ? todayActivityEntries.length : 0;
  const timerStatus = completionPrompt
    ? "完了確認中"
    : activeTimer
      ? activeTimer.paused
        ? "一時停止"
        : "実行中"
      : "待機中";
  const timerClock = currentTimerMetrics
    ? formatClock(Math.max(0, currentTimerMetrics.remainingSeconds))
    : "00:00";
  const activeTimerProject = activeTimer?.projectId
    ? config.projects.find((project) => project.id === activeTimer.projectId)
    : undefined;
  const completionProject = completionPrompt?.projectId
    ? config.projects.find((project) => project.id === completionPrompt.projectId)
    : null;
  const focusedProjects = config.projects.filter((project) => project.weeklyFocus === true);
  const doNowCandidates = (doNowResponse?.candidates ?? []).flatMap((candidate) => {
    const project = config.projects.find((item) => item.id === candidate.projectId);
    return project ? [{ candidate, project }] : [];
  });
  const doNowSelection = doNowCandidates[doNowCandidateIndex] ?? doNowCandidates[0];
  const doNowRestartPreferred = Boolean(
    doNowSelection?.candidate.restartEligible && (config.settings.restartShortFirst ?? true),
  );
  const doNowReason = doNowSelection
    ? doNowRestartPreferred
      ? "14日以上空いているため、短時間から再開できます"
      : doNowCandidateIndex > 0
      ? "固定ルール順の別候補です"
      : doNowSelection.candidate.reason === "noToday"
        ? "今週の重点で、今日はまだ取り組んでいません"
        : doNowSelection.candidate.reason === "manualOrder"
          ? "同じ条件の中で、手動の優先順が最も高いプロジェクトです"
          : "今日の中で最初に取り組んだため、次の候補です"
    : "";
  const doNowDefaultTimerMinutes = doNowSelection
    ? (doNowSelection.project.defaultTimerMinutes ?? config.settings.defaultTimerMinutes)
    : config.settings.defaultTimerMinutes;
  const doNowShortTimerMinutes = doNowSelection
    ? (doNowSelection.project.shortTimerMinutes ?? config.settings.shortTimerMinutes)
    : config.settings.shortTimerMinutes;
  const doNowInstructionPath = doNowSelection?.project.instructionPath?.trim() ?? "";
  const isDoNowRunning = Boolean(
    doNowSelection && activeTimer?.sourceId === doNowSelection.project.id,
  );
  const startDoNowProject = (project: LauncherProject, short: boolean) => {
    const actions = project.buttonIds.flatMap(
      (buttonId) => buttonsById.get(buttonId)?.actions ?? [],
    );
    void startTimer(
      project.id,
      project.name,
      project.id,
      actions,
      short
        ? (project.shortTimerMinutes ?? config.settings.shortTimerMinutes)
        : (project.defaultTimerMinutes ?? config.settings.defaultTimerMinutes),
      project.startNoteTemplate,
    );
  };
  const renderButtonIcon = (button: LauncherButton, className: string) => {
    const source = buttonIconSources[button.id];
    if (source) {
      return <img alt="" className={`${className} buttonIconImage`} src={source} />;
    }

    return (
      <span className={className}>
        {button.icon ?? iconForAction(button.actions[0] ?? makeAction("open_file"))}
      </span>
    );
  };
  const runLauncherOverlayItem = (item: LauncherOverlayItem | undefined) => {
    if (!item) return;
    closeLauncherOverlay(false);
    void runActions(item.button.id, item.button.actions);
  };
  const focusOverlayPageTabAt = (index: number) => {
    if (launcherOverlayPageTabs.length === 0) return;
    const normalizedIndex =
      (index + launcherOverlayPageTabs.length) % launcherOverlayPageTabs.length;
    const pageKey = launcherOverlayPageTabs[normalizedIndex].key;
    window.requestAnimationFrame(() => launcherPageTabRefs.current.get(pageKey)?.focus());
  };
  const selectOverlayPageByOffset = (offset: -1 | 1) => {
    const currentIndex = launcherOverlayPageTabs.findIndex(
      (tab) => tab.key === selectedOverlayPageKey,
    );
    const nextIndex =
      (Math.max(0, currentIndex) + offset + launcherOverlayPageTabs.length) %
      launcherOverlayPageTabs.length;
    const nextPageKey = launcherOverlayPageTabs[nextIndex]?.key;
    if (!nextPageKey) return;
    setSelectedOverlayPageKey(nextPageKey);
    setLauncherSelectedIndex(0);
    focusOverlayPageTabAt(nextIndex);
  };
  const scrollLauncherOverlayTabs = (direction: -1 | 1) => {
    const tabs = launcherOverlayTabsRef.current;
    if (!tabs) return;
    tabs.scrollBy({ left: direction * Math.max(160, Math.round(tabs.clientWidth * 0.62)) });
  };

  const handleLauncherOverlayKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!launcherOverlayOpen) return;

    if (event.key === "Tab" && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      selectOverlayPageByOffset(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (launcherSearch.trim()) {
        setLauncherSearch("");
        setLauncherSelectedIndex(0);
      } else {
        closeLauncherOverlay();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setLauncherSelectedIndex((current) =>
        launcherDisplayedItems.length === 0 ? 0 : (current + 1) % launcherDisplayedItems.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setLauncherSelectedIndex((current) =>
        launcherDisplayedItems.length === 0
          ? 0
          : (current - 1 + launcherDisplayedItems.length) % launcherDisplayedItems.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runLauncherOverlayItem(launcherDisplayedItems[launcherSelectedIndex]);
    }
  };


  const skipLinkBlocked = Boolean(
    launcherOverlayOpen ||
      settingsDraft ||
      helpGuideOpen ||
      confirmDialog ||
      manualSessionDraft ||
      sessionEditDraft ||
      buttonEditDraft ||
      projectEditDraft ||
      dropDraft ||
      groupDraft !== null ||
      groupRenameDraft ||
      overlayPageDraft ||
      completionPrompt,
  );

  const focusSkipTarget = () => {
    const scrollArea = mainScrollAreaRef.current;
    if (!scrollArea) return;
    const target =
      activeView === "records"
        ? scrollArea.querySelector<HTMLElement>("[data-skip-target='records']")
        : scrollArea.querySelector<HTMLElement>(".doNowStartPrimary:not(:disabled)") ??
          scrollArea.querySelector<HTMLElement>("[data-skip-target='main'] button:not(:disabled)") ??
          scrollArea.querySelector<HTMLElement>("[data-skip-target='main']");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", inline: "nearest" });
  };
  return (
    <main
      className={
        dragActive
          ? "appShell appShell--dashboard appShell--dragging"
          : "appShell appShell--dashboard"
      }
      onDragOver={handleDomDragOver}
      onDrop={handleDomDrop}
    >
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
          className="dictionaryMainScrim"
          role="presentation"
        />
      )}
      <aside
        className="sidebar"
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu({ kind: "sidebar" }, event.clientX, event.clientY, event.currentTarget);
        }}
        tabIndex={-1}
      >
        <div className="brandBlock">
          <img alt="" aria-hidden="true" className="brandIcon" src="/life-launcher-icon.svg" />
          <div className="brandCopy">
            <p className="eyebrow">Life Launcher</p>
            <strong>Quick</strong>
          </div>
        </div>

        <button
          className="launcherOpenButton"
          onClick={() => void openDictionaryManually()}
          type="button"
        >
          <span>辞書を開く</span>
          <kbd>{config?.settings.launcherHotkey?.trim() || "Ctrl+K"}</kbd>
        </button>

          <div className="quickList app-scrollbar" aria-label="クイック起動">
          {visibleSidebarButtonGroups.length === 0 ? (
            <p className="quietText quietText--small">
              サイドバー表示の項目がありません。アプリ、ショートカット、URLをドラッグして追加できます。
            </p>
          ) : (
            visibleSidebarButtonGroups.map((group) => {
              const collapsed = collapsedGroups[group.name] ?? false;
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
                >
                  <button
                    className="quickGroupHeader"
                    data-sidebar-group-name={group.name}
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
                  {!collapsed && (
                    <div className="quickGroupItems" data-sidebar-group-name={group.name}>
                      {group.buttons.map((button) => (
                        <div
                          className={
                            sidebarPointerDrag?.id === button.id
                              ? "quickButtonDrag quickButtonDrag--dragging"
                              : "quickButtonDrag"
                          }
                          data-sidebar-button-id={button.id}
                          data-sidebar-group-name={group.name}
                          key={button.id}
                        >
                          <button
                            className="quickButton"
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
                              renderButtonIcon(button, "quickIcon")
                            )}
                            <span>{button.label}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                  {renderButtonIcon(button, "quickIcon")}
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
        clock={activeTimer ? timerClock : `${config.settings.defaultTimerMinutes}分`}
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
          label={activeTimer ? activeTimer.label : "通常タイマー"}
          onFinish={() => {
            if (activeTimer) void finishTimer(activeTimer);
          }}
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
          waitingContent={
            <div className="timerPresetControls" aria-label="通常タイマーの分数">
              <span className="timerHint">通常タイマー</span>
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
                  <input
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

      {false && launcherOverlayOpen && (
        <div
          className="launcherOverlayBackdrop"
          onClick={() => closeLauncherOverlay()}
          role="presentation"
        >
          <section
            aria-label="起動辞書"
            aria-modal="true"
            className="launcherOverlay"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleLauncherOverlayKeyDown}
            role="dialog"
            tabIndex={-1}
          >
            <header className="launcherOverlayHeader">
              <div>
                <p className="eyebrow">Launcher</p>
                <h2>辞書</h2>
              </div>
              <button aria-label="辞書を閉じる" className="iconButton" onClick={() => closeLauncherOverlay()} title="閉じる" type="button">
                <UiIcon name="close" size={16} />
              </button>
            </header>

            <div className="launcherOverlayTabsFrame">
              {launcherTabScrollState.canScrollLeft && (
                <button
                  aria-label="辞書タブを左へスクロール"
                  className="launcherOverlayTabScroll"
                  onClick={() => scrollLauncherOverlayTabs(-1)}
                  title="左のページを表示"
                  type="button"
                >
                  <UiIcon name="chevronLeft" size={16} />
                </button>
              )}
              <div
                className="launcherOverlayTabs app-scrollbar"
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const edge = 48;
                  if (event.clientX < rect.left + edge) event.currentTarget.scrollBy(-12, 0);
                  if (event.clientX > rect.right - edge) event.currentTarget.scrollBy(12, 0);
                }}
                onScroll={(event) => {
                  const tabs = event.currentTarget;
                  const maxScrollLeft = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
                  setLauncherTabScrollState({
                    canScrollLeft: tabs.scrollLeft > 1,
                    canScrollRight: tabs.scrollLeft < maxScrollLeft - 1,
                  });
                }}
                ref={launcherOverlayTabsRef}
              >
              <div className="launcherOverlayTabList" role="tablist" aria-label="辞書ページ">
                {launcherOverlayPageTabs.map((tab, tabIndex) => {
                const selected = selectedOverlayPageKey === tab.key;
                const customPageId = overlayPageIdFromKey(tab.key);
                const customPage = customPageId
                  ? overlayPages.find((page) => page.id === customPageId)
                  : undefined;
                return (
                  <button
                    aria-controls="launcher-overlay-panel"
                    aria-selected={selected}
                    className={
                      selected
                        ? "launcherOverlayTab launcherOverlayTab--selected"
                        : "launcherOverlayTab"
                    }
                    draggable={Boolean(customPage)}
                    id={`launcher-overlay-tab-${tabIndex}`}
                    key={tab.key}
                    onClick={() => {
                      setSelectedOverlayPageKey(tab.key);
                      setLauncherSelectedIndex(0);
                    }}
                    onContextMenu={(event) => {
                      if (!customPage) return;
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(
                        { kind: "overlayPage", page: customPage },
                        event.clientX,
                        event.clientY,
                        event.currentTarget,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault();
                        event.stopPropagation();
                        focusOverlayPageTabAt(tabIndex + (event.key === "ArrowLeft" ? -1 : 1));
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedOverlayPageKey(tab.key);
                        setLauncherSelectedIndex(0);
                        return;
                      }
                      if (customPage) {
                        openContextMenuFromKeyboard(event, {
                          kind: "overlayPage",
                          page: customPage,
                        });
                      }
                    }}
                    onDragEnd={() => setOverlayPageDragId(null)}
                    onDragStart={(event) => {
                      if (!customPage) {
                        event.preventDefault();
                        return;
                      }
                      setOverlayPageDragId(customPage.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(OVERLAY_PAGE_DRAG_TYPE, customPage.id);
                    }}
                    onDrop={(event) => {
                      if (!customPage) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const draggedPageId =
                        event.dataTransfer.getData(OVERLAY_PAGE_DRAG_TYPE) || overlayPageDragId;
                      if (!draggedPageId || draggedPageId === customPage.id) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placement = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      setOverlayPageDragId(null);
                      void moveOverlayPage(draggedPageId, customPage.id, placement);
                    }}
                    ref={(node) => {
                      if (node) launcherPageTabRefs.current.set(tab.key, node);
                      else launcherPageTabRefs.current.delete(tab.key);
                    }}
                    role="tab"
                    tabIndex={selected ? 0 : -1}
                    title={tab.name}
                    type="button"
                  >
                    <span>{tab.name}</span>
                    <small>{overlayPageCounts.get(tab.key) ?? 0}</small>
                  </button>
                );
                })}
              </div>
                <button
                  aria-label="辞書ページを追加"
                  className="launcherOverlayTabAdd"
                  onClick={() => openOverlayPageDialog()}
                  ref={launcherPageAddRef}
                  title="辞書ページを追加"
                  type="button"
                >
                  <UiIcon name="add" size={18} />
                </button>
              </div>
              {launcherTabScrollState.canScrollRight && (
                <button
                  aria-label="辞書タブを右へスクロール"
                  className="launcherOverlayTabScroll"
                  onClick={() => scrollLauncherOverlayTabs(1)}
                  title="右のページを表示"
                  type="button"
                >
                  <UiIcon name="chevronRight" size={16} />
                </button>
              )}
            </div>

            <input
              aria-label="辞書を検索"
              className="launcherSearchInput"
              onChange={(event) => {
                setLauncherSearch(event.target.value);
                setLauncherSelectedIndex(0);
              }}
              placeholder="ラベル・ページ・キーワードで検索"
              ref={launcherSearchRef}
              value={launcherSearch}
            />

            <div
              aria-labelledby={`launcher-overlay-tab-${Math.max(
                0,
                launcherOverlayPageTabs.findIndex((tab) => tab.key === selectedOverlayPageKey),
              )}`}
              className="launcherOverlayBody app-scrollbar"
              id="launcher-overlay-panel"
              role="tabpanel"
            >
              {launcherSearch.trim() ? (
                launcherDisplayedItems.length > 0 ? (
                  <div className="launcherSearchResults" aria-label="全ページの検索結果">
                  <p className="launcherSearchScope">
                    <span>全ページの検索結果</span>
                    <small>{launcherDisplayedItems.length}件</small>
                  </p>
                  {launcherDisplayedItems.map((item) => (
                    <button
                      className={
                        launcherDisplayedItems[launcherSelectedIndex]?.button.id === item.button.id
                          ? "launcherSearchResult launcherSearchResult--selected"
                          : "launcherSearchResult"
                      }
                      key={item.button.id}
                      onClick={() => runLauncherOverlayItem(item)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(
                          { kind: "button", button: item.button },
                          event.clientX,
                          event.clientY,
                          event.currentTarget,
                        );
                      }}
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, { kind: "button", button: item.button })
                      }
                      title={`${item.button.label} / ${item.pageName} / ${item.groupName}`}
                      type="button"
                    >
                      {renderButtonIcon(item.button, "launcherSearchResultIcon")}
                      <span className="launcherSearchResultCopy">
                        <strong>{item.button.label}</strong>
                        <small>
                          {item.pageName} ・ {item.groupName} ・ {actionKindLabel(item.button.actions[0])}
                          {(item.button.aliases ?? []).length > 0
                            ? ` ・ ${(item.button.aliases ?? []).join(", ")}`
                            : ""}
                        </small>
                      </span>
                    </button>
                  ))}
                  </div>
                ) : (
                  <div className="launcherOverlayEmptyState">
                    <strong>該当する項目がありません</strong>
                    <span>検索語を変えてください。</span>
                  </div>
                )
              ) : selectedOverlayPageButtons.length > 0 ? (
                <div className="launcherTileGrid">
                  {selectedOverlayPageButtons.map((button) => (
                    <button
                      className={
                        launcherDisplayedItems[launcherSelectedIndex]?.button.id === button.id
                          ? "launcherTile launcherTile--selected"
                          : "launcherTile"
                      }
                      key={button.id}
                      onClick={() => {
                        runLauncherOverlayItem({
                          groupName: buttonGroupName(button),
                          pageName: getOverlayPageNameForButton(button, overlayPages),
                          button,
                        });
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
                      title={button.label}
                      type="button"
                    >
                      {renderButtonIcon(button, "launcherTileIcon")}
                      <span>{button.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="launcherOverlayEmptyState">
                  <strong>
                    {selectedOverlayPageKey === OVERLAY_ALL_PAGE_KEY
                      ? "まだ辞書に項目がありません"
                      : "このページには項目がありません"}
                  </strong>
                  <span>ファイルやフォルダーをドロップして登録できます。</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="mainPanel">
        <header className="topBar">
          <div className="topSummary">
            <h1 className={activeView === "records" ? "topTitle topTitle--records" : "topTitle"}>
              {activeView === "records" ? "記録" : `今日 ${todaySessionMinutes}分`}
            </h1>
            {activeView === "main" && (
              <span className="topDateLabel">{formatDateKeyForHeader(config.today.date)}</span>
            )}
          </div>
          <div className="topPills">
            <div
              aria-label={TOP_MENU_GROUP_LABELS.window}
              className="topPillGroup topPillGroup--window"
              role="group"
            >
            <button
              className={
                config.settings.autoStart
                  ? "viewToggleButton viewToggleButton--active"
                  : "viewToggleButton"
              }
              onClick={() => void toggleAutoStart()}
              title={config.settings.autoStart ? "Windows自動起動: ON" : "Windows自動起動: OFF"}
              aria-label={config.settings.autoStart ? "Windows自動起動: ON" : "Windows自動起動: OFF"}
              type="button"
            >
              <UiIcon name="power" size={18} />
              <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.autoStart}</span>
            </button>
            <button
              className="viewToggleButton"
              aria-busy={miniTransitioning}
              disabled={!config.settings.miniMode || miniTransitioning}
              onClick={() => void toggleMiniMode()}
              title={
                miniTransitioning
                  ? "ミニモードを準備中"
                  : config.settings.miniMode
                    ? "ミニモードへ切り替え"
                    : "設定でミニモードを有効にしてください"
              }
              aria-label="ミニモードへ切り替え"
              type="button"
            >
              <UiIcon name="miniMode" size={18} />
              <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.miniMode}</span>
            </button>
            </div>
            <div
              aria-label={TOP_MENU_GROUP_LABELS.work}
              className="topPillGroup topPillGroup--work"
              role="group"
            >
            <button
              className="viewToggleButton"
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
              onClick={() => void openInstructionsManually()}
              title="手順書を開く"
              type="button"
            >
              <UiIcon name="book" size={18} />
              <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.instructions}</span>
            </button>
            </div>
            <div
              aria-label={TOP_MENU_GROUP_LABELS.support}
              className="topPillGroup topPillGroup--support"
              role="group"
            >
            <button
              aria-label="使い方"
              className="viewToggleButton"
              onClick={() => setHelpGuideOpen(true)}
              title="使い方"
              type="button"
            >
              <UiIcon name="help" size={18} />
              <span className="viewToggleButtonLabel">{TOP_MENU_LABELS.guide}</span>
            </button>
            <button
              className="viewToggleButton"
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

        <div className="mainScrollArea app-scrollbar" id="main-content" ref={mainScrollAreaRef}>
        {banner && (
          <section className="banner">
            <span>{banner}</span>
            {backupPath && (
              <button className="bannerButton" onClick={openBackupFolder} type="button">
                バックアップから復元: フォルダを開く
              </button>
            )}
          </section>
        )}

        {activeView === "main" && weeklyReviewBannerOpen && (
          <section className="weeklyReviewBanner" aria-label="週次ふりかえりの案内">
            <span>先週のふりかえりが見られます</span>
            <div>
              <button
                className="weeklyReviewBannerPrimary"
                onClick={() => {
                  setWeeklyReviewBannerOpen(false);
                  setActiveView("records");
                }}
                type="button"
              >
                見る
              </button>
              <button onClick={() => setWeeklyReviewBannerOpen(false)} type="button">
                閉じる
              </button>
            </div>
          </section>
        )}

        {activeView === "records" ? (
          <section className="recordsView" data-skip-target="records" tabIndex={-1}>
            <section className="weeklyReviewSection" aria-labelledby="weekly-review-title">
              <div className="sectionHeading">
                <div>
                  <h2 id="weekly-review-title">先週のふりかえり</h2>
                  {weeklyReview && (
                    <span>
                      {weeklyReview.previousWeekStart} - {weeklyReview.previousWeekEnd}
                    </span>
                  )}
                </div>
              </div>

              <div className="weeklyReviewFacts">
                <div>
                  <span>合計時間</span>
                  <strong>{weeklyReview?.totalMinutes ?? 0}分</strong>
                </div>
                <div>
                  <span>活動日数</span>
                  <strong>{weeklyReview?.activeDays ?? 0}日</strong>
                </div>
                <div>
                  <span>動かしたプロジェクト</span>
                  <strong>{weeklyReviewProjects.length}件</strong>
                </div>
              </div>

              <div className="weeklyReviewBlock">
                <h3>動かしたプロジェクト</h3>
                {weeklyReviewProjects.length > 0 ? (
                  <div className="weeklyReviewProjectList">
                    {weeklyReviewProjects.map(({ summary, project }) => (
                      <div
                        className="weeklyReviewProjectRow"
                        key={summary.projectId ?? `label:${summary.label}`}
                      >
                        <div>
                          {project ? (
                            <ProjectIdentity
                              colorId={project.colorId}
                              name={project.name}
                              projectId={project.id}
                            />
                          ) : (
                            <strong>{summary.label}</strong>
                          )}
                          {project?.northStar && (
                            <span className="weeklyReviewNorthStar">
                              北極星: {project.northStar}
                            </span>
                          )}
                        </div>
                        <span>
                          {summary.sessionCount}セッション・{summary.totalMinutes}分
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="quietText">先週のセッション記録はありません。</p>
                )}
              </div>

              <div className="weeklyReviewBlock">
                <div className="weeklyReviewBlockHeading">
                  <h3>今週の重点</h3>
                  <span>
                    {config.projects.filter((project) => project.weeklyFocus === true).length}/
                    {WEEKLY_FOCUS_LIMIT}
                  </span>
                </div>
                <div className="weeklyFocusChecklist">
                  {config.projects.map((project) => (
                    <label key={project.id}>
                      <input
                        checked={project.weeklyFocus === true}
                        onChange={(event) =>
                          setWeeklyReviewProjectFocus(project.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <ProjectIdentity
                        colorId={project.colorId}
                        name={project.name}
                        projectId={project.id}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {staleNextStepProjects.length > 0 && (
                <div className="weeklyReviewBlock freshnessReview" aria-labelledby="freshness-title">
                  <h3 id="freshness-title">鮮度レビュー</h3>
                  <div className="freshnessReviewList">
                    {staleNextStepProjects.map((project) => (
                      <div className="freshnessReviewRow" key={project.id}>
                        <div className="freshnessReviewCopy">
                          <ProjectIdentity
                            colorId={project.colorId}
                            name={project.name}
                            projectId={project.id}
                          />
                          <strong>{project.nextStep}</strong>
                          <span>次の一手が14日以上同じです</span>
                        </div>
                        <div className="freshnessReviewActions">
                          <button onClick={() => openProjectEditDialog(project)} type="button">
                            書き直す
                          </button>
                          <button
                            onClick={() => void tryStaleNextStepForShortTime(project)}
                            type="button"
                          >
                            短時間で試す
                          </button>
                          <button onClick={() => void markNextStepReviewed(project.id)} type="button">
                            このまま
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="recordsStats">
              <div>
                <span>今日</span>
                <strong>{sessionSummary?.todayMinutes ?? 0}分</strong>
              </div>
              <div>
                <span>今週</span>
                <strong>{sessionSummary?.weekMinutes ?? 0}分</strong>
              </div>
              <div>
                <span>活動日数</span>
                <strong>{sessionSummary?.activeDays ?? 0}日</strong>
              </div>
            </div>

            <div className="recordsActions">
              <button className="dataFolderButton" onClick={openManualSessionDialog} type="button">
                セッションを追加
              </button>
            </div>

            <section className="recordsSection">
              <div className="sectionHeading">
                <h2>プロジェクト別（今週）</h2>
                <span>{sessionSummary?.date ?? config.today.date}</span>
              </div>
              {sessionSummary && sessionSummary.projects.length > 0 ? (
                <div className="recordsTable">
                  {sessionSummary.projects.map((project) => (
                    <div className="recordsTableRow" key={project.projectId ?? project.label}>
                      {project.projectId ? (
                        <ProjectIdentity
                          colorId={config.projects.find((item) => item.id === project.projectId)?.colorId}
                          name={project.label}
                          projectId={project.projectId}
                        />
                      ) : (
                        <span>{project.label}</span>
                      )}
                      <strong>{project.totalMinutes}分</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="quietText">今週のセッション記録はありません。</p>
              )}
            </section>

            <section className="recordsSection">
              <div className="sectionHeading">
                <h2>プロジェクト別累計</h2>
                <span>すべての記録</span>
              </div>
              {sessionSummary && sessionSummary.allTimeProjects.length > 0 ? (
                <div className="recordsTable">
                  {sessionSummary.allTimeProjects.map((project) => (
                    <div
                      className="recordsTableRow recordsTableRow--allTime"
                      key={project.projectId ?? project.label}
                    >
                      {project.projectId ? (
                        <ProjectIdentity
                          colorId={config.projects.find((item) => item.id === project.projectId)?.colorId}
                          name={project.label}
                          projectId={project.projectId}
                        />
                      ) : (
                        <span>{project.label}</span>
                      )}
                      <div className="recordsTotalMetrics">
                        <span>{project.activeDays}日</span>
                        <strong>{project.totalMinutes}分</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="quietText">セッション記録はまだありません。</p>
              )}
            </section>

            <section className="recordsSection">
              <div className="sectionHeading">
                <h2>最近のセッション</h2>
                <button
                  className="sectionLinkButton"
                  onClick={openRuntimeDataFolder}
                  title={sessionEntries?.path || sessionSummary?.path || "sessions.jsonl"}
                  type="button"
                >
                  保存先を開く
                </button>
              </div>

              <div className="recordsFilters">
                <input
                  className="textInput"
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder="検索"
                  value={sessionSearch}
                />
                <div className="filterGroup" aria-label="期間">
                  <span>期間</span>
                  <div className="segmentRow">
                  {[
                    ["week", "今週"],
                    ["today", "今日"],
                    ["all", "すべて"],
                  ].map(([value, label]) => (
                    <button
                      className={
                        sessionDateScope === value
                          ? "segmentButton segmentButton--active"
                          : "segmentButton"
                      }
                      key={value}
                      onClick={() => setSessionDateScope(value as RecordsDateScope)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                </div>
                <div className="filterGroup" aria-label="プロジェクト">
                  <span>プロジェクト</span>
                  <div className="projectFilterRow">
                  <button
                    className={
                      sessionProjectFilter ? "filterChip" : "filterChip filterChip--active"
                    }
                    onClick={() => setSessionProjectFilter("")}
                    type="button"
                  >
                    すべて
                  </button>
                  {config.projects.map((project) => (
                    <button
                      className={
                        sessionProjectFilter === project.id
                          ? "filterChip filterChip--active"
                          : "filterChip"
                      }
                      key={project.id}
                      onClick={() => setSessionProjectFilter(project.id)}
                      type="button"
                    >
                      {project.name}
                    </button>
                  ))}
                  </div>
                </div>
              </div>

              {sessionEntries && sessionEntries.entries.length > 0 ? (
                <div className="recentSessionList">
                  {sessionEntries.entries.map((session) => (
                    <div
                      className="recentSessionRow"
                      key={session.rowKey}
                    >
                      <div className="recentSessionMeta">
                        <span>{session.date}</span>
                        <span>{session.startedAt}</span>
                        {session.projectId ? (
                          <ProjectIdentity
                            colorId={config.projects.find((item) => item.id === session.projectId)?.colorId}
                            compact
                            name={session.label}
                            projectId={session.projectId}
                          />
                        ) : (
                          <strong>{session.label}</strong>
                        )}
                        <span>{session.minutes}分</span>
                      </div>
                      {session.note.trim() ? (
                        <p>{session.note}</p>
                      ) : (
                        <p className="quietText quietText--small">noteなし</p>
                      )}
                      <div className="sessionRowActions">
                        <button
                          className="secondaryButton"
                          onClick={() => openSessionEditDialog(session)}
                          type="button"
                        >
                          編集
                        </button>
                        <button
                          className="dangerButton"
                          onClick={() => requestSessionDelete(session)}
                          type="button"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="quietText">条件に一致するセッションがありません。検索語またはフィルターを変更してください。</p>
              )}
            </section>

            <section className="recordsSection">
              <div className="sectionHeading">
                <h2>旧notes履歴</h2>
                <button
                  className="sectionLinkButton"
                  onClick={openRuntimeDataFolder}
                  title={notesHistory?.path || "notes.json"}
                  type="button"
                >
                  保存先を開く
                </button>
              </div>
              {notesHistory && notesHistory.entries.length > 0 ? (
                <div className="notesHistoryList">
                  {notesHistory.entries.map((entry) => (
                    <div className="notesHistoryDay" key={entry.date}>
                      <strong>{entry.date}</strong>
                      <div className="notesList">
                        {toThreeNoteDraft(entry.items).map((item, index) => (
                          <input
                            aria-label={`${entry.date} できたこと ${index + 1}`}
                            className="textInput"
                            key={index}
                            maxLength={120}
                            onChange={(event) =>
                              updateHistoryNoteText(entry.date, index, event.target.value)
                            }
                            onBlur={() => flushHistoryNotesSave(entry.date)}
                            value={item}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="quietText">既存のnotes.jsonに旧記録がある場合だけ、ここで確認・編集できます。</p>
              )}
            </section>

            <div className="recordsFooter">
              <button className="dataFolderButton" onClick={openSettingsCenter} type="button">
                設定
              </button>
              <button className="dataFolderButton" onClick={openRuntimeDataFolder} type="button">
                データフォルダを開く
              </button>
            </div>
          </section>
        ) : (
          <>
            <section
              className={victoryDone ? "victoryBar victoryBar--done" : "victoryBar"}
              aria-label="今日の勝利条件"
            >
              <span className="victoryIcon" aria-hidden="true">
                🏆
              </span>
              <input
                aria-label="勝利条件を達成"
                checked={victoryDone}
                className="check victoryCheck"
                disabled={!victoryText}
                onChange={toggleVictoryDone}
                type="checkbox"
              />
              <div className="victoryContent">
                <span className="victoryLabel">今日の勝利条件</span>
                {victoryEditing || !victoryText ? (
                  <>
                    <input
                    aria-label="今日の勝利条件"
                    className={victoryDone ? "victoryInput victoryInput--done" : "victoryInput"}
                    maxLength={90}
                    onBlur={() => setVictoryEditing(false)}
                    onChange={(event) => updateVictoryText(event.target.value)}
                    onKeyDown={handleVictoryKeyDown}
                    placeholder="今日はこれができれば勝ち"
                    ref={victoryInputRef}
                      value={config.today.victory.text}
                    />
                    {!victoryText && victorySuggestions.length > 0 && (
                      <div className="victorySuggestions" aria-label="勝利条件の候補">
                        {victorySuggestions.map((suggestion) => (
                          <button
                            className="suggestionChip"
                            key={suggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyVictorySuggestion(suggestion)}
                            type="button"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className={
                      victoryDone
                        ? "victoryTextButton victoryTextButton--done"
                        : "victoryTextButton"
                    }
                    onClick={() => setVictoryEditing(true)}
                    type="button"
                  >
                    {config.today.victory.text}
                  </button>
                )}
              </div>
              {victoryDone && <span className="victoryBadge">達成</span>}
            </section>

            <section className="doNowBand" aria-labelledby="do-now-title" data-skip-target="main" tabIndex={-1}>
              {doNowSelection ? (
                <div className="doNowContent" data-project-color={resolveProjectColorId(doNowSelection.project.id, doNowSelection.project.colorId)}>
                  <div className="doNowCopy">
                    <div className="doNowKicker">
                      <h2 id="do-now-title">
                        <span aria-hidden="true" className="doNowStatusDot" />
                        今やる一手
                      </h2>
                      <span className="doNowProjectChip">
                        <ProjectIdentity
                          colorId={doNowSelection.project.colorId}
                          compact
                          name={doNowSelection.project.name}
                          projectId={doNowSelection.project.id}
                        />
                      </span>
                      {isDoNowRunning && activeTimer && (
                        <span className={activeTimer.paused ? "runningBadge runningBadge--paused" : "runningBadge runningBadge--running"}>
                          {activeTimer.paused ? "一時停止" : "実行中"}
                        </span>
                      )}
                    </div>
                    <strong title={doNowSelection.project.nextStep}>{doNowSelection.project.nextStep}</strong>
                    <div className="doNowMeta">
                      <span className="doNowMetaItem doNowMetaTimer">
                        <UiIcon name="clock" size={16} /> 通常 {doNowDefaultTimerMinutes}分
                      </span>
                      {doNowSelection.project.nextStepTrigger?.trim() && (
                        <span
                          className="doNowMetaItem doNowTrigger"
                          title={doNowSelection.project.nextStepTrigger.trim()}
                        >
                          <UiIcon name="external" size={16} />
                          {doNowSelection.project.nextStepTrigger.trim()}
                        </span>
                      )}
                      <span className="doNowReason">{doNowReason}</span>
                    </div>
                  </div>
                  <div className="doNowFooter">
                    <div className="doNowActions">
                      {isDoNowRunning && activeTimer ? (
                        <>
                          <button
                            aria-label={activeTimer.paused ? "このセッションを再開" : "このセッションを一時停止"}
                            className="runningPauseButton"
                            onClick={togglePause}
                            type="button"
                          >
                            <UiIcon name={activeTimer.paused ? "play" : "pause"} size={16} />
                            {activeTimer.paused ? "再開" : "一時停止"}
                          </button>
                          <button
                            className="runningStopButton"
                            onClick={() => void finishTimer(activeTimer)}
                            type="button"
                          >
                            終了
                          </button>
                        </>
                      ) : (
                        <>
                      <button
                        className="doNowStartPrimary"
                        onClick={() => startDoNowProject(doNowSelection.project, true)}
                        type="button"
                      >
                        <UiIcon name="play" size={16} /> {doNowShortTimerMinutes}分で始める
                      </button>
                      <button
                        className="doNowStartSecondary"
                        onClick={() => startDoNowProject(doNowSelection.project, false)}
                        type="button"
                      >
                        <UiIcon name="play" size={16} /> 通常 {doNowDefaultTimerMinutes}分
                      </button>
                        </>
                      )}
                      {doNowInstructionPath && (
                        <button
                          aria-label={`${doNowSelection.project.name}の手順書を開く`}
                          className="doNowInstructionButton"
                          onClick={() => {
                            void openInstructionWindow({ path: doNowInstructionPath, focus: true }).catch((error) => {
                              showToast(
                                "error",
                                `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
                              );
                            });
                          }}
                          type="button"
                        >
                          <UiIcon name="book" size={16} /> 手順書
                        </button>
                      )}
                    </div>
                    {doNowCandidates.length > 1 && (
                      <button
                        className="doNowAlternateButton"
                        onClick={() =>
                          setDoNowCandidateIndex((index) => (index + 1) % doNowCandidates.length)
                        }
                        type="button"
                      >
                        別の候補 →
                      </button>
                    )}
                  </div>
                </div>
              ) : focusedProjects.length > 0 ? (
                <>
                  <div className="doNowHeading">
                    <h2 id="do-now-title">今やる一手</h2>
                  </div>
                  <div className="doNowEmpty">
                    <span>重点プロジェクトに次の一手を設定すると、ここに提案されます。</span>
                    <button onClick={() => openProjectEditDialog(focusedProjects[0])} type="button">
                      次の一手を設定
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="doNowHeading">
                    <h2 id="do-now-title">今やる一手</h2>
                  </div>
                  <div className="doNowEmpty">
                    <span>今週の重点を選ぶと、今やる一手を提案できます。</span>
                    <button onClick={() => setActiveView("records")} type="button">
                      重点を選ぶ
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="focusBand">
              <div className="sectionHeading sectionHeading--compact sectionHeading--inlineActions">
                <h2>今日の3件</h2>
                <div className="sectionHeadingActions">
                  <button
                    aria-label="今日の3件に追加"
                    className="sectionAddButton"
                    disabled={todayRemaining <= 0 || todayAddOpen}
                    onClick={() => setTodayAddOpen(true)}
                    title={todayRemaining <= 0 ? "3件まで追加できます" : "今日の3件に追加"}
                    type="button"
                  >
                    <UiIcon name="add" size={16} />
                    追加
                  </button>
                  <span>{config.today.items.length}/{TODAY_ITEM_LIMIT}</span>
                </div>
              </div>
              <div className="todayList">
                {config.today.items.length === 0 && (
                  <p className="quietText">今日はまだありません。「今日を組み立てる」から選べます。</p>
                )}
                {config.today.items.map((item, index) => (
                  <div
                    className={[
                      "todayRow",
                      todayPointerDrag === index ? "todayRow--dragging" : "",
                      activeTimer?.sourceId === `today-${index}` ? "todayRow--running" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-today-index={index}
                    key={`${item.text}-${index}`}
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
                    onKeyDown={(event) =>
                      openContextMenuFromKeyboard(event, { kind: "today", index, itemText: item.text })
                    }
                    onPointerCancel={cancelTodayPointerDrag}
                    onPointerDown={(event) => startTodayPointerDrag(event, index)}
                    onPointerMove={updateTodayPointerDrag}
                    onPointerUp={finishTodayPointerDrag}
                    tabIndex={0}
                  >
                    <input
                      aria-label="完了"
                      checked={item.done}
                      className="check"
                      onChange={() => toggleTodayDone(index)}
                      type="checkbox"
                    />
                    <div className="todayItemCopy">
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
                      {todayTriggerEditingIndex === index ? (
                        <input
                          aria-label="いつ・何の後にやる？"
                          autoFocus
                          className="todayTriggerInput"
                          maxLength={EXECUTION_TRIGGER_MAX_CHARS}
                          onBlur={cancelTodayTriggerEdit}
                          onChange={(event) => setTodayTriggerDraft(event.target.value)}
                          onKeyDown={(event) => handleTodayTriggerKeyDown(event, index)}
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder="例: 21時 / 夕食後"
                          value={todayTriggerDraft}
                        />
                      ) : item.trigger || todayEditingIndex !== index ? (
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
                      ) : null}
                      {todayEditingIndex === index ? (
                        <input
                          aria-label="今日の項目"
                          autoFocus
                          className={
                            item.done ? "todayEditInput todayEditInput--done" : "todayEditInput"
                          }
                          maxLength={90}
                          onBlur={() => setTodayEditingIndex(null)}
                          onChange={(event) => updateTodayText(index, event.target.value)}
                          onKeyDown={handleTodayEditKeyDown}
                          onPointerDown={(event) => event.stopPropagation()}
                          value={item.text}
                        />
                      ) : (
                        <button
                          className={
                            item.done ? "todayTextButton todayTextButton--done" : "todayTextButton"
                          }
                          onClick={() => {
                            cancelTodayTriggerEdit();
                            setTodayEditingIndex(index);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          {item.text || "未入力"}
                        </button>
                      )}
                      {activeTimer?.sourceId === `today-${index}` && (
                        <span
                          className={
                            activeTimer.paused
                              ? "runningBadge runningBadge--paused"
                              : "runningBadge runningBadge--running"
                          }
                        >
                          {activeTimer.paused ? "一時停止" : "実行中"}
                        </span>
                      )}
                    </div>
                    {activeTimer?.sourceId === `today-${index}` ? (
                      <div className="todayTimerActions todayTimerActions--running">
                        <button
                          aria-label={
                            activeTimer.paused
                              ? "このセッションを再開"
                              : "このセッションを一時停止"
                          }
                          className="runningPauseButton"
                          onClick={togglePause}
                          title={activeTimer.paused ? "このセッションを再開" : "このセッションを一時停止"}
                          type="button"
                        >
                          <UiIcon name={activeTimer.paused ? "play" : "pause"} size={16} />
                          {activeTimer.paused ? "再開" : "一時停止"}
                        </button>
                        <button
                          className="runningStopButton"
                          onClick={() => void finishTimer(activeTimer)}
                          title="このセッションを終了"
                          type="button"
                        >
                          終了
                        </button>
                      </div>
                    ) : (
                      <div className="todayTimerActions">
                        <button
                          aria-label={`短時間タイマー${config.settings.shortTimerMinutes}分で開始`}
                          className="todayStartButton todayStartButton--short"
                          disabled={!item.text.trim()}
                          onClick={() =>
                            void startTimer(
                              `today-${index}`,
                              item.projectId && projectsById.has(item.projectId)
                                ? (projectsById.get(item.projectId)?.name ?? item.text)
                                : item.text,
                              item.projectId && projectsById.has(item.projectId) ? item.projectId : null,
                              (item.buttonIds ?? []).flatMap(
                                (buttonId) => buttonsById.get(buttonId)?.actions ?? [],
                              ),
                              config.settings.shortTimerMinutes,
                              item.text,
                              item.instructionPath,
                              item.instructionOpenOnStart,
                            )
                          }
                          title={`短時間タイマー: ${config.settings.shortTimerMinutes}分`}
                          type="button"
                        >
                          <span aria-hidden="true" className="nextStepStartGlyph">
                            <UiIcon name="play" size={16} />
                          </span>
                          <span aria-hidden="true" className="nextStepStartDuration">
                            {config.settings.shortTimerMinutes}分
                          </span>
                        </button>
                        <button
                          aria-label={`通常タイマー${config.settings.defaultTimerMinutes}分で開始`}
                          className="todayStartButton todayStartButton--normal"
                          disabled={!item.text.trim()}
                          onClick={() =>
                            void startTimer(
                              `today-${index}`,
                              item.projectId && projectsById.has(item.projectId)
                                ? (projectsById.get(item.projectId)?.name ?? item.text)
                                : item.text,
                              item.projectId && projectsById.has(item.projectId) ? item.projectId : null,
                              (item.buttonIds ?? []).flatMap(
                                (buttonId) => buttonsById.get(buttonId)?.actions ?? [],
                              ),
                              config.settings.defaultTimerMinutes,
                              item.text,
                              item.instructionPath,
                              item.instructionOpenOnStart,
                            )
                          }
                          title={`通常タイマー: ${config.settings.defaultTimerMinutes}分`}
                          type="button"
                        >
                          <span aria-hidden="true" className="nextStepStartGlyph">
                            <UiIcon name="play" size={16} />
                          </span>
                          <span aria-hidden="true" className="nextStepStartDuration">
                            {config.settings.defaultTimerMinutes}分
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {todayRemaining > 0 && todayAddOpen && (
                <form
                  className="todayAddRow"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTodayItem();
                  }}
                >
                  <input
                    aria-label="今日に追加"
                    autoFocus
                    className="todayEditInput"
                    maxLength={90}
                    onChange={(event) => setTodayDraft(event.target.value)}
                    onKeyDown={handleTodayAddKeyDown}
                    placeholder={`あと${todayRemaining}件`}
                    value={todayDraft}
                  />
                  <button className="primaryButton" disabled={!todayDraft.trim()} type="submit">
                    追加
                  </button>
                </form>
              )}
            </section>

            <section className="todayBuilderBand">
              <div className="disclosureHeader todayBuilderHeader">
                <button
                  className="disclosure todayBuilderDisclosure"
                  onClick={toggleTodayBuilder}
                  type="button"
                >
                  <UiIcon name={todayBuilderOpen ? "chevronDown" : "chevronRight"} size={16} />
                  <span className="disclosureLabel">
                    <strong>今日を組み立てる</strong>
                    <span className="disclosureDescription">候補から今日の行動を選ぶ</span>
                  </span>
                </button>
                <button
                  aria-label="やりたいことを追加"
                  className="sectionAddButton todayBuilderHeaderAdd"
                  disabled={todayBuilderAddOpen}
                  onClick={() => {
                    setTodayBuilderOpen(true);
                    setTodayBuilderAddOpen(true);
                  }}
                  title="やりたいことを追加"
                  type="button"
                >
                  <UiIcon name="add" size={16} />
                </button>
                <span className="disclosureCount">{todayBuilderCandidates.length}</span>
              </div>
              {todayBuilderOpen && (
                <div className="todayBuilderBody">
                  {todayBuilderAddOpen ? (
                    <form
                      className="addRow inboxAddRow todayBuilderAddRow"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addTodayBuilderDraft();
                      }}
                    >
                      <input
                        aria-label="やりたいことに追加"
                        data-today-builder-add-input
                        autoFocus
                        className="textInput"
                        maxLength={120}
                        onChange={(event) => setTodayBuilderDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setTodayBuilderDraft("");
                            setTodayBuilderAddOpen(false);
                          }
                        }}
                        value={todayBuilderDraft}
                      />
                      <button className="primaryButton" disabled={!todayBuilderDraft.trim()} type="submit">
                        追加
                      </button>
                    </form>
                  ) : (
                    <button
                      className="inboxAddPrompt todayBuilderAddPrompt"
                      onClick={() => setTodayBuilderAddOpen(true)}
                      type="button"
                    >
                      <UiIcon name="add" size={16} />
                      追加
                    </button>
                  )}
                  {todayBuilderCandidates.length === 0 ? (
                    <p className="quietText">
                      候補はまだありません。やりたいことやプロジェクトの次の一手を追加するとここに表示されます。
                    </p>
                  ) : (
                    todayBuilderCandidates.map((candidate, index) => (
                      <div
                        className={
                          todayBuilderPointerDrag?.index === index
                            ? "todayBuilderRow todayBuilderRow--dragging"
                            : "todayBuilderRow"
                        }
                        data-today-builder-index={index}
                        key={candidate.key}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openContextMenu(
                            { kind: "todayBuilder", index, candidateKey: candidate.key },
                            event.clientX,
                            event.clientY,
                            event.currentTarget,
                          );
                        }}
                        onKeyDown={(event) =>
                          openContextMenuFromKeyboard(event, {
                            kind: "todayBuilder",
                            index,
                            candidateKey: candidate.key,
                          })
                        }
                        onPointerCancel={cancelTodayBuilderPointerDrag}
                        onPointerDown={(event) => startTodayBuilderPointerDrag(event, index)}
                        onPointerMove={updateTodayBuilderPointerDrag}
                        onPointerUp={finishTodayBuilderPointerDrag}
                        tabIndex={0}
                      >
                        <div>
                          <span className="todayBuilderSource">{candidate.source}</span>
                          <strong>{candidate.text}</strong>
                        </div>
                        <div className="todayBuilderActions">
                          <select
                            aria-label={`${candidate.text}の追加先`}
                            className="todayBuilderDestination"
                            onChange={(event) =>
                              setTodayBuilderDestinations((current) => ({
                                ...current,
                                [candidate.text]: event.target.value,
                              }))
                            }
                            value={todayBuilderDestinations[candidate.text] ?? "today"}
                          >
                            <option value="today">今日の3件</option>
                            <option value="victory">勝利条件</option>
                            <option value="inbox">やりたいこと</option>
                          </select>
                          <button
                            className="primaryButton todayBuilderAddButton"
                            disabled={
                              (todayBuilderDestinations[candidate.text] ?? "today") === "today" &&
                              todayRemaining <= 0
                            }
                            onClick={() =>
                              applyTodayBuilderCandidate(
                                candidate,
                                todayBuilderDestinations[candidate.text] ?? "today",
                              )
                            }
                            type="button"
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {todayBuilderPointerDrag?.targetIndicator && (
                    <div
                      aria-hidden="true"
                      className="todayBuilderDropIndicator"
                      style={todayBuilderPointerDrag.targetIndicator}
                    />
                  )}
                  {todayBuilderPointerDrag && (
                    <div
                      aria-hidden="true"
                      className="todayBuilderDragGhost"
                      style={{
                        height: todayBuilderPointerDrag.height,
                        left: todayBuilderPointerDrag.pointerX - todayBuilderPointerDrag.offsetX,
                        top: todayBuilderPointerDrag.pointerY - todayBuilderPointerDrag.offsetY,
                        width: todayBuilderPointerDrag.width,
                      }}
                    >
                      <span className="todayBuilderSource">
                        {todayBuilderCandidates[todayBuilderPointerDrag.index]?.source}
                      </span>
                      <strong>{todayBuilderCandidates[todayBuilderPointerDrag.index]?.text}</strong>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section
              className="projectsBand"
              onContextMenu={(event) => {
                event.preventDefault();
                openContextMenu({ kind: "projects" }, event.clientX, event.clientY, event.currentTarget);
              }}
              tabIndex={-1}
            >
              <div
                className="sectionHeading sectionHeading--inlineActions"
                onContextMenu={(event) => {
                  event.preventDefault();
                  openContextMenu({ kind: "projects" }, event.clientX, event.clientY, event.currentTarget);
                }}
                tabIndex={-1}
              >
                <h2>次の一手</h2>
                <div className="sectionHeadingActions">
                  <button
                    aria-label="次の一手を追加"
                    className="sectionAddButton"
                    onClick={openProjectAddDialog}
                    title="次の一手を追加"
                    type="button"
                  >
                    <UiIcon name="add" size={16} />
                    追加
                  </button>
                  <span>{config.projects.length}件</span>
                </div>
              </div>
              <div className="projectGrid">
                {config.projects.map((project) => {
                  const projectButtons = project.buttonIds
                    .map((buttonId) => buttonsById.get(buttonId))
                    .filter((button): button is LauncherButton => Boolean(button));
                  const actions = projectButtons.flatMap((button) => button.actions);
                  const hasBrokenButton = project.buttonIds.length > projectButtons.length;
                  const opensInstructionOnStart = Boolean(
                    project.instructionPath && project.instructionOpenOnStart !== false,
                  );
                  const isRunningProject = activeTimer?.sourceId === project.id;
                  const projectDefaultTimerMinutes =
                    project.defaultTimerMinutes ?? config.settings.defaultTimerMinutes;
                  const projectShortTimerMinutes =
                    project.shortTimerMinutes ?? config.settings.shortTimerMinutes;
                  return (
                    <article
                      className={
                        [
                          "projectCard",
                          projectPointerDrag?.id === project.id ? "projectCard--dragging" : "",
                          isRunningProject ? "projectCard--running" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                      data-project-color={resolveProjectColorId(project.id, project.colorId)}
                      data-project-id={project.id}
                      key={project.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(
                          { kind: "project", project },
                          event.clientX,
                          event.clientY,
                          event.currentTarget,
                        );
                      }}
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, { kind: "project", project })
                      }
                      onPointerCancel={cancelProjectPointerDrag}
                      onPointerDown={(event) => startProjectPointerDrag(event, project.id)}
                      onPointerMove={updateProjectPointerDrag}
                      onPointerUp={finishProjectPointerDrag}
                      tabIndex={0}
                    >
                      <div className="projectCopy">
                        <div className="projectTitleRow">
                          <h3>
                            <ProjectIdentity
                              colorId={project.colorId}
                              name={project.name}
                              projectId={project.id}
                            />
                          </h3>
                          {isRunningProject && activeTimer && (
                            <span className={activeTimer.paused ? "runningBadge runningBadge--paused" : "runningBadge runningBadge--running"}>
                              {activeTimer.paused ? "一時停止" : "実行中"}
                            </span>
                          )}
                          {project.instructionPath && (
                            <button
                              aria-label={`${project.name}の手順書を開く`}
                              className="projectInstructionButton"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openInstructionWindow({
                                  path: project.instructionPath,
                                  focus: true,
                                }).catch((error) => {
                                  showToast(
                                    "error",
                                    `手順書を開けません: ${
                                      error instanceof Error ? error.message : String(error)
                                    }`,
                                  );
                                });
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              title="手順書を開く"
                              type="button"
                            >
                              <UiIcon name="book" size={18} />
                            </button>
                          )}
                          <button
                            aria-label="プロジェクトを編集" className="projectEditButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProjectEditDialog(project);
                            }}
                            title="編集"
                            type="button"
                          >
                            <UiIcon name="edit" size={16} />
                          </button>
                        </div>
                        <p className={project.nextStep.trim() ? "" : "projectNextStepPlaceholder"} title={project.nextStep.trim() || "次の一手を書く"}>
                          {project.nextStepTrigger?.trim() && (
                            <span className="projectNextStepTrigger">
                              {project.nextStepTrigger.trim()} ▸{" "}
                            </span>
                          )}
                          {project.nextStep.trim() || "次の一手を書く"}
                        </p>
                      </div>
                      {isRunningProject && activeTimer && (
                        <div className="projectActions projectActions--running">
                          <button
                            aria-label={activeTimer.paused ? "このセッションを再開" : "このセッションを一時停止"} className="runningPauseButton"
                            onClick={togglePause}
                            title={activeTimer.paused ? "このセッションを再開" : "このセッションを一時停止"}
                            type="button"
                          >
                            <><UiIcon name={activeTimer.paused ? "play" : "pause"} size={16} /> {activeTimer.paused ? "再開" : "一時停止"}</>
                          </button>
                          <button
                            className="runningStopButton"
                            onClick={() => void finishTimer(activeTimer)}
                            title="このセッションを終了"
                            type="button"
                          >
                            終了
                          </button>
                        </div>
                      )}
                      {(project.buttonIds.length > 0 || opensInstructionOnStart) &&
                        !isRunningProject && (
                        <div className="projectActions">
                          <button
                            aria-label={`短時間タイマー${projectShortTimerMinutes}分で開始`}
                            className="shortStartButton"
                            disabled={
                              (!opensInstructionOnStart && actions.length === 0) ||
                              pendingActionId === project.id
                            }
                            onClick={() =>
                              void startTimer(
                                project.id,
                                project.name,
                                project.id,
                                actions,
                                projectShortTimerMinutes,
                                project.startNoteTemplate,
                              )
                            }
                            title={
                              hasBrokenButton
                                ? "buttonIdsに見つからない項目があります"
                                : `短時間タイマー: ${projectShortTimerMinutes}分`
                            }
                            type="button"
                          >
                            <span aria-hidden="true" className="nextStepStartGlyph">
                              <UiIcon name="play" size={18} />
                            </span>
                            <span aria-hidden="true" className="nextStepStartDuration">
                              {projectShortTimerMinutes}分
                            </span>
                          </button>
                          <button
                            aria-label={
                              hasBrokenButton
                                ? "実行ボタンに見つからない項目があります"
                                : `通常タイマー${projectDefaultTimerMinutes}分で開始`
                            }
                            className="startButton"
                            disabled={
                              (!opensInstructionOnStart && actions.length === 0) ||
                              pendingActionId === project.id
                            }
                            onClick={() =>
                              void startTimer(
                                project.id,
                                project.name,
                                project.id,
                                actions,
                                projectDefaultTimerMinutes,
                                project.startNoteTemplate,
                              )
                            }
                            title={
                              hasBrokenButton
                                ? "buttonIdsに見つからない項目があります"
                                : "通常タイマーで開始"
                            }
                            type="button"
                          >
                            {pendingActionId === project.id ? (
                              <span className="spinner" />
                            ) : (
                              <>
                                <span aria-hidden="true" className="nextStepStartGlyph">
                                  <UiIcon name="play" size={18} />
                                </span>
                                <span aria-hidden="true" className="nextStepStartDuration">
                                  {projectDefaultTimerMinutes}分
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {projectPointerDrag?.targetIndicator && (
                <div
                  aria-hidden="true"
                  className="projectDropIndicator"
                  style={projectPointerDrag.targetIndicator}
                />
              )}
              {projectPointerDrag && (
                <div
                  aria-hidden="true"
                  className="projectDragGhost"
                  style={{
                    height: projectPointerDrag.height,
                    left: projectPointerDrag.pointerX - projectPointerDrag.offsetX,
                    top: projectPointerDrag.pointerY - projectPointerDrag.offsetY,
                    width: projectPointerDrag.width,
                  }}
                >
                  {(() => {
                    const project = config.projects.find((item) => item.id === projectPointerDrag.id);
                    return project ? (
                      <>
                        <ProjectIdentity colorId={project.colorId} compact name={project.name} projectId={project.id} />
                        <strong>{project.nextStep || "次の一手を書く"}</strong>
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </section>

            <section className="inboxBand">
              <div className="disclosureHeader" data-inbox-header>
                <button
                  aria-expanded={inboxOpen}
                  className="disclosure"
                  onClick={() => setInboxOpen((open) => !open)}
                  type="button"
                >
                  <UiIcon name={inboxOpen ? "chevronDown" : "chevronRight"} size={16} />
                  <span className="disclosureLabel">
                    <strong>やりたいこと</strong>
                    <span className="disclosureDescription">あとで整理する一時置き場</span>
                  </span>
                </button>
                <button
                  aria-label="やりたいことを追加"
                  className="sectionAddButton sectionAddButton--icon"
                  disabled={inboxAddOpen}
                  onClick={() => {
                    setInboxOpen(true);
                    setInboxAddOpen(true);
                  }}
                  title="やりたいことを追加"
                  type="button"
                >
                  <UiIcon name="add" size={16} />
                </button>
                <span className="disclosureCount">{config.inbox.length}</span>
              </div>

              {inboxOpen && (
                <div className="inboxBody">
                  {inboxAddOpen ? (
                    <form
                      className="addRow inboxAddRow"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addInboxItem();
                      }}
                    >
                      <input
                        aria-label="やりたいことに追加"
                        autoFocus
                        className="textInput"
                        maxLength={120}
                        onChange={(event) => setInboxDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape") return;
                          setInboxDraft("");
                          setInboxAddOpen(false);
                        }}
                        value={inboxDraft}
                      />
                      <button className="primaryButton" disabled={!inboxDraft.trim()} type="submit">
                        追加
                      </button>
                    </form>
                  ) : (
                    <button
                      className="inboxAddPrompt"
                      onClick={() => setInboxAddOpen(true)}
                      type="button"
                    >
                      <UiIcon name="add" size={16} /> 追加
                    </button>
                  )}
                  <div className="inboxList">
                    {config.inbox.map((item, index) => (
                      <div
                        className={inboxPointerDrag?.index === index ? "inboxRow inboxRow--dragging" : "inboxRow"}
                        data-inbox-index={index}
                        key={`${item.text}-${index}`}
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
                        onKeyDown={(event) =>
                          openContextMenuFromKeyboard(event, { kind: "inbox", index, itemText: item.text })
                        }
                        onPointerCancel={cancelInboxPointerDrag}
                        onPointerDown={(event) => startInboxPointerDrag(event, index)}
                        onPointerMove={updateInboxPointerDrag}
                        onPointerUp={finishInboxPointerDrag}
                        tabIndex={0}
                      >
                        <span className="inboxItemCopy">
                          {item.projectId && projectsById.has(item.projectId) && (
                            <span className="inboxProjectIdentity">
                              <ProjectIdentity
                                colorId={projectsById.get(item.projectId)?.colorId}
                                compact
                                name={projectsById.get(item.projectId)?.name ?? ""}
                                projectId={item.projectId}
                              />
                            </span>
                          )}
                          <span className="inboxItemText">{item.text}</span>
                        </span>
                        <button
                          className="moveTodayButton"
                          onClick={() => moveInboxItemToToday(index)}
                          onPointerDown={(event) => event.stopPropagation()}
                          title="今日へ"
                          type="button"
                        >
                          今日へ
                        </button>
                      </div>
                    ))}
                  </div>
                  {inboxPointerDrag?.targetIndicator && (
                    <div aria-hidden="true" className="inboxDropIndicator" style={inboxPointerDrag.targetIndicator} />
                  )}
                  {inboxPointerDrag && (
                    <div
                      aria-hidden="true"
                      className="inboxDragGhost"
                      style={{
                        height: inboxPointerDrag.height,
                        left: inboxPointerDrag.pointerX - inboxPointerDrag.offsetX,
                        top: inboxPointerDrag.pointerY - inboxPointerDrag.offsetY,
                        width: inboxPointerDrag.width,
                      }}
                    >
                      {config.inbox[inboxPointerDrag.index]?.text}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="todayActivityBand">
              <button
                aria-expanded={todayActivityOpen}
                className="disclosure disclosure--automatic"
                onClick={() => setTodayActivityOpen((open) => !open)}
                type="button"
              >
                <UiIcon name={todayActivityOpen ? "chevronDown" : "chevronRight"} size={16} />
                <span className="disclosureLabel">
                  <strong>今日の実行</strong>
                  <span className="disclosureDescription">タイマーで実行した内容</span>
                </span>
                <span className="todayActivityAutoBadge">自動</span>
                <span className="disclosureCount">{todayActivityCount}</span>
              </button>

              {todayActivityOpen && (
                <div className="todayActivityBody">
                  {todayActivityCount > 0 ? (
                    <div className="todayActivityList">
                      {todayActivityEntries.map((session) => {
                        const project = session.projectId
                          ? config.projects.find((item) => item.id === session.projectId)
                          : undefined;
                        return (
                          <div className="todayActivityRow" key={session.rowKey}>
                            <div className="todayActivityIdentity">
                              {project ? (
                                <ProjectIdentity
                                  colorId={project.colorId}
                                  compact
                                  name={session.label || project.name}
                                  projectId={project.id}
                                />
                              ) : (
                                <>
                                  <span aria-hidden="true" className="todayActivityDot" />
                                  <span>{session.label || "記録"}</span>
                                </>
                              )}
                            </div>
                            <span className="todayActivityStartedAt">{session.startedAt}</span>
                            <strong>{session.minutes}分</strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="quietText">今日はまだ実行記録がありません。</p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
        </div>

      </section>

      <div aria-live="polite" className="reorderAnnouncement" role="status">
        {reorderAnnouncement}
      </div>

      {toasts.length > 0 && (
        <div aria-live="polite" className="toastStack">
          {toasts.map((toast) => (
            <div
              className={`toast toast--${toast.tone}${toast.leaving ? " toast--leaving" : ""}`}
              key={toast.id}
              role="status"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          ariaLabel="操作メニュー"
          onClose={() => dismissContextMenu(false)}
          opener={contextMenuReturnFocusRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          {contextMenu.kind === "overlayPage" ? (
            <>
              <ContextMenuItem
                disabled={overlayPages.findIndex((page) => page.id === contextMenu.page.id) <= 0}
                onClick={() => void moveOverlayPageByOffset(contextMenu.page.id, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  overlayPages.findIndex((page) => page.id === contextMenu.page.id) >=
                  overlayPages.length - 1
                }
                onClick={() => void moveOverlayPageByOffset(contextMenu.page.id, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openOverlayPageDialog(contextMenu.page)} type="button">
                名前を変更
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => deleteOverlayPage(contextMenu.page)}
                type="button"
              >
                ページを削除
              </ContextMenuItem>
            </>
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
                    disabled={
                      (() => {
                        const groupButtons = (config?.buttons ?? []).filter(
                          (button) =>
                            showButtonInSidebar(button) &&
                            buttonGroupName(button) === buttonGroupName(contextMenu.button),
                        );
                        return (
                          groupButtons.findIndex((button) => button.id === contextMenu.button.id) >=
                          groupButtons.length - 1
                        );
                      })()
                    }
                    onClick={() => void moveSidebarButtonByOffset(contextMenu.button.id, 1)}
                    type="button"
                  >
                    下へ移動
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuItem onClick={() => openButtonEditDialog(contextMenu.button)} type="button">
                編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => deleteButton(contextMenu.button)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "today" ? (
            <>
              <ContextMenuItem
                disabled={contextMenu.index <= 0}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index >= (config?.today.items.length ?? 0) - 1}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => {
                  setContextMenu(null);
                  removeTodayItem(contextMenu.index);
                }}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "todayBuilder" ? (
            <>
              <ContextMenuItem
                disabled={contextMenu.index <= 0}
                onClick={() => moveTodayBuilderCandidateByOffset(contextMenu.index, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index >= todayBuilderCandidates.length - 1}
                onClick={() => moveTodayBuilderCandidateByOffset(contextMenu.index, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "inbox" ? (
            <>
              <ContextMenuItem
                disabled={contextMenu.index <= 0}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index >= (config?.inbox.length ?? 0) - 1}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem onClick={() => beginInboxEdit(contextMenu.index)} type="button">
                編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => deleteInboxItem(contextMenu.index)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "project" ? (
            <>
              <ContextMenuItem
                disabled={config?.projects.findIndex((project) => project.id === contextMenu.project.id) === 0}
                onClick={() => void moveProjectByOffset(contextMenu.project.id, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  config?.projects.findIndex((project) => project.id === contextMenu.project.id) ===
                  (config?.projects.length ?? 0) - 1
                }
                onClick={() => void moveProjectByOffset(contextMenu.project.id, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openProjectEditDialog(contextMenu.project)} type="button">
                編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => deleteProject(contextMenu.project)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "projects" ? (
            <ContextMenuItem onClick={openProjectAddDialog} type="button">
              プロジェクト追加
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuItem onClick={openGroupDialog} type="button">
                グループ追加
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
        <div
          className="modalBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) commitInboxEdit();
          }}
          role="presentation"
        >
          <section
            aria-label="やりたいこと編集"
            aria-modal="true"
            className="dropDialog inboxEditDialog"
            role="dialog"
            tabIndex={-1}
          >
            <div>
              <p className="eyebrow">Someday</p>
              <h2>やりたいことを編集</h2>
            </div>

            <label className="fieldStack">
              <span>やりたいこと</span>
              <input
                autoFocus
                className="textInput"
                maxLength={120}
                onChange={(event) => setInboxEditDraft(event.target.value)}
                value={inboxEditDraft}
              />
            </label>

            <fieldset className="inboxProjectChoices">
              <legend>プロジェクト</legend>
              <label>
                <input
                  checked={!inboxEditProjectId}
                  name="inbox-project"
                  onChange={() => setInboxEditProjectId("")}
                  type="radio"
                />
                <span>プロジェクトなし</span>
              </label>
              {config.projects.map((project) => (
                <label key={project.id}>
                  <input
                    checked={inboxEditProjectId === project.id}
                    name="inbox-project"
                    onChange={() => setInboxEditProjectId(project.id)}
                    type="radio"
                  />
                  <ProjectIdentity
                    colorId={project.colorId}
                    compact
                    name={project.name}
                    projectId={project.id}
                  />
                </label>
              ))}
            </fieldset>

            <h3 className="formSectionHeading">手順書</h3>
            <div className="fieldStack inboxStartEnvironmentSection">
              <select
                aria-label="手順書を選択"
                className="textInput"
                disabled={instructionChoicesLoading}
                onChange={(event) => {
                  const instructionPath = event.target.value;
                  setInboxEditInstructionPath(instructionPath);
                  setInboxEditInstructionOpenOnStart(
                    instructionPath
                      ? inboxEditInstructionPath
                        ? inboxEditInstructionOpenOnStart
                        : true
                      : false,
                  );
                }}
                value={inboxEditInstructionPath}
              >
                <option value="">
                  {instructionChoicesLoading ? "手順書を読み込み中…" : "手順書なし"}
                </option>
                {inboxEditInstructionPath &&
                  !instructionChoices.some((choice) => choice.path === inboxEditInstructionPath) && (
                    <option value={inboxEditInstructionPath}>
                      現在の設定（登録フォルダ内に見つかりません）
                    </option>
                  )}
                {instructionChoices.map((choice) => (
                  <option key={choice.path} value={choice.path}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {instructionChoicesError && (
                <div className="projectInstructionLoadError" role="status">
                  <small>一覧を読み込めません: {instructionChoicesError}</small>
                  <button onClick={() => void refreshInstructionChoices()} type="button">
                    再読込
                  </button>
                </div>
              )}
              <label className="projectWeeklyFocusToggle projectInstructionStartToggle">
                <input
                  checked={inboxEditInstructionOpenOnStart}
                  disabled={!inboxEditInstructionPath}
                  onChange={(event) => setInboxEditInstructionOpenOnStart(event.target.checked)}
                  type="checkbox"
                />
                <span>タイマー開始時に手順書を開く</span>
              </label>
            </div>

            <h3 className="formSectionHeading">開始環境</h3>
            <div className="fieldStack inboxStartEnvironmentSection">
              <span>実行ボタン</span>
              <span className="quietText">タイマー開始時に一緒に実行します</span>
              <div className="checkList app-scrollbar">
                {visibleSidebarButtons.length === 0 && (
                  <span className="quietText">サイドバーに実行ボタンがありません</span>
                )}
                {visibleSidebarButtons.map((button) => (
                  <label className="checkListItem" key={button.id}>
                    <input
                      checked={inboxEditButtonIds.includes(button.id)}
                      onChange={(event) =>
                        setInboxEditButtonIds((current) =>
                          event.target.checked
                            ? [...current, button.id]
                            : current.filter((id) => id !== button.id),
                        )
                      }
                      type="checkbox"
                    />
                    <span>{button.icon ?? "◇"}</span>
                    <strong>{button.label}</strong>
                  </label>
                ))}
              </div>
              {dictionaryOnlyButtons.length > 0 && (
                <details className="projectDictionaryButtons">
                  <summary>
                    <span>辞書から選ぶ</span>
                    <span>
                      {dictionaryOnlyButtons.filter((button) => inboxEditButtonIds.includes(button.id)).length}/
                      {dictionaryOnlyButtons.length}
                    </span>
                  </summary>
                  <div className="checkList app-scrollbar">
                    {dictionaryOnlyButtons.map((button) => (
                      <label className="checkListItem" key={button.id}>
                        <input
                          checked={inboxEditButtonIds.includes(button.id)}
                          onChange={(event) =>
                            setInboxEditButtonIds((current) =>
                              event.target.checked
                                ? [...current, button.id]
                                : current.filter((id) => id !== button.id),
                            )
                          }
                          type="checkbox"
                        />
                        <span>{button.icon ?? "◇"}</span>
                        <strong>{button.label}</strong>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="dialogActions">
              <button className="secondaryButton" onClick={cancelInboxEdit} type="button">
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={!inboxEditDraft.trim()}
                onClick={commitInboxEdit}
                type="button"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {overlayPageDraft && (
        <div className="modalBackdrop" role="presentation">
          <section
            aria-label={overlayPageDraft.mode === "add" ? "辞書ページ追加" : "辞書ページ名変更"}
            aria-modal="true"
            className="dropDialog"
            role="dialog"
            tabIndex={-1}
          >
            <div>
              <p className="eyebrow">Dictionary page</p>
              <h2>{overlayPageDraft.mode === "add" ? "ページを追加" : "名前を変更"}</h2>
            </div>

            <label className="fieldStack">
              <span>ページ名</span>
              <input
                autoFocus
                className="textInput"
                maxLength={OVERLAY_PAGE_NAME_MAX_CHARS}
                onChange={(event) =>
                  setOverlayPageDraft({ ...overlayPageDraft, name: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !overlayPageNameError(
                    overlayPageDraft.name,
                    overlayPageDraft.pageId,
                  )) {
                    void saveOverlayPageDraft();
                  }
                  if (event.key === "Escape") closeOverlayPageDialog();
                }}
                placeholder="例: プロジェクト名"
                value={overlayPageDraft.name}
              />
              {overlayPageDraft.name.trim() &&
                overlayPageNameError(overlayPageDraft.name, overlayPageDraft.pageId) && (
                  <small className="fieldError">
                    {overlayPageNameError(overlayPageDraft.name, overlayPageDraft.pageId)}
                  </small>
                )}
            </label>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={closeOverlayPageDialog}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={Boolean(
                  overlayPageNameError(overlayPageDraft.name, overlayPageDraft.pageId),
                )}
                onClick={() => void saveOverlayPageDraft()}
                type="button"
              >
                {overlayPageDraft.mode === "add" ? "追加" : "保存"}
              </button>
            </div>
          </section>
        </div>
      )}

      {groupDraft !== null && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="グループ追加" aria-modal="true" className="dropDialog" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Group</p>
              <h2>グループを追加</h2>
            </div>

            <label className="fieldStack">
              <span>グループ名</span>
              <input
                autoFocus
                className="textInput"
                maxLength={40}
                onChange={(event) => setGroupDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    confirmGroupAddition();
                  }
                  if (event.key === "Escape") {
                    setGroupDraft(null);
                  }
                }}
                placeholder="例: 仕事"
                value={groupDraft}
              />
            </label>

            <div className="dialogActions">
              <button className="secondaryButton" onClick={() => setGroupDraft(null)} type="button">
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={!groupDraft.trim()}
                onClick={confirmGroupAddition}
                type="button"
              >
                追加
              </button>
            </div>
          </section>
        </div>
      )}

      {groupRenameDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="グループ名変更" aria-modal="true" className="dropDialog" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Group</p>
              <h2>名前を変更</h2>
            </div>

            <label className="fieldStack">
              <span>グループ名</span>
              <input
                autoFocus
                className="textInput"
                maxLength={40}
                onChange={(event) =>
                  setGroupRenameDraft({ ...groupRenameDraft, to: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    confirmGroupRename();
                  }
                  if (event.key === "Escape") {
                    setGroupRenameDraft(null);
                  }
                }}
                value={groupRenameDraft.to}
              />
            </label>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => setGroupRenameDraft(null)}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={!groupRenameDraft.to.trim()}
                onClick={confirmGroupRename}
                type="button"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsDraft && (
        <div
          className="modalBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) requestCloseSettings();
          }}
          role="presentation"
        >
          <section aria-label="設定" aria-modal="true" className="dropDialog settingsDialog" role="dialog" tabIndex={-1}>
            <div className="modalTitleRow">
              <div>
              <p className="eyebrow">Settings</p>
              <h2>設定</h2>
              </div>
              <button
                aria-label="設定を閉じる"
                className="iconButton"
                onClick={requestCloseSettings}
                title="閉じる"
                type="button"
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>

            <div className="settingsTabs" role="tablist" aria-label="設定カテゴリ">
              {[
                ["basic", "基本"],
                ["shortcuts", "ショートカット"],
                ["instructions", "手順書"],
                ["backup", "バックアップ"],
                ["maintenance", "メンテナンス"],
              ].map(([key, label]) => (
                <button
                  aria-selected={settingsSection === key}
                  className={settingsSection === key ? "settingsTab settingsTab--active" : "settingsTab"}
                  key={key}
                  onClick={() => {
                    if (shortcutRecordingField) {
                      void finishShortcutRecording();
                    }
                    setSettingsSection(key as SettingsSectionKey);
                  }}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={settingsSection === "basic" ? "settingsSection app-scrollbar" : "settingsSection settingsSection--hidden app-scrollbar"}>
              <h3>基本</h3>
              <div className="settingsGrid">
                <label
                  className={
                    numberInputDragging === "settingsDefault"
                      ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                      : "fieldStack fieldStack--numberDrag"
                  }
                  onPointerCancel={cancelNumberInputDrag}
                  onPointerDown={(event) =>
                    startNumberInputDrag(
                      event,
                      "settingsDefault",
                      Number.parseInt(settingsDraft.defaultTimerMinutes, 10) || 25,
                    )
                  }
                  onPointerMove={updateNumberInputDrag}
                  onPointerUp={finishNumberInputDrag}
                  title="上下にドラッグして分数を調整"
                >
                  <span>通常タイマー分数</span>
                  <span className="numberDragInput">
                    <input
                      className="textInput"
                      max={240}
                      min={1}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          defaultTimerMinutes: event.target.value,
                        })
                      }
                      type="number"
                      value={settingsDraft.defaultTimerMinutes}
                    />
                    <span aria-hidden="true" className="numberDragAffordance" />
                  </span>
                </label>
                <label
                  className={
                    numberInputDragging === "settingsShort"
                      ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                      : "fieldStack fieldStack--numberDrag"
                  }
                  onPointerCancel={cancelNumberInputDrag}
                  onPointerDown={(event) =>
                    startNumberInputDrag(
                      event,
                      "settingsShort",
                      Number.parseInt(settingsDraft.shortTimerMinutes, 10) || 5,
                    )
                  }
                  onPointerMove={updateNumberInputDrag}
                  onPointerUp={finishNumberInputDrag}
                  title="上下にドラッグして分数を調整"
                >
                  <span>短時間タイマー分数</span>
                  <span className="numberDragInput">
                    <input
                      className="textInput"
                      max={240}
                      min={1}
                      onChange={(event) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          shortTimerMinutes: event.target.value,
                        })
                      }
                      type="number"
                      value={settingsDraft.shortTimerMinutes}
                    />
                    <span aria-hidden="true" className="numberDragAffordance" />
                  </span>
                </label>
                <label
                  className={
                    numberInputDragging === "settingsDayStart"
                      ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                      : "fieldStack fieldStack--numberDrag"
                  }
                  onPointerCancel={cancelNumberInputDrag}
                  onPointerDown={(event) =>
                    startNumberInputDrag(
                      event,
                      "settingsDayStart",
                      Number.parseInt(settingsDraft.dayStartHour, 10) || 0,
                    )
                  }
                  onPointerMove={updateNumberInputDrag}
                  onPointerUp={finishNumberInputDrag}
                  title="上下にドラッグして時刻を調整"
                >
                  <span>日付切替時刻</span>
                  <span className="numberDragInput">
                    <input
                      className="textInput"
                      max={23}
                      min={0}
                      onChange={(event) =>
                        setSettingsDraft({ ...settingsDraft, dayStartHour: event.target.value })
                      }
                      type="number"
                      value={settingsDraft.dayStartHour}
                    />
                    <span aria-hidden="true" className="numberDragAffordance" />
                  </span>
                </label>
              </div>
              <div className="settingsToggleGrid">
                <label className="settingsToggle">
                  <input
                    checked={settingsDraft.alwaysOnTop}
                    onChange={(event) =>
                      setSettingsDraft({ ...settingsDraft, alwaysOnTop: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>常に手前</span>
                </label>
                <label className="settingsToggle">
                  <input
                    checked={settingsDraft.autoStart}
                    onChange={(event) =>
                      setSettingsDraft({ ...settingsDraft, autoStart: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Windows自動起動</span>
                </label>
                <label className="settingsToggle">
                  <input
                    checked={settingsDraft.miniMode}
                    onChange={(event) =>
                      setSettingsDraft({ ...settingsDraft, miniMode: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>ミニモード</span>
                </label>
                <label className="settingsToggle settingsToggle--wide">
                  <input
                    checked={settingsDraft.restartShortFirst}
                    onChange={(event) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        restartShortFirst: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>長く空いたプロジェクトでは短時間開始を優先表示する</span>
                </label>
              </div>
              <section className="settingsWeeklyFocus" aria-labelledby="settings-weekly-focus-title">
                <div className="settingsWeeklyFocusHeading">
                  <div>
                    <h4 id="settings-weekly-focus-title">今週の重点</h4>
                    <p>今やる一手の候補にするプロジェクトを最大3件選びます。</p>
                  </div>
                  <span>
                    {settingsDraft.weeklyFocusProjectIds.length}/{WEEKLY_FOCUS_LIMIT}
                  </span>
                </div>
                {config.projects.length > 0 ? (
                  <div className="weeklyFocusChecklist settingsWeeklyFocusChecklist">
                    {config.projects.map((project) => {
                      const checked = settingsDraft.weeklyFocusProjectIds.includes(project.id);
                      return (
                        <label key={project.id}>
                          <input
                            aria-label={`${project.name}を今週の重点にする`}
                            checked={checked}
                            disabled={
                              !checked &&
                              settingsDraft.weeklyFocusProjectIds.length >= WEEKLY_FOCUS_LIMIT
                            }
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? [...settingsDraft.weeklyFocusProjectIds, project.id]
                                : settingsDraft.weeklyFocusProjectIds.filter(
                                    (projectId) => projectId !== project.id,
                                  );
                              setSettingsDraft({
                                ...settingsDraft,
                                weeklyFocusProjectIds: nextIds,
                              });
                            }}
                            type="checkbox"
                          />
                          <ProjectIdentity
                            colorId={project.colorId}
                            compact
                            name={project.name}
                            projectId={project.id}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="quietText">プロジェクトを追加すると選択できます。</p>
                )}
              </section>
            </div>

            <div className={settingsSection === "shortcuts" ? "settingsSection app-scrollbar" : "settingsSection settingsSection--hidden app-scrollbar"}>
              <h3>ショートカット</h3>
              <div className="settingsGrid">
                {SHORTCUT_DRAFT_FIELDS.map(({ field, label }) => {
                  const value = settingsDraft[field];
                  const recording = shortcutRecordingField === field;
                  const others = SHORTCUT_DRAFT_FIELDS.filter(
                    (candidate) => candidate.field !== field,
                  ).map((candidate) => settingsDraft[candidate.field]);
                  return (
                    <div className="fieldStack shortcutCaptureField" key={field}>
                      <span>{label}</span>
                      <div
                        className={
                          recording
                            ? "shortcutCaptureControl shortcutCaptureControl--recording"
                            : "shortcutCaptureControl"
                        }
                      >
                        <div aria-live="polite" className="shortcutCaptureValue">
                          <kbd>{recording ? "入力待ち…" : value || "未設定"}</kbd>
                        </div>
                        <button
                          aria-pressed={recording}
                          className="secondaryButton shortcutCaptureButton"
                          onClick={() => void beginShortcutRecording(field)}
                          type="button"
                        >
                          {recording ? "待機中" : "登録"}
                        </button>
                        <button
                          aria-label={`${label}のショートカットを解除`}
                          className="shortcutCaptureClear"
                          disabled={!value || recording}
                          onClick={() =>
                            setSettingsDraft({ ...settingsDraft, [field]: "" })
                          }
                          title="ショートカットを解除"
                          type="button"
                        >
                          <UiIcon name="close" size={16} />
                        </button>
                      </div>
                      <small className="quietText quietText--small">
                        {recording
                          ? "キーの組み合わせを押してください。Escapeで取消"
                          : shortcutValidationMessage(value, others)}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={settingsSection === "instructions" ? "settingsSection app-scrollbar" : "settingsSection settingsSection--hidden app-scrollbar"}>
              <h3>手順書</h3>
              <div className="fieldStack">
                <span>手順書フォルダ（最大5件）</span>
                {settingsDraft.instructionFolders.length > 0 ? (
                  <div className="instructionFolderSettingsList">
                    {settingsDraft.instructionFolders.map((folder) => (
                      <div className="instructionFolderSettingsRow" key={folder}>
                        <span title={folder}>{folder}</span>
                        <button
                          className="secondaryButton settingsButton--warning"
                          disabled={instructionSettingsBusy}
                          onClick={() => removeInstructionFolder(folder)}
                          type="button"
                        >
                          解除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="quietText quietText--small">
                    MarkdownまたはTextファイルを置くローカルフォルダを登録してください。
                  </p>
                )}
                <button
                  className="secondaryButton settingsButton--neutral instructionFolderAddButton"
                  disabled={instructionSettingsBusy || settingsDraft.instructionFolders.length >= 5}
                  onClick={() => void addInstructionFolder()}
                  type="button"
                >
                  ＋ フォルダを追加
                </button>
              </div>
            </div>

            <div className={settingsSection === "backup" ? "settingsSection app-scrollbar" : "settingsSection settingsSection--hidden app-scrollbar"}>
              <h3>バックアップ</h3>
              <label className="fieldStack">
                <span>保存先フォルダ</span>
                <div className="folderPickerRow">
                  <input
                    className="textInput"
                    placeholder="未設定"
                    readOnly
                    value={settingsDraft.backupFolder}
                  />
                  <button
                    className="secondaryButton settingsButton--neutral"
                    onClick={chooseBackupFolder}
                    type="button"
                  >
                    選択
                  </button>
                </div>
              </label>
              {!settingsDraft.backupFolder && (
                <p className="quietText quietText--small">
                  バックアップは未設定です。データ保護のため保存先の設定を推奨します。
                </p>
              )}
              <label className="fieldStack">
                <span>保持世代数</span>
                <input
                  className="textInput"
                  min={1}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, backupKeep: event.target.value })
                  }
                  type="number"
                  value={settingsDraft.backupKeep}
                />
              </label>
              <div className="settingsButtonRow">
                <button
                  className="dangerButton settingsButton--danger"
                  onClick={requestClearBackupFolder}
                  type="button"
                >
                  バックアップを未設定にする
                </button>
                <button
                  className="secondaryButton settingsButton--warning"
                  onClick={chooseBackupZipForRestore}
                  type="button"
                >
                  バックアップから復元
                </button>
              </div>
            </div>

            <div className={settingsSection === "maintenance" ? "settingsSection app-scrollbar" : "settingsSection settingsSection--hidden app-scrollbar"}>
              <h3>メンテナンス</h3>
              <div className="settingsButtonRow">
                <button
                  className="secondaryButton settingsButton--neutral"
                  disabled={dailyActivityCopying}
                  onClick={() => void copyTodayActivityLog()}
                  title="今日のセッションとできたことをクリップボードへコピー"
                  type="button"
                >
                  {dailyActivityCopying ? "コピー中" : "今日の活動ログをコピー"}
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={openRuntimeDataFolder}
                  type="button"
                >
                  configフォルダを開く
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={openBackupFolder}
                  type="button"
                >
                  バックアップフォルダを開く
                </button>
                <button
                  className="secondaryButton settingsButton--warning"
                  onClick={requestIconCacheRegeneration}
                  type="button"
                >
                  アイコンキャッシュ再生成
                </button>
                <button
                  className="secondaryButton settingsButton--warning"
                  onClick={requestMiniWindowPositionReset}
                  type="button"
                >
                  ミニウィンドウ位置をリセット
                </button>
                <button
                  className="secondaryButton settingsButton--warning"
                  onClick={requestInstructionWindowPositionReset}
                  type="button"
                >
                  手順書ウィンドウ位置をリセット
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={() => void reloadInstructionList()}
                  type="button"
                >
                  手順書一覧を再読み込み
                </button>
              </div>
            </div>

            <div className="dialogActions">
              <button
                className="secondaryButton settingsButton--neutral"
                onClick={requestCloseSettings}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={Boolean(shortcutRecordingField)}
                onClick={saveSettingsCenter}
                type="button"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {manualSessionDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="手動セッション追加" aria-modal="true" className="dropDialog modalLongForm" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Session</p>
              <h2>セッションを追加</h2>
            </div>

            <label className="fieldStack">
              <span>プロジェクト</span>
              <select
                className="textInput"
                onChange={(event) =>
                  setManualSessionDraft({
                    ...manualSessionDraft,
                    projectId: event.target.value || null,
                  })
                }
                value={manualSessionDraft.projectId ?? ""}
              >
                <option value="">未分類</option>
                {config.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {manualSessionDraft.projectId && projectsById.has(manualSessionDraft.projectId) && (
              <div
                className="sessionProjectIdentity"
                data-project-color={resolveProjectColorId(
                  manualSessionDraft.projectId,
                  projectsById.get(manualSessionDraft.projectId)?.colorId,
                )}
              >
                <ProjectIdentity
                  colorId={projectsById.get(manualSessionDraft.projectId)?.colorId}
                  name={projectsById.get(manualSessionDraft.projectId)?.name ?? ""}
                  projectId={manualSessionDraft.projectId}
                />
              </div>
            )}

            <div className="editGrid">
              <label className="fieldStack">
                <span>日付</span>
                <input
                  className="textInput"
                  onChange={(event) =>
                    setManualSessionDraft({ ...manualSessionDraft, date: event.target.value })
                  }
                  type="date"
                  value={manualSessionDraft.date}
                />
              </label>
              <label className="fieldStack">
                <span>開始時刻</span>
                <input
                  className="textInput"
                  onChange={(event) =>
                    setManualSessionDraft({
                      ...manualSessionDraft,
                      startedAt: event.target.value,
                    })
                  }
                  step={60}
                  type="time"
                  value={manualSessionDraft.startedAt}
                />
              </label>
              <label className="fieldStack">
                <span>分数</span>
                <input
                  className="textInput"
                  min={1}
                  onChange={(event) =>
                    setManualSessionDraft({ ...manualSessionDraft, minutes: event.target.value })
                  }
                  type="number"
                  value={manualSessionDraft.minutes}
                />
              </label>
            </div>

            <label className="fieldStack">
              <span>note</span>
              <input
                className="textInput"
                onChange={(event) =>
                  setManualSessionDraft({ ...manualSessionDraft, note: event.target.value })
                }
                value={manualSessionDraft.note}
              />
            </label>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => setManualSessionDraft(null)}
                type="button"
              >
                キャンセル
              </button>
              <button className="primaryButton" onClick={saveManualSession} type="button">
                追加
              </button>
            </div>
          </section>
        </div>
      )}

      {sessionEditDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="セッション編集" aria-modal="true" className="dropDialog editDialog" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Session</p>
              <h2>セッションを編集</h2>
            </div>

            <label className="fieldStack">
              <span>プロジェクト</span>
              <select
                className="textInput"
                onChange={(event) => {
                  const project = config.projects.find((item) => item.id === event.target.value);
                  setSessionEditDraft({
                    ...sessionEditDraft,
                    projectId: project?.id ?? null,
                    label: project?.name ?? sessionEditDraft.label,
                  });
                }}
                value={sessionEditDraft.projectId ?? ""}
              >
                <option value="">未分類</option>
                {config.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {sessionEditDraft.projectId && projectsById.has(sessionEditDraft.projectId) && (
              <div
                className="sessionProjectIdentity"
                data-project-color={resolveProjectColorId(
                  sessionEditDraft.projectId,
                  projectsById.get(sessionEditDraft.projectId)?.colorId,
                )}
              >
                <ProjectIdentity
                  colorId={projectsById.get(sessionEditDraft.projectId)?.colorId}
                  name={projectsById.get(sessionEditDraft.projectId)?.name ?? sessionEditDraft.label}
                  projectId={sessionEditDraft.projectId}
                />
              </div>
            )}

            <label className="fieldStack">
              <span>ラベル</span>
              <input
                className="textInput"
                maxLength={80}
                onChange={(event) =>
                  setSessionEditDraft({ ...sessionEditDraft, label: event.target.value })
                }
                value={sessionEditDraft.label}
              />
            </label>

            <div className="editGrid">
              <label className="fieldStack">
                <span>日付</span>
                <input
                  className="textInput"
                  onChange={(event) =>
                    setSessionEditDraft({ ...sessionEditDraft, date: event.target.value })
                  }
                  type="date"
                  value={sessionEditDraft.date}
                />
              </label>
              <label className="fieldStack">
                <span>開始</span>
                <input
                  className="textInput"
                  maxLength={16}
                  onChange={(event) =>
                    setSessionEditDraft({ ...sessionEditDraft, startedAt: event.target.value })
                  }
                  value={sessionEditDraft.startedAt}
                />
              </label>
              <label className="fieldStack">
                <span>分数</span>
                <input
                  className="textInput"
                  min={1}
                  onChange={(event) =>
                    setSessionEditDraft({ ...sessionEditDraft, minutes: event.target.value })
                  }
                  type="number"
                  value={sessionEditDraft.minutes}
                />
              </label>
            </div>

            <label className="fieldStack">
              <span>note</span>
              <input
                className="textInput"
                onChange={(event) =>
                  setSessionEditDraft({ ...sessionEditDraft, note: event.target.value })
                }
                value={sessionEditDraft.note}
              />
            </label>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => setSessionEditDraft(null)}
                type="button"
              >
                キャンセル
              </button>
              <button className="primaryButton" onClick={saveSessionEdit} type="button">
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {buttonEditDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="ボタン編集" aria-modal="true" className="dropDialog editDialog modalLongForm app-scrollbar" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Button</p>
              <h2>ボタンを編集</h2>
            </div>

            <h3 className="formSectionHeading">基本</h3>
            <div className="editGrid">
              <label className="fieldStack">
                <span>ラベル</span>
                <input
                  className="textInput"
                  maxLength={48}
                  onChange={(event) =>
                    setButtonEditDraft({ ...buttonEditDraft, label: event.target.value })
                  }
                  value={buttonEditDraft.label}
                />
              </label>
              <label className="fieldStack">
                <span>アイコン</span>
                <input
                  className="textInput"
                  maxLength={4}
                  onChange={(event) =>
                    setButtonEditDraft({ ...buttonEditDraft, icon: event.target.value })
                  }
                  value={buttonEditDraft.icon}
                />
              </label>
            </div>

            <div className="fieldStack">
              <span>グループ</span>
              <div className="groupPicker">
                <select
                  onChange={(event) =>
                    setButtonEditDraft({
                      ...buttonEditDraft,
                      group: event.target.value === "__custom__" ? "" : event.target.value,
                    })
                  }
                  value={
                    groupNames.includes(buttonEditDraft.group)
                      ? buttonEditDraft.group
                      : "__custom__"
                  }
                >
                  {groupNames.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                  <option value="__custom__">新規入力</option>
                </select>
                <input
                  className="textInput"
                  onChange={(event) =>
                    setButtonEditDraft({ ...buttonEditDraft, group: event.target.value })
                  }
                  placeholder="新規グループ"
                  value={buttonEditDraft.group}
                />
              </div>
            </div>

            <h3 className="formSectionHeading">表示先</h3>
            <div className="fieldStack">
              <span>表示先</span>
              <div className="displayTargetList">
                <label className="displayTargetItem">
                  <input
                    checked={buttonEditDraft.showInSidebar}
                    onChange={(event) =>
                      setButtonEditDraft({
                        ...buttonEditDraft,
                        showInSidebar: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <strong>左サイドバーに表示</strong>
                </label>
                <label className="displayTargetItem">
                  <input
                    checked={buttonEditDraft.showInOverlay}
                    onChange={(event) =>
                      setButtonEditDraft({
                        ...buttonEditDraft,
                        showInOverlay: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <strong>Ctrl+K辞書に表示</strong>
                </label>
              </div>
            </div>

            {!buttonEditDraft.showInSidebar && !buttonEditDraft.showInOverlay && (
              <p className="visibilityWarning">
                サイドバーにも辞書にも表示されません。設定ファイル上には残ります。
              </p>
            )}

            {buttonEditDraft.showInOverlay && (
              <div className="fieldStack">
                <span>辞書ページ</span>
                <div className="overlayPagePicker">
                  <select
                    className="textInput"
                    onChange={(event) =>
                      setButtonEditDraft({
                        ...buttonEditDraft,
                        overlayPageId: event.target.value || null,
                      })
                    }
                    value={
                      overlayPages.some((page) => page.id === buttonEditDraft.overlayPageId)
                        ? buttonEditDraft.overlayPageId ?? ""
                        : ""
                    }
                  >
                    <option value="">未分類</option>
                    {overlayPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondaryButton"
                    onClick={() => openOverlayPageDialog(undefined, true)}
                    type="button"
                  >
                    + 新しいページ
                  </button>
                </div>
                <small className="quietText quietText--small">
                  サイドバーのグループと辞書ページは別々に設定できます。
                </small>
              </div>
            )}

            <h3 className="formSectionHeading">検索</h3>
            <label className="fieldStack">
              <span>検索キーワード</span>
              <textarea
                className="textInput aliasesInput"
                onChange={(event) =>
                  setButtonEditDraft({ ...buttonEditDraft, aliasesInput: event.target.value })
                }
                placeholder="editor, docs, よく使う"
                value={buttonEditDraft.aliasesInput}
              />
            </label>

            <label className="fieldStack">
              <span>説明</span>
              <textarea
                className="textInput aliasesInput"
                onChange={(event) =>
                  setButtonEditDraft({ ...buttonEditDraft, description: event.target.value })
                }
                placeholder="よく使うアプリやフォルダを開く。"
                value={buttonEditDraft.description}
              />
            </label>

            <h3 className="formSectionHeading">実行アクション</h3>
            <div className="fieldStack">
              <span>アクション</span>
              <div className="actionEditor">
                {buttonEditDraft.actions.map((action, index) => (
                  <div
                    className={
                      actionDragId === action.draftId
                        ? "actionRow actionRow--dragging"
                        : "actionRow"
                    }
                    draggable
                    key={action.draftId}
                    onDragStart={(event) => {
                      setActionDragId(action.draftId);
                      event.dataTransfer.setData(ACTION_DRAG_TYPE, action.draftId);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setActionDragId(null)}
                    onDragOver={(event) => {
                      const draggedId =
                        event.dataTransfer.getData(ACTION_DRAG_TYPE) || actionDragId;
                      if (!draggedId || draggedId === action.draftId) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      const draggedId =
                        event.dataTransfer.getData(ACTION_DRAG_TYPE) || actionDragId;
                      if (!draggedId || draggedId === action.draftId) return;
                      event.preventDefault();
                      moveButtonActionTo(draggedId, action.draftId);
                      setActionDragId(null);
                    }}
                  >
                    <select
                      onChange={(event) =>
                        updateButtonAction(
                          action.draftId,
                          makeAction(
                            event.target.value as LauncherAction["type"],
                            actionValue(action),
                          ),
                        )
                      }
                      value={action.type}
                    >
                      <option value="open_app">アプリ</option>
                      <option value="open_folder">フォルダ</option>
                        <option value="open_file">ファイル</option>
                        <option value="open_url">URL</option>
                        <option value="run_script">スクリプト</option>
                        <option value="open_shell_special">Windows特殊項目</option>
                      </select>
                      <input
                        className="textInput"
                        disabled={action.type === "open_shell_special"}
                      onChange={(event) =>
                        updateButtonAction(
                          action.draftId,
                          setActionValue(action, event.target.value),
                        )
                      }
                      value={actionValue(action)}
                    />
                    <button
                      className="iconButton"
                      disabled={index === 0}
                      onClick={() => moveButtonAction(action.draftId, -1)}
                      title="上へ"
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      className="iconButton"
                      disabled={index === buttonEditDraft.actions.length - 1}
                      onClick={() => moveButtonAction(action.draftId, 1)}
                      title="下へ"
                      type="button"
                    >
                      ↓
                    </button>
                    <button aria-label="アクションを削除" className="iconButton" onClick={() => setButtonEditDraft({
                          ...buttonEditDraft,
                          actions: buttonEditDraft.actions.filter(
                            (item) => item.draftId !== action.draftId,
                          ),
                        })
                      }
                      title="削除"
                      type="button"
                    >
                      <UiIcon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="secondaryButton"
                  onClick={() =>
                    setButtonEditDraft({
                      ...buttonEditDraft,
                      actions: [...buttonEditDraft.actions, makeAction("open_app")],
                    })
                  }
                  type="button"
                >
                  アクション追加
                </button>
              </div>
            </div>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={requestCloseButtonEdit}
                type="button"
              >
                キャンセル
              </button>
              <button className="primaryButton" onClick={saveButtonEdit} type="button">
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {projectEditDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="プロジェクト編集" aria-modal="true" className="dropDialog editDialog modalLongForm app-scrollbar" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Project</p>
              <h2>{projectEditDraft.isNew ? "プロジェクト追加" : "プロジェクト編集"}</h2>
            </div>

            <h3 className="formSectionHeading">基本</h3>
            <label className="fieldStack">
              <span>名前</span>
              <input
                className="textInput"
                maxLength={48}
                onChange={(event) =>
                  setProjectEditDraft({ ...projectEditDraft, name: event.target.value })
                }
                value={projectEditDraft.name}
              />
            </label>

            <label className="fieldStack">
              <span>北極星（任意）</span>
              <input
                className="textInput"
                maxLength={60}
                onChange={(event) =>
                  setProjectEditDraft({ ...projectEditDraft, northStar: event.target.value })
                }
                placeholder="EPを1枚完成させる"
                value={projectEditDraft.northStar}
              />
              <small className="fieldHint">
                このプロジェクトで長期的に実現したいことを1行で書きます。
              </small>
            </label>

            <label className="projectWeeklyFocusToggle">
              <input
                checked={projectEditDraft.weeklyFocus}
                onChange={(event) => setProjectWeeklyFocus(event.target.checked)}
                type="checkbox"
              />
              <span>今週の重点にする</span>
            </label>

            <h3 className="formSectionHeading">計画</h3>
            <label className="fieldStack">
              <span>次の一手</span>
              <input
                className="textInput"
                maxLength={120}
                onChange={(event) =>
                  setProjectEditDraft({ ...projectEditDraft, nextStep: event.target.value })
                }
                value={projectEditDraft.nextStep}
              />
              {projectNextStepSuggestions.length > 0 && (
                <div className="suggestionRow" aria-label="次の一手候補">
                  {projectNextStepSuggestions.map((suggestion) => (
                    <button
                      className="suggestionChip"
                      key={suggestion}
                      onClick={() =>
                        setProjectEditDraft({ ...projectEditDraft, nextStep: suggestion })
                      }
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className="fieldStack">
              <span>いつ・何の後にやる？（任意）</span>
              <input
                className="textInput"
                maxLength={EXECUTION_TRIGGER_MAX_CHARS}
                onChange={(event) =>
                  setProjectEditDraft({
                    ...projectEditDraft,
                    nextStepTrigger: event.target.value,
                  })
                }
                placeholder="例: 21時 / 夕食後 / PCを開いたら"
                value={projectEditDraft.nextStepTrigger}
              />
            </label>

            <h3 className="formSectionHeading">手順書</h3>
            <div className="fieldStack projectInstructionSetting">
              <span>手順書（任意）</span>
              <select
                aria-label="プロジェクトの手順書"
                className="textInput"
                disabled={instructionChoicesLoading}
                onChange={(event) => {
                  const instructionPath = event.target.value;
                  setProjectEditDraft({
                    ...projectEditDraft,
                    instructionPath,
                    instructionOpenOnStart: instructionPath
                      ? projectEditDraft.instructionPath
                        ? projectEditDraft.instructionOpenOnStart
                        : true
                      : false,
                  });
                }}
                value={projectEditDraft.instructionPath}
              >
                <option value="">
                  {instructionChoicesLoading ? "手順書を読み込み中…" : "手順書なし"}
                </option>
                {projectEditDraft.instructionPath &&
                  !instructionChoices.some(
                    (choice) => choice.path === projectEditDraft.instructionPath,
                  ) && (
                    <option value={projectEditDraft.instructionPath}>
                      現在の設定（登録フォルダ内に見つかりません）
                    </option>
                  )}
                {instructionChoices.map((choice) => (
                  <option key={choice.path} value={choice.path}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {instructionChoicesError && (
                <div className="projectInstructionLoadError" role="status">
                  <small>一覧を読み込めません: {instructionChoicesError}</small>
                  <button onClick={() => void refreshInstructionChoices()} type="button">
                    再読込
                  </button>
                </div>
              )}
              <label className="projectWeeklyFocusToggle projectInstructionStartToggle">
                <input
                  checked={projectEditDraft.instructionOpenOnStart}
                  disabled={!projectEditDraft.instructionPath}
                  onChange={(event) =>
                    setProjectEditDraft({
                      ...projectEditDraft,
                      instructionOpenOnStart: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>プロジェクト開始時に手順書を開く</span>
              </label>
            </div>

            <h3 className="formSectionHeading">タイマー</h3>
            <div className="fieldStack">
              <span>開始レシピ</span>
              <div className="projectTimerGrid">
                <div className="projectTimerSetting">
                  <span>通常タイマー</span>
                  <div className="projectTimerControl">
                    <button
                      aria-label="通常タイマーを1分減らす"
                      className="projectTimerStepButton"
                      onClick={() => stepProjectTimer("defaultTimerMinutes", -1)}
                      type="button"
                    >
                      −
                    </button>
                    <label
                      className={
                        numberInputDragging === "projectDefault"
                          ? "projectTimerInput fieldStack--numberDrag fieldStack--numberDragging"
                          : "projectTimerInput fieldStack--numberDrag"
                      }
                      onPointerCancel={cancelNumberInputDrag}
                      onPointerDown={(event) =>
                        startNumberInputDrag(
                          event,
                          "projectDefault",
                          Number.parseInt(projectEditDraft.defaultTimerMinutes, 10) ||
                            config.settings.defaultTimerMinutes,
                        )
                      }
                      onPointerMove={updateNumberInputDrag}
                      onPointerUp={finishNumberInputDrag}
                      title="上下にドラッグして分数を調整"
                    >
                      <span className="numberDragInput">
                        <input
                          aria-label="プロジェクトの通常タイマー分数"
                          className="textInput"
                          inputMode="numeric"
                          max="240"
                          min="1"
                          onChange={(event) =>
                            setProjectEditDraft({
                              ...projectEditDraft,
                              defaultTimerMinutes: event.target.value,
                            })
                          }
                          placeholder={String(config.settings.defaultTimerMinutes)}
                          type="number"
                          value={projectEditDraft.defaultTimerMinutes}
                        />
                        <span aria-hidden="true" className="numberDragAffordance" />
                      </span>
                    </label>
                    <button
                      aria-label="通常タイマーを1分増やす"
                      className="projectTimerStepButton"
                      onClick={() => stepProjectTimer("defaultTimerMinutes", 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <div className="projectTimerFooter">
                    <span>
                      {projectEditDraft.defaultTimerMinutes
                        ? `${projectEditDraft.defaultTimerMinutes}分を使用`
                        : `全体設定 ${config.settings.defaultTimerMinutes}分を使用`}
                    </span>
                    <button
                      disabled={!projectEditDraft.defaultTimerMinutes}
                      onClick={() =>
                        setProjectEditDraft({ ...projectEditDraft, defaultTimerMinutes: "" })
                      }
                      type="button"
                    >
                      全体設定に戻す
                    </button>
                  </div>
                </div>

                <div className="projectTimerSetting">
                  <span>短時間タイマー</span>
                  <div className="projectTimerControl">
                    <button
                      aria-label="短時間タイマーを1分減らす"
                      className="projectTimerStepButton"
                      onClick={() => stepProjectTimer("shortTimerMinutes", -1)}
                      type="button"
                    >
                      −
                    </button>
                    <label
                      className={
                        numberInputDragging === "projectShort"
                          ? "projectTimerInput fieldStack--numberDrag fieldStack--numberDragging"
                          : "projectTimerInput fieldStack--numberDrag"
                      }
                      onPointerCancel={cancelNumberInputDrag}
                      onPointerDown={(event) =>
                        startNumberInputDrag(
                          event,
                          "projectShort",
                          Number.parseInt(projectEditDraft.shortTimerMinutes, 10) ||
                            config.settings.shortTimerMinutes,
                        )
                      }
                      onPointerMove={updateNumberInputDrag}
                      onPointerUp={finishNumberInputDrag}
                      title="上下にドラッグして分数を調整"
                    >
                      <span className="numberDragInput">
                        <input
                          aria-label="プロジェクトの短時間タイマー分数"
                          className="textInput"
                          inputMode="numeric"
                          max="240"
                          min="1"
                          onChange={(event) =>
                            setProjectEditDraft({
                              ...projectEditDraft,
                              shortTimerMinutes: event.target.value,
                            })
                          }
                          placeholder={String(config.settings.shortTimerMinutes)}
                          type="number"
                          value={projectEditDraft.shortTimerMinutes}
                        />
                        <span aria-hidden="true" className="numberDragAffordance" />
                      </span>
                    </label>
                    <button
                      aria-label="短時間タイマーを1分増やす"
                      className="projectTimerStepButton"
                      onClick={() => stepProjectTimer("shortTimerMinutes", 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <div className="projectTimerFooter">
                    <span>
                      {projectEditDraft.shortTimerMinutes
                        ? `${projectEditDraft.shortTimerMinutes}分を使用`
                        : `全体設定 ${config.settings.shortTimerMinutes}分を使用`}
                    </span>
                    <button
                      disabled={!projectEditDraft.shortTimerMinutes}
                      onClick={() =>
                        setProjectEditDraft({ ...projectEditDraft, shortTimerMinutes: "" })
                      }
                      type="button"
                    >
                      全体設定に戻す
                    </button>
                  </div>
                </div>
              </div>
              <h3 className="formSectionHeading">見た目</h3>
              <div className="fieldStack">
                <span>プロジェクトカラー</span>
                <div
                  aria-label="プロジェクトカラー"
                  className="projectColorPalette"
                  role="radiogroup"
                >
                  {PROJECT_COLOR_IDS.map((colorId) => (
                    <button
                      aria-checked={projectEditDraft.colorId === colorId}
                      aria-label={PROJECT_COLOR_LABELS[colorId]}
                      className={
                        projectEditDraft.colorId === colorId
                          ? "projectColorSwatch projectColorSwatch--selected"
                          : "projectColorSwatch"
                      }
                      data-project-color={colorId}
                      key={colorId}
                      onClick={() => setProjectEditDraft({ ...projectEditDraft, colorId })}
                      role="radio"
                      title={PROJECT_COLOR_LABELS[colorId]}
                      type="button"
                    >
                      <span aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <label className="fieldStack">
                <span>開始noteテンプレート（空欄は次の一手）</span>
                <input
                  className="textInput"
                  maxLength={120}
                  onChange={(event) =>
                    setProjectEditDraft({ ...projectEditDraft, startNoteTemplate: event.target.value })
                  }
                  value={projectEditDraft.startNoteTemplate}
                />
              </label>
            </div>

            <h3 className="formSectionHeading">開始環境</h3>
            <div className="fieldStack">
              <span>実行ボタン</span>
              <span className="quietText">サイドバーのボタン</span>
              <div className="checkList app-scrollbar">
                {visibleSidebarButtons.length === 0 && (
                  <span className="quietText">サイドバーに実行ボタンがありません</span>
                )}
                {visibleSidebarButtons.map((button) => (
                  <label className="checkListItem" key={button.id}>
                    <input
                      checked={projectEditDraft.buttonIds.includes(button.id)}
                      onChange={(event) => {
                        const buttonIds = event.target.checked
                          ? [...projectEditDraft.buttonIds, button.id]
                          : projectEditDraft.buttonIds.filter((id) => id !== button.id);
                        setProjectEditDraft({ ...projectEditDraft, buttonIds });
                      }}
                      type="checkbox"
                    />
                    <span>{button.icon ?? "●"}</span>
                    <strong>{button.label}</strong>
                  </label>
                ))}
              </div>
              {dictionaryOnlyButtons.length > 0 ? (
                <details className="projectDictionaryButtons">
                  <summary>
                    <span>辞書から選ぶ</span>
                    <span>
                      {
                        dictionaryOnlyButtons.filter((button) =>
                          projectEditDraft.buttonIds.includes(button.id),
                        ).length
                      }
                      /{dictionaryOnlyButtons.length}
                    </span>
                  </summary>
                  <div className="checkList app-scrollbar">
                    {dictionaryOnlyButtons.map((button) => (
                      <label className="checkListItem" key={button.id}>
                        <input
                          checked={projectEditDraft.buttonIds.includes(button.id)}
                          onChange={(event) => {
                            const buttonIds = event.target.checked
                              ? [...projectEditDraft.buttonIds, button.id]
                              : projectEditDraft.buttonIds.filter((id) => id !== button.id);
                            setProjectEditDraft({ ...projectEditDraft, buttonIds });
                          }}
                          type="checkbox"
                        />
                        <span>{button.icon ?? "●"}</span>
                        <strong>{button.label}</strong>
                      </label>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => setProjectEditDraft(null)}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={!projectEditDraft.name.trim()}
                onClick={saveProjectEdit}
                type="button"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      )}

      {completionPrompt && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="タイマー満了" aria-modal="true" className="dropDialog timerCompleteDialog" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Timer Complete</p>
              <h2>{completionPrompt.label}</h2>
            </div>

            <p className="timerCompleteText">予定時間になりました</p>

            {completionProject && (
              <label className="fieldStack">
                <span>次の一手</span>
                <input
                  className="textInput"
                  onChange={(event) => updateCompletionNextStep(event.target.value)}
                  placeholder="次の一手を書く"
                  value={completionProject.nextStep}
                />
                {completionNextStepSuggestions.length > 0 && (
                  <div className="suggestionRow" aria-label="次の一手候補">
                    {completionNextStepSuggestions.map((suggestion) => (
                      <button
                        className="suggestionChip"
                        key={suggestion}
                        onClick={() => updateCompletionNextStep(suggestion)}
                        type="button"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </label>
            )}

            <div className="dialogActions">
              <button className="secondaryButton" onClick={continueCompletedTimer} type="button">
                続ける(+15分)
              </button>
              <button className="primaryButton" onClick={finishCompletedTimer} type="button">
                終わる
              </button>
            </div>
          </section>
        </div>
      )}

      {dropDraft && (
        <div className="modalBackdrop" role="presentation">
          <section aria-label="ボタン登録" aria-modal="true" className="dropDialog modalLongForm" role="dialog" tabIndex={-1}>
            <div>
              <p className="eyebrow">Drop Register</p>
              <h2>ボタンを追加</h2>
            </div>

            <label className="fieldStack">
              <span>ラベル</span>
              <input
                className="textInput"
                onChange={(event) => setDropDraft({ ...dropDraft, label: event.target.value })}
                value={dropDraft.label}
              />
            </label>

            <div className="fieldStack">
              <span>グループ</span>
              <div className="groupPicker">
                <select
                  onChange={(event) =>
                    setDropDraft({
                      ...dropDraft,
                      group: event.target.value === "__custom__" ? "" : event.target.value,
                    })
                  }
                  value={groupNames.includes(dropDraft.group) ? dropDraft.group : "__custom__"}
                >
                  {groupNames.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                  <option value="__custom__">新規入力</option>
                </select>
                <input
                  className="textInput"
                  onChange={(event) => setDropDraft({ ...dropDraft, group: event.target.value })}
                  placeholder="新規グループ"
                  value={dropDraft.group}
                />
              </div>
            </div>

            <div className="fieldStack">
              <span>表示先</span>
              <div className="displayTargetList">
                <label className="displayTargetItem">
                  <input
                    checked={dropDraft.showInSidebar}
                    onChange={(event) =>
                      setDropDraft({ ...dropDraft, showInSidebar: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <strong>左サイドバーに表示</strong>
                </label>
                <label className="displayTargetItem">
                  <input
                    checked={dropDraft.showInOverlay}
                    onChange={(event) =>
                      setDropDraft({ ...dropDraft, showInOverlay: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <strong>Ctrl+K辞書に表示</strong>
                </label>
              </div>
            </div>

            {!dropDraft.showInSidebar && !dropDraft.showInOverlay && (
              <p className="visibilityWarning">
                サイドバーにも辞書にも表示されません。設定ファイル上には残ります。
              </p>
            )}

            {dropDraft.showInOverlay && (
              <label className="fieldStack">
                <span>辞書ページ</span>
                <select
                  className="textInput"
                  onChange={(event) =>
                    setDropDraft({
                      ...dropDraft,
                      overlayPageId: event.target.value || null,
                    })
                  }
                  value={
                    overlayPages.some((page) => page.id === dropDraft.overlayPageId)
                      ? dropDraft.overlayPageId ?? ""
                      : ""
                  }
                >
                  <option value="">未分類</option>
                  {overlayPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="dropSource">{actionDescription(dropDraft.action)}</p>

            <div className="dialogActions">
              <button className="secondaryButton" onClick={() => setDropDraft(null)} type="button">
                キャンセル
              </button>
              <button className="primaryButton" onClick={confirmDropRegistration} type="button">
                追加
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog {...confirmDialog} onCancel={closeConfirmDialog} open />
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
    </main>
  );
}
