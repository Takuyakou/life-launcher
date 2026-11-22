import { type ActionDraft, SHORTCUT_DRAFT_FIELDS, type SettingsCenterDraft, type ToastTone } from "./dashboardTypes";
import { ActionResult, AppConfig, LauncherAction, LauncherButton, LauncherProject, SessionEntryRow, TodayItem } from "../types";
import { DEFAULT_BUTTON_GROUP, GROUP_COLLAPSE_STORAGE_KEY, TODAY_ITEM_LIMIT } from "../constants";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SOURCE_LIST_COMPACT_LIMIT, SOURCE_LIST_PAGE_SIZE, SOURCE_LIST_PAGINATION_THRESHOLD } from "./constants";
import { findShortcutConflicts } from "../shortcutConflicts";

export function sourceListRange(total: number, expanded: boolean, page: number) {
  if (total < SOURCE_LIST_PAGINATION_THRESHOLD) {
    return {
      start: 0,
      end: total <= SOURCE_LIST_COMPACT_LIMIT || expanded ? total : SOURCE_LIST_COMPACT_LIMIT,
      page: 1,
      pageCount: 1,
    };
  }
  const pageCount = Math.max(1, Math.ceil(total / SOURCE_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * SOURCE_LIST_PAGE_SIZE;
  return { start, end: Math.min(total, start + SOURCE_LIST_PAGE_SIZE), page: safePage, pageCount };
}

export function createStableId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function todaySourceKey(item: TodayItem, index: number): string {
  return item.sourceKey?.trim() || `legacy:${index}:${item.projectId ?? ""}:${item.text}`;
}

export function todayTimerSourceId(item: TodayItem, index: number): string {
  return `today:${todaySourceKey(item, index)}`;
}

export function todayEntries(items: TodayItem[]) {
  return items.map((item, index) => ({ item, sourceKey: todaySourceKey(item, index) }));
}

export function toggleDisclosureFromBar(event: ReactMouseEvent<HTMLElement>, toggle: () => void) {
  const target = event.target;
  if (target instanceof Element && target.closest("button, a, input, select, textarea")) return;
  toggle();
}


export function formatActionSummary(results: ActionResult[]): { tone: ToastTone; message: string } {
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

export function limitToday(config: AppConfig): AppConfig {
  return {
    ...config,
    today: {
      ...config.today,
      items: config.today.items.slice(0, TODAY_ITEM_LIMIT),
    },
  };
}

export function uniqueSuggestions(candidates: Array<string | null | undefined>, limit: number): string[] {
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

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function matchesHotkey(
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

export const CLOSE_SHORTCUT = "Ctrl+W";

export function isCloseShortcutValue(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === CLOSE_SHORTCUT.toLowerCase();
}

export function formatStartedAt(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function formatDateKeyForHeader(dateKey: string): string {
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

// P10-14d (D1): "N分 ・ HH:MM–HH:MM" when both ends of the Session are known.
export function formatSessionRange(followup: { minutes?: number; startedAt?: string; endedAt?: string }) {
  if (!followup.minutes || !followup.startedAt || !followup.endedAt) return null;
  const start = new Date(followup.startedAt);
  const end = new Date(followup.endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const clock = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${followup.minutes}分 ・ ${clock(start)}–${clock(end)}`;
}

export function isValidStartedAt(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUP_COLLAPSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function writeCollapsedGroups(groups: Record<string, boolean>) {
  window.localStorage.setItem(GROUP_COLLAPSE_STORAGE_KEY, JSON.stringify(groups));
}

export function buttonGroupName(button: LauncherButton): string {
  const group = button.group?.trim();
  return group || DEFAULT_BUTTON_GROUP;
}

export function showButtonInSidebar(button: LauncherButton): boolean {
  return button.showInSidebar !== false;
}

export function showButtonInOverlay(button: LauncherButton): boolean {
  return button.showInOverlay !== false;
}

export function aliasesInputToList(input: string): string[] {
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

export function aliasesListToInput(aliases: string[] | null | undefined): string {
  return aliases?.join(", ") ?? "";
}

export function normalizeOptionalText(input: string): string | undefined {
  const clean = input.trim();
  return clean || undefined;
}

export function uniqueGroupNames(config: AppConfig): string[] {
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

export function uniqueButtonId(label: string, existingButtons: LauncherButton[]): string {
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

export function toThreeNoteDraft(items: string[]): string[] {
  return Array.from({ length: TODAY_ITEM_LIMIT }, (_, index) => items[index] ?? "");
}

export function uniqueProjectId(name: string, existingProjects: LauncherProject[]): string {
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

export function draftId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toActionDraft(action: LauncherAction): ActionDraft {
  return { ...action, draftId: draftId() } as ActionDraft;
}

export function stripActionDraft(action: ActionDraft): LauncherAction {
  const cleanAction = { ...action };
  delete (cleanAction as Partial<ActionDraft>).draftId;
  return cleanAction;
}

export function makeAction(type: LauncherAction["type"], value = ""): ActionDraft {
  if (type === "open_url") {
    return { draftId: draftId(), type, payload: { url: value } };
  }

  if (type === "open_shell_special") {
    return { draftId: draftId(), type, payload: { item: "recycle_bin" } };
  }

  return { draftId: draftId(), type, payload: { path: value } };
}

export function actionValue(action: LauncherAction): string {
  if (action.type === "open_url") return action.payload.url;
  if (action.type === "open_shell_special") return "ごみ箱";
  return action.payload.path;
}

export function setActionValue(action: ActionDraft, value: string): ActionDraft {
  if (action.type === "open_url") {
    return { ...action, payload: { url: value } };
  }

  if (action.type === "open_shell_special") return action;

  return { ...action, payload: { ...action.payload, path: value } };
}

export function actionHasSuspiciousPath(action: LauncherAction): boolean {
  if (action.type === "open_url") {
    return !/^https?:\/\//i.test(action.payload.url.trim());
  }

  if (action.type === "open_shell_special") return false;

  const path = action.payload.path.trim();
  return Boolean(path && !/^[a-zA-Z]:[\\/]/.test(path) && !path.startsWith("%"));
}

export function iconForAction(action: LauncherAction): string {
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

export function isSafeIconSourcePath(path: string): boolean {
  const cleanPath = path.trim();
  return Boolean(cleanPath) && !/^https?:\/\//i.test(cleanPath);
}

export function buttonHasIconCacheSource(button: LauncherButton): boolean {
  if (button.iconSource?.trim()) return isSafeIconSourcePath(button.iconSource);
  return button.actions.some((action) => {
    const value = actionValue(action).trim();
    if (!value) return false;
    return action.type === "open_url" ? /^https?:\/\//i.test(value) : true;
  });
}

export function normalizeTimerMinutes(value: number): number {
  return Math.min(240, Math.max(1, Math.round(value)));
}

export function formatTodayActivityLog(date: string, entries: SessionEntryRow[]): string {
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
      lines.push(
        `- ${entry.startedAt} | プロジェクト・項目: ${entry.label || "未分類"} | ${entry.minutes}分 | 次の一手・作業名: ${note || "記録なし"}`,
      );
    });
  }

  return lines.join("\n");
}

export function actionDescription(action: LauncherAction): string {
  switch (action.type) {
    case "open_app":
    case "run_script":
      return action.payload.path;
    case "open_folder":
    case "open_file":
      return action.payload.path;
    case "open_url":
      return action.payload.url;
    case "open_shell_special":
      return "ごみ箱";
  }
}

export function actionKindLabel(action: LauncherAction | undefined): string {
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

export function firstDroppedUrl(text: string): string | null {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && /^https?:\/\//i.test(line)) ?? null
  );
}

/** The custom and Tauri drop paths report physical pixels; convert them to CSS pixels. */
export function dropPositionToCss(position: { x: number; y: number }): { x: number; y: number } {
  const ratio = window.devicePixelRatio || 1;
  return { x: position.x / ratio, y: position.y / ratio };
}

export const SHORTCUT_PATTERN =
  /^(?:(?:Ctrl|Alt|Shift|Super|Command)\+)*(?:[A-Za-z0-9]|F(?:[1-9]|1[0-2])|Space)$/i;
export const WINDOWS_RESERVED_SHORTCUTS = ["alt+space", "ctrl+esc", "ctrl+alt+delete"];

export function shortcutFromKeyboardEvent(event: globalThis.KeyboardEvent): string | null | undefined {
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

export function shortcutValidationMessage(value: string, conflictingActions: string[]): string {
  const clean = value.trim();
  if (!clean) return "未設定";
  if (!SHORTCUT_PATTERN.test(clean)) return "Ctrl+Kのような形式で入力してください";
  if (isCloseShortcutValue(clean)) return "Ctrl+W はアプリの『閉じる』で使っています";
  if (conflictingActions.length > 0) {
    return `${conflictingActions.map((label) => `「${label}」`).join("・")}と競合。どちらかを変更してください`;
  }
  if (WINDOWS_RESERVED_SHORTCUTS.includes(clean.toLowerCase())) {
    return "OS予約キーのため登録できません。別のキーを入力してください";
  }
  return "登録済み（保存時に再登録）";
}

export function validateShortcutSettings(
  draft: SettingsCenterDraft,
  currentSettings?: AppConfig["settings"],
): string | null {
  const values = SHORTCUT_DRAFT_FIELDS.map(({ field }) => draft[field])
    .map((value) => value.trim())
    .filter(Boolean);
  const closeAssignment = SHORTCUT_DRAFT_FIELDS.some(
    ({ field }) =>
      isCloseShortcutValue(draft[field]) && !isCloseShortcutValue(currentSettings?.[field]),
  );
  if (closeAssignment) {
    return "Ctrl+W はアプリの『閉じる』で使っています";
  }
  const conflict = findShortcutConflicts(
    SHORTCUT_DRAFT_FIELDS.map(({ field, label }) => ({ field, label, value: draft[field] })),
  )[0];
  if (conflict) {
    return `${conflict.chord} は ${conflict.bindings.map(({ label }) => `「${label}」`).join("・")} に設定されています。いずれかを変更してください`;
  }
  const invalid = values.find((value) => !SHORTCUT_PATTERN.test(value));
  if (invalid) return `ショートカットの形式を確認してください: ${invalid}`;
  const reserved = values.find((value) => WINDOWS_RESERVED_SHORTCUTS.includes(value.toLowerCase()));
  return reserved ? `OS予約キーは登録できません。別のキーを入力してください: ${reserved}` : null;
}
