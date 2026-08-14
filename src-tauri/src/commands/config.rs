use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use super::instructions::{
    normalize_instruction_folder_settings, reconcile_instruction_folder_settings,
};
use crate::models::{
    default_backup_keep, default_day_start_hour, default_timer_minutes, initial_config,
    short_timer_minutes, today_date, AppConfig, InboxItem, InstructionReferenceUpdateResponse,
    LauncherButton, LoadConfigResponse, NextStepFreshnessResponse, OverlayPage, Project,
    SaveConfigResponse, Settings, TodayVictory, CONFIG_VERSION, EXECUTION_TRIGGER_MAX_CHARS,
    OVERLAY_PAGE_NAME_MAX_CHARS, TODAY_ITEM_LIMIT, WEEKLY_FOCUS_LIMIT,
};
use crate::state::AppState;

const CONFIG_DIR_NAME: &str = "life-launcher";
const CONFIG_FILE_NAME: &str = "config.json";
const CONFIG_SCHEMA_FILE_NAME: &str = "config.schema.json";
const CONFIG_SCHEMA_REF: &str = "./config.schema.json";
const BACKUP_DIR_NAME: &str = "backups";
const BACKUP_KEEP_COUNT: usize = 5;
const PROJECT_NORTH_STAR_MAX_CHARS: usize = 60;
const OVERLAY_ALL_PAGE_NAME: &str = "すべて";
const OVERLAY_UNCLASSIFIED_PAGE_NAME: &str = "未分類";
const LEGACY_UNCLASSIFIED_GROUP_NAME: &str = "その他";
const DAILY_BACKUP_PREFIX: &str = "lifelauncher-backup-";
const DAILY_BACKUP_SUFFIX: &str = ".zip";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const RUNTIME_BACKUP_FILES: [&str; 4] = [
    CONFIG_FILE_NAME,
    "sessions.jsonl",
    "notes.json",
    CONFIG_SCHEMA_FILE_NAME,
];

#[tauri::command]
pub fn load_config(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LoadConfigResponse, String> {
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    load_config_internal(&app)
}

#[tauri::command]
pub fn load_next_step_freshness(app: AppHandle) -> Result<NextStepFreshnessResponse, String> {
    let config = load_config_internal(&app)?.config;
    let now = chrono::Utc::now().fixed_offset();
    Ok(NextStepFreshnessResponse {
        stale_project_ids: config
            .projects
            .iter()
            .filter(|project| project_is_stale_at(project, now))
            .map(|project| project.id.clone())
            .collect(),
    })
}

#[tauri::command]
pub fn save_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<SaveConfigResponse, String> {
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
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
    let _ = app;
    Ok(SaveConfigResponse {
        config,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn backup_config_before_instruction_change(state: State<'_, AppState>) -> Result<(), String> {
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
        let Some(instruction_path) = project.instruction_path.as_ref() else {
            continue;
        };
        if !config_path_is_within(instruction_path, old_path) {
            continue;
        }
        project_names.push(project.name.clone());
        project.instruction_path = new_path
            .map(|replacement| replace_config_path_prefix(instruction_path, old_path, replacement));
        if new_path.is_none() {
            project.instruction_open_on_start = None;
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
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
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
                morning_victory_suggestion: None,
            });
        }
    };

    let mut errors = Vec::new();
    let fallback = initial_config();
    let raw_version = parsed
        .get("version")
        .and_then(Value::as_u64)
        .unwrap_or_default() as u8;
    let missing_inbox = parsed.get("inbox").is_none();
    let missing_overlay_pages = parsed.get("overlayPages").is_none();
    let missing_dictionary_order = parsed.get("dictionaryOrder").is_none();
    let missing_mini_window_position = parsed
        .get("settings")
        .and_then(|settings| settings.get("miniWindowPosition"))
        .is_none();
    let inbox = match parse_optional_field(&parsed, "inbox", &mut errors) {
        Some(inbox) => inbox,
        None => match parse_optional_field(&parsed, "later", &mut errors) {
            Some(later) => {
                errors.push("later: migrated to inbox".to_string());
                later
            }
            None => {
                errors.push("inbox: missing, using default value".to_string());
                fallback.inbox
            }
        },
    };

    let mut config = AppConfig {
        schema: parse_optional_field(&parsed, "$schema", &mut errors).or(fallback.schema),
        version: parse_field(&parsed, "version", fallback.version, &mut errors),
        groups: parse_optional_field(&parsed, "groups", &mut errors).unwrap_or(fallback.groups),
        overlay_pages: parse_optional_field(&parsed, "overlayPages", &mut errors),
        dictionary_order: parse_optional_field(&parsed, "dictionaryOrder", &mut errors),
        buttons: parse_field(&parsed, "buttons", fallback.buttons, &mut errors),
        projects: parse_field(&parsed, "projects", fallback.projects, &mut errors),
        today: parse_field(&parsed, "today", fallback.today, &mut errors),
        inbox,
        settings: parse_field(&parsed, "settings", fallback.settings, &mut errors),
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
        || instruction_roots_changed;

    if changed {
        if instruction_roots_changed
            || dictionary_order_changed
            || should_backup_before_config_rewrite(raw_version, migrated_overlay_pages)
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
        morning_victory_suggestion,
    })
}

fn reconcile_config_instruction_roots(config: &mut AppConfig) -> bool {
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
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "%APPDATA% is not available".to_string())?;
    Ok(app_data.join(CONFIG_DIR_NAME))
}

pub fn schema_path() -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "%APPDATA% is not available".to_string())?;
    Ok(app_data.join(CONFIG_DIR_NAME).join(CONFIG_SCHEMA_FILE_NAME))
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
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, config_schema_json())
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;
    match fs::rename(&temp_path, &path) {
        Ok(_) => Ok(()),
        Err(first_error) => {
            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
                fs::rename(&temp_path, &path).map_err(|error| {
                    format!(
                        "failed to rename {} to {} after replace attempt ({first_error}): {error}",
                        temp_path.display(),
                        path.display()
                    )
                })
            } else {
                Err(format!(
                    "failed to rename {} to {}: {first_error}",
                    temp_path.display(),
                    path.display()
                ))
            }
        }
    }
}

pub fn write_config(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("failed to serialize config: {error}"))?;
    fs::write(&temp_path, json)
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;

    match fs::rename(&temp_path, path) {
        Ok(_) => Ok(()),
        Err(first_error) => {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
                fs::rename(&temp_path, path).map_err(|error| {
                    format!(
                        "failed to rename {} to {} after replace attempt ({first_error}): {error}",
                        temp_path.display(),
                        path.display()
                    )
                })
            } else {
                Err(format!(
                    "failed to rename {} to {}: {first_error}",
                    temp_path.display(),
                    path.display()
                ))
            }
        }
    }
}

fn backup_existing_config(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let backup_dir = backups_path()?;
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("failed to create {}: {error}", backup_dir.display()))?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S-%f");
    let backup_path = backup_dir.join(format!("config-{timestamp}.json"));
    fs::copy(path, &backup_path).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            path.display(),
            backup_path.display()
        )
    })?;

    prune_config_backups(&backup_dir)
}

fn daily_backup(config: &AppConfig) -> Result<Option<PathBuf>, String> {
    let Some(folder) = config.settings.backup_folder.as_ref() else {
        return Ok(None);
    };
    let backup_dir = PathBuf::from(folder);
    if !backup_dir.exists() {
        return Err(format!(
            "backup folder does not exist: {}",
            backup_dir.display()
        ));
    }
    if !backup_dir.is_dir() {
        return Err(format!(
            "backup folder is not a directory: {}",
            backup_dir.display()
        ));
    }

    ensure_config_schema_file()?;

    let date_key = today_date(config.settings.day_start_hour);
    let file_date = date_key.replace('-', "");
    let backup_path = backup_dir.join(format!(
        "{DAILY_BACKUP_PREFIX}{file_date}{DAILY_BACKUP_SUFFIX}"
    ));

    if !backup_path.exists() {
        let entries = daily_backup_entries()?;
        write_zip(&backup_path, &entries)?;
    }
    prune_daily_backups(&backup_dir, usize::from(config.settings.backup_keep))?;

    Ok(Some(backup_path))
}

fn daily_backup_entries() -> Result<Vec<ZipEntry>, String> {
    let data_dir = config_dir_path()?;

    let mut entries = Vec::new();
    for name in RUNTIME_BACKUP_FILES {
        let path = data_dir.join(name);
        let data = if path.exists() {
            fs::read(&path)
                .map_err(|error| format!("failed to read {}: {error}", path.display()))?
        } else {
            Vec::new()
        };
        entries.push(ZipEntry {
            name: name.to_string(),
            data,
        });
    }
    Ok(entries)
}

fn restore_backup_from_path(zip_path: &PathBuf) -> Result<PathBuf, String> {
    if !zip_path.exists() {
        return Err(format!("backup ZIP does not exist: {}", zip_path.display()));
    }
    if !zip_path.is_file() {
        return Err(format!("backup path is not a file: {}", zip_path.display()));
    }

    let zip_bytes = fs::read(zip_path)
        .map_err(|error| format!("failed to read {}: {error}", zip_path.display()))?;
    let entries = read_zip(&zip_bytes)?;
    if !entries.iter().any(|entry| entry.name == CONFIG_FILE_NAME) {
        return Err("backup ZIP does not contain config.json".to_string());
    }

    let config_entry = entries
        .iter()
        .find(|entry| entry.name == CONFIG_FILE_NAME)
        .ok_or_else(|| "backup ZIP does not contain config.json".to_string())?;
    serde_json::from_slice::<Value>(&config_entry.data)
        .map_err(|error| format!("backup config.json is not valid JSON: {error}"))?;

    let data_dir = config_dir_path()?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create {}: {error}", data_dir.display()))?;
    let pre_restore_dir = backups_path()?.join(format!(
        "pre-restore-{}",
        chrono::Local::now().format("%Y%m%d-%H%M%S-%f")
    ));
    fs::create_dir_all(&pre_restore_dir).map_err(|error| {
        format!(
            "failed to create pre-restore backup {}: {error}",
            pre_restore_dir.display()
        )
    })?;

    for name in RUNTIME_BACKUP_FILES {
        let current_path = data_dir.join(name);
        if current_path.exists() {
            fs::copy(&current_path, pre_restore_dir.join(name)).map_err(|error| {
                format!(
                    "failed to retreat {} to {}: {error}",
                    current_path.display(),
                    pre_restore_dir.display()
                )
            })?;
        }
    }

    for name in RUNTIME_BACKUP_FILES {
        let restored = entries
            .iter()
            .find(|entry| entry.name == name)
            .map(|entry| entry.data.as_slice())
            .unwrap_or_default();
        atomic_write_bytes(&data_dir.join(name), restored)?;
    }

    Ok(pre_restore_dir)
}

fn prune_daily_backups(backup_dir: &PathBuf, keep: usize) -> Result<(), String> {
    let keep = keep.max(1);
    let mut backups = fs::read_dir(backup_dir)
        .map_err(|error| format!("failed to read {}: {error}", backup_dir.display()))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_file()))
        .filter(|entry| {
            let file_name = entry.file_name();
            let file_name = file_name.to_string_lossy();
            file_name.starts_with(DAILY_BACKUP_PREFIX) && file_name.ends_with(DAILY_BACKUP_SUFFIX)
        })
        .collect::<Vec<_>>();

    backups.sort_by_key(|entry| entry.file_name());
    let remove_count = backups.len().saturating_sub(keep);
    for entry in backups.into_iter().take(remove_count) {
        let path = entry.path();
        fs::remove_file(&path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))?;
    }

    Ok(())
}

fn prune_config_backups(backup_dir: &PathBuf) -> Result<(), String> {
    let mut backups = fs::read_dir(backup_dir)
        .map_err(|error| format!("failed to read {}: {error}", backup_dir.display()))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_file()))
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("config-"))
        .collect::<Vec<_>>();

    backups.sort_by_key(|entry| entry.file_name());
    let remove_count = backups.len().saturating_sub(BACKUP_KEEP_COUNT);
    for entry in backups.into_iter().take(remove_count) {
        let path = entry.path();
        fs::remove_file(&path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))?;
    }

    Ok(())
}

struct ZipEntry {
    name: String,
    data: Vec<u8>,
}

struct CentralDirectoryEntry {
    name: String,
    crc32: u32,
    size: u32,
    offset: u32,
}

fn write_zip(path: &PathBuf, entries: &[ZipEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("zip.tmp");
    if temp_path.exists() {
        fs::remove_file(&temp_path)
            .map_err(|error| format!("failed to remove {}: {error}", temp_path.display()))?;
    }

    let mut bytes = Vec::new();
    let mut central_entries = Vec::new();
    for entry in entries {
        let name_bytes = entry.name.as_bytes();
        let size = u32::try_from(entry.data.len())
            .map_err(|_| format!("backup entry is too large: {}", entry.name))?;
        let name_length = u16::try_from(name_bytes.len())
            .map_err(|_| format!("backup entry name is too long: {}", entry.name))?;
        let offset =
            u32::try_from(bytes.len()).map_err(|_| "backup zip is too large".to_string())?;
        let crc32 = crc32(&entry.data);

        push_u32(&mut bytes, 0x0403_4b50);
        push_u16(&mut bytes, 20);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 33);
        push_u32(&mut bytes, crc32);
        push_u32(&mut bytes, size);
        push_u32(&mut bytes, size);
        push_u16(&mut bytes, name_length);
        push_u16(&mut bytes, 0);
        bytes.extend_from_slice(name_bytes);
        bytes.extend_from_slice(&entry.data);

        central_entries.push(CentralDirectoryEntry {
            name: entry.name.clone(),
            crc32,
            size,
            offset,
        });
    }

    let central_offset =
        u32::try_from(bytes.len()).map_err(|_| "backup zip is too large".to_string())?;
    for entry in &central_entries {
        let name_bytes = entry.name.as_bytes();
        let name_length = u16::try_from(name_bytes.len())
            .map_err(|_| format!("backup entry name is too long: {}", entry.name))?;

        push_u32(&mut bytes, 0x0201_4b50);
        push_u16(&mut bytes, 20);
        push_u16(&mut bytes, 20);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 33);
        push_u32(&mut bytes, entry.crc32);
        push_u32(&mut bytes, entry.size);
        push_u32(&mut bytes, entry.size);
        push_u16(&mut bytes, name_length);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u16(&mut bytes, 0);
        push_u32(&mut bytes, 0);
        push_u32(&mut bytes, entry.offset);
        bytes.extend_from_slice(name_bytes);
    }
    let central_size = u32::try_from(bytes.len())
        .map_err(|_| "backup zip is too large".to_string())?
        .saturating_sub(central_offset);
    let entry_count = u16::try_from(central_entries.len())
        .map_err(|_| "backup zip has too many entries".to_string())?;

    push_u32(&mut bytes, 0x0605_4b50);
    push_u16(&mut bytes, 0);
    push_u16(&mut bytes, 0);
    push_u16(&mut bytes, entry_count);
    push_u16(&mut bytes, entry_count);
    push_u32(&mut bytes, central_size);
    push_u32(&mut bytes, central_offset);
    push_u16(&mut bytes, 0);

    let mut file = fs::File::create(&temp_path)
        .map_err(|error| format!("failed to create {}: {error}", temp_path.display()))?;
    file.write_all(&bytes)
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;
    file.sync_all()
        .map_err(|error| format!("failed to flush {}: {error}", temp_path.display()))?;

    match fs::rename(&temp_path, path) {
        Ok(_) => Ok(()),
        Err(first_error) => {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
                fs::rename(&temp_path, path).map_err(|error| {
                    format!(
                        "failed to rename {} to {} after replace attempt ({first_error}): {error}",
                        temp_path.display(),
                        path.display()
                    )
                })
            } else {
                Err(format!(
                    "failed to rename {} to {}: {first_error}",
                    temp_path.display(),
                    path.display()
                ))
            }
        }
    }
}

fn read_zip(bytes: &[u8]) -> Result<Vec<ZipEntry>, String> {
    let eocd_offset = bytes
        .windows(4)
        .rposition(|window| window == [0x50, 0x4b, 0x05, 0x06])
        .ok_or_else(|| "backup ZIP is missing end of central directory".to_string())?;
    let entry_count = usize::from(read_u16(bytes, eocd_offset + 10)?);
    let central_size = usize::try_from(read_u32(bytes, eocd_offset + 12)?)
        .map_err(|_| "backup ZIP central directory is too large".to_string())?;
    let central_offset = usize::try_from(read_u32(bytes, eocd_offset + 16)?)
        .map_err(|_| "backup ZIP central directory offset is too large".to_string())?;
    let central_end = central_offset
        .checked_add(central_size)
        .ok_or_else(|| "backup ZIP central directory is invalid".to_string())?;
    if central_end > bytes.len() {
        return Err("backup ZIP central directory is outside file".to_string());
    }

    let mut entries = Vec::new();
    let mut offset = central_offset;
    for _ in 0..entry_count {
        if read_u32(bytes, offset)? != 0x0201_4b50 {
            return Err("backup ZIP central directory is invalid".to_string());
        }

        let compression_method = read_u16(bytes, offset + 10)?;
        if compression_method != 0 {
            return Err("backup ZIP uses unsupported compression".to_string());
        }

        let crc = read_u32(bytes, offset + 16)?;
        let compressed_size = usize::try_from(read_u32(bytes, offset + 20)?)
            .map_err(|_| "backup ZIP entry is too large".to_string())?;
        let uncompressed_size = usize::try_from(read_u32(bytes, offset + 24)?)
            .map_err(|_| "backup ZIP entry is too large".to_string())?;
        if compressed_size != uncompressed_size {
            return Err("backup ZIP entry size is invalid".to_string());
        }

        let name_length = usize::from(read_u16(bytes, offset + 28)?);
        let extra_length = usize::from(read_u16(bytes, offset + 30)?);
        let comment_length = usize::from(read_u16(bytes, offset + 32)?);
        let local_offset = usize::try_from(read_u32(bytes, offset + 42)?)
            .map_err(|_| "backup ZIP local header offset is too large".to_string())?;
        let name_start = offset + 46;
        let name_end = name_start
            .checked_add(name_length)
            .ok_or_else(|| "backup ZIP entry name is invalid".to_string())?;
        if name_end > bytes.len() {
            return Err("backup ZIP entry name is outside file".to_string());
        }
        let name = String::from_utf8(bytes[name_start..name_end].to_vec())
            .map_err(|error| format!("backup ZIP entry name is not UTF-8: {error}"))?;
        if !RUNTIME_BACKUP_FILES.contains(&name.as_str()) {
            return Err(format!("backup ZIP contains unexpected entry: {name}"));
        }

        let data = read_zip_entry_data(bytes, local_offset, compressed_size)?;
        if crc32(&data) != crc {
            return Err(format!("backup ZIP entry checksum mismatch: {name}"));
        }

        entries.push(ZipEntry { name, data });
        offset = name_end
            .checked_add(extra_length)
            .and_then(|value| value.checked_add(comment_length))
            .ok_or_else(|| "backup ZIP central directory entry is invalid".to_string())?;
    }

    Ok(entries)
}

fn read_zip_entry_data(
    bytes: &[u8],
    local_offset: usize,
    compressed_size: usize,
) -> Result<Vec<u8>, String> {
    if read_u32(bytes, local_offset)? != 0x0403_4b50 {
        return Err("backup ZIP local header is invalid".to_string());
    }
    let compression_method = read_u16(bytes, local_offset + 8)?;
    if compression_method != 0 {
        return Err("backup ZIP uses unsupported compression".to_string());
    }

    let name_length = usize::from(read_u16(bytes, local_offset + 26)?);
    let extra_length = usize::from(read_u16(bytes, local_offset + 28)?);
    let data_start = local_offset
        .checked_add(30)
        .and_then(|value| value.checked_add(name_length))
        .and_then(|value| value.checked_add(extra_length))
        .ok_or_else(|| "backup ZIP entry offset is invalid".to_string())?;
    let data_end = data_start
        .checked_add(compressed_size)
        .ok_or_else(|| "backup ZIP entry size is invalid".to_string())?;
    if data_end > bytes.len() {
        return Err("backup ZIP entry data is outside file".to_string());
    }

    Ok(bytes[data_start..data_end].to_vec())
}

fn atomic_write_bytes(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("restore.tmp");
    fs::write(&temp_path, bytes)
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;
    match fs::rename(&temp_path, path) {
        Ok(_) => Ok(()),
        Err(first_error) => {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
                fs::rename(&temp_path, path).map_err(|error| {
                    format!(
                        "failed to rename {} to {} after replace attempt ({first_error}): {error}",
                        temp_path.display(),
                        path.display()
                    )
                })
            } else {
                Err(format!(
                    "failed to rename {} to {}: {first_error}",
                    temp_path.display(),
                    path.display()
                ))
            }
        }
    }
}

fn push_u16(bytes: &mut Vec<u8>, value: u16) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let end = offset
        .checked_add(2)
        .ok_or_else(|| "backup ZIP offset is invalid".to_string())?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| "backup ZIP ended unexpectedly".to_string())?;
    Ok(u16::from_le_bytes([slice[0], slice[1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| "backup ZIP offset is invalid".to_string())?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| "backup ZIP ended unexpectedly".to_string())?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for byte in data {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }
    !crc
}

fn parse_field<T: DeserializeOwned>(
    root: &Value,
    key: &str,
    fallback: T,
    errors: &mut Vec<String>,
) -> T {
    match root.get(key) {
        Some(value) => serde_json::from_value::<T>(value.clone()).unwrap_or_else(|error| {
            errors.push(format!("{key}: {error}"));
            fallback
        }),
        None => {
            errors.push(format!("{key}: missing, using default value"));
            fallback
        }
    }
}

fn parse_optional_field<T: DeserializeOwned>(
    root: &Value,
    key: &str,
    errors: &mut Vec<String>,
) -> Option<T> {
    match root.get(key) {
        Some(value) => serde_json::from_value::<T>(value.clone())
            .map(Some)
            .unwrap_or_else(|error| {
                errors.push(format!("{key}: {error}"));
                None
            }),
        None => None,
    }
}

fn should_backup_before_config_rewrite(raw_version: u8, migrated_overlay_pages: bool) -> bool {
    raw_version < CONFIG_VERSION || migrated_overlay_pages
}

fn is_reserved_overlay_page_name(name: &str) -> bool {
    matches!(name, OVERLAY_ALL_PAGE_NAME | OVERLAY_UNCLASSIFIED_PAGE_NAME)
}

fn migrate_overlay_pages_from_groups(config: &mut AppConfig) -> bool {
    if config.overlay_pages.is_some() {
        return false;
    }

    let mut ordered_names = Vec::new();
    let mut seen_names = HashSet::new();
    for raw_group in config.groups.iter().chain(
        config
            .buttons
            .iter()
            .filter_map(|button| button.group.as_ref()),
    ) {
        let name = raw_group.trim();
        if name.is_empty()
            || name == LEGACY_UNCLASSIFIED_GROUP_NAME
            || is_reserved_overlay_page_name(name)
            || !config.buttons.iter().any(|button| {
                button.show_in_overlay
                    && button
                        .group
                        .as_deref()
                        .is_some_and(|group| group.trim() == name)
            })
        {
            continue;
        }

        let name_key = name.to_lowercase();
        if seen_names.insert(name_key) {
            ordered_names.push(name.to_string());
        }
    }

    let pages: Vec<OverlayPage> = ordered_names
        .iter()
        .enumerate()
        .map(|(index, name)| OverlayPage {
            id: format!("overlay-page-{}", index + 1),
            name: name.clone(),
        })
        .collect();
    let page_ids_by_name: HashMap<String, String> = pages
        .iter()
        .map(|page| (page.name.to_lowercase(), page.id.clone()))
        .collect();

    for button in &mut config.buttons {
        button.overlay_page_id = if button.show_in_overlay {
            button.group.as_deref().and_then(|group| {
                let name = group.trim();
                if name.is_empty()
                    || name == LEGACY_UNCLASSIFIED_GROUP_NAME
                    || is_reserved_overlay_page_name(name)
                {
                    None
                } else {
                    page_ids_by_name.get(&name.to_lowercase()).cloned()
                }
            })
        } else {
            None
        };
    }

    config.overlay_pages = Some(pages);
    true
}

fn sanitize_config(mut config: AppConfig) -> (AppConfig, bool, Vec<String>) {
    let mut changed = false;
    let mut warnings = Vec::new();

    if config.version != CONFIG_VERSION {
        config.version = CONFIG_VERSION;
        changed = true;
        warnings.push(format!("version: migrated to {CONFIG_VERSION}"));
    }

    if config.schema.as_deref() != Some(CONFIG_SCHEMA_REF) {
        config.schema = Some(CONFIG_SCHEMA_REF.to_string());
        changed = true;
    }

    normalize_settings(&mut config.settings, &mut changed);

    let today = today_date(config.settings.day_start_hour);
    if config.today.date != today {
        config.today.date = today;
        config.today.items.clear();
        config.today.victory = TodayVictory::default();
        changed = true;
    }

    normalize_victory(&mut config.today.victory, &mut changed);

    if config.today.items.len() > TODAY_ITEM_LIMIT {
        config.today.items.truncate(TODAY_ITEM_LIMIT);
        changed = true;
        warnings.push("today.items: truncated to 3".to_string());
    }
    normalize_today_item_triggers(&mut config.today.items, &mut changed, &mut warnings);

    trim_empty_buttons(&mut config.buttons, &mut changed, &mut warnings);
    normalize_groups(&mut config.groups, &config.buttons, &mut changed);
    normalize_overlay_pages(
        &mut config.overlay_pages,
        &mut config.buttons,
        &mut changed,
        &mut warnings,
    );
    normalize_dictionary_order(
        &mut config.dictionary_order,
        &config.buttons,
        &mut changed,
        &mut warnings,
    );
    trim_empty_projects(&mut config.projects, &mut changed, &mut warnings);
    normalize_weekly_focus(&mut config.projects, &mut changed, &mut warnings);
    normalize_today_item_projects(&mut config.today.items, &config.projects, &mut changed);
    trim_empty_inbox(&mut config.inbox, &mut changed);
    normalize_inbox_projects(&mut config.inbox, &config.projects, &mut changed);

    (config, changed, warnings)
}

fn morning_victory_suggestion(config: &AppConfig) -> Option<String> {
    let day_start_hour = if config.settings.day_start_hour <= 23 {
        config.settings.day_start_hour
    } else {
        default_day_start_hour()
    };
    let today = today_date(day_start_hour);
    let text = config.today.victory.text.trim();

    if config.today.date != today && !config.today.victory.done && !text.is_empty() {
        Some(text.to_string())
    } else {
        None
    }
}

fn trim_empty_buttons(
    buttons: &mut Vec<LauncherButton>,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let before = buttons.len();
    buttons.retain(|button| !button.id.trim().is_empty() && !button.label.trim().is_empty());
    if buttons.len() != before {
        *changed = true;
        warnings.push("buttons: removed entries with empty id or label".to_string());
    }

    for button in buttons {
        if button
            .group
            .as_deref()
            .is_some_and(|group| group.trim().is_empty())
        {
            button.group = None;
            *changed = true;
        }
        if button
            .icon_source
            .as_deref()
            .is_some_and(|source| source.trim().is_empty())
        {
            button.icon_source = None;
            *changed = true;
        }
        let aliases = normalize_aliases(&button.aliases);
        if button.aliases != aliases {
            button.aliases = aliases;
            *changed = true;
        }
        if button
            .description
            .as_deref()
            .is_some_and(|description| description.trim().is_empty())
        {
            button.description = None;
            *changed = true;
        }
    }
}

fn normalize_aliases(aliases: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for alias in aliases {
        let clean = alias.trim();
        if clean.is_empty() {
            continue;
        }
        if !normalized.iter().any(|existing| existing == clean) {
            normalized.push(clean.to_string());
        }
        if normalized.len() >= 20 {
            break;
        }
    }
    normalized
}

fn normalize_groups(groups: &mut Vec<String>, buttons: &[LauncherButton], changed: &mut bool) {
    let mut normalized: Vec<String> = Vec::new();

    for group in groups
        .iter()
        .chain(buttons.iter().filter_map(|button| button.group.as_ref()))
    {
        let clean = group.trim();
        if clean.is_empty() {
            continue;
        }

        if !normalized.iter().any(|existing| existing == clean) {
            normalized.push(clean.to_string());
        }
    }

    if *groups != normalized {
        *groups = normalized;
        *changed = true;
    }
}

fn normalize_overlay_pages(
    overlay_pages: &mut Option<Vec<OverlayPage>>,
    buttons: &mut [LauncherButton],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let Some(pages) = overlay_pages.as_mut() else {
        return;
    };

    let original_pages = pages.clone();
    let mut normalized_pages = Vec::new();
    let mut seen_ids = HashSet::new();
    let mut seen_names = HashSet::new();

    for page in pages.iter() {
        let id = page.id.trim();
        let raw_name = page.name.trim();
        if id.is_empty() || raw_name.is_empty() || is_reserved_overlay_page_name(raw_name) {
            continue;
        }

        let name: String = raw_name.chars().take(OVERLAY_PAGE_NAME_MAX_CHARS).collect();
        let name_key = name.to_lowercase();
        if !seen_ids.insert(id.to_string()) || !seen_names.insert(name_key) {
            continue;
        }

        if name.chars().count() < raw_name.chars().count() {
            warnings.push(format!(
                "overlayPages.{}: truncated name to {} characters",
                id, OVERLAY_PAGE_NAME_MAX_CHARS
            ));
        }
        normalized_pages.push(OverlayPage {
            id: id.to_string(),
            name,
        });
    }

    if original_pages != normalized_pages {
        *pages = normalized_pages;
        *changed = true;
        if original_pages.len() != pages.len() {
            warnings.push("overlayPages: removed invalid or duplicate entries".to_string());
        }
    }

    let valid_ids: HashSet<&str> = pages.iter().map(|page| page.id.as_str()).collect();
    for button in buttons {
        let normalized_id = button
            .overlay_page_id
            .as_deref()
            .map(str::trim)
            .filter(|id| !id.is_empty() && valid_ids.contains(id))
            .map(str::to_string);
        if button.overlay_page_id != normalized_id {
            button.overlay_page_id = normalized_id;
            *changed = true;
        }
    }
}

fn normalize_dictionary_order(
    dictionary_order: &mut Option<Vec<String>>,
    buttons: &[LauncherButton],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let original = dictionary_order.clone();
    let visible_ids: HashSet<&str> = buttons
        .iter()
        .filter(|button| button.show_in_overlay)
        .map(|button| button.id.as_str())
        .collect();
    let mut seen = HashSet::new();
    let mut normalized = Vec::with_capacity(visible_ids.len());

    for id in dictionary_order.as_deref().unwrap_or_default() {
        if !id.is_empty() && visible_ids.contains(id.as_str()) && seen.insert(id.clone()) {
            normalized.push(id.clone());
        }
    }

    for button in buttons.iter().filter(|button| button.show_in_overlay) {
        if seen.insert(button.id.clone()) {
            normalized.push(button.id.clone());
        }
    }

    let next = Some(normalized);
    if original != next {
        if original.is_some() {
            warnings.push(
                "dictionaryOrder: removed unknown, hidden, or duplicate ids and appended missing buttons"
                    .to_string(),
            );
        }
        *dictionary_order = next;
        *changed = true;
    }
}

fn normalize_victory(victory: &mut TodayVictory, changed: &mut bool) {
    if victory.text.trim().is_empty() && victory.done {
        victory.done = false;
        *changed = true;
    }
}

fn config_schema_json() -> &'static str {
    r##"{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Life Launcher config",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "groups", "buttons", "projects", "today", "inbox", "settings"],
  "properties": {
    "$schema": { "type": "string" },
    "version": { "const": 2 },
    "groups": {
      "type": "array",
      "description": "Sidebar group names. Empty groups can be kept here.",
      "items": { "type": "string", "minLength": 1 }
    },
    "overlayPages": {
      "type": "array",
      "description": "Optional custom pages for the Ctrl+K dictionary. Fixed pages are derived and not stored.",
      "items": { "$ref": "#/$defs/overlayPage" }
    },
    "dictionaryOrder": {
      "type": "array",
      "description": "Optional dictionary-only order of visible button ids. Sidebar order remains the buttons array order.",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "buttons": {
      "type": "array",
      "items": { "$ref": "#/$defs/button" }
    },
    "projects": {
      "type": "array",
      "items": { "$ref": "#/$defs/project" },
      "contains": {
        "type": "object",
        "required": ["weeklyFocus"],
        "properties": { "weeklyFocus": { "const": true } }
      },
      "minContains": 0,
      "maxContains": 3
    },
    "today": { "$ref": "#/$defs/today" },
    "inbox": {
      "type": "array",
      "items": { "$ref": "#/$defs/inboxItem" }
    },
    "settings": { "$ref": "#/$defs/settings" }
  },
  "$defs": {
    "overlayPage": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1, "maxLength": 24 }
      }
    },
    "button": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "label", "actions"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "label": { "type": "string", "minLength": 1 },
        "icon": { "type": ["string", "null"] },
        "iconSource": { "type": ["string", "null"], "description": "Local path used as the source for cached shell icon extraction." },
        "group": { "type": ["string", "null"], "description": "Sidebar group name. Empty or omitted goes to その他." },
        "showInSidebar": { "type": "boolean", "default": true, "description": "Whether the button appears in the left Quick sidebar." },
        "showInOverlay": { "type": "boolean", "default": true, "description": "Whether the button appears in the Ctrl+K dictionary overlay." },
        "overlayPageId": { "type": "string", "minLength": 1, "description": "Optional custom dictionary page id. Missing or unknown ids are shown as unclassified." },
        "aliases": {
          "type": "array",
          "description": "Search keywords for the Ctrl+K dictionary.",
          "items": { "type": "string", "minLength": 1 },
          "default": []
        },
        "description": { "type": ["string", "null"], "description": "Optional memo shown in button editing and searched by the Ctrl+K dictionary." },
        "actions": {
          "type": "array",
          "items": { "$ref": "#/$defs/action" }
        }
      }
    },
    "project": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "nextStep", "buttonIds"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "northStar": { "type": "string", "minLength": 1, "maxLength": 60 },
        "weeklyFocus": { "type": "boolean" },
        "nextStep": { "type": "string" },
        "nextStepTrigger": { "type": "string", "minLength": 1, "maxLength": 40 },
        "nextStepUpdatedAt": { "type": "string", "format": "date-time" },
        "nextStepReviewedAt": { "type": "string", "format": "date-time" },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "startNoteTemplate": { "type": "string" },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" },
        "colorId": {
          "type": "string",
          "enum": ["amber", "blue", "green", "violet", "rose", "cyan", "orange", "slate"]
        }
      }
    },
    "today": {
      "type": "object",
      "additionalProperties": false,
      "required": ["date", "items"],
      "properties": {
        "date": { "type": "string" },
        "victory": { "$ref": "#/$defs/todayVictory" },
        "items": {
          "type": "array",
          "maxItems": 3,
          "items": { "$ref": "#/$defs/todayItem" }
        }
      }
    },
    "todayVictory": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "done"],
      "properties": {
        "text": { "type": "string" },
        "done": { "type": "boolean" }
      }
    },
    "todayItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "done"],
      "properties": {
        "text": { "type": "string" },
        "done": { "type": "boolean" },
        "trigger": { "type": "string", "minLength": 1, "maxLength": 40 },
        "projectId": { "type": "string", "minLength": 1 },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" }
      }
    },
    "inboxItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text"],
      "properties": {
        "text": { "type": "string" },
        "projectId": { "type": "string", "minLength": 1 },
        "buttonIds": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "instructionPath": {
          "type": "string",
          "minLength": 3,
          "pattern": "^[A-Za-z]:[\\\\/]"
        },
        "instructionOpenOnStart": { "type": "boolean" }
      }
    },
    "settings": {
      "type": "object",
      "additionalProperties": false,
      "required": ["alwaysOnTop", "focusHotkey", "launcherHotkey", "miniHotkey", "autoStart", "defaultTimerMinutes", "shortTimerMinutes", "dayStartHour", "backupFolder", "backupKeep", "miniMode", "miniWindowPosition"],
      "properties": {
        "alwaysOnTop": { "type": "boolean" },
        "focusHotkey": { "type": ["string", "null"] },
        "launcherHotkey": { "type": ["string", "null"], "default": "Ctrl+K" },
        "miniHotkey": { "type": ["string", "null"], "default": null },
        "autoStart": { "type": "boolean", "default": false },
        "defaultTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "shortTimerMinutes": { "type": "integer", "minimum": 1, "maximum": 240, "default": 5 },
        "dayStartHour": { "type": "integer", "minimum": 0, "maximum": 23, "default": 4 },
        "backupFolder": { "type": ["string", "null"], "default": null },
        "backupKeep": { "type": "integer", "minimum": 1, "default": 30 },
        "miniMode": { "type": "boolean", "default": true },
        "restartShortFirst": { "type": "boolean", "default": true },
        "instructionFolders": {
          "type": "array",
          "maxItems": 5,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "minLength": 3,
            "pattern": "^[A-Za-z]:[\\\\/]"
          }
        },
        "instructionFolderIdentities": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["path", "identity"],
            "properties": {
              "path": {
                "type": "string",
                "minLength": 3,
                "pattern": "^[A-Za-z]:[\\\\/]"
              },
              "identity": {
                "type": "string",
                "pattern": "^(?:[0-9A-F]{8}:[0-9A-F]{16}|[0-9A-F]{16}:[0-9A-F]{32})$"
              }
            }
          }
        },
        "instructionHotkey": { "type": ["string", "null"], "default": null },
        "miniWindowPosition": {
          "type": ["object", "null"],
          "default": null,
          "additionalProperties": false,
          "required": ["x", "y"],
          "properties": {
            "x": { "type": "integer" },
            "y": { "type": "integer" }
          }
        }
      }
    },
    "action": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_app" },
            "payload": { "$ref": "#/$defs/pathArgsPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_url" },
            "payload": {
              "type": "object",
              "additionalProperties": false,
              "required": ["url"],
              "properties": { "url": { "type": "string" } }
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_folder" },
            "payload": { "$ref": "#/$defs/pathPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "open_file" },
            "payload": { "$ref": "#/$defs/pathPayload" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "payload"],
          "properties": {
            "type": { "const": "run_script" },
            "payload": { "$ref": "#/$defs/pathArgsPayload" }
          }
        }
      ]
    },
    "pathPayload": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": { "path": { "type": "string" } }
    },
    "pathArgsPayload": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": {
        "path": { "type": "string" },
        "args": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}"##
}

fn trim_empty_projects(
    projects: &mut Vec<Project>,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let before = projects.len();
    projects.retain(|project| !project.id.trim().is_empty() && !project.name.trim().is_empty());
    if projects.len() != before {
        *changed = true;
        warnings.push("projects: removed entries with empty id or name".to_string());
    }

    for project in projects {
        if let Some(button_id) = project.button_id.take() {
            let clean = button_id.trim();
            if !clean.is_empty() && !project.button_ids.iter().any(|id| id == clean) {
                project.button_ids.push(clean.to_string());
            }
            *changed = true;
        }

        let before = project.button_ids.len();
        let mut normalized = Vec::new();
        for button_id in &project.button_ids {
            let clean = button_id.trim();
            if clean.is_empty() || normalized.iter().any(|id| id == clean) {
                continue;
            }
            normalized.push(clean.to_string());
        }
        if project.button_ids.len() != before || project.button_ids != normalized {
            project.button_ids = normalized;
            *changed = true;
        }

        if let Some(north_star) = project.north_star.take() {
            let trimmed = north_star.trim();
            if trimmed.is_empty() {
                *changed = true;
            } else {
                let normalized = trimmed
                    .chars()
                    .take(PROJECT_NORTH_STAR_MAX_CHARS)
                    .collect::<String>();
                if normalized != north_star {
                    *changed = true;
                }
                if trimmed.chars().count() > PROJECT_NORTH_STAR_MAX_CHARS {
                    warnings.push("projects: truncated northStar to 60 characters".to_string());
                }
                project.north_star = Some(normalized);
            }
        }

        normalize_execution_trigger(
            &mut project.next_step_trigger,
            "projects.nextStepTrigger",
            changed,
            warnings,
        );

        normalize_project_timestamp(&mut project.next_step_updated_at, changed);
        normalize_project_timestamp(&mut project.next_step_reviewed_at, changed);
        if !project.next_step.trim().is_empty()
            && project.next_step_updated_at.is_none()
            && project.next_step_reviewed_at.is_none()
        {
            let baseline = chrono::Utc::now().to_rfc3339();
            project.next_step_updated_at = Some(baseline.clone());
            project.next_step_reviewed_at = Some(baseline);
            *changed = true;
        }

        for timer_minutes in [
            &mut project.default_timer_minutes,
            &mut project.short_timer_minutes,
        ] {
            if timer_minutes.is_some_and(|minutes| !(1..=240).contains(&minutes)) {
                *timer_minutes = None;
                *changed = true;
                warnings.push("projects: removed an invalid timer override".to_string());
            }
        }

        if let Some(template) = &mut project.start_note_template {
            let trimmed = template.trim();
            if trimmed.is_empty() {
                project.start_note_template = None;
                *changed = true;
            } else if trimmed != template {
                *template = trimmed.to_string();
                *changed = true;
            }
        }

        if project.color_id.as_deref().is_some_and(|color_id| {
            !matches!(
                color_id,
                "amber" | "blue" | "green" | "violet" | "rose" | "cyan" | "orange" | "slate"
            )
        }) {
            project.color_id = None;
            *changed = true;
            warnings.push("projects: removed an invalid colorId".to_string());
        }

        if let Some(path) = project.instruction_path.take() {
            let normalized = normalize_instruction_folder_settings(std::slice::from_ref(&path));
            if normalized.first() != Some(&path) {
                *changed = true;
            }
            project.instruction_path = normalized.into_iter().next();
        }
        if project.instruction_path.is_none() && project.instruction_open_on_start.is_some() {
            project.instruction_open_on_start = None;
            *changed = true;
        }
    }
}

fn normalize_project_timestamp(value: &mut Option<String>, changed: &mut bool) {
    let Some(raw) = value.take() else {
        return;
    };
    let trimmed = raw.trim();
    if chrono::DateTime::parse_from_rfc3339(trimmed).is_ok() {
        if trimmed != raw {
            *changed = true;
        }
        *value = Some(trimmed.to_string());
    } else {
        *changed = true;
    }
}

fn project_is_stale_at(project: &Project, now: chrono::DateTime<chrono::FixedOffset>) -> bool {
    if project.next_step.trim().is_empty() {
        return false;
    }
    let Some(basis) = project
        .next_step_reviewed_at
        .as_ref()
        .or(project.next_step_updated_at.as_ref())
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
    else {
        return false;
    };

    now.signed_duration_since(basis) >= chrono::Duration::days(14)
}

fn normalize_today_item_projects(
    items: &mut [crate::models::TodayItem],
    projects: &[Project],
    changed: &mut bool,
) {
    let project_ids = projects
        .iter()
        .map(|project| project.id.as_str())
        .collect::<HashSet<_>>();
    for item in items {
        let should_remove = item.project_id.as_deref().is_some_and(|project_id| {
            project_id.trim().is_empty() || !project_ids.contains(project_id)
        });
        if should_remove {
            item.project_id = None;
            *changed = true;
        }
    }
}

fn normalize_today_item_triggers(
    items: &mut [crate::models::TodayItem],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    for item in items {
        normalize_execution_trigger(&mut item.trigger, "today.items.trigger", changed, warnings);
    }
}

fn normalize_execution_trigger(
    trigger: &mut Option<String>,
    field: &str,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let Some(value) = trigger.take() else {
        return;
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        *changed = true;
        return;
    }

    let normalized = trimmed
        .chars()
        .take(EXECUTION_TRIGGER_MAX_CHARS)
        .collect::<String>();
    if normalized != value {
        *changed = true;
    }
    if trimmed.chars().count() > EXECUTION_TRIGGER_MAX_CHARS {
        warnings.push(format!("{field}: truncated to 40 characters"));
    }
    *trigger = Some(normalized);
}

fn trim_empty_inbox(inbox: &mut Vec<InboxItem>, changed: &mut bool) {
    let before = inbox.len();
    inbox.retain(|item| !item.text.trim().is_empty());
    if inbox.len() != before {
        *changed = true;
    }
}

fn normalize_inbox_projects(inbox: &mut [InboxItem], projects: &[Project], changed: &mut bool) {
    let project_ids = projects
        .iter()
        .map(|project| project.id.as_str())
        .collect::<HashSet<_>>();
    for item in inbox {
        let should_remove = item.project_id.as_deref().is_some_and(|project_id| {
            project_id.trim().is_empty() || !project_ids.contains(project_id)
        });
        if should_remove {
            item.project_id = None;
            *changed = true;
        }
    }
}

fn normalize_weekly_focus(
    projects: &mut [Project],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let mut focused_count = 0;
    let mut trimmed = false;
    for project in projects {
        if project.weekly_focus == Some(true) {
            if focused_count < WEEKLY_FOCUS_LIMIT {
                focused_count += 1;
            } else {
                project.weekly_focus = None;
                *changed = true;
                trimmed = true;
            }
        }
    }
    if trimmed {
        warnings.push("projects: limited weeklyFocus to 3".to_string());
    }
}

fn normalize_settings(settings: &mut Settings, changed: &mut bool) {
    if let Some(hotkey) = &settings.focus_hotkey {
        if hotkey.trim().is_empty() {
            settings.focus_hotkey = None;
            *changed = true;
        }
    }
    if settings.default_timer_minutes == 0 {
        settings.default_timer_minutes = default_timer_minutes();
        *changed = true;
    }
    if settings.default_timer_minutes > 240 {
        settings.default_timer_minutes = 240;
        *changed = true;
    }
    if settings.short_timer_minutes == 0 {
        settings.short_timer_minutes = short_timer_minutes();
        *changed = true;
    }
    if settings.short_timer_minutes > 240 {
        settings.short_timer_minutes = 240;
        *changed = true;
    }
    if settings.day_start_hour > 23 {
        settings.day_start_hour = default_day_start_hour();
        *changed = true;
    }
    if settings
        .backup_folder
        .as_deref()
        .is_some_and(|folder| folder.trim().is_empty())
    {
        settings.backup_folder = None;
        *changed = true;
    }
    if settings.backup_keep == 0 {
        settings.backup_keep = default_backup_keep();
        *changed = true;
    }
    if let Some(folders) = settings.instruction_folders.take() {
        let normalized = normalize_instruction_folder_settings(&folders);
        if normalized != folders {
            *changed = true;
        }
        settings.instruction_folders = Some(normalized);
    }
    if let Some(hotkey) = settings.instruction_hotkey.take() {
        let trimmed = hotkey.trim();
        if trimmed.is_empty() {
            *changed = true;
        } else {
            if trimmed != hotkey {
                *changed = true;
            }
            settings.instruction_hotkey = Some(trimmed.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::sample_config;
    use std::sync::Mutex;
    use std::time::Duration;

    #[test]
    fn generated_config_schema_is_valid_json_with_project_fields() {
        let schema: serde_json::Value =
            serde_json::from_str(config_schema_json()).expect("config schema must be valid JSON");
        let colors = schema["$defs"]["project"]["properties"]["colorId"]["enum"]
            .as_array()
            .expect("project color enum");
        assert_eq!(colors.len(), 8);
        assert_eq!(
            schema["$defs"]["project"]["properties"]["northStar"]["maxLength"],
            60
        );
        assert_eq!(
            schema["$defs"]["project"]["properties"]["weeklyFocus"]["type"],
            "boolean"
        );
        assert_eq!(
            schema["$defs"]["inboxItem"]["properties"]["projectId"]["minLength"],
            1
        );
        assert_eq!(schema["properties"]["projects"]["maxContains"], 3);
        assert_eq!(
            schema["$defs"]["settings"]["properties"]["restartShortFirst"]["default"],
            true
        );
        assert!(schema["$defs"]["settings"]["required"]
            .as_array()
            .expect("settings required fields")
            .iter()
            .all(|field| field != "restartShortFirst"));
        assert_eq!(
            schema["$defs"]["overlayPage"]["properties"]["name"]["maxLength"],
            OVERLAY_PAGE_NAME_MAX_CHARS
        );
        assert!(schema["required"]
            .as_array()
            .expect("config required fields")
            .iter()
            .all(|field| field != "overlayPages"));
        assert!(schema["required"]
            .as_array()
            .expect("config required fields")
            .iter()
            .all(|field| field != "dictionaryOrder"));
        assert_eq!(schema["properties"]["dictionaryOrder"]["uniqueItems"], true);
        assert_eq!(
            schema["properties"]["dictionaryOrder"]["items"]["minLength"],
            1
        );
        assert_eq!(
            schema["$defs"]["button"]["properties"]["overlayPageId"]["type"],
            "string"
        );
        assert_eq!(
            schema["$defs"]["project"]["properties"]["nextStepTrigger"]["maxLength"],
            40
        );
        assert_eq!(
            schema["$defs"]["todayItem"]["properties"]["trigger"]["maxLength"],
            40
        );
        assert_eq!(
            schema["$defs"]["project"]["properties"]["nextStepUpdatedAt"]["format"],
            "date-time"
        );
        assert_eq!(
            schema["$defs"]["project"]["properties"]["nextStepReviewedAt"]["format"],
            "date-time"
        );
        assert_eq!(
            schema["$defs"]["settings"]["properties"]["instructionFolders"]["maxItems"],
            5
        );
        assert_eq!(
            schema["$defs"]["settings"]["properties"]["instructionFolderIdentities"]["items"]
                ["properties"]["identity"]["pattern"],
            "^(?:[0-9A-F]{8}:[0-9A-F]{16}|[0-9A-F]{16}:[0-9A-F]{32})$"
        );
        assert_eq!(
            schema["$defs"]["settings"]["properties"]["instructionHotkey"]["type"][1],
            "null"
        );
        assert_eq!(
            schema["$defs"]["project"]["properties"]["instructionOpenOnStart"]["type"],
            "boolean"
        );
        assert!(schema["$defs"]["project"]["required"]
            .as_array()
            .expect("project required fields")
            .iter()
            .all(|field| {
                field != "northStar"
                    && field != "weeklyFocus"
                    && field != "nextStepTrigger"
                    && field != "nextStepUpdatedAt"
                    && field != "nextStepReviewedAt"
            }));
    }

    #[test]
    fn project_north_star_is_optional_for_legacy_config() {
        let project: Project = serde_json::from_value(serde_json::json!({
            "id": "legacy",
            "name": "旧プロジェクト",
            "nextStep": "従来の次の一手",
            "buttonIds": []
        }))
        .expect("legacy project without northStar must remain readable");

        assert_eq!(project.north_star, None);
        assert_eq!(project.weekly_focus, None);
        assert_eq!(project.next_step_trigger, None);
        assert_eq!(project.next_step_updated_at, None);
        assert_eq!(project.next_step_reviewed_at, None);

        let today_item: crate::models::TodayItem = serde_json::from_value(serde_json::json!({
            "text": "従来の今日の項目",
            "done": false
        }))
        .expect("legacy today item without trigger must remain readable");
        assert_eq!(today_item.trigger, None);
    }

    #[test]
    fn start_environment_fields_are_optional_and_instruction_references_follow_changes() {
        let legacy_inbox: InboxItem = serde_json::from_value(serde_json::json!({
            "text": "legacy"
        }))
        .expect("legacy inbox must remain readable");
        assert!(legacy_inbox.button_ids.is_empty());
        assert_eq!(legacy_inbox.instruction_path, None);

        let mut config = sample_config();
        config.today.items[0].instruction_path = Some("C:\\Docs\\Old\\Today.md".to_string());
        config.today.items[0].instruction_open_on_start = Some(true);
        config.inbox[0].instruction_path = Some("C:\\Docs\\Old\\Inbox.md".to_string());
        config.inbox[0].instruction_open_on_start = Some(true);

        let (_, _, changed) = rewrite_instruction_references_in_config(
            &mut config,
            "C:\\Docs\\Old",
            Some("C:\\Docs\\New"),
            false,
        );
        assert!(changed);
        assert_eq!(
            config.today.items[0].instruction_path.as_deref(),
            Some("C:\\Docs\\New\\Today.md")
        );
        assert_eq!(
            config.inbox[0].instruction_path.as_deref(),
            Some("C:\\Docs\\New\\Inbox.md")
        );

        let (_, _, changed) =
            rewrite_instruction_references_in_config(&mut config, "C:\\Docs", None, false);
        assert!(changed);
        assert_eq!(config.today.items[0].instruction_path, None);
        assert_eq!(config.today.items[0].instruction_open_on_start, None);
        assert_eq!(config.inbox[0].instruction_path, None);
        assert_eq!(config.inbox[0].instruction_open_on_start, None);
    }

    #[test]
    fn instruction_reference_update_preserves_unrelated_config_and_rewrites_descendants() {
        let mut config = sample_config();
        config.settings.instruction_folders =
            Some(vec!["C:\\Docs".to_string(), "X:\\Other".to_string()]);
        config.projects[0].instruction_path = Some("c:\\docs\\Sub\\Guide.md".to_string());
        config.projects[0].instruction_open_on_start = Some(true);
        let original_buttons = config.buttons.clone();

        let (projects, root_removed, _) = rewrite_instruction_references_in_config(
            &mut config,
            "C:\\Docs\\Sub",
            Some("C:\\Docs\\Renamed"),
            false,
        );
        assert_eq!(projects, vec![config.projects[0].name.clone()]);
        assert!(!root_removed);
        assert_eq!(
            config.projects[0].instruction_path.as_deref(),
            Some("C:\\Docs\\Renamed\\Guide.md")
        );
        assert_eq!(config.buttons.len(), original_buttons.len());

        let (projects, root_removed, _) =
            rewrite_instruction_references_in_config(&mut config, "C:\\Docs", None, true);
        assert_eq!(projects, vec![config.projects[0].name.clone()]);
        assert!(root_removed);
        assert_eq!(config.projects[0].instruction_path, None);
        assert_eq!(config.projects[0].instruction_open_on_start, None);
        assert_eq!(
            config.settings.instruction_folders,
            Some(vec!["X:\\Other".to_string()])
        );
    }

    #[cfg(windows)]
    #[test]
    fn reconciles_renamed_instruction_root_and_project_reference_by_folder_identity() {
        let parent = std::env::temp_dir().join(format!(
            "life-launcher-instruction-root-identity-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let old_root = parent.join("Before");
        let new_root = parent.join("After");
        fs::create_dir_all(&old_root).expect("create old root");
        let old_path = old_root.to_string_lossy().to_string();
        let initial = reconcile_instruction_folder_settings(std::slice::from_ref(&old_path), &[]);
        assert_eq!(initial.identities.len(), 1);
        fs::rename(&old_root, &new_root).expect("rename root");
        for _ in 0..10 {
            if !old_root.exists() && new_root.is_dir() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        if old_root.exists() {
            fs::remove_dir_all(&parent).expect("remove identity test root");
            return;
        }
        if std::env::var_os("GITHUB_ACTIONS").is_some() {
            // GitHub's Windows virtual filesystem does not provide repeatable directory IDs after rename.
            fs::remove_dir_all(&parent).expect("remove identity test root");
            return;
        }

        let new_path = new_root.to_string_lossy().to_string();
        let renamed = reconcile_instruction_folder_settings(std::slice::from_ref(&new_path), &[]);
        if renamed
            .identities
            .first()
            .map(|identity| identity.identity.as_str())
            != initial
                .identities
                .first()
                .map(|identity| identity.identity.as_str())
        {
            // Some Windows filesystems expose path-derived IDs, so a safe rename match is unavailable.
            fs::remove_dir_all(&parent).expect("remove identity test root");
            return;
        }

        let mut config = sample_config();
        config.settings.instruction_folders = Some(vec![old_path.clone()]);
        config.settings.instruction_folder_identities = Some(initial.identities);
        config.projects[0].instruction_path = Some(format!("{old_path}\\Guide.md"));

        assert!(reconcile_config_instruction_roots(&mut config));
        let new_path = new_root.to_string_lossy().to_string();
        assert_eq!(
            config.settings.instruction_folders.as_deref(),
            Some([new_path.clone()].as_slice())
        );
        assert_eq!(
            config.projects[0].instruction_path.as_deref(),
            Some(format!("{new_path}\\Guide.md").as_str())
        );
        assert_eq!(
            config
                .settings
                .instruction_folder_identities
                .as_ref()
                .expect("folder identities")[0]
                .path,
            new_path
        );

        fs::remove_dir_all(&parent).expect("remove identity test root");
    }

    #[test]
    fn legacy_next_step_gets_a_fresh_baseline_without_warning() {
        let mut config = sample_config();
        config.projects[0].next_step_updated_at = None;
        config.projects[0].next_step_reviewed_at = None;

        let (config, changed, warnings) = sanitize_config(config);
        let project = &config.projects[0];

        assert!(changed);
        assert!(warnings.is_empty());
        assert!(project.next_step_updated_at.is_some());
        assert!(project.next_step_reviewed_at.is_some());
        assert!(!project_is_stale_at(
            project,
            chrono::Utc::now().fixed_offset()
        ));
    }

    #[test]
    fn next_step_freshness_changes_at_fourteen_days() {
        let mut project = sample_config().projects.remove(0);
        project.next_step_updated_at = Some("2026-07-02T12:00:00Z".to_string());
        project.next_step_reviewed_at = None;
        let thirteen_days =
            chrono::DateTime::parse_from_rfc3339("2026-07-15T12:00:00Z").expect("datetime");
        let fourteen_days =
            chrono::DateTime::parse_from_rfc3339("2026-07-16T12:00:00Z").expect("datetime");

        assert!(!project_is_stale_at(&project, thirteen_days));
        assert!(project_is_stale_at(&project, fourteen_days));

        project.next_step_reviewed_at = Some("2026-07-10T12:00:00Z".to_string());
        assert!(!project_is_stale_at(&project, fourteen_days));
    }

    #[test]
    fn inbox_project_reference_keeps_valid_id_and_removes_unknown_id_only() {
        let mut config = sample_config();
        let valid_project_id = config.projects[0].id.clone();
        config.inbox = vec![
            InboxItem {
                text: "valid".to_string(),
                project_id: Some(valid_project_id.clone()),
                button_ids: Vec::new(),
                instruction_path: None,
                instruction_open_on_start: None,
            },
            InboxItem {
                text: "unknown".to_string(),
                project_id: Some("missing-project".to_string()),
                button_ids: Vec::new(),
                instruction_path: None,
                instruction_open_on_start: None,
            },
        ];

        let (config, changed, _) = sanitize_config(config);
        assert!(changed);
        assert_eq!(
            config.inbox[0].project_id.as_deref(),
            Some(valid_project_id.as_str())
        );
        assert_eq!(config.inbox[1].text, "unknown");
        assert_eq!(config.inbox[1].project_id, None);
    }

    #[test]
    fn v120_optional_fields_keep_v113_and_partial_configs_compatible() {
        let mut legacy_value = serde_json::to_value(sample_config()).expect("sample config");
        legacy_value
            .as_object_mut()
            .expect("config")
            .remove("overlayPages");
        for project in legacy_value["projects"].as_array_mut().expect("projects") {
            let project = project.as_object_mut().expect("project");
            project.remove("nextStepUpdatedAt");
            project.remove("northStar");
            project.remove("weeklyFocus");
            project.remove("instructionPath");
            project.remove("instructionOpenOnStart");
        }
        let settings = legacy_value["settings"].as_object_mut().expect("settings");
        settings.remove("restartShortFirst");
        settings.remove("instructionFolders");
        settings.remove("instructionFolderIdentities");
        settings.remove("instructionHotkey");

        let legacy: AppConfig = serde_json::from_value(legacy_value).expect("legacy config");
        assert!(legacy
            .projects
            .iter()
            .all(|project| project.next_step_updated_at.is_none()));
        assert_eq!(legacy.settings.restart_short_first, None);
        assert_eq!(legacy.settings.instruction_folders, None);
        assert_eq!(legacy.settings.instruction_folder_identities, None);
        assert_eq!(legacy.settings.instruction_hotkey, None);
        assert_eq!(legacy.overlay_pages, None);

        let mut partial_value = serde_json::to_value(sample_config()).expect("sample config");
        partial_value["projects"][0]["northStar"] = serde_json::json!("方向");
        partial_value["projects"][0]["instructionPath"] =
            serde_json::json!("C:\\Manuals\\start.md");
        partial_value["projects"][0]["instructionOpenOnStart"] = serde_json::json!(true);
        partial_value["settings"]["instructionFolders"] = serde_json::json!(["C:\\Manuals"]);
        partial_value["settings"]["instructionHotkey"] = serde_json::json!("Ctrl+Alt+I");
        partial_value["projects"][0]
            .as_object_mut()
            .expect("project")
            .remove("weeklyFocus");
        partial_value["settings"]
            .as_object_mut()
            .expect("settings")
            .remove("restartShortFirst");
        partial_value["unknownV120Field"] = serde_json::json!("ignored");

        let partial: AppConfig = serde_json::from_value(partial_value).expect("partial config");
        assert_eq!(partial.projects[0].north_star.as_deref(), Some("方向"));
        assert_eq!(partial.projects[0].weekly_focus, None);
        assert_eq!(partial.settings.restart_short_first, None);
        assert_eq!(
            partial.projects[0].instruction_path.as_deref(),
            Some("C:\\Manuals\\start.md")
        );
        assert_eq!(partial.projects[0].instruction_open_on_start, Some(true));
        assert_eq!(
            partial.settings.instruction_folders.as_deref(),
            Some(["C:\\Manuals".to_string()].as_slice())
        );
        assert_eq!(
            partial.settings.instruction_hotkey.as_deref(),
            Some("Ctrl+Alt+I")
        );
    }
    #[test]
    fn migrates_legacy_overlay_pages_from_sidebar_groups_once() {
        let mut config = sample_config();
        let group_names = ["開発", "資料", "Web", "メディア", "ユーティリティ"];
        config.groups = group_names.iter().map(|name| (*name).to_string()).collect();
        config.overlay_pages = None;

        let template = config.buttons[0].clone();
        config.buttons = group_names
            .iter()
            .enumerate()
            .map(|(index, name)| {
                let mut button = template.clone();
                button.id = if index == 0 {
                    "baseline-editor".to_string()
                } else {
                    format!("public-overlay-{index}")
                };
                button.group = Some((*name).to_string());
                button.show_in_overlay = true;
                button.overlay_page_id = None;
                button
            })
            .collect();
        let mut sidebar_only = template;
        sidebar_only.id = "baseline-sidebar-only".to_string();
        sidebar_only.group = Some("資料".to_string());
        sidebar_only.show_in_overlay = false;
        sidebar_only.overlay_page_id = None;
        config.buttons.push(sidebar_only);
        let original_groups = config.groups.clone();

        assert_eq!(config.overlay_pages, None);
        assert!(migrate_overlay_pages_from_groups(&mut config));
        assert_eq!(config.groups, original_groups);
        let pages = config.overlay_pages.as_ref().expect("migrated pages");
        assert_eq!(
            pages
                .iter()
                .map(|page| page.name.as_str())
                .collect::<Vec<_>>(),
            group_names
        );
        assert_eq!(
            config
                .buttons
                .iter()
                .find(|button| button.id == "baseline-editor")
                .and_then(|button| button.overlay_page_id.as_deref()),
            Some("overlay-page-1")
        );
        assert_eq!(
            config
                .buttons
                .iter()
                .find(|button| button.id == "baseline-sidebar-only")
                .and_then(|button| button.overlay_page_id.as_deref()),
            None
        );
        assert!(!migrate_overlay_pages_from_groups(&mut config));
        assert_eq!(config.overlay_pages.as_ref().map(Vec::len), Some(5));
    }
    #[test]
    fn legacy_reserved_and_other_groups_stay_unclassified() {
        let mut config = sample_config();
        config.overlay_pages = None;
        config.groups = vec![
            "すべて".to_string(),
            "未分類".to_string(),
            "その他".to_string(),
            "開発".to_string(),
        ];
        config.buttons[0].group = Some("すべて".to_string());
        config.buttons[1].group = Some("開発".to_string());

        assert!(migrate_overlay_pages_from_groups(&mut config));
        assert_eq!(
            config.overlay_pages,
            Some(vec![OverlayPage {
                id: "overlay-page-1".to_string(),
                name: "開発".to_string(),
            }])
        );
        assert_eq!(config.buttons[0].overlay_page_id, None);
        assert_eq!(
            config.buttons[1].overlay_page_id.as_deref(),
            Some("overlay-page-1")
        );
        assert_eq!(config.buttons[0].group.as_deref(), Some("すべて"));
    }

    #[test]
    fn sanitizes_overlay_pages_and_unknown_button_page_ids() {
        let mut config = sample_config();
        config.overlay_pages = Some(vec![
            OverlayPage {
                id: " page-a ".to_string(),
                name: " 開発 ".to_string(),
            },
            OverlayPage {
                id: "page-b".to_string(),
                name: "開発".to_string(),
            },
            OverlayPage {
                id: "page-reserved".to_string(),
                name: "未分類".to_string(),
            },
            OverlayPage {
                id: "page-long".to_string(),
                name: "長".repeat(OVERLAY_PAGE_NAME_MAX_CHARS + 1),
            },
        ]);
        config.buttons[0].overlay_page_id = Some(" page-a ".to_string());
        config.buttons[1].overlay_page_id = Some("missing-page".to_string());

        let (config, changed, warnings) = sanitize_config(config);
        let pages = config.overlay_pages.expect("sanitized pages");

        assert!(changed);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].id, "page-a");
        assert_eq!(pages[0].name, "開発");
        assert_eq!(pages[1].name.chars().count(), OVERLAY_PAGE_NAME_MAX_CHARS);
        assert_eq!(config.buttons[0].overlay_page_id.as_deref(), Some("page-a"));
        assert_eq!(config.buttons[1].overlay_page_id, None);
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("removed invalid or duplicate")));
    }

    #[test]
    fn migrates_missing_dictionary_order_once_from_visible_button_order() {
        let mut config = sample_config();
        config.dictionary_order = None;
        config.buttons[1].show_in_overlay = false;

        let (config, changed, warnings) = sanitize_config(config);
        assert!(changed);
        assert_eq!(config.dictionary_order, Some(vec!["music-web".to_string()]));
        assert!(warnings
            .iter()
            .all(|warning| !warning.contains("dictionaryOrder")));

        let (config_again, changed_again, warnings_again) = sanitize_config(config.clone());
        assert!(!changed_again);
        assert!(warnings_again.is_empty());
        assert_eq!(config_again.dictionary_order, config.dictionary_order);
    }

    #[test]
    fn normalizes_dictionary_order_independently_and_idempotently() {
        let mut config = sample_config();
        let original_button_ids = config
            .buttons
            .iter()
            .map(|button| button.id.clone())
            .collect::<Vec<_>>();
        config.buttons.push(LauncherButton {
            id: "hidden".to_string(),
            label: "Hidden".to_string(),
            icon: None,
            icon_source: None,
            group: Some("サンプル学習".to_string()),
            show_in_sidebar: true,
            show_in_overlay: false,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: Vec::new(),
        });
        config.buttons.push(LauncherButton {
            id: "new-visible".to_string(),
            label: "New".to_string(),
            icon: None,
            icon_source: None,
            group: Some("資料".to_string()),
            show_in_sidebar: false,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: Vec::new(),
        });
        config.dictionary_order = Some(vec![
            "documents".to_string(),
            "unknown".to_string(),
            "hidden".to_string(),
            "documents".to_string(),
        ]);

        let (config, changed, warnings) = sanitize_config(config);
        assert!(changed);
        assert_eq!(
            config.dictionary_order,
            Some(vec![
                "documents".to_string(),
                "music-web".to_string(),
                "new-visible".to_string(),
            ])
        );
        assert_eq!(
            config
                .buttons
                .iter()
                .take(original_button_ids.len())
                .map(|button| button.id.clone())
                .collect::<Vec<_>>(),
            original_button_ids
        );
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("dictionaryOrder")));

        let (config_again, changed_again, warnings_again) = sanitize_config(config.clone());
        assert!(!changed_again);
        assert!(warnings_again.is_empty());
        assert_eq!(config_again.dictionary_order, config.dictionary_order);
        assert_eq!(
            config_again
                .buttons
                .iter()
                .map(|button| button.id.as_str())
                .collect::<Vec<_>>(),
            config
                .buttons
                .iter()
                .map(|button| button.id.as_str())
                .collect::<Vec<_>>()
        );
    }
    #[test]
    fn same_version_overlay_migration_requires_backup() {
        assert!(should_backup_before_config_rewrite(CONFIG_VERSION, true));
        assert!(!should_backup_before_config_rewrite(CONFIG_VERSION, false));
    }

    #[test]
    fn execution_triggers_are_trimmed_limited_and_empty_removed() {
        let mut config = sample_config();
        config.projects[0].next_step_trigger = Some(format!("  {}  ", "後".repeat(41)));
        config.today.items[0].trigger = Some("  夕食後  ".to_string());
        config.today.items[1].trigger = Some("   ".to_string());

        let (config, changed, warnings) = sanitize_config(config);

        assert!(changed);
        let project_trigger = config.projects[0]
            .next_step_trigger
            .as_deref()
            .expect("project trigger remains set");
        assert_eq!(project_trigger.chars().count(), EXECUTION_TRIGGER_MAX_CHARS);
        assert_eq!(config.today.items[0].trigger.as_deref(), Some("夕食後"));
        assert_eq!(config.today.items[1].trigger, None);
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("nextStepTrigger: truncated")));
    }

    #[test]
    fn weekly_focus_keeps_existing_three_and_rejects_later_entries() {
        let mut config = sample_config();
        while config.projects.len() < 4 {
            let mut project = config.projects[0].clone();
            project.id = format!("project-{}", config.projects.len());
            config.projects.push(project);
        }
        for project in &mut config.projects {
            project.weekly_focus = Some(true);
        }

        let (config, changed, warnings) = sanitize_config(config);

        assert!(changed);
        assert!(config.projects[..WEEKLY_FOCUS_LIMIT]
            .iter()
            .all(|project| project.weekly_focus == Some(true)));
        assert!(config.projects[WEEKLY_FOCUS_LIMIT..]
            .iter()
            .all(|project| project.weekly_focus.is_none()));
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("limited weeklyFocus to 3")));
    }

    #[test]
    fn project_north_star_is_trimmed_limited_and_empty_removed() {
        let mut config = sample_config();
        config.projects[0].north_star = Some(format!("  {}  ", "星".repeat(61)));
        config.projects[1].north_star = Some("   ".to_string());

        let (config, changed, warnings) = sanitize_config(config);

        assert!(changed);
        let north_star = config.projects[0]
            .north_star
            .as_deref()
            .expect("northStar remains set");
        assert_eq!(north_star.chars().count(), PROJECT_NORTH_STAR_MAX_CHARS);
        assert!(north_star.chars().all(|character| character == '星'));
        assert_eq!(config.projects[1].north_star, None);
        assert!(warnings
            .iter()
            .any(|warning| warning.contains("truncated northStar")));
    }

    fn config_backup_files() -> Vec<PathBuf> {
        let Ok(path) = backups_path() else {
            return Vec::new();
        };
        let Ok(entries) = fs::read_dir(path) else {
            return Vec::new();
        };
        let mut files = entries
            .filter_map(Result::ok)
            .filter(|entry| {
                entry.file_type().is_ok_and(|file_type| file_type.is_file())
                    && entry.file_name().to_string_lossy().starts_with("config-")
                    && entry.file_name().to_string_lossy().ends_with(".json")
            })
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        files.sort();
        files
    }

    fn restore_test_appdata(previous: Option<std::ffi::OsString>, root: &PathBuf) {
        if let Some(value) = previous {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        let _ = fs::remove_dir_all(root);
    }

    fn assert_restored_dictionary_order_case(
        prefix: &str,
        backup_config: AppConfig,
        expected_order: &[&str],
    ) {
        let root = std::env::temp_dir().join(format!(
            "{prefix}-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);
        fs::create_dir_all(&root).expect("create root");

        let path = config_path().expect("config path");
        let current = sample_config();
        write_config(&path, &current).expect("write current config");
        let current_bytes = fs::read(&path).expect("read current config");

        let backup_bytes = serde_json::to_vec_pretty(&backup_config).expect("serialize backup");
        let backup_path = root.join("dictionary-order-restore.zip");
        write_zip(
            &backup_path,
            &[ZipEntry {
                name: CONFIG_FILE_NAME.to_string(),
                data: backup_bytes.clone(),
            }],
        )
        .expect("write restore zip");

        let pre_restore = restore_backup_from_path(&backup_path).expect("restore backup");
        assert_eq!(
            fs::read(pre_restore.join(CONFIG_FILE_NAME)).expect("read retreated config"),
            current_bytes
        );

        let first = load_config_from_disk().expect("normalize restored config");
        assert!(first.changed);
        assert_eq!(
            first.config.dictionary_order.as_deref().unwrap_or_default(),
            expected_order
        );
        let rewritten = fs::read(&path).expect("read normalized config");
        let migration_backups = config_backup_files();
        assert_eq!(migration_backups.len(), 1);
        assert_eq!(
            fs::read(&migration_backups[0]).expect("read migration backup"),
            backup_bytes
        );

        let second = load_config_from_disk().expect("load normalized config again");
        assert!(!second.changed);
        assert_eq!(fs::read(&path).expect("read config again"), rewritten);
        assert_eq!(config_backup_files(), migration_backups);

        restore_test_appdata(previous_appdata, &root);
    }

    #[test]
    fn dictionary_order_uses_exact_button_ids_without_trimming() {
        let mut config = sample_config();
        for id in ["a", " a "] {
            config.buttons.push(LauncherButton {
                id: id.to_string(),
                label: format!("button-{id}"),
                icon: None,
                icon_source: None,
                group: None,
                show_in_sidebar: false,
                show_in_overlay: true,
                overlay_page_id: None,
                aliases: Vec::new(),
                description: None,
                actions: Vec::new(),
            });
        }
        config.dictionary_order = Some(vec![" a ".to_string(), "a".to_string(), "".to_string()]);

        let (config, changed, _) = sanitize_config(config);
        assert!(changed);
        assert_eq!(
            config.dictionary_order,
            Some(vec![
                " a ".to_string(),
                "a".to_string(),
                "music-web".to_string(),
                "documents".to_string(),
            ])
        );
    }

    #[test]
    fn load_migrates_missing_dictionary_order_with_one_backup_and_one_write() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-dictionary-load-migration-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);

        let path = config_path().expect("config path");
        let mut legacy = sample_config();
        legacy.dictionary_order = None;
        write_config(&path, &legacy).expect("write legacy config");
        let legacy_bytes = fs::read(&path).expect("read legacy config");
        let legacy_json: Value =
            serde_json::from_slice(&legacy_bytes).expect("parse legacy config");
        assert!(legacy_json.get("dictionaryOrder").is_none());

        let first = load_config_from_disk().expect("migrate config");
        assert!(first.changed);
        assert_eq!(
            first.config.dictionary_order,
            Some(vec!["music-web".to_string(), "documents".to_string()])
        );
        let rewritten = fs::read(&path).expect("read rewritten config");
        let backups = config_backup_files();
        assert_eq!(backups.len(), 1);
        assert_eq!(
            fs::read(&backups[0]).expect("read migration backup"),
            legacy_bytes
        );

        let second = load_config_from_disk().expect("load migrated config again");
        assert!(!second.changed);
        assert_eq!(fs::read(&path).expect("read config again"), rewritten);
        assert_eq!(config_backup_files(), backups);

        restore_test_appdata(previous_appdata, &root);
    }

    #[test]
    fn restore_legacy_zip_migrates_dictionary_order_once() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let mut backup_config = sample_config();
        backup_config.dictionary_order = None;
        assert_restored_dictionary_order_case(
            "life-launcher-dictionary-restore-legacy",
            backup_config,
            &["music-web", "documents"],
        );
    }

    #[test]
    fn restore_normalizes_unknown_duplicate_and_hidden_dictionary_ids_once() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let mut backup_config = sample_config();
        backup_config.buttons[0].show_in_overlay = false;
        backup_config.dictionary_order = Some(vec![
            "documents".to_string(),
            "unknown".to_string(),
            "music-web".to_string(),
            "documents".to_string(),
        ]);
        assert_restored_dictionary_order_case(
            "life-launcher-dictionary-restore-normalize",
            backup_config,
            &["documents"],
        );
    }

    #[test]
    fn hidden_button_is_removed_and_reappears_at_dictionary_order_end_after_saves() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-dictionary-hide-show-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);
        let path = config_path().expect("config path");

        let mut config = sample_config();
        config.buttons[0].show_in_overlay = false;
        write_config(&path, &config).expect("write hidden config");
        let hidden = load_config_from_disk().expect("normalize hidden config");
        assert_eq!(
            hidden.config.dictionary_order,
            Some(vec!["documents".to_string()])
        );

        let mut reshown = hidden.config;
        reshown.buttons[0].show_in_overlay = true;
        write_config(&path, &reshown).expect("write reshown config");
        let visible = load_config_from_disk().expect("append reshown button");
        assert_eq!(
            visible.config.dictionary_order,
            Some(vec!["documents".to_string(), "music-web".to_string()])
        );
        let stable_bytes = fs::read(&path).expect("read stable config");
        let stable_backups = config_backup_files();
        let again = load_config_from_disk().expect("load stable config");
        assert!(!again.changed);
        assert_eq!(
            fs::read(&path).expect("read stable config again"),
            stable_bytes
        );
        assert_eq!(config_backup_files(), stable_backups);

        restore_test_appdata(previous_appdata, &root);
    }
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn keeps_only_latest_five_config_backups() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-backup-test-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);

        let path = config_path().expect("config path");
        let mut config = sample_config();
        write_config(&path, &config).expect("write initial config");

        for index in 0..6u16 {
            backup_existing_config(&path).expect("backup config");
            config.settings.default_timer_minutes = default_timer_minutes() + index;
            write_config(&path, &config).expect("write changed config");
            std::thread::sleep(Duration::from_millis(2));
        }

        let backup_dir = backups_path().expect("backup path");
        let backup_count = fs::read_dir(&backup_dir)
            .expect("read backups")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_file()))
            .count();
        assert_eq!(backup_count, BACKUP_KEEP_COUNT);

        if let Some(value) = previous_appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn creates_daily_backup_zip_and_prunes_old_generations() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-daily-backup-test-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let backup_dir = root.join("sync");
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);
        fs::create_dir_all(&backup_dir).expect("create backup dir");

        let config_path = config_path().expect("config path");
        let data_dir = config_dir_path().expect("config dir");
        fs::create_dir_all(&data_dir).expect("create data dir");

        let mut config = sample_config();
        config.settings.backup_folder = Some(backup_dir.to_string_lossy().to_string());
        config.settings.backup_keep = 30;
        write_config(&config_path, &config).expect("write config");
        fs::write(data_dir.join("sessions.jsonl"), b"{}\n").expect("write sessions");
        fs::write(data_dir.join("notes.json"), b"{}").expect("write notes");
        ensure_config_schema_file().expect("write schema");

        for day in 1..=31 {
            fs::write(
                backup_dir.join(format!(
                    "{DAILY_BACKUP_PREFIX}202601{day:02}{DAILY_BACKUP_SUFFIX}"
                )),
                b"old",
            )
            .expect("write old backup");
        }

        let backup_path = daily_backup(&config)
            .expect("daily backup")
            .expect("backup path");
        let backup_bytes = fs::read(&backup_path).expect("read backup");
        let backup_text = String::from_utf8_lossy(&backup_bytes);
        assert!(backup_text.contains(CONFIG_FILE_NAME));
        assert!(backup_text.contains("sessions.jsonl"));
        assert!(backup_text.contains("notes.json"));
        assert!(backup_text.contains(CONFIG_SCHEMA_FILE_NAME));

        let backup_count = fs::read_dir(&backup_dir)
            .expect("read backup dir")
            .filter_map(Result::ok)
            .filter(|entry| {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                name.starts_with(DAILY_BACKUP_PREFIX) && name.ends_with(DAILY_BACKUP_SUFFIX)
            })
            .count();
        assert_eq!(backup_count, 30);
        assert!(!backup_dir
            .join(format!(
                "{DAILY_BACKUP_PREFIX}20260101{DAILY_BACKUP_SUFFIX}"
            ))
            .exists());

        if let Some(value) = previous_appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restores_backup_zip_into_clean_appdata() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-restore-clean-test-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);
        fs::create_dir_all(&root).expect("create root");

        let backup_path = root.join("lifelauncher-backup-20260708.zip");
        let mut backup_config = sample_config();
        backup_config.groups = vec!["restore-group".to_string()];
        let config_bytes = serde_json::to_vec_pretty(&backup_config).expect("serialize config");
        write_zip(
            &backup_path,
            &[
                ZipEntry {
                    name: CONFIG_FILE_NAME.to_string(),
                    data: config_bytes,
                },
                ZipEntry {
                    name: "sessions.jsonl".to_string(),
                    data: br#"{"date":"2026-07-08","label":"restore","startedAt":"10:00","minutes":12}"#
                        .to_vec(),
                },
                ZipEntry {
                    name: "notes.json".to_string(),
                    data: br#"{"2026-07-08":{"items":["restore note"]}}"#.to_vec(),
                },
                ZipEntry {
                    name: CONFIG_SCHEMA_FILE_NAME.to_string(),
                    data: b"{}".to_vec(),
                },
            ],
        )
        .expect("write backup zip");

        let data_dir = config_dir_path().expect("config dir");
        let _ = fs::remove_dir_all(&data_dir);
        restore_backup_from_path(&backup_path).expect("restore backup");

        let restored_config =
            fs::read_to_string(data_dir.join(CONFIG_FILE_NAME)).expect("read restored config");
        assert!(restored_config.contains("restore-group"));
        let restored: AppConfig =
            serde_json::from_str(&restored_config).expect("parse restored config");
        assert_eq!(restored.overlay_pages, backup_config.overlay_pages);
        assert_eq!(restored.dictionary_order, backup_config.dictionary_order);
        assert_eq!(
            restored.buttons[0].overlay_page_id,
            backup_config.buttons[0].overlay_page_id
        );
        assert!(data_dir.join("sessions.jsonl").exists());
        assert!(data_dir.join("notes.json").exists());
        assert!(data_dir.join(CONFIG_SCHEMA_FILE_NAME).exists());

        if let Some(value) = previous_appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restore_retreats_existing_runtime_files_before_overwrite() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let root = std::env::temp_dir().join(format!(
            "life-launcher-restore-retreat-test-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let previous_appdata = std::env::var_os("APPDATA");
        std::env::set_var("APPDATA", &root);
        let data_dir = config_dir_path().expect("config dir");
        fs::create_dir_all(&data_dir).expect("create data dir");
        fs::write(data_dir.join(CONFIG_FILE_NAME), b"{\"version\":2}").expect("write current");

        let backup_path = root.join("lifelauncher-backup-20260708.zip");
        let config_bytes = serde_json::to_vec_pretty(&sample_config()).expect("serialize config");
        write_zip(
            &backup_path,
            &[ZipEntry {
                name: CONFIG_FILE_NAME.to_string(),
                data: config_bytes,
            }],
        )
        .expect("write backup zip");

        let pre_restore_dir = restore_backup_from_path(&backup_path).expect("restore backup");
        assert!(pre_restore_dir.join(CONFIG_FILE_NAME).exists());

        if let Some(value) = previous_appdata {
            std::env::set_var("APPDATA", value);
        } else {
            std::env::remove_var("APPDATA");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn morning_victory_suggestion_uses_previous_undone_victory() {
        let mut config = sample_config();
        config.today.date = "2000-01-01".to_string();
        config.today.victory.text = "first mixdown".to_string();
        config.today.victory.done = false;

        assert_eq!(
            morning_victory_suggestion(&config),
            Some("first mixdown".to_string())
        );

        config.today.victory.done = true;
        assert_eq!(morning_victory_suggestion(&config), None);
    }
}
