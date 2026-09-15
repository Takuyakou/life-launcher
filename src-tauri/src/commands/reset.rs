use std::collections::BTreeMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

use super::config::{
    atomic_write_bytes, config_dir_path, config_schema_json, create_forced_user_backup,
};
use crate::models::{initial_config, AppConfig, CONFIG_VERSION};
use crate::state::AppState;

const RESET_MARKER_FILE: &str = "reset-transaction.json";
const RESET_RECOVERY_FILE: &str = "reset-recovery.json";
const RUNTIME_FILES: [&str; 4] = [
    "config.json",
    "sessions.jsonl",
    "notes.json",
    "config.schema.json",
];
const LOCAL_STORAGE_KEYS: [&str; 10] = [
    "life-launcher.sidebar-groups",
    "life-launcher.weekly-review-seen",
    "life-launcher-mini-position",
    "life-launcher-today-builder-order",
    "life-launcher-instruction-always-on-top",
    "life-launcher-instruction-last-opened-path",
    "life-launcher-instruction-expanded-folders",
    "life-launcher-instruction-tree-order-v1",
    "life-launcher.dictionary-focus-lock",
    "life-launcher-today-builder-dismissed",
];
const TIMER_GUARD_MESSAGE: &str = "実行中のタイマーを終了してからリセットしてください。";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareResetInput {
    #[serde(default)]
    pub create_user_backup: bool,
    #[serde(default)]
    pub timer_state: Option<SoftwareResetTimerState>,
    #[serde(default)]
    pub local_storage_snapshot: BTreeMap<String, Option<String>>,
    #[serde(default)]
    pub local_storage_cleared: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SoftwareResetTimerState {
    Running,
    Paused,
    CompletionPrompt,
    EarlyStopConfirmation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalStorageRollbackPayload {
    values: BTreeMap<String, Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum ResetPhase {
    Prepared,
    Committing,
    CommittedAwaitingRestartValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FileSnapshot {
    name: String,
    existed: bool,
    byte_len: u64,
    checksum: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct TreeSnapshot {
    existed: bool,
    directories: Vec<String>,
    files: Vec<FileSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ByteSnapshot {
    existed: bool,
    byte_len: u64,
    checksum: u32,
}

impl ByteSnapshot {
    fn from_bytes(bytes: Option<&[u8]>) -> Self {
        match bytes {
            Some(bytes) => Self {
                existed: true,
                byte_len: bytes.len() as u64,
                checksum: crc32(bytes),
            },
            None => Self {
                existed: false,
                byte_len: 0,
                checksum: crc32(&[]),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResetMarker {
    version: u8,
    transaction_id: String,
    phase: ResetPhase,
    snapshot_dir: String,
    files: Vec<FileSnapshot>,
    icons: TreeSnapshot,
    window_state: ByteSnapshot,
    autostart_enabled: bool,
    local_storage_snapshot: BTreeMap<String, Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareResetRecovery {
    pub message: String,
    pub local_storage_snapshot: BTreeMap<String, Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareResetBackupResponse {
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareResetResponse {
    pub restart_requested: bool,
}

struct ResetPaths {
    data_dir: PathBuf,
    backups_dir: PathBuf,
    marker: PathBuf,
    recovery: PathBuf,
    window_state: PathBuf,
}

trait ResetPlatform {
    fn autostart_enabled(&self) -> Result<bool, String>;
    fn set_autostart(&self, enabled: bool) -> Result<(), String>;
    fn close_auxiliary_windows(&self) -> Result<(), String>;
    fn remove_window_state_plugin(&self) -> bool;
}

struct TauriResetPlatform<'a> {
    app: &'a AppHandle,
}

impl ResetPlatform for TauriResetPlatform<'_> {
    fn autostart_enabled(&self) -> Result<bool, String> {
        #[cfg(desktop)]
        {
            self.app
                .autolaunch()
                .is_enabled()
                .map_err(|error| format!("failed to read autostart state: {error}"))
        }
        #[cfg(not(desktop))]
        {
            Ok(false)
        }
    }

    fn set_autostart(&self, enabled: bool) -> Result<(), String> {
        #[cfg(desktop)]
        {
            let manager = self.app.autolaunch();
            if enabled {
                manager.enable()
            } else {
                manager.disable()
            }
            .map_err(|error| format!("failed to update autostart: {error}"))?;
            if manager
                .is_enabled()
                .map_err(|error| format!("failed to verify autostart: {error}"))?
                != enabled
            {
                return Err("autostart verification failed".to_string());
            }
        }
        #[cfg(not(desktop))]
        let _ = enabled;
        Ok(())
    }

    fn close_auxiliary_windows(&self) -> Result<(), String> {
        for label in [
            "life-launcher-mini",
            "dictionary",
            "life-launcher-instruction",
        ] {
            if let Some(window) = self.app.get_webview_window(label) {
                window
                    .destroy()
                    .map_err(|error| format!("failed to close {label}: {error}"))?;
            }
        }
        Ok(())
    }

    fn remove_window_state_plugin(&self) -> bool {
        self.app.remove_plugin("window-state")
    }
}

trait FailureInjector {
    fn check(&self, point: &str) -> Result<(), String>;
}

struct NoFailures;
impl FailureInjector for NoFailures {
    fn check(&self, _point: &str) -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
pub fn create_software_reset_backup(
    state: State<'_, AppState>,
) -> Result<SoftwareResetBackupResponse, String> {
    let _snapshot_guard = state.begin_app_snapshot()?;
    let _config_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let config_path = config_dir_path()?.join("config.json");
    let config: AppConfig = serde_json::from_slice(
        &fs::read(&config_path)
            .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?,
    )
    .map_err(|error| format!("invalid config for backup: {error}"))?;
    let path = create_forced_user_backup(&config)?;
    Ok(SoftwareResetBackupResponse {
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn software_reset(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SoftwareResetInput,
) -> Result<SoftwareResetResponse, String> {
    if input.timer_state.is_some() {
        return Err(TIMER_GUARD_MESSAGE.to_string());
    }
    validate_local_storage_input(&input)?;
    let guard = state.begin_software_reset()?;
    let platform = TauriResetPlatform { app: &app };
    let result = (|| {
        let _config_guard = state
            .config_write_lock
            .lock()
            .map_err(|_| "failed to lock config writes".to_string())?;
        let paths = ResetPaths::production(&app)?;
        software_reset_at_paths(&paths, &platform, &input, &NoFailures)
    })();
    if let Err(error) = result {
        state.cancel_software_reset();
        drop(guard);
        let _ = app.emit(
            "software-reset-rollback-local-storage",
            LocalStorageRollbackPayload {
                values: input.local_storage_snapshot,
            },
        );
        return Err(error);
    }
    drop(guard);
    app.request_restart();
    Ok(SoftwareResetResponse {
        restart_requested: true,
    })
}

#[tauri::command]
pub fn prepare_software_reset(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.software_reset_in_progress() {
        return Err("software reset is already in progress".to_string());
    }
    TauriResetPlatform { app: &app }.close_auxiliary_windows()
}

#[tauri::command]
pub fn load_software_reset_recovery() -> Result<Option<SoftwareResetRecovery>, String> {
    let path = config_dir_path()?.join(RESET_RECOVERY_FILE);
    load_recovery_at(&path)
}

#[tauri::command]
pub fn acknowledge_software_reset_recovery() -> Result<(), String> {
    acknowledge_recovery_at(&config_dir_path()?.join(RESET_RECOVERY_FILE))
}

fn load_recovery_at(path: &Path) -> Result<Option<SoftwareResetRecovery>, String> {
    if !path.exists() {
        return Ok(None);
    }
    read_last_valid_json_record(path, "software reset recovery").map(Some)
}

fn acknowledge_recovery_at(path: &Path) -> Result<(), String> {
    remove_if_exists(path)
}

pub fn recover_interrupted_software_reset(app: &AppHandle) -> Result<(), String> {
    let paths = ResetPaths::production(app)?;
    if !paths.marker.exists() {
        return Ok(());
    }
    let marker = read_marker(&paths.marker)?;
    let platform = TauriResetPlatform { app };
    if marker.phase == ResetPhase::CommittedAwaitingRestartValidation
        && validate_fresh_state(&paths, &marker, &platform, true).is_ok()
    {
        return remove_if_exists(&paths.marker);
    }
    rollback(&paths, &marker, &platform)?;
    append_json_record(
        &paths.recovery,
        &SoftwareResetRecovery {
            message: "中断されたソフトウェアリセットを復元しました。".to_string(),
            local_storage_snapshot: marker.local_storage_snapshot,
        },
    )?;
    remove_if_exists(&paths.marker)
}

fn software_reset_at_paths(
    paths: &ResetPaths,
    platform: &dyn ResetPlatform,
    input: &SoftwareResetInput,
    failures: &dyn FailureInjector,
) -> Result<(), String> {
    if paths.marker.exists() {
        return Err("unfinished software reset requires recovery".to_string());
    }
    let current_config = read_current_config(paths)?;
    validate_backup_folder_outside_reset_targets(paths, &current_config)?;
    fs::create_dir_all(&paths.backups_dir)
        .map_err(|error| format!("failed to create backup directory: {error}"))?;
    if input.create_user_backup {
        create_forced_user_backup(&current_config)?;
    }

    failures.check("snapshot")?;
    let mut marker = prepare_snapshot(paths, platform, &input.local_storage_snapshot)?;
    let result = (|| {
        failures.check("stage")?;
        stage_fresh_state(&marker)?;
        marker.phase = ResetPhase::Committing;
        write_marker(paths, &marker)?;
        for name in RUNTIME_FILES {
            failures.check(&format!("commit:{name}"))?;
            let bytes = fs::read(snapshot_path(&marker).join("stage").join(name))
                .map_err(|error| format!("failed to read staged {name}: {error}"))?;
            atomic_write_bytes(&paths.data_dir.join(name), &bytes)?;
        }
        failures.check("commit:icons")?;
        replace_icons_with_empty(&paths.data_dir.join("icons"))?;
        failures.check("commit:autostart")?;
        platform.set_autostart(false)?;
        failures.check("validate")?;
        validate_fresh_state(paths, &marker, platform, false)?;
        failures.check("commit:windows")?;
        platform.close_auxiliary_windows()?;
        remove_if_exists(&paths.window_state)?;
        if paths.window_state.exists() {
            return Err("window-state file still exists after removal".to_string());
        }
        marker.phase = ResetPhase::CommittedAwaitingRestartValidation;
        write_marker(paths, &marker)?;
        failures.check("commit:plugin")?;
        if !platform.remove_window_state_plugin() {
            return Err("window-state plugin removal failed".to_string());
        }
        Ok(())
    })();
    if let Err(error) = result {
        if let Err(rollback_error) = rollback(paths, &marker, platform) {
            return Err(format!(
                "reset failed: {error}; rollback failed: {rollback_error}; snapshot retained at {}",
                marker.snapshot_dir
            ));
        }
        remove_if_exists(&paths.marker)?;
        return Err(format!("reset failed and was rolled back: {error}"));
    }
    Ok(())
}

impl ResetPaths {
    fn production(app: &AppHandle) -> Result<Self, String> {
        let data_dir = config_dir_path()?;
        let window_state = app
            .path()
            .app_config_dir()
            .map_err(|error| format!("failed to resolve app config directory: {error}"))?
            .join(tauri_plugin_window_state::DEFAULT_FILENAME);
        Ok(Self {
            backups_dir: data_dir.join("backups"),
            marker: data_dir.join(RESET_MARKER_FILE),
            recovery: data_dir.join(RESET_RECOVERY_FILE),
            data_dir,
            window_state,
        })
    }
}

fn read_current_config(paths: &ResetPaths) -> Result<AppConfig, String> {
    let path = paths.data_dir.join("config.json");
    serde_json::from_slice(
        &fs::read(&path).map_err(|error| format!("failed to read config for reset: {error}"))?,
    )
    .map_err(|error| format!("invalid config for reset: {error}"))
}

fn validate_backup_folder_outside_reset_targets(
    paths: &ResetPaths,
    config: &AppConfig,
) -> Result<(), String> {
    let Some(folder) = config.settings.backup_folder.as_deref() else {
        return Ok(());
    };
    let backup_folder = PathBuf::from(folder);
    let icons = paths.data_dir.join("icons");
    if !backup_folder.exists() || !icons.exists() {
        return Ok(());
    }
    let backup_folder = backup_folder
        .canonicalize()
        .map_err(|error| format!("failed to resolve configured backup folder: {error}"))?;
    let icons = icons
        .canonicalize()
        .map_err(|error| format!("failed to resolve icon cache: {error}"))?;
    if backup_folder.starts_with(&icons) {
        return Err(
            "configured backup folder is inside the icon cache and would be removed by reset"
                .to_string(),
        );
    }
    Ok(())
}

fn validate_local_storage_input(input: &SoftwareResetInput) -> Result<(), String> {
    if !input.local_storage_cleared {
        return Err("localStorage reset acknowledgement is required".to_string());
    }
    if input
        .local_storage_snapshot
        .keys()
        .any(|key| !LOCAL_STORAGE_KEYS.contains(&key.as_str()))
    {
        return Err("localStorage snapshot contains an unapproved key".to_string());
    }
    Ok(())
}

fn prepare_snapshot(
    paths: &ResetPaths,
    platform: &dyn ResetPlatform,
    local_storage: &BTreeMap<String, Option<String>>,
) -> Result<ResetMarker, String> {
    let id = format!(
        "{}-{}",
        chrono::Local::now().format("%Y%m%d-%H%M%S-%f"),
        std::process::id()
    );
    let root = paths.backups_dir.join(format!("pre-reset-{id}"));
    let files_dir = root.join("files");
    fs::create_dir_all(&files_dir)
        .map_err(|error| format!("failed to create snapshot: {error}"))?;
    let mut files = Vec::new();
    for name in RUNTIME_FILES {
        let live = paths.data_dir.join(name);
        let existed = live.is_file();
        let bytes = if existed {
            fs::read(&live).map_err(|error| format!("failed to snapshot {name}: {error}"))?
        } else {
            Vec::new()
        };
        if existed {
            write_synced(&files_dir.join(name), &bytes)?;
        }
        files.push(FileSnapshot {
            name: name.to_string(),
            existed,
            byte_len: bytes.len() as u64,
            checksum: crc32(&bytes),
        });
    }
    let icons_path = paths.data_dir.join("icons");
    let icons = capture_tree_snapshot(&icons_path)?;
    if icons.existed {
        copy_tree(&icons_path, &root.join("icons"))?;
        verify_tree_snapshot(&root.join("icons"), &icons)?;
    }
    let window_state_bytes = if paths.window_state.is_file() {
        Some(
            fs::read(&paths.window_state)
                .map_err(|error| format!("failed to snapshot window-state: {error}"))?,
        )
    } else {
        None
    };
    let window_state = ByteSnapshot::from_bytes(window_state_bytes.as_deref());
    if let Some(bytes) = window_state_bytes.as_deref() {
        write_synced(&root.join("window-state.json"), bytes)?;
    }
    let marker = ResetMarker {
        version: 2,
        transaction_id: id,
        phase: ResetPhase::Prepared,
        snapshot_dir: root.to_string_lossy().to_string(),
        files,
        icons,
        window_state,
        autostart_enabled: platform.autostart_enabled()?,
        local_storage_snapshot: local_storage.clone(),
    };
    write_json_synced(&root.join("manifest.json"), &marker)?;
    verify_snapshot(&marker)?;
    write_marker(paths, &marker)?;
    Ok(marker)
}

fn verify_snapshot(marker: &ResetMarker) -> Result<(), String> {
    let root = snapshot_path(marker);
    let expected_names = RUNTIME_FILES.to_vec();
    let actual_names = marker
        .files
        .iter()
        .map(|file| file.name.as_str())
        .collect::<Vec<_>>();
    if actual_names != expected_names {
        return Err("snapshot runtime file manifest is invalid".to_string());
    }
    for file in &marker.files {
        if file.existed {
            let bytes = fs::read(root.join("files").join(&file.name))
                .map_err(|error| format!("failed to verify {}: {error}", file.name))?;
            if bytes.len() as u64 != file.byte_len || crc32(&bytes) != file.checksum {
                return Err(format!("snapshot verification failed: {}", file.name));
            }
        }
    }
    verify_tree_snapshot(&root.join("icons"), &marker.icons)?;
    verify_byte_snapshot(
        &root.join("window-state.json"),
        &marker.window_state,
        "window-state snapshot",
    )?;
    Ok(())
}

fn stage_fresh_state(marker: &ResetMarker) -> Result<(), String> {
    let stage = snapshot_path(marker).join("stage");
    fs::create_dir_all(&stage).map_err(|error| format!("failed to create stage: {error}"))?;
    let fresh = initial_config();
    write_synced(
        &stage.join("config.json"),
        &serde_json::to_vec_pretty(&fresh)
            .map_err(|error| format!("failed to serialize initial config: {error}"))?,
    )?;
    write_synced(&stage.join("sessions.jsonl"), b"")?;
    write_synced(&stage.join("notes.json"), b"{}")?;
    write_synced(
        &stage.join("config.schema.json"),
        config_schema_json().as_bytes(),
    )?;
    let parsed: AppConfig = serde_json::from_slice(
        &fs::read(stage.join("config.json"))
            .map_err(|error| format!("failed to read staged config: {error}"))?,
    )
    .map_err(|error| format!("staged config is invalid: {error}"))?;
    if parsed.version != CONFIG_VERSION
        || serde_json::to_value(parsed).map_err(|error| error.to_string())?
            != serde_json::to_value(fresh).map_err(|error| error.to_string())?
    {
        return Err("staged config differs from initial_config".to_string());
    }
    validate_support_files(&stage)
}

fn validate_fresh_state(
    paths: &ResetPaths,
    marker: &ResetMarker,
    platform: &dyn ResetPlatform,
    require_window_state_absent: bool,
) -> Result<(), String> {
    let config: AppConfig = serde_json::from_slice(
        &fs::read(paths.data_dir.join("config.json"))
            .map_err(|error| format!("failed to read reset config: {error}"))?,
    )
    .map_err(|error| format!("reset config is invalid: {error}"))?;
    let staged: AppConfig = serde_json::from_slice(
        &fs::read(snapshot_path(marker).join("stage").join("config.json"))
            .map_err(|error| format!("failed to read staged reset config: {error}"))?,
    )
    .map_err(|error| format!("staged reset config is invalid: {error}"))?;
    if serde_json::to_value(config).map_err(|error| error.to_string())?
        != serde_json::to_value(staged).map_err(|error| error.to_string())?
    {
        return Err("reset config differs from its staged config".to_string());
    }
    validate_support_files(&paths.data_dir)?;
    let icons = paths.data_dir.join("icons");
    if !icons.is_dir()
        || fs::read_dir(&icons)
            .map_err(|error| format!("failed to read icons: {error}"))?
            .next()
            .is_some()
    {
        return Err("icon cache is not empty".to_string());
    }
    if platform.autostart_enabled()? {
        return Err("autostart is still enabled".to_string());
    }
    if require_window_state_absent && paths.window_state.exists() {
        return Err("window-state file still exists after reset".to_string());
    }
    Ok(())
}

fn validate_support_files(root: &Path) -> Result<(), String> {
    if !fs::read(root.join("sessions.jsonl"))
        .map_err(|error| format!("failed to read sessions: {error}"))?
        .is_empty()
    {
        return Err("sessions are not empty".to_string());
    }
    let notes: serde_json::Value = serde_json::from_slice(
        &fs::read(root.join("notes.json"))
            .map_err(|error| format!("failed to read notes: {error}"))?,
    )
    .map_err(|error| format!("notes are invalid: {error}"))?;
    if notes.as_object().is_none_or(|value| !value.is_empty()) {
        return Err("notes are not empty".to_string());
    }
    let schema: serde_json::Value = serde_json::from_slice(
        &fs::read(root.join("config.schema.json"))
            .map_err(|error| format!("failed to read schema: {error}"))?,
    )
    .map_err(|error| format!("schema is invalid: {error}"))?;
    if !schema.is_object() {
        return Err("schema root is not an object".to_string());
    }
    Ok(())
}

fn rollback(
    paths: &ResetPaths,
    marker: &ResetMarker,
    platform: &dyn ResetPlatform,
) -> Result<(), String> {
    verify_snapshot(marker)?;
    let root = snapshot_path(marker);
    let mut errors = Vec::new();
    for file in &marker.files {
        let live = paths.data_dir.join(&file.name);
        let result = if file.existed {
            fs::read(root.join("files").join(&file.name))
                .map_err(|error| error.to_string())
                .and_then(|bytes| atomic_write_bytes(&live, &bytes))
        } else {
            remove_if_exists(&live)
        };
        if let Err(error) = result {
            errors.push(format!("{}: {error}", file.name));
        }
    }
    if let Err(error) = restore_icons(paths, marker) {
        errors.push(format!("icons: {error}"));
    }
    if let Err(error) = restore_window_state(paths, marker) {
        errors.push(format!("window-state: {error}"));
    }
    if let Err(error) = platform.set_autostart(marker.autostart_enabled) {
        errors.push(format!("autostart: {error}"));
    }
    if let Err(error) = validate_rollback(paths, marker, platform) {
        errors.push(format!("validation: {error}"));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn validate_rollback(
    paths: &ResetPaths,
    marker: &ResetMarker,
    platform: &dyn ResetPlatform,
) -> Result<(), String> {
    for file in &marker.files {
        let live = paths.data_dir.join(&file.name);
        if live.exists() != file.existed {
            return Err(format!("{} existence changed", file.name));
        }
        if file.existed {
            let bytes =
                fs::read(&live).map_err(|error| format!("failed to read rollback: {error}"))?;
            if bytes.len() as u64 != file.byte_len || crc32(&bytes) != file.checksum {
                return Err(format!("{} bytes changed", file.name));
            }
        }
    }
    verify_tree_snapshot(&paths.data_dir.join("icons"), &marker.icons)
        .map_err(|error| format!("icon rollback validation failed: {error}"))?;
    verify_byte_snapshot(
        &paths.window_state,
        &marker.window_state,
        "window-state rollback",
    )?;
    if platform.autostart_enabled()? != marker.autostart_enabled {
        return Err("autostart state changed".to_string());
    }
    Ok(())
}

fn restore_icons(paths: &ResetPaths, marker: &ResetMarker) -> Result<(), String> {
    let live = paths.data_dir.join("icons");
    remove_tree_if_exists(&live)?;
    if marker.icons.existed {
        copy_tree(&snapshot_path(marker).join("icons"), &live)?;
    }
    Ok(())
}

fn restore_window_state(paths: &ResetPaths, marker: &ResetMarker) -> Result<(), String> {
    if marker.window_state.existed {
        atomic_write_bytes(
            &paths.window_state,
            &fs::read(snapshot_path(marker).join("window-state.json"))
                .map_err(|error| format!("failed to read window snapshot: {error}"))?,
        )
    } else {
        remove_if_exists(&paths.window_state)
    }
}

fn replace_icons_with_empty(path: &Path) -> Result<(), String> {
    remove_tree_if_exists(path)?;
    fs::create_dir_all(path).map_err(|error| format!("failed to create icons: {error}"))
}

fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("failed to inspect {}: {error}", source.display()))?;
    if metadata.file_type().is_symlink() {
        return Err(format!("refusing to follow link: {}", source.display()));
    }
    fs::create_dir_all(destination)
        .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("failed to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        let target = destination.join(entry.file_name());
        if kind.is_symlink() {
            return Err(format!(
                "refusing to follow link: {}",
                entry.path().display()
            ));
        } else if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            write_synced(
                &target,
                &fs::read(entry.path()).map_err(|error| error.to_string())?,
            )?;
        } else {
            return Err(format!(
                "unsupported cache entry: {}",
                entry.path().display()
            ));
        }
    }
    Ok(())
}

fn capture_tree_snapshot(path: &Path) -> Result<TreeSnapshot, String> {
    if !path.exists() {
        return Ok(TreeSnapshot {
            existed: false,
            directories: Vec::new(),
            files: Vec::new(),
        });
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "snapshot tree is not a regular directory: {}",
            path.display()
        ));
    }

    let mut directories = Vec::new();
    let mut files = Vec::new();
    collect_tree_snapshot(path, path, &mut directories, &mut files)?;
    directories.sort();
    files.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(TreeSnapshot {
        existed: true,
        directories,
        files,
    })
}

fn collect_tree_snapshot(
    root: &Path,
    current: &Path,
    directories: &mut Vec<String>,
    files: &mut Vec<FileSnapshot>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(current)
        .map_err(|error| format!("failed to read {}: {error}", current.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        if kind.is_symlink() {
            return Err(format!(
                "refusing to follow link: {}",
                entry.path().display()
            ));
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_path_buf();
        let relative_name = relative.to_string_lossy().to_string();
        if kind.is_dir() {
            directories.push(relative_name);
            collect_tree_snapshot(root, &entry.path(), directories, files)?;
        } else if kind.is_file() {
            let bytes = fs::read(entry.path()).map_err(|error| error.to_string())?;
            files.push(FileSnapshot {
                name: relative_name,
                existed: true,
                byte_len: bytes.len() as u64,
                checksum: crc32(&bytes),
            });
        } else {
            return Err(format!(
                "unsupported cache entry: {}",
                entry.path().display()
            ));
        }
    }
    Ok(())
}

fn verify_tree_snapshot(path: &Path, expected: &TreeSnapshot) -> Result<(), String> {
    let actual = capture_tree_snapshot(path)?;
    if &actual != expected {
        return Err(format!("tree snapshot differs: {}", path.display()));
    }
    Ok(())
}

fn verify_byte_snapshot(path: &Path, expected: &ByteSnapshot, label: &str) -> Result<(), String> {
    if path.is_file() != expected.existed {
        return Err(format!("{label} existence changed"));
    }
    if expected.existed {
        let bytes = fs::read(path).map_err(|error| format!("failed to read {label}: {error}"))?;
        if bytes.len() as u64 != expected.byte_len || crc32(&bytes) != expected.checksum {
            return Err(format!("{label} bytes changed"));
        }
    }
    Ok(())
}

fn write_marker(paths: &ResetPaths, marker: &ResetMarker) -> Result<(), String> {
    append_json_record(&paths.marker, marker)?;
    write_json_synced(&snapshot_path(marker).join("manifest.json"), marker)
}

fn read_marker(path: &Path) -> Result<ResetMarker, String> {
    let marker: ResetMarker = read_last_valid_json_record(path, "reset marker")?;
    if marker.version != 2 {
        return Err(format!(
            "unsupported reset marker version: {}",
            marker.version
        ));
    }
    let snapshot = snapshot_path(&marker);
    let backup_root = path
        .parent()
        .unwrap_or(Path::new(""))
        .join("backups")
        .canonicalize()
        .map_err(|error| format!("failed to resolve backup root: {error}"))?;
    let resolved = snapshot
        .canonicalize()
        .map_err(|error| format!("failed to resolve snapshot: {error}"))?;
    if !resolved.starts_with(backup_root) {
        return Err("reset snapshot is outside the backup root".to_string());
    }
    Ok(marker)
}

fn snapshot_path(marker: &ResetMarker) -> PathBuf {
    PathBuf::from(&marker.snapshot_dir)
}

fn append_json_record<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    let mut bytes = serde_json::to_vec(value)
        .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
    bytes.push(b'\n');
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open {}: {error}", path.display()))?;
    file.write_all(&bytes)
        .map_err(|error| format!("failed to append {}: {error}", path.display()))?;
    file.sync_all()
        .map_err(|error| format!("failed to sync {}: {error}", path.display()))
}

fn read_last_valid_json_record<T>(path: &Path, label: &str) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    let bytes = fs::read(path).map_err(|error| format!("failed to read {label}: {error}"))?;
    bytes
        .rsplit(|byte| *byte == b'\n')
        .find_map(|line| {
            (!line.iter().all(u8::is_ascii_whitespace))
                .then(|| serde_json::from_slice::<T>(line).ok())
                .flatten()
        })
        .ok_or_else(|| format!("{label} has no valid record"))
}

fn write_json_synced<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    write_synced(
        path,
        &serde_json::to_vec_pretty(value)
            .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?,
    )
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut file = fs::File::create(path).map_err(|error| error.to_string())?;
    file.write_all(bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))?;
    }
    Ok(())
}

fn remove_tree_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        let resolved = path
            .canonicalize()
            .map_err(|error| format!("failed to resolve {}: {error}", path.display()))?;
        let parent = path
            .parent()
            .ok_or_else(|| "refusing to remove a root path".to_string())?
            .canonicalize()
            .map_err(|error| format!("failed to resolve parent: {error}"))?;
        if resolved == parent || !resolved.starts_with(&parent) {
            return Err(format!("refusing unsafe removal: {}", path.display()));
        }
        fs::remove_dir_all(resolved).map_err(|error| error.to_string())?;
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    struct TestPlatform(AtomicBool);
    impl ResetPlatform for TestPlatform {
        fn autostart_enabled(&self) -> Result<bool, String> {
            Ok(self.0.load(Ordering::Acquire))
        }
        fn set_autostart(&self, enabled: bool) -> Result<(), String> {
            self.0.store(enabled, Ordering::Release);
            Ok(())
        }
        fn close_auxiliary_windows(&self) -> Result<(), String> {
            Ok(())
        }
        fn remove_window_state_plugin(&self) -> bool {
            true
        }
    }

    struct FailAt(&'static str);
    impl FailureInjector for FailAt {
        fn check(&self, point: &str) -> Result<(), String> {
            if point == self.0 {
                Err(format!("injected failure at {point}"))
            } else {
                Ok(())
            }
        }
    }

    struct Fixture {
        root: PathBuf,
        paths: ResetPaths,
        original: BTreeMap<String, Vec<u8>>,
        external: PathBuf,
        backup: PathBuf,
    }

    impl Fixture {
        fn new(label: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "life-launcher-p83-{label}-{}-{}",
                std::process::id(),
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ));
            let data_dir = root.join("appdata").join("life-launcher");
            let backups_dir = data_dir.join("backups");
            let window_state = root.join("tauri").join(".window-state.json");
            fs::create_dir_all(&backups_dir).unwrap();
            fs::create_dir_all(window_state.parent().unwrap()).unwrap();
            let mut old_config = initial_config();
            old_config.groups.push("old".to_string());
            old_config.settings.auto_start = true;
            let entries = [
                (
                    "config.json",
                    serde_json::to_vec_pretty(&old_config).unwrap(),
                ),
                ("sessions.jsonl", b"{\"minutes\":25}\n".to_vec()),
                ("notes.json", b"{\"old\":{}}".to_vec()),
                ("config.schema.json", b"{\"old\":true}".to_vec()),
            ];
            let mut original = BTreeMap::new();
            for (name, bytes) in entries {
                fs::write(data_dir.join(name), &bytes).unwrap();
                original.insert(name.to_string(), bytes);
            }
            fs::create_dir_all(data_dir.join("icons")).unwrap();
            fs::write(data_dir.join("icons").join("old.png"), b"icon").unwrap();
            fs::create_dir_all(data_dir.join("icons").join("nested").join("empty")).unwrap();
            fs::write(
                data_dir.join("icons").join("nested").join("second.ico"),
                b"second-icon",
            )
            .unwrap();
            fs::write(&window_state, b"window").unwrap();
            let backup = backups_dir.join("existing.zip");
            fs::write(&backup, b"backup").unwrap();
            let external = root.join("instruction.html");
            fs::write(&external, b"external").unwrap();
            Self {
                paths: ResetPaths {
                    marker: data_dir.join(RESET_MARKER_FILE),
                    recovery: data_dir.join(RESET_RECOVERY_FILE),
                    data_dir,
                    backups_dir,
                    window_state,
                },
                root,
                original,
                external,
                backup,
            }
        }

        fn input(&self) -> SoftwareResetInput {
            SoftwareResetInput {
                create_user_backup: false,
                timer_state: None,
                local_storage_snapshot: BTreeMap::from([(
                    LOCAL_STORAGE_KEYS[0].to_string(),
                    Some("old".to_string()),
                )]),
                local_storage_cleared: true,
            }
        }

        fn assert_preserved(&self) {
            assert_eq!(fs::read(&self.external).unwrap(), b"external");
            assert_eq!(fs::read(&self.backup).unwrap(), b"backup");
        }

        fn assert_rolled_back(&self) {
            for (name, bytes) in &self.original {
                assert_eq!(fs::read(self.paths.data_dir.join(name)).unwrap(), *bytes);
            }
            assert_eq!(
                fs::read(self.paths.data_dir.join("icons").join("old.png")).unwrap(),
                b"icon"
            );
            assert_eq!(
                fs::read(
                    self.paths
                        .data_dir
                        .join("icons")
                        .join("nested")
                        .join("second.ico")
                )
                .unwrap(),
                b"second-icon"
            );
            assert!(self
                .paths
                .data_dir
                .join("icons")
                .join("nested")
                .join("empty")
                .is_dir());
            assert_eq!(fs::read(&self.paths.window_state).unwrap(), b"window");
            self.assert_preserved();
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn reset_creates_canonical_fresh_state_and_preserves_external_data() {
        let fixture = Fixture::new("success");
        let platform = TestPlatform(AtomicBool::new(true));
        software_reset_at_paths(&fixture.paths, &platform, &fixture.input(), &NoFailures).unwrap();
        let marker = read_marker(&fixture.paths.marker).unwrap();
        validate_fresh_state(&fixture.paths, &marker, &platform, true).unwrap();
        assert!(!fixture.paths.window_state.exists());
        assert!(fixture.paths.marker.exists());
        fixture.assert_preserved();
    }

    #[test]
    fn failure_at_every_mutating_boundary_restores_exact_bytes() {
        for point in [
            "stage",
            "commit:config.json",
            "commit:sessions.jsonl",
            "commit:notes.json",
            "commit:config.schema.json",
            "commit:icons",
            "commit:autostart",
            "validate",
            "commit:windows",
            "commit:plugin",
        ] {
            let fixture = Fixture::new(&point.replace(':', "-"));
            let platform = TestPlatform(AtomicBool::new(true));
            let error = software_reset_at_paths(
                &fixture.paths,
                &platform,
                &fixture.input(),
                &FailAt(point),
            )
            .unwrap_err();
            assert!(error.contains("rolled back"), "{point}: {error}");
            fixture.assert_rolled_back();
            assert!(platform.0.load(Ordering::Acquire));
            assert!(!fixture.paths.marker.exists());
        }
    }

    #[test]
    fn preflight_rejects_uncleared_or_unapproved_local_storage() {
        let fixture = Fixture::new("preflight");
        let mut input = fixture.input();
        input.local_storage_cleared = false;
        assert!(validate_local_storage_input(&input).is_err());
        input.local_storage_cleared = true;
        input
            .local_storage_snapshot
            .insert("unrelated".into(), None);
        assert!(validate_local_storage_input(&input).is_err());
    }

    #[test]
    fn journal_uses_last_valid_full_record_when_tail_is_truncated() {
        let fixture = Fixture::new("journal-tail");
        let platform = TestPlatform(AtomicBool::new(true));
        let mut marker = prepare_snapshot(
            &fixture.paths,
            &platform,
            &fixture.input().local_storage_snapshot,
        )
        .unwrap();
        marker.phase = ResetPhase::Committing;
        write_marker(&fixture.paths, &marker).unwrap();

        let mut journal = OpenOptions::new()
            .append(true)
            .open(&fixture.paths.marker)
            .unwrap();
        journal
            .write_all(br#"{"version":2,"transactionId"#)
            .unwrap();
        journal.sync_all().unwrap();

        let recovered = read_marker(&fixture.paths.marker).unwrap();
        assert_eq!(recovered.phase, ResetPhase::Committing);
        assert_eq!(recovered.transaction_id, marker.transaction_id);
    }

    #[test]
    fn recovery_is_retained_until_acknowledged() {
        let fixture = Fixture::new("recovery-ack");
        let recovery = SoftwareResetRecovery {
            message: "recover".to_string(),
            local_storage_snapshot: fixture.input().local_storage_snapshot,
        };
        append_json_record(&fixture.paths.recovery, &recovery).unwrap();

        assert_eq!(
            load_recovery_at(&fixture.paths.recovery)
                .unwrap()
                .unwrap()
                .message,
            "recover"
        );
        assert!(fixture.paths.recovery.exists());
        assert!(load_recovery_at(&fixture.paths.recovery).unwrap().is_some());

        acknowledge_recovery_at(&fixture.paths.recovery).unwrap();
        assert!(!fixture.paths.recovery.exists());
        assert!(load_recovery_at(&fixture.paths.recovery).unwrap().is_none());
    }

    #[test]
    fn snapshot_verification_rejects_corrupt_icons_and_window_state() {
        let icons_fixture = Fixture::new("corrupt-icons");
        let platform = TestPlatform(AtomicBool::new(true));
        let marker = prepare_snapshot(
            &icons_fixture.paths,
            &platform,
            &icons_fixture.input().local_storage_snapshot,
        )
        .unwrap();
        fs::write(
            snapshot_path(&marker).join("icons").join("old.png"),
            b"changed",
        )
        .unwrap();
        assert!(verify_snapshot(&marker)
            .unwrap_err()
            .contains("tree snapshot differs"));

        let window_fixture = Fixture::new("corrupt-window");
        let marker = prepare_snapshot(
            &window_fixture.paths,
            &platform,
            &window_fixture.input().local_storage_snapshot,
        )
        .unwrap();
        fs::write(snapshot_path(&marker).join("window-state.json"), b"changed").unwrap();
        assert!(verify_snapshot(&marker)
            .unwrap_err()
            .contains("window-state snapshot bytes changed"));
    }

    #[test]
    fn configured_backup_folder_inside_icons_is_rejected_before_reset() {
        let mut fixture = Fixture::new("backup-in-icons");
        let backup_folder = fixture.paths.data_dir.join("icons").join("user-backups");
        fs::create_dir_all(&backup_folder).unwrap();
        let existing_backup = backup_folder.join("keep.zip");
        fs::write(&existing_backup, b"keep").unwrap();
        let mut config = read_current_config(&fixture.paths).unwrap();
        config.settings.backup_folder = Some(backup_folder.to_string_lossy().to_string());
        let config_bytes = serde_json::to_vec_pretty(&config).unwrap();
        fs::write(fixture.paths.data_dir.join("config.json"), &config_bytes).unwrap();
        fixture
            .original
            .insert("config.json".to_string(), config_bytes);

        let platform = TestPlatform(AtomicBool::new(true));
        let error =
            software_reset_at_paths(&fixture.paths, &platform, &fixture.input(), &NoFailures)
                .unwrap_err();
        assert!(error.contains("backup folder is inside the icon cache"));
        assert_eq!(fs::read(existing_backup).unwrap(), b"keep");
        assert!(!fixture.paths.marker.exists());
        fixture.assert_rolled_back();
    }

    #[test]
    fn fresh_validation_uses_transaction_staged_config() {
        let fixture = Fixture::new("staged-date");
        let platform = TestPlatform(AtomicBool::new(false));
        let marker = prepare_snapshot(
            &fixture.paths,
            &platform,
            &fixture.input().local_storage_snapshot,
        )
        .unwrap();
        stage_fresh_state(&marker).unwrap();
        let stage = snapshot_path(&marker).join("stage");
        let mut staged: AppConfig =
            serde_json::from_slice(&fs::read(stage.join("config.json")).unwrap()).unwrap();
        staged.today.date = "2000-01-01".to_string();
        let staged_bytes = serde_json::to_vec_pretty(&staged).unwrap();
        write_synced(&stage.join("config.json"), &staged_bytes).unwrap();
        for name in RUNTIME_FILES {
            fs::copy(stage.join(name), fixture.paths.data_dir.join(name)).unwrap();
        }
        replace_icons_with_empty(&fixture.paths.data_dir.join("icons")).unwrap();

        validate_fresh_state(&fixture.paths, &marker, &platform, false).unwrap();
    }
}
