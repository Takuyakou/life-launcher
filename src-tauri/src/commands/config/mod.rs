mod backup;
#[cfg(test)]
mod migration_tests;
mod sanitize;
mod schema;
#[cfg(test)]
mod tests;

use std::collections::HashSet;
use std::fs;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use super::actions::expand_env_path;
use super::instructions::reconcile_instruction_folder_settings;
use crate::datetime;
use crate::models::{
    default_day_start_hour, initial_config, Action, AppConfig, InboxItem,
    InstructionReferenceUpdateResponse, LegacyProjectV2, LoadConfigResponse,
    MissingLaunchTargetsResponse, NextStepFreshnessResponse, Project, ProjectV3,
    SaveConfigResponse, Settings, UndoTodaySelectionInput, TODAY_ITEM_LIMIT,
};
use crate::state::AppState;
pub use backup::write_config;
pub(crate) use backup::{
    atomic_write_bytes, backup_existing_config, create_forced_user_backup, read_zip, write_zip,
    ZipEntry, RUNTIME_BACKUP_FILES,
};
use backup::{daily_backup, restore_backup_from_path, write_bytes_atomically};
pub(crate) use sanitize::sanitize_config;
use sanitize::{
    migrate_overlay_pages_from_groups, morning_victory_suggestion, project_is_stale_at,
    should_backup_before_config_rewrite,
};
pub(crate) use schema::config_schema_json;

pub(super) const CONFIG_FILE_NAME: &str = "config.json";
pub(super) const CONFIG_SCHEMA_FILE_NAME: &str = "config.schema.json";
const BACKUP_DIR_NAME: &str = "backups";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[tauri::command]
pub fn load_config(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LoadConfigResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    load_config_internal(&app)
}

#[tauri::command]
pub fn load_next_step_freshness(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<NextStepFreshnessResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let config = load_config_internal(&app)?.config;
    let now = datetime::now_utc();
    Ok(NextStepFreshnessResponse {
        stale_project_ids: config
            .projects
            .iter()
            .filter(|project| project_is_stale_at(project, now))
            .map(|project| project.id.clone())
            .collect(),
    })
}

#[derive(Debug, Default, PartialEq, Eq)]
struct LaunchTargetChecks {
    buttons: Vec<(String, Vec<String>)>,
    instructions: Vec<(String, String)>,
}

fn collect_launch_target_checks(config: &AppConfig) -> LaunchTargetChecks {
    let referenced_button_ids: HashSet<&str> = config
        .projects
        .iter()
        .filter_map(|project| project.next_step.as_ref())
        .flat_map(|step| step.button_ids.iter().map(String::as_str))
        .collect();

    let mut seen_button_ids = HashSet::new();
    let mut buttons = Vec::new();
    for button in &config.buttons {
        if !referenced_button_ids.contains(button.id.as_str())
            || !seen_button_ids.insert(button.id.as_str())
        {
            continue;
        }
        let paths: Vec<String> = button
            .actions
            .iter()
            .filter_map(|action| match action {
                Action::OpenApp { path, .. }
                | Action::OpenFolder { path }
                | Action::OpenFile { path }
                | Action::RunScript { path, .. } => Some(path.clone()),
                Action::OpenUrl { .. } | Action::OpenShellSpecial { .. } => None,
            })
            .collect();
        if !paths.is_empty() {
            buttons.push((button.id.clone(), paths));
        }
    }

    let mut seen_project_ids = HashSet::new();
    let mut instructions = Vec::new();
    for project in &config.projects {
        if let Some(path) = project
            .next_step
            .as_ref()
            .and_then(|step| step.instruction_path.as_ref())
        {
            if seen_project_ids.insert(project.id.as_str()) {
                instructions.push((project.id.clone(), path.clone()));
            }
        }
    }

    LaunchTargetChecks {
        buttons,
        instructions,
    }
}

fn is_missing_local_path(raw: &str) -> bool {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return false;
    }
    let expanded = expand_env_path(trimmed);
    if expanded.is_empty()
        || expanded.contains('%')
        || expanded.starts_with(r"\\")
        || expanded.starts_with("//")
    {
        return false;
    }
    matches!(Path::new(&expanded).try_exists(), Ok(false))
}

fn evaluate_missing_launch_targets(checks: LaunchTargetChecks) -> MissingLaunchTargetsResponse {
    let missing_button_ids = checks
        .buttons
        .into_iter()
        .filter(|(_, paths)| paths.iter().any(|path| is_missing_local_path(path)))
        .map(|(id, _)| id)
        .collect();
    let missing_instruction_project_ids = checks
        .instructions
        .into_iter()
        .filter(|(_, path)| is_missing_local_path(path))
        .map(|(project_id, _)| project_id)
        .collect();
    MissingLaunchTargetsResponse {
        missing_button_ids,
        missing_instruction_project_ids,
    }
}

#[tauri::command]
pub async fn load_missing_launch_targets(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<MissingLaunchTargetsResponse, String> {
    let checks = {
        let _reset_guard = state.begin_app_write()?;
        let _write_guard = state
            .config_write_lock
            .lock()
            .map_err(|_| "failed to lock config writes".to_string())?;
        let config = load_config_internal(&app)?.config;
        collect_launch_target_checks(&config)
    };
    tauri::async_runtime::spawn_blocking(move || evaluate_missing_launch_targets(checks))
        .await
        .map_err(|error| format!("failed to check launch targets: {error}"))
}

#[tauri::command]
pub fn save_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<SaveConfigResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    validate_project_v3_invariants(&config)?;
    let (mut config, _changed, _warnings) = sanitize_config(config);
    reconcile_config_instruction_roots(&mut config);
    // P10-11: every ordinary save records that the first-run guide is no longer needed.
    stamp_first_run_done_at(&mut config.settings);
    let path = config_path()?;
    validate_existing_config_before_save(&path)?;
    ensure_config_schema_file()?;
    backup_existing_config(&path)?;
    *state
        .suppress_reload_until
        .lock()
        .map_err(|_| "failed to lock reload state".to_string())? =
        Some(Instant::now() + Duration::from_millis(900));
    write_config(&path, &config)?;
    let _ = app;
    Ok(SaveConfigResponse {
        config,
        path: path.to_string_lossy().to_string(),
    })
}

/// P10-11 (§8.2): fills `firstRunDoneAt` on an ordinary save when it is still missing.
/// The first-run guide itself writes it explicitly; this only covers users who set things up
/// without finishing the guide (or who upgraded from a version without the field).
fn stamp_first_run_done_at(settings: &mut Settings) -> bool {
    if settings.first_run_done_at.is_some() {
        return false;
    }
    settings.first_run_done_at = Some(datetime::format_rfc3339_auto(datetime::now_utc()));
    true
}

fn current_source_snapshot(config: &AppConfig, source_key: &str) -> Option<Value> {
    if let Some(project_id) = source_key.strip_prefix("project:") {
        return config
            .projects
            .iter()
            .find(|project| project.id == project_id)
            .and_then(|project| serde_json::to_value(project).ok());
    }
    if let Some(wishlist_id) = source_key.strip_prefix("wishlist:") {
        return config
            .inbox
            .iter()
            .find(|item| item.id.as_deref() == Some(wishlist_id))
            .and_then(|item| serde_json::to_value(item).ok());
    }
    None
}

fn normalized_source_snapshot(source_key: &str, snapshot: &Option<Value>) -> Option<Value> {
    let value = snapshot.as_ref()?.clone();
    if source_key.starts_with("project:") {
        return serde_json::from_value::<Project>(value)
            .ok()
            .and_then(|project| serde_json::to_value(project).ok());
    }
    if source_key.starts_with("wishlist:") {
        return serde_json::from_value::<InboxItem>(value)
            .ok()
            .and_then(|item| serde_json::to_value(item).ok());
    }
    None
}

fn today_item_source_key(item: &crate::models::TodayItem) -> Option<&str> {
    item.source_key
        .as_deref()
        .filter(|key| !key.trim().is_empty())
}

fn apply_undo_today_selection(
    mut config: AppConfig,
    input: &UndoTodaySelectionInput,
) -> Result<AppConfig, String> {
    if config.today.date != input.day_key {
        return Err("日付または今日の枠が変わったため元に戻せません".to_string());
    }
    if config
        .today
        .selection_mutation_tokens
        .get(&input.source_key)
        .map(String::as_str)
        != Some(input.operation_id.as_str())
    {
        return Err("対象はこの後に変更されたため元に戻せません".to_string());
    }
    let is_stable_source =
        input.source_key.starts_with("project:") || input.source_key.starts_with("wishlist:");
    let current_snapshot = current_source_snapshot(&config, &input.source_key);
    let input_snapshot = normalized_source_snapshot(&input.source_key, &input.source_snapshot);
    let input_snapshot_is_invalid = input.source_snapshot.is_some() && input_snapshot.is_none();
    if is_stable_source && (input_snapshot_is_invalid || current_snapshot != input_snapshot) {
        return Err("元の次の一手・やりたいことが変更されたため元に戻せません".to_string());
    }
    if config
        .today
        .items
        .iter()
        .any(|item| today_item_source_key(item) == Some(input.source_key.as_str()))
    {
        return Err("対象はすでに今日の3件へ戻っています".to_string());
    }
    if let Some(item) = input.item.clone() {
        if config.today.items.len() >= TODAY_ITEM_LIMIT {
            return Err("今日の3件が埋まっているため元に戻せません".to_string());
        }
        let insertion_index = input
            .next_source_key
            .as_deref()
            .and_then(|key| {
                config
                    .today
                    .items
                    .iter()
                    .position(|entry| today_item_source_key(entry) == Some(key))
            })
            .or_else(|| {
                input.previous_source_key.as_deref().and_then(|key| {
                    config
                        .today
                        .items
                        .iter()
                        .position(|entry| today_item_source_key(entry) == Some(key))
                        .map(|index| index + 1)
                })
            })
            .unwrap_or(config.today.items.len());
        config.today.items.insert(insertion_index, item);
    }
    if input.restore_exclusion {
        config
            .today
            .candidate_excluded_source_keys
            .retain(|key| key != &input.source_key);
    }
    config
        .today
        .selection_mutation_tokens
        .remove(&input.source_key);
    Ok(config)
}

#[tauri::command]
pub fn undo_today_selection(
    app: AppHandle,
    state: State<'_, AppState>,
    input: UndoTodaySelectionInput,
) -> Result<SaveConfigResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let config = apply_undo_today_selection(load_config_internal(&app)?.config, &input)?;
    let (mut config, _changed, _warnings) = sanitize_config(config);
    reconcile_config_instruction_roots(&mut config);
    let path = config_path()?;
    ensure_config_schema_file()?;
    backup_existing_config(&path)?;
    *state
        .suppress_reload_until
        .lock()
        .map_err(|_| "failed to lock reload state".to_string())? =
        Some(Instant::now() + Duration::from_millis(900));
    write_config(&path, &config)?;
    Ok(SaveConfigResponse {
        config,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn backup_config_before_instruction_change(state: State<'_, AppState>) -> Result<(), String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    backup_existing_config(&config_path()?)
}

#[tauri::command]
pub fn update_instruction_references(
    app: AppHandle,
    state: State<'_, AppState>,
    old_path: String,
    new_path: Option<String>,
    unregister_root: bool,
) -> Result<InstructionReferenceUpdateResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let mut config = load_config_internal(&app)?.config;
    let (project_names, root_removed, item_references_changed) =
        rewrite_instruction_references_in_config(
            &mut config,
            &old_path,
            new_path.as_deref(),
            unregister_root,
        );
    let changed = root_removed || item_references_changed || !project_names.is_empty();
    if changed {
        let path = config_path()?;
        backup_existing_config(&path)?;
        *state
            .suppress_reload_until
            .lock()
            .map_err(|_| "failed to lock reload state".to_string())? =
            Some(Instant::now() + Duration::from_millis(900));
        write_config(&path, &config)?;
        let _ = app.emit("config-changed", ());
    }
    // V160-B1: a renamed, moved, or removed ZIP keeps (or drops) its remembered page.
    crate::commands::instruction_books::rename_instruction_book_state(
        &old_path,
        new_path.as_deref(),
    );
    Ok(InstructionReferenceUpdateResponse {
        project_names,
        changed,
    })
}

fn config_path_key(path: &str) -> String {
    path.replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

fn config_paths_equal(left: &str, right: &str) -> bool {
    config_path_key(left) == config_path_key(right)
}

fn config_path_is_within(path: &str, root: &str) -> bool {
    let path = config_path_key(path);
    let root = config_path_key(root);
    path == root || path.starts_with(&format!("{root}\\"))
}

fn replace_config_path_prefix(path: &str, old_path: &str, new_path: &str) -> String {
    let old_component_count = PathBuf::from(old_path).components().count();
    let suffix = PathBuf::from(path)
        .components()
        .skip(old_component_count)
        .collect::<PathBuf>();
    PathBuf::from(new_path)
        .join(suffix)
        .to_string_lossy()
        .to_string()
}

fn rewrite_instruction_references_in_config(
    config: &mut AppConfig,
    old_path: &str,
    new_path: Option<&str>,
    unregister_root: bool,
) -> (Vec<String>, bool, bool) {
    let mut project_names = Vec::new();
    for project in &mut config.projects {
        let mut changed = false;
        let mut rewrite = |instruction_path: &mut Option<String>,
                           open_on_start: &mut Option<bool>| {
            let Some(path) = instruction_path.as_ref() else {
                return;
            };
            if !config_path_is_within(path, old_path) {
                return;
            }
            *instruction_path =
                new_path.map(|replacement| replace_config_path_prefix(path, old_path, replacement));
            if new_path.is_none() {
                *open_on_start = None;
            }
            changed = true;
        };
        if let Some(next_step) = project.next_step.as_mut() {
            rewrite(
                &mut next_step.instruction_path,
                &mut next_step.instruction_open_on_start,
            );
        }
        if let Some(pending) = project.legacy_next_step_settings.as_mut() {
            rewrite(
                &mut pending.instruction_path,
                &mut pending.instruction_open_on_start,
            );
        }
        if changed {
            project_names.push(project.name.clone());
        }
    }

    let mut item_references_changed = false;
    for item in &mut config.today.items {
        if item
            .instruction_path
            .as_deref()
            .is_some_and(|path| config_path_is_within(path, old_path))
        {
            item.instruction_path = new_path.map(|replacement| {
                replace_config_path_prefix(
                    item.instruction_path.as_deref().unwrap_or_default(),
                    old_path,
                    replacement,
                )
            });
            if new_path.is_none() {
                item.instruction_open_on_start = None;
            }
            item_references_changed = true;
        }
    }
    for item in &mut config.inbox {
        if item
            .instruction_path
            .as_deref()
            .is_some_and(|path| config_path_is_within(path, old_path))
        {
            item.instruction_path = new_path.map(|replacement| {
                replace_config_path_prefix(
                    item.instruction_path.as_deref().unwrap_or_default(),
                    old_path,
                    replacement,
                )
            });
            if new_path.is_none() {
                item.instruction_open_on_start = None;
            }
            item_references_changed = true;
        }
    }

    let mut root_removed = false;
    if unregister_root {
        if let Some(folders) = config.settings.instruction_folders.as_mut() {
            let before = folders.len();
            folders.retain(|path| !config_paths_equal(path, old_path));
            root_removed = folders.len() != before;
        }
        if let Some(identities) = config.settings.instruction_folder_identities.as_mut() {
            identities.retain(|identity| !config_paths_equal(&identity.path, old_path));
        }
    }
    (project_names, root_removed, item_references_changed)
}

#[tauri::command]
pub fn open_config_backups(app: AppHandle) -> Result<String, String> {
    let path = backups_path()?;
    fs::create_dir_all(&path)
        .map_err(|error| format!("failed to create {}: {error}", path.display()))?;
    let path_text = path.to_string_lossy().to_string();
    app.opener()
        .open_path(path_text.clone(), None::<&str>)
        .map_err(|error| error.to_string())?;
    Ok(path_text)
}

#[tauri::command]
pub fn open_data_folder(app: AppHandle) -> Result<String, String> {
    let path = config_dir_path()?;
    fs::create_dir_all(&path)
        .map_err(|error| format!("failed to create {}: {error}", path.display()))?;
    let path_text = path.to_string_lossy().to_string();
    app.opener()
        .open_path(path_text.clone(), None::<&str>)
        .map_err(|error| error.to_string())?;
    Ok(path_text)
}

#[tauri::command]
pub fn select_backup_folder() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let script = concat!(
            "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ",
            "$shell=New-Object -ComObject Shell.Application; ",
            "$folder=$shell.BrowseForFolder(0,'Life Launcher backup folder',0,0); ",
            "if ($folder) { [Console]::Out.Write($folder.Self.Path) }"
        );
        let output = powershell_dialog_output(script)
            .map_err(|error| format!("failed to open folder picker: {error}"))?;

        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                "folder picker was closed unexpectedly".to_string()
            } else {
                message
            });
        }

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }

    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn select_backup_zip() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let script = concat!(
            "Add-Type -AssemblyName System.Windows.Forms; ",
            "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ",
            "$dialog=New-Object System.Windows.Forms.OpenFileDialog; ",
            "$dialog.Title='Life Launcher backup ZIP'; ",
            "$dialog.Filter='Life Launcher backup (*.zip)|*.zip'; ",
            "$dialog.CheckFileExists=$true; ",
            "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { ",
            "[Console]::Out.Write($dialog.FileName) }"
        );
        let output = powershell_dialog_output(script)
            .map_err(|error| format!("failed to open backup picker: {error}"))?;

        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                "backup picker was closed unexpectedly".to_string()
            } else {
                message
            });
        }

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }

    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn restore_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    zip_path: String,
) -> Result<LoadConfigResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    *state
        .suppress_reload_until
        .lock()
        .map_err(|_| "failed to lock reload state".to_string())? =
        Some(Instant::now() + Duration::from_secs(5));
    restore_backup_from_path(&PathBuf::from(zip_path))?;
    load_config_internal(&app)
}

#[cfg(windows)]
fn powershell_dialog_output(script: &str) -> std::io::Result<std::process::Output> {
    let mut command = std::process::Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-STA", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW);
    command.output()
}

pub fn load_config_internal(_app: &AppHandle) -> Result<LoadConfigResponse, String> {
    load_config_from_disk()
}

fn load_config_from_disk() -> Result<LoadConfigResponse, String> {
    let path = config_path()?;
    let backup_path = backups_path()?;
    ensure_config_schema_file()?;
    if !path.exists() {
        let config = initial_config();
        write_config(&path, &config)?;
        let backup_error = daily_backup(&config).err();
        return Ok(LoadConfigResponse {
            config,
            path: path.to_string_lossy().to_string(),
            backup_path: backup_path.to_string_lossy().to_string(),
            error: None,
            backup_error,
            changed: true,
            save_blocked: false,
            morning_victory_suggestion: None,
        });
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(error) => {
            return Ok(LoadConfigResponse {
                config: initial_config(),
                path: path.to_string_lossy().to_string(),
                backup_path: backup_path.to_string_lossy().to_string(),
                error: Some(format!("config.json is not valid JSON: {error}")),
                backup_error: None,
                changed: false,
                save_blocked: true,
                morning_victory_suggestion: None,
            });
        }
    };

    let raw_version = parsed
        .get("version")
        .and_then(Value::as_u64)
        .unwrap_or_default() as u8;
    if !parsed.is_object() {
        return Ok(LoadConfigResponse {
            config: initial_config(),
            path: path.to_string_lossy().to_string(),
            backup_path: backup_path.to_string_lossy().to_string(),
            error: Some("config root must be an object".to_string()),
            backup_error: None,
            changed: false,
            save_blocked: true,
            morning_victory_suggestion: None,
        });
    }
    let mut errors = Vec::new();
    let missing_inbox = parsed.get("inbox").is_none();
    let missing_overlay_pages = parsed.get("overlayPages").is_none();
    let missing_dictionary_order = parsed.get("dictionaryOrder").is_none();
    let missing_mini_window_position = parsed
        .get("settings")
        .and_then(|settings| settings.get("miniWindowPosition"))
        .is_none();
    let mut prepared = parsed;
    if missing_inbox {
        let inbox = prepared
            .get("later")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new()));
        prepared
            .as_object_mut()
            .expect("JSON config root checked by decoder")
            .insert("inbox".to_string(), inbox);
        errors.push(if prepared.get("later").is_some() {
            "later: migrated to inbox".to_string()
        } else {
            "inbox: missing, using default value".to_string()
        });
    }
    let (mut config, migrated_config_v3) = match decode_config_for_v3(&prepared) {
        Ok(result) => result,
        Err(error) => {
            return Ok(LoadConfigResponse {
                config: initial_config(),
                path: path.to_string_lossy().to_string(),
                backup_path: backup_path.to_string_lossy().to_string(),
                error: Some(error),
                backup_error: None,
                changed: false,
                save_blocked: true,
                morning_victory_suggestion: None,
            });
        }
    };
    let migrated_overlay_pages =
        missing_overlay_pages && migrate_overlay_pages_from_groups(&mut config);
    let morning_victory_suggestion = morning_victory_suggestion(&config);
    let dictionary_order_before_sanitize = config.dictionary_order.clone();

    let (sanitized, changed, warnings) = sanitize_config(config);
    config = sanitized;
    let dictionary_order_changed = config.dictionary_order != dictionary_order_before_sanitize;
    errors.extend(warnings);
    let instruction_roots_changed = reconcile_config_instruction_roots(&mut config);
    let changed = changed
        || missing_inbox
        || missing_mini_window_position
        || migrated_overlay_pages
        || missing_dictionary_order
        || dictionary_order_changed
        || instruction_roots_changed
        || migrated_config_v3;

    if changed {
        if instruction_roots_changed
            || dictionary_order_changed
            || should_backup_before_config_rewrite(raw_version, migrated_overlay_pages)
            || migrated_config_v3
        {
            backup_existing_config(&path)?;
        }
        write_config(&path, &config)?;
    }

    let backup_error = daily_backup(&config).err();

    Ok(LoadConfigResponse {
        config,
        path: path.to_string_lossy().to_string(),
        backup_path: backup_path.to_string_lossy().to_string(),
        error: if errors.is_empty() {
            None
        } else {
            Some(errors.join(" / "))
        },
        backup_error,
        changed,
        save_blocked: false,
        morning_victory_suggestion,
    })
}

fn migrate_config_value_to_v3(parsed: &Value) -> Result<(Value, bool), String> {
    let raw_version = parsed
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "config version is missing or invalid".to_string())?;
    if raw_version == 3 {
        return Ok((parsed.clone(), false));
    }
    if raw_version > 3 {
        return Err(format!(
            "config version {raw_version} is newer than this app supports"
        ));
    }

    let legacy_projects = parsed
        .get("projects")
        .cloned()
        .ok_or_else(|| "projects: missing; migration was not attempted".to_string())?;
    let legacy_projects =
        serde_json::from_value::<Vec<LegacyProjectV2>>(legacy_projects).map_err(|error| {
            format!("projects: invalid v2 data; migration was not attempted: {error}")
        })?;
    let projects = legacy_projects
        .into_iter()
        .map(ProjectV3::from)
        .collect::<Vec<_>>();
    let mut migrated = parsed.clone();
    let root = migrated
        .as_object_mut()
        .ok_or_else(|| "config root must be an object".to_string())?;
    root.insert("version".to_string(), Value::from(3));
    root.insert(
        "projects".to_string(),
        serde_json::to_value(projects)
            .map_err(|error| format!("failed to serialize migrated projects: {error}"))?,
    );
    Ok((migrated, true))
}

fn decode_config_for_v3(parsed: &Value) -> Result<(AppConfig, bool), String> {
    let (migrated, changed) = migrate_config_value_to_v3(parsed)?;
    let config = serde_json::from_value::<AppConfig>(migrated)
        .map_err(|error| format!("config v3 validation failed: {error}"))?;
    validate_project_v3_invariants(&config)?;
    Ok((config, changed))
}

pub(crate) fn validate_project_v3_invariants(config: &AppConfig) -> Result<(), String> {
    if let Some(project) = config
        .projects
        .iter()
        .find(|project| project.next_step.is_some() && project.legacy_next_step_settings.is_some())
    {
        return Err(format!(
            "project {} has both nextStep and legacyNextStepSettings",
            project.id
        ));
    }
    Ok(())
}

pub(crate) fn validate_existing_config_before_save(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to validate {} before save: {error}", path.display()))?;
    let parsed = serde_json::from_str::<Value>(&raw).map_err(|error| {
        format!("config.json is invalid; save was blocked to preserve the original file: {error}")
    })?;
    decode_config_for_v3(&parsed)
        .map(|_| ())
        .map_err(|error| format!("config.json could not be validated; save was blocked: {error}"))
}

pub(crate) fn reconcile_config_instruction_roots(config: &mut AppConfig) -> bool {
    let had_instruction_folders = config.settings.instruction_folders.is_some();
    let folders = config
        .settings
        .instruction_folders
        .clone()
        .unwrap_or_default();
    let identities = config
        .settings
        .instruction_folder_identities
        .clone()
        .unwrap_or_default();
    let reconciliation = reconcile_instruction_folder_settings(&folders, &identities);
    for (old_path, new_path) in &reconciliation.renamed {
        rewrite_instruction_references_in_config(config, old_path, Some(new_path), false);
    }
    let next_folders = if reconciliation.folders.is_empty() && !had_instruction_folders {
        None
    } else {
        Some(reconciliation.folders)
    };
    let next_identities = if reconciliation.identities.is_empty() {
        None
    } else {
        Some(reconciliation.identities)
    };
    let changed = config.settings.instruction_folders != next_folders
        || config.settings.instruction_folder_identities != next_identities;
    config.settings.instruction_folders = next_folders;
    config.settings.instruction_folder_identities = next_identities;
    changed || !reconciliation.renamed.is_empty()
}

pub fn backups_path() -> Result<PathBuf, String> {
    Ok(config_dir_path()?.join(BACKUP_DIR_NAME))
}

pub fn config_path() -> Result<PathBuf, String> {
    Ok(config_dir_path()?.join(CONFIG_FILE_NAME))
}

pub fn config_dir_path() -> Result<PathBuf, String> {
    // 保存先は起動の最初に1回だけ決める（app_paths）。ここで %APPDATA% を直接読まない。
    crate::app_paths::data_dir()
}

pub fn schema_path() -> Result<PathBuf, String> {
    Ok(config_dir_path()?.join(CONFIG_SCHEMA_FILE_NAME))
}

pub fn configured_day_start_hour() -> u8 {
    let Ok(path) = config_path() else {
        return default_day_start_hour();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return default_day_start_hour();
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return default_day_start_hour();
    };

    value
        .get("settings")
        .and_then(|settings| settings.get("dayStartHour"))
        .and_then(Value::as_u64)
        .and_then(|hour| u8::try_from(hour).ok())
        .filter(|hour| *hour <= 23)
        .unwrap_or_else(default_day_start_hour)
}

pub fn ensure_config_schema_file() -> Result<(), String> {
    let path = schema_path()?;
    let schema = config_schema_json();
    if fs::read(&path).ok().as_deref() == Some(schema.as_bytes()) {
        return Ok(());
    }
    write_bytes_atomically(&path, schema.as_bytes(), "schema")
}

/// テスト用の起動かどうかを画面へ伝える。画面は、自動起動の登録を呼ばないことと、
/// 「テスト」の表示に使う。
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestProfileInfo {
    test_profile: bool,
    profile_path: Option<String>,
    webview_data_dir: Option<String>,
}

#[tauri::command]
pub fn test_profile_info() -> TestProfileInfo {
    TestProfileInfo {
        test_profile: crate::app_paths::is_test_profile(),
        profile_path: crate::app_paths::test_profile_path()
            .map(|path| path.to_string_lossy().to_string()),
        webview_data_dir: crate::app_paths::webview_data_dir()
            .map(|path| path.to_string_lossy().to_string()),
    }
}
