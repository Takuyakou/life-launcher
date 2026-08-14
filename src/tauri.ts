import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  ActionResult,
  AppConfig,
  AppConfigSchema,
  DropButtonDraft,
  DropResolveInput,
  InstructionDocument,
  InstructionEntry,
  InstructionFolderSummary,
  InstructionPathChange,
  InstructionRecycleResult,
  InstructionRoot,
  InstructionReferenceUpdateResult,
  InstructionWriteResult,
  LauncherAction,
  LauncherButton,
  LoadConfigResponse,
  ManualSessionInput,
  NotesForDateInput,
  NotesHistoryResponse,
  NextStepFreshnessResponse,
  SaveConfigResponse,
  DeleteSessionEntryInput,
  DoNowResponse,
  SessionEntriesFilter,
  SessionEntriesResponse,
  SessionLogInput,
  SessionSummaryResponse,
  SessionTotalResponse,
  UpdateSessionEntryInput,
  TodayNotesInput,
  TodayNotesResponse,
  WeeklyReviewResponse,
} from "./types";

export async function loadConfig(): Promise<LoadConfigResponse> {
  const response = await invoke<LoadConfigResponse>("load_config");
  return {
    ...response,
    config: AppConfigSchema.parse(response.config),
  };
}

export async function saveConfig(config: AppConfig): Promise<SaveConfigResponse> {
  const response = await invoke<SaveConfigResponse>("save_config", { config });
  return {
    ...response,
    config: AppConfigSchema.parse(response.config),
  };
}

export async function saveConfigAndNotifyDashboard(
  config: AppConfig,
): Promise<SaveConfigResponse> {
  const response = await saveConfig(config);
  await emitTo("main", "config-changed").catch(() => undefined);
  return response;
}

export async function executeActions(actions: LauncherAction[]): Promise<ActionResult[]> {
  return invoke<ActionResult[]>("execute_actions", { actions });
}

export async function reapplyDashboardSettings(): Promise<void> {
  await invoke("reapply_dashboard_settings");
}

export async function suspendDashboardShortcuts(): Promise<void> {
  await invoke("suspend_dashboard_shortcuts");
}

export async function resumeDashboardShortcuts(): Promise<void> {
  await invoke("resume_dashboard_shortcuts");
}

export async function focusDashboardWindow(): Promise<void> {
  await invoke("focus_dashboard_window");
}

export async function enableMainShellDrop(): Promise<void> {
  await invoke("enable_main_shell_drop");
}

export async function startShellDropPoc(): Promise<void> {
  await invoke("start_shell_drop_poc");
}

export async function stopShellDropPoc(): Promise<void> {
  await invoke("stop_shell_drop_poc");
}

export async function loadTodaySessionTotal(): Promise<SessionTotalResponse> {
  return invoke<SessionTotalResponse>("load_today_session_total");
}

export async function recordSession(session: SessionLogInput): Promise<SessionTotalResponse> {
  return invoke<SessionTotalResponse>("record_session", { session });
}

export async function recordManualSession(
  session: ManualSessionInput,
): Promise<SessionSummaryResponse> {
  return invoke<SessionSummaryResponse>("record_manual_session", { session });
}

export async function loadSessionSummary(): Promise<SessionSummaryResponse> {
  return invoke<SessionSummaryResponse>("load_session_summary");
}

export async function loadDoNowCandidates(): Promise<DoNowResponse> {
  return invoke<DoNowResponse>("load_do_now_candidates");
}

export async function loadWeeklyReview(): Promise<WeeklyReviewResponse> {
  return invoke<WeeklyReviewResponse>("load_weekly_review");
}

export async function loadNextStepFreshness(): Promise<NextStepFreshnessResponse> {
  return invoke<NextStepFreshnessResponse>("load_next_step_freshness");
}

export async function loadSessionEntries(
  filter?: SessionEntriesFilter,
): Promise<SessionEntriesResponse> {
  return invoke<SessionEntriesResponse>("load_session_entries", { filter });
}

export async function updateSessionEntry(
  input: UpdateSessionEntryInput,
): Promise<SessionEntriesResponse> {
  return invoke<SessionEntriesResponse>("update_session_entry", { input });
}

export async function deleteSessionEntry(
  input: DeleteSessionEntryInput,
): Promise<SessionEntriesResponse> {
  return invoke<SessionEntriesResponse>("delete_session_entry", { input });
}

export async function loadNextStepSuggestions(projectId: string): Promise<string[]> {
  return invoke<string[]>("load_next_step_suggestions", { projectId });
}

export async function loadTodayNotes(): Promise<TodayNotesResponse> {
  return invoke<TodayNotesResponse>("load_today_notes");
}

export async function saveTodayNotes(input: TodayNotesInput): Promise<TodayNotesResponse> {
  return invoke<TodayNotesResponse>("save_today_notes", { input });
}

export async function loadNotesHistory(): Promise<NotesHistoryResponse> {
  return invoke<NotesHistoryResponse>("load_notes_history");
}

export async function saveNotesForDate(input: NotesForDateInput): Promise<NotesHistoryResponse> {
  return invoke<NotesHistoryResponse>("save_notes_for_date", { input });
}

export async function resolveDropItem(input: DropResolveInput): Promise<DropButtonDraft> {
  return invoke<DropButtonDraft>("resolve_drop_item", { input });
}

export async function ensureButtonIconCache(button: LauncherButton): Promise<string | null> {
  const path = await invoke<string | null>("ensure_button_icon_cache", { button });
  return path ? convertFileSrc(path) : null;
}

export async function deleteButtonIconCache(buttonId: string): Promise<void> {
  await invoke("delete_button_icon_cache", { buttonId });
}

export async function openConfigBackups(): Promise<string> {
  return invoke<string>("open_config_backups");
}

export async function openDataFolder(): Promise<string> {
  return invoke<string>("open_data_folder");
}

export async function selectBackupFolder(): Promise<string | null> {
  return invoke<string | null>("select_backup_folder");
}

export async function selectBackupZip(): Promise<string | null> {
  return invoke<string | null>("select_backup_zip");
}

export async function restoreBackup(zipPath: string): Promise<LoadConfigResponse> {
  const response = await invoke<LoadConfigResponse>("restore_backup", { zipPath });
  return {
    ...response,
    config: AppConfigSchema.parse(response.config),
  };
}

export async function listInstructionRoots(): Promise<InstructionRoot[]> {
  return invoke<InstructionRoot[]>("list_instruction_roots");
}

export async function listInstructionDirectory(path: string): Promise<InstructionEntry[]> {
  return invoke<InstructionEntry[]>("list_instruction_directory", { path });
}

export async function searchInstructionFiles(query: string): Promise<InstructionEntry[]> {
  return invoke<InstructionEntry[]>("search_instruction_files", { query });
}

export async function readInstruction(path: string): Promise<InstructionDocument> {
  return invoke<InstructionDocument>("read_instruction", { path });
}

export async function writeInstruction(
  path: string,
  content: string,
  expectedModifiedAt: number,
): Promise<InstructionWriteResult> {
  return invoke<InstructionWriteResult>("write_instruction", {
    path,
    content,
    expectedModifiedAt,
  });
}

export async function createInstructionFile(
  parent: string,
  name: string,
  extension: string,
): Promise<InstructionEntry> {
  return invoke<InstructionEntry>("create_instruction_file", { parent, name, extension });
}

export async function createInstructionFolder(
  parent: string,
  name: string,
): Promise<InstructionEntry> {
  return invoke<InstructionEntry>("create_instruction_folder", { parent, name });
}

export async function renameInstructionFile(
  path: string,
  newName: string,
): Promise<InstructionPathChange> {
  return invoke<InstructionPathChange>("rename_instruction_file", { path, newName });
}

export async function renameInstructionFolder(
  path: string,
  newName: string,
): Promise<InstructionPathChange> {
  return invoke<InstructionPathChange>("rename_instruction_folder", { path, newName });
}

export async function moveInstructionToRecycleBin(
  path: string,
): Promise<InstructionRecycleResult> {
  return invoke<InstructionRecycleResult>("move_instruction_to_recycle_bin", { path });
}

export async function inspectInstructionFolder(path: string): Promise<InstructionFolderSummary> {
  return invoke<InstructionFolderSummary>("inspect_instruction_folder", { path });
}

export async function backupConfigBeforeInstructionChange(): Promise<void> {
  return invoke("backup_config_before_instruction_change");
}

export async function updateInstructionReferences(
  oldPath: string,
  newPath: string | null,
  unregisterRoot = false,
): Promise<InstructionReferenceUpdateResult> {
  return invoke<InstructionReferenceUpdateResult>("update_instruction_references", {
    oldPath,
    newPath,
    unregisterRoot,
  });
}

export async function openInstructionInDefaultEditor(path: string): Promise<string> {
  return invoke<string>("open_instruction_in_default_editor", { path });
}

export async function openInstructionFolder(path: string): Promise<string> {
  return invoke<string>("open_instruction_folder", { path });
}

export async function revealInstructionInExplorer(path: string): Promise<string> {
  return invoke<string>("reveal_instruction_in_explorer", { path });
}

export async function validateInstructionRoot(path: string): Promise<InstructionRoot> {
  return invoke<InstructionRoot>("validate_instruction_root", { path });
}

export async function chooseInstructionRoot(): Promise<InstructionRoot | null> {
  return invoke<InstructionRoot | null>("choose_instruction_root");
}

export function listenForConfigChanges(onChange: () => void): Promise<() => void> {
  return listen("config-changed", () => onChange());
}
