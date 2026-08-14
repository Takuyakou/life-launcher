use std::collections::HashSet;
use std::fs::{self, File, Metadata, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::models::{
    InstructionEntry, InstructionFolderIdentity, InstructionFolderSummary, InstructionReadResponse,
    InstructionRecycleResponse, InstructionRenameResponse, InstructionRoot,
    InstructionWriteResponse, INSTRUCTION_FILE_MAX_BYTES, INSTRUCTION_FOLDER_LIMIT,
    INSTRUCTION_NAME_MAX_CHARS,
};

use super::config::{config_path, load_config_internal};
use crate::state::AppState;
use tauri::State;

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use windows::Win32::Foundation::HANDLE;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    FileAttributeTagInfo, FileIdInfo, GetDriveTypeW, GetFileInformationByHandle,
    GetFileInformationByHandleEx, ReplaceFileW, BY_HANDLE_FILE_INFORMATION,
    FILE_ATTRIBUTE_TAG_INFO, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_ID_INFO, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, REPLACE_FILE_FLAGS,
};
#[cfg(windows)]
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IBindCtx, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED,
};
#[cfg(windows)]
use windows::Win32::System::SystemServices::{IO_REPARSE_TAG_CLOUD, IO_REPARSE_TAG_CLOUD_MASK};
#[cfg(windows)]
use windows::Win32::UI::Shell::{
    FileOperation, IFileOperation, IFileOperationProgressSink, IShellItem,
    SHCreateItemFromParsingName, FOFX_RECYCLEONDELETE, FOF_NOCONFIRMATION, FOF_NOERRORUI,
    FOF_NORECURSEREPARSE, FOF_SILENT,
};
#[cfg(windows)]
use windows_core::PCWSTR;

const UTF8_BOM: &[u8] = b"\xEF\xBB\xBF";
const SEARCH_RESULT_LIMIT: usize = 500;
const SEARCH_ENTRY_LIMIT: usize = 50_000;
#[cfg(windows)]
const FILE_ATTRIBUTE_REPARSE_POINT_VALUE: u32 = 0x0000_0400;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

struct ValidatedTarget {
    root: PathBuf,
    path: PathBuf,
    metadata: Metadata,
    file: Option<File>,
}

#[tauri::command]
pub fn validate_instruction_root(path: String) -> Result<InstructionRoot, String> {
    let configured = read_configured_root_strings()?;
    let canonical = validate_root_path(Path::new(&path))?;
    let canonical_text = path_for_response(&canonical);
    if configured.iter().any(|existing| {
        validate_root_path(Path::new(existing))
            .map(|root| paths_equal(&root, &canonical))
            .unwrap_or_else(|_| path_key(existing) == path_key(&canonical_text))
    }) {
        return Err("instruction root is already registered".to_string());
    }
    if configured.len() >= INSTRUCTION_FOLDER_LIMIT {
        return Err(format!(
            "instruction folder limit is {INSTRUCTION_FOLDER_LIMIT}"
        ));
    }
    Ok(available_root(canonical))
}

#[tauri::command]
pub async fn choose_instruction_root(
    window: tauri::WebviewWindow,
) -> Result<Option<InstructionRoot>, String> {
    #[cfg(windows)]
    let owner_hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to identify instruction window: {error}"))?
        .0 as isize;
    #[cfg(not(windows))]
    let owner_hwnd = {
        let _ = window;
        0
    };

    tauri::async_runtime::spawn_blocking(move || choose_instruction_root_blocking(owner_hwnd))
        .await
        .map_err(|error| format!("instruction folder picker task failed: {error}"))?
}

fn choose_instruction_root_blocking(_owner_hwnd: isize) -> Result<Option<InstructionRoot>, String> {
    #[cfg(windows)]
    {
        let script = format!(
            concat!(
                "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ",
                "Add-Type -AssemblyName System.Windows.Forms; ",
                "$null=Add-Type -TypeDefinition 'using System; using System.Windows.Forms; public sealed class LifeLauncherWindowOwner : IWin32Window {{ public LifeLauncherWindowOwner(IntPtr handle) {{ Handle = handle; }} public IntPtr Handle {{ get; }} }}'; ",
                "$owner=[LifeLauncherWindowOwner]::new([IntPtr]::new({})); ",
                "$dialog=New-Object System.Windows.Forms.FolderBrowserDialog; ",
                "$dialog.Description='Life Launcher instruction folder'; ",
                "$result=$dialog.ShowDialog($owner); ",
                "if ($result -eq [System.Windows.Forms.DialogResult]::OK) {{ [Console]::Write($dialog.SelectedPath) }}"
            ),
            _owner_hwnd,
        );
        let mut command = std::process::Command::new("powershell.exe");
        command
            .args(["-NoProfile", "-STA", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW);
        let output = command
            .output()
            .map_err(|error| format!("failed to open instruction folder picker: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "instruction folder picker failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        let selected = String::from_utf8(output.stdout).map_err(|error| {
            format!("instruction folder picker returned invalid UTF-8: {error}")
        })?;
        let selected = selected.trim();
        if selected.is_empty() {
            return Ok(None);
        }
        validate_instruction_root(selected.to_string()).map(Some)
    }

    #[cfg(not(windows))]
    Err("instruction folder picker is unsupported on this platform".to_string())
}

#[tauri::command]
pub fn list_instruction_roots(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<InstructionRoot>, String> {
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let folders = load_config_internal(&app)?
        .config
        .settings
        .instruction_folders
        .unwrap_or_default();
    folders
        .into_iter()
        .map(
            |configured| match validate_root_path(Path::new(&configured)) {
                Ok(root) => Ok(available_root(root)),
                Err(error) => Ok(InstructionRoot {
                    name: root_name(Path::new(&configured)),
                    path: configured,
                    available: false,
                    error: Some(error),
                }),
            },
        )
        .collect()
}

#[tauri::command]
pub fn list_instruction_directory(path: String) -> Result<Vec<InstructionEntry>, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(Path::new(&path), &roots)?;
    if !target.metadata.is_dir() {
        return Err("instruction path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&target.path)
        .map_err(|error| format!("failed to read {}: {error}", target.path.display()))?
    {
        let entry = entry.map_err(|error| format!("failed to read directory entry: {error}"))?;
        let entry_path = entry.path();
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if is_blocked_reparse_point(&entry_path, &metadata) {
            continue;
        }
        if metadata.is_dir() || (metadata.is_file() && is_instruction_file(&entry_path)) {
            entries.push(entry_from_metadata(&entry_path, &metadata)?);
        }
    }
    sort_entries(&mut entries);
    Ok(entries)
}

#[tauri::command]
pub fn search_instruction_files(query: String) -> Result<Vec<InstructionEntry>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    if query.chars().count() > 128 {
        return Err("instruction search query is too long".to_string());
    }
    let query = query.to_lowercase();
    let configured = read_configured_root_strings()?;
    let mut roots = Vec::new();
    for configured_root in configured {
        if let Ok(root) = validate_root_path(Path::new(&configured_root)) {
            roots.push(root);
        }
    }
    if roots.is_empty() {
        return Ok(Vec::new());
    }

    roots.sort_by_key(|root| path_key(&root.to_string_lossy()).len());
    let mut distinct_roots: Vec<PathBuf> = Vec::new();
    for root in roots {
        if !distinct_roots
            .iter()
            .any(|existing| path_is_within(&root, existing))
        {
            distinct_roots.push(root);
        }
    }

    search_instruction_files_in_roots(&query, distinct_roots)
}

fn search_instruction_files_in_roots(
    query: &str,
    roots: Vec<PathBuf>,
) -> Result<Vec<InstructionEntry>, String> {
    let mut results = Vec::new();
    let mut scanned = 0usize;
    let mut stack: Vec<(PathBuf, PathBuf)> =
        roots.into_iter().map(|root| (root.clone(), root)).collect();
    while let Some((directory, root)) = stack.pop() {
        let read_dir = match fs::read_dir(&directory) {
            Ok(read_dir) => read_dir,
            Err(_) => continue,
        };
        for entry in read_dir.flatten() {
            scanned += 1;
            if scanned > SEARCH_ENTRY_LIMIT {
                return Err(format!(
                    "instruction search exceeded the {SEARCH_ENTRY_LIMIT} item safety limit"
                ));
            }
            let path = entry.path();
            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if is_blocked_reparse_point(&path, &metadata) {
                continue;
            }

            let name_matches = path_matches_instruction_search(&path, &root, query);
            if metadata.is_dir() {
                if name_matches {
                    results.push(entry_from_metadata(&path, &metadata)?);
                }
                stack.push((path, root.clone()));
            } else if metadata.is_file() && is_instruction_file(&path) && name_matches {
                results.push(entry_from_metadata(&path, &metadata)?);
            }
            if results.len() >= SEARCH_RESULT_LIMIT {
                sort_entries(&mut results);
                return Ok(results);
            }
        }
    }
    sort_entries(&mut results);
    Ok(results)
}

fn path_matches_instruction_search(path: &Path, root: &Path, query: &str) -> bool {
    root.file_name()
        .is_some_and(|name| name.to_string_lossy().to_lowercase().contains(query))
        || path.strip_prefix(root).is_ok_and(|relative| {
            relative.components().any(|component| {
                component
                    .as_os_str()
                    .to_string_lossy()
                    .to_lowercase()
                    .contains(query)
            })
        })
}

#[tauri::command]
pub fn read_instruction(path: String) -> Result<InstructionReadResponse, String> {
    let roots = read_configured_root_strings()?;
    read_instruction_for_roots(Path::new(&path), &roots)
}

#[tauri::command]
pub fn write_instruction(
    path: String,
    content: String,
    expected_modified_at: u64,
) -> Result<InstructionWriteResponse, String> {
    let roots = read_configured_root_strings()?;
    write_instruction_for_roots(Path::new(&path), &content, expected_modified_at, &roots)
}

#[tauri::command]
pub fn create_instruction_file(
    parent: String,
    name: String,
    extension: String,
) -> Result<InstructionEntry, String> {
    validate_instruction_name(&name)?;
    let extension = normalize_extension(&extension)?;
    let roots = read_configured_root_strings()?;
    let parent = validate_existing_target(Path::new(&parent), &roots)?;
    if !parent.metadata.is_dir() {
        return Err("instruction parent is not a directory".to_string());
    }
    let destination = parent.path.join(format!("{name}.{extension}"));
    ensure_destination_within_root(&parent.root, &destination)?;
    validate_existing_target(&parent.path, &roots)?;

    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)
        .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
    let sync_result = file
        .flush()
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("failed to sync {}: {error}", destination.display()));
    drop(file);
    if let Err(error) = sync_result {
        let _ = fs::remove_file(&destination);
        return Err(error);
    }
    let metadata = fs::symlink_metadata(&destination)
        .map_err(|error| format!("failed to inspect {}: {error}", destination.display()))?;
    entry_from_metadata(&destination, &metadata)
}

#[tauri::command]
pub fn create_instruction_folder(parent: String, name: String) -> Result<InstructionEntry, String> {
    validate_instruction_name(&name)?;
    let roots = read_configured_root_strings()?;
    let parent = validate_existing_target(Path::new(&parent), &roots)?;
    if !parent.metadata.is_dir() {
        return Err("instruction parent is not a directory".to_string());
    }
    let destination = parent.path.join(name);
    ensure_destination_within_root(&parent.root, &destination)?;
    validate_existing_target(&parent.path, &roots)?;
    fs::create_dir(&destination)
        .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
    let metadata = fs::symlink_metadata(&destination)
        .map_err(|error| format!("failed to inspect {}: {error}", destination.display()))?;
    entry_from_metadata(&destination, &metadata)
}

#[tauri::command]
pub fn rename_instruction_file(
    path: String,
    new_name: String,
) -> Result<InstructionRenameResponse, String> {
    rename_instruction(Path::new(&path), &new_name, false)
}

#[tauri::command]
pub fn rename_instruction_folder(
    path: String,
    new_name: String,
) -> Result<InstructionRenameResponse, String> {
    rename_instruction(Path::new(&path), &new_name, true)
}

#[tauri::command]
pub fn move_instruction_to_recycle_bin(path: String) -> Result<InstructionRecycleResponse, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(Path::new(&path), &roots)?;
    if paths_equal(&target.root, &target.path) {
        return Err("registered instruction roots cannot be moved to the recycle bin".to_string());
    }
    if target.metadata.is_file() && !is_instruction_file(&target.path) {
        return Err("only .md, .txt, and .html instruction files are supported".to_string());
    }
    if !target.metadata.is_file() && !target.metadata.is_dir() {
        return Err("instruction path is neither a file nor a directory".to_string());
    }
    let response_path = path_for_response(&target.path);
    let revalidated = validate_existing_target(&target.path, &roots)?;
    recycle_path(revalidated.path)?;
    Ok(InstructionRecycleResponse {
        path: response_path,
    })
}

#[tauri::command]
pub fn inspect_instruction_folder(path: String) -> Result<InstructionFolderSummary, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(Path::new(&path), &roots)?;
    if !target.metadata.is_dir() {
        return Err("instruction path is not a directory".to_string());
    }

    summarize_instruction_folder(&target.path)
}

fn summarize_instruction_folder(path: &Path) -> Result<InstructionFolderSummary, String> {
    let mut summary = InstructionFolderSummary {
        instruction_count: 0,
        folder_count: 0,
    };
    let mut scanned = 0usize;
    let mut stack = vec![path.to_path_buf()];
    while let Some(directory) = stack.pop() {
        let entries = fs::read_dir(&directory)
            .map_err(|error| format!("failed to read {}: {error}", directory.display()))?;
        for entry in entries {
            scanned += 1;
            if scanned > SEARCH_ENTRY_LIMIT {
                return Err(format!(
                    "instruction folder inspection exceeded the {SEARCH_ENTRY_LIMIT} item safety limit"
                ));
            }
            let entry =
                entry.map_err(|error| format!("failed to read directory entry: {error}"))?;
            let entry_path = entry.path();
            let metadata = match fs::symlink_metadata(&entry_path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if is_blocked_reparse_point(&entry_path, &metadata) {
                continue;
            }
            if metadata.is_dir() {
                summary.folder_count += 1;
                stack.push(entry_path);
            } else if metadata.is_file() && is_instruction_file(&entry_path) {
                summary.instruction_count += 1;
            }
        }
    }
    Ok(summary)
}

#[tauri::command]
pub fn open_instruction_in_default_editor(app: AppHandle, path: String) -> Result<String, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_instruction_file(Path::new(&path), &roots)?;
    let response_path = path_for_response(&target.path);
    validate_instruction_file(&target.path, &roots)?;
    app.opener()
        .open_path(response_path.clone(), None::<&str>)
        .map_err(|error| format!("failed to open instruction: {error}"))?;
    Ok(response_path)
}

#[tauri::command]
pub fn open_instruction_folder(app: AppHandle, path: String) -> Result<String, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(Path::new(&path), &roots)?;
    if !target.metadata.is_dir() {
        return Err("instruction path is not a directory".to_string());
    }
    let response_path = path_for_response(&target.path);
    validate_existing_target(&target.path, &roots)?;
    app.opener()
        .open_path(response_path.clone(), None::<&str>)
        .map_err(|error| format!("failed to open instruction folder: {error}"))?;
    Ok(response_path)
}

fn instruction_explorer_folder(target: &ValidatedTarget) -> Result<PathBuf, String> {
    if target.metadata.is_dir() {
        return Ok(target.path.clone());
    }
    target
        .path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "instruction file has no parent folder".to_string())
}

#[tauri::command]
pub fn reveal_instruction_in_explorer(path: String) -> Result<String, String> {
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(Path::new(&path), &roots)?;
    if target.metadata.is_file() && !is_instruction_file(&target.path) {
        return Err("only .md, .txt, and .html instruction files are supported".to_string());
    }
    validate_existing_target(&target.path, &roots)?;
    let folder = instruction_explorer_folder(&target)?;
    validate_existing_target(&folder, &roots)?;
    let response_path = path_for_response(&folder);

    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(&response_path)
            .spawn()
            .map_err(|error| format!("failed to open instruction folder: {error}"))?;
        Ok(response_path)
    }

    #[cfg(not(windows))]
    Err("revealing instruction paths is unsupported on this platform".to_string())
}

pub(crate) fn normalize_instruction_folder_settings(folders: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for folder in folders {
        let Some(folder) = normalize_local_drive_path_text(folder) else {
            continue;
        };
        if seen.insert(path_key(&folder)) {
            normalized.push(folder);
        }
        if normalized.len() >= INSTRUCTION_FOLDER_LIMIT {
            break;
        }
    }
    normalized
}

pub(crate) struct InstructionFolderReconciliation {
    pub folders: Vec<String>,
    pub identities: Vec<InstructionFolderIdentity>,
    pub renamed: Vec<(String, String)>,
}

pub(crate) fn reconcile_instruction_folder_settings(
    folders: &[String],
    identities: &[InstructionFolderIdentity],
) -> InstructionFolderReconciliation {
    let folders = normalize_instruction_folder_settings(folders);
    let mut resolved_folders = Vec::new();
    let mut resolved_identities = Vec::new();
    let mut renamed = Vec::new();
    let mut seen = HashSet::new();

    for folder in folders {
        let saved_identity = identities
            .iter()
            .find(|identity| path_key(&identity.path) == path_key(&folder))
            .filter(|identity| valid_instruction_folder_identity(&identity.identity));
        let existing = validate_root_path(Path::new(&folder)).ok();
        let resolved = existing.or_else(|| {
            saved_identity.and_then(|identity| {
                find_renamed_instruction_root(Path::new(&folder), &identity.identity)
            })
        });
        let resolved_path = resolved
            .as_deref()
            .map(path_for_response)
            .unwrap_or_else(|| folder.clone());
        if !seen.insert(path_key(&resolved_path)) {
            continue;
        }
        if path_key(&resolved_path) != path_key(&folder) {
            renamed.push((folder.clone(), resolved_path.clone()));
        }
        let identity = resolved
            .as_deref()
            .and_then(instruction_folder_identity)
            .or_else(|| saved_identity.map(|identity| identity.identity.clone()));
        if let Some(identity) = identity {
            resolved_identities.push(InstructionFolderIdentity {
                path: resolved_path.clone(),
                identity,
            });
        }
        resolved_folders.push(resolved_path);
    }

    InstructionFolderReconciliation {
        folders: resolved_folders,
        identities: resolved_identities,
        renamed,
    }
}

fn valid_instruction_folder_identity(identity: &str) -> bool {
    (identity.len() == 25
        && identity.as_bytes().get(8) == Some(&b':')
        && identity
            .bytes()
            .enumerate()
            .all(|(index, byte)| index == 8 || byte.is_ascii_hexdigit()))
        || valid_extended_instruction_folder_identity(identity)
}

fn valid_extended_instruction_folder_identity(identity: &str) -> bool {
    identity.len() == 49
        && identity.as_bytes().get(16) == Some(&b':')
        && identity
            .bytes()
            .enumerate()
            .all(|(index, byte)| index == 16 || byte.is_ascii_hexdigit())
}

#[cfg(windows)]
fn instruction_folder_identity(path: &Path) -> Option<String> {
    let directory = OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0 | FILE_SHARE_DELETE.0)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0)
        .open(path)
        .ok()?;
    let mut information = FILE_ID_INFO::default();
    unsafe {
        GetFileInformationByHandleEx(
            HANDLE(directory.as_raw_handle()),
            FileIdInfo,
            (&mut information as *mut FILE_ID_INFO).cast(),
            std::mem::size_of::<FILE_ID_INFO>() as u32,
        )
        .ok()?;
    }
    let file_id = information
        .FileId
        .Identifier
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<String>();
    Some(format!("{:016X}:{file_id}", information.VolumeSerialNumber))
}

#[cfg(windows)]
fn legacy_instruction_folder_identity(path: &Path) -> Option<String> {
    let directory = OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0 | FILE_SHARE_DELETE.0)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0)
        .open(path)
        .ok()?;
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    unsafe {
        GetFileInformationByHandle(HANDLE(directory.as_raw_handle()), &mut information).ok()?;
    }
    let volume = information.dwVolumeSerialNumber;
    let file_index =
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
    Some(format!("{volume:08X}:{file_index:016X}"))
}

#[cfg(not(windows))]
fn instruction_folder_identity(_path: &Path) -> Option<String> {
    None
}

#[cfg(windows)]
fn instruction_folder_identity_matches(path: &Path, expected_identity: &str) -> bool {
    instruction_folder_identity(path).as_deref() == Some(expected_identity)
        || legacy_instruction_folder_identity(path).as_deref() == Some(expected_identity)
}

#[cfg(not(windows))]
fn instruction_folder_identity_matches(_path: &Path, _expected_identity: &str) -> bool {
    false
}

fn find_renamed_instruction_root(path: &Path, expected_identity: &str) -> Option<PathBuf> {
    let parent = path.parent()?;
    for entry in fs::read_dir(parent).ok()?.take(10_000).flatten() {
        let candidate = entry.path();
        if !instruction_folder_identity_matches(&candidate, expected_identity) {
            continue;
        }
        if let Ok(validated) = validate_root_path(&candidate) {
            return Some(validated);
        }
    }
    None
}

fn read_configured_root_strings() -> Result<Vec<String>, String> {
    let path = config_path()?;
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let value: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("config.json is not valid JSON: {error}"))?;
    let Some(folders) = value
        .get("settings")
        .and_then(|settings| settings.get("instructionFolders"))
    else {
        return Ok(Vec::new());
    };
    let folders = folders
        .as_array()
        .ok_or_else(|| "settings.instructionFolders must be an array".to_string())?;
    if folders.len() > INSTRUCTION_FOLDER_LIMIT {
        return Err(format!(
            "settings.instructionFolders exceeds the {INSTRUCTION_FOLDER_LIMIT} folder limit"
        ));
    }

    let mut result = Vec::new();
    let mut seen = HashSet::new();
    for folder in folders {
        let raw = folder
            .as_str()
            .ok_or_else(|| "settings.instructionFolders contains a non-string value".to_string())?;
        let normalized = normalize_local_drive_path_text(raw).ok_or_else(|| {
            format!("registered instruction root is not a local drive path: {raw}")
        })?;
        if !seen.insert(path_key(&normalized)) {
            return Err("settings.instructionFolders contains a duplicate path".to_string());
        }
        result.push(normalized);
    }
    Ok(result)
}

fn available_root(path: PathBuf) -> InstructionRoot {
    InstructionRoot {
        name: root_name(&path),
        path: path_for_response(&path),
        available: true,
        error: None,
    }
}

fn validate_root_path(path: &Path) -> Result<PathBuf, String> {
    let raw = path.to_string_lossy();
    if normalize_local_drive_path_text(&raw).is_none() {
        return Err("instruction root must be an absolute local drive path".to_string());
    }
    if !is_local_drive_path(path) {
        return Err("instruction root must be on a local Windows drive".to_string());
    }
    reject_parent_components(path)?;
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "failed to inspect instruction root {}: {error}",
            path.display()
        )
    })?;
    if is_blocked_reparse_point(path, &metadata) {
        return Err(
            "instruction root cannot be a symlink, junction, or unsupported reparse point"
                .to_string(),
        );
    }
    if !metadata.is_dir() {
        return Err("instruction root is not a directory".to_string());
    }
    let canonical = fs::canonicalize(path)
        .map_err(|error| format!("failed to canonicalize instruction root: {error}"))?;
    if normalize_local_drive_path_text(&canonical.to_string_lossy()).is_none() {
        return Err("canonical instruction root is not a local drive path".to_string());
    }
    Ok(canonical)
}

#[cfg(windows)]
fn is_local_drive_path(path: &Path) -> bool {
    let Some(normalized) = normalize_local_drive_path_text(&path.to_string_lossy()) else {
        return false;
    };
    let drive_root = &normalized[..3];
    let wide: Vec<u16> = std::ffi::OsStr::new(drive_root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let drive_type = unsafe { GetDriveTypeW(PCWSTR(wide.as_ptr())) };
    !matches!(drive_type, 0 | 1 | 4)
}

#[cfg(not(windows))]
fn is_local_drive_path(_path: &Path) -> bool {
    false
}

#[cfg(windows)]
fn open_instruction_file_handle(path: &Path) -> Result<File, String> {
    OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_DELETE.0)
        .open(path)
        .map_err(|error| {
            format!(
                "failed to lock instruction file {}: {error}",
                path.display()
            )
        })
}

#[cfg(not(windows))]
fn open_instruction_file_handle(path: &Path) -> Result<File, String> {
    File::open(path).map_err(|error| format!("failed to open {}: {error}", path.display()))
}

#[cfg(windows)]
fn ensure_single_link(file: &File) -> Result<(), String> {
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    unsafe {
        GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut information)
            .map_err(|error| format!("failed to inspect instruction file links: {error}"))?;
    }
    if information.nNumberOfLinks > 1 {
        return Err("instruction files with hard links are not supported".to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn ensure_single_link(_file: &File) -> Result<(), String> {
    Ok(())
}

fn validate_existing_target(path: &Path, roots: &[String]) -> Result<ValidatedTarget, String> {
    reject_parent_components(path)?;
    if normalize_local_drive_path_text(&path.to_string_lossy()).is_none() {
        return Err("instruction path must be an absolute local drive path".to_string());
    }

    let mut candidates: Vec<&String> = roots
        .iter()
        .filter(|root| path_is_within_text(path, Path::new(root)))
        .collect();
    candidates.sort_by_key(|root| std::cmp::Reverse(path_key(root).len()));
    if candidates.is_empty() {
        return Err("instruction path is outside the registered roots".to_string());
    }

    let mut last_root_error = None;
    for configured_root in candidates {
        let root = match validate_root_path(Path::new(configured_root)) {
            Ok(root) => root,
            Err(error) => {
                last_root_error = Some(error);
                continue;
            }
        };
        ensure_no_reparse_chain(Path::new(configured_root), path)?;
        let canonical = fs::canonicalize(path)
            .map_err(|error| format!("failed to canonicalize instruction path: {error}"))?;
        if !path_is_within(&canonical, &root) {
            return Err("canonical instruction path is outside the registered root".to_string());
        }
        ensure_no_reparse_chain(&root, &canonical)?;
        let metadata = fs::symlink_metadata(&canonical)
            .map_err(|error| format!("failed to inspect {}: {error}", canonical.display()))?;
        if is_blocked_reparse_point(&canonical, &metadata) {
            return Err(
                "instruction path cannot be a symlink, junction, or unsupported reparse point"
                    .to_string(),
            );
        }
        let file = if metadata.is_file() {
            let file = open_instruction_file_handle(&canonical)?;
            ensure_single_link(&file)?;
            Some(file)
        } else {
            None
        };
        return Ok(ValidatedTarget {
            root,
            path: canonical,
            metadata,
            file,
        });
    }

    Err(last_root_error
        .unwrap_or_else(|| "no registered instruction root is available".to_string()))
}

fn validate_instruction_file(path: &Path, roots: &[String]) -> Result<ValidatedTarget, String> {
    let target = validate_existing_target(path, roots)?;
    if !target.metadata.is_file() {
        return Err("instruction path is not a file".to_string());
    }
    if !is_instruction_file(&target.path) {
        return Err("only .md, .txt, and .html instruction files are supported".to_string());
    }
    Ok(target)
}

fn read_instruction_for_roots(
    path: &Path,
    roots: &[String],
) -> Result<InstructionReadResponse, String> {
    let mut target = validate_instruction_file(path, roots)?;
    if target.metadata.len() > INSTRUCTION_FILE_MAX_BYTES {
        return Err("instruction file exceeds the 2 MiB limit".to_string());
    }
    let mut bytes = Vec::with_capacity(target.metadata.len() as usize);
    target
        .file
        .as_mut()
        .ok_or_else(|| "instruction file handle is unavailable".to_string())?
        .take(INSTRUCTION_FILE_MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("failed to read {}: {error}", target.path.display()))?;
    if bytes.len() as u64 > INSTRUCTION_FILE_MAX_BYTES {
        return Err("instruction file exceeds the 2 MiB limit".to_string());
    }
    if bytes.contains(&0) {
        return Err("instruction file appears to be binary".to_string());
    }
    let text_bytes = bytes.strip_prefix(UTF8_BOM).unwrap_or(&bytes);
    let content = String::from_utf8(text_bytes.to_vec())
        .map_err(|_| "instruction file is not valid UTF-8".to_string())?;
    Ok(InstructionReadResponse {
        name: file_name_text(&target.path)?,
        path: path_for_response(&target.path),
        content,
        modified_at: modified_at_millis(&target.metadata)?,
        size: target.metadata.len(),
        read_only: target.metadata.permissions().readonly()
            || instruction_extension(&target.path).as_deref() == Some("html"),
    })
}

fn write_instruction_for_roots(
    path: &Path,
    content: &str,
    expected_modified_at: u64,
    roots: &[String],
) -> Result<InstructionWriteResponse, String> {
    if content.len() as u64 > INSTRUCTION_FILE_MAX_BYTES {
        return Err("instruction content exceeds the 2 MiB limit".to_string());
    }
    if content.as_bytes().contains(&0) {
        return Err("instruction content contains a binary NUL byte".to_string());
    }
    let target = validate_instruction_file(path, roots)?;
    if !is_editable_instruction_file(&target.path) {
        return Err("HTML instruction files are read-only in Life Launcher".to_string());
    }
    let locked_metadata = target
        .file
        .as_ref()
        .ok_or_else(|| "instruction file handle is unavailable".to_string())?
        .metadata()
        .map_err(|error| format!("failed to inspect locked instruction file: {error}"))?;
    ensure_expected_mtime(&locked_metadata, expected_modified_at)?;
    let parent = target
        .path
        .parent()
        .ok_or_else(|| "instruction file has no parent directory".to_string())?;
    let temp_path = unique_temp_path(parent);

    let result = (|| {
        let mut temp = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| format!("failed to create temporary instruction file: {error}"))?;
        temp.write_all(content.as_bytes())
            .and_then(|_| temp.flush())
            .and_then(|_| temp.sync_all())
            .map_err(|error| format!("failed to sync temporary instruction file: {error}"))?;
        drop(temp);

        let revalidated = validate_instruction_file(&target.path, roots)?;
        let revalidated_metadata = revalidated
            .file
            .as_ref()
            .ok_or_else(|| "instruction file handle is unavailable".to_string())?
            .metadata()
            .map_err(|error| format!("failed to inspect locked instruction file: {error}"))?;
        ensure_expected_mtime(&revalidated_metadata, expected_modified_at)?;
        replace_file_atomically(&target.path, &temp_path)?;
        let metadata = fs::metadata(&target.path)
            .map_err(|error| format!("failed to inspect saved instruction: {error}"))?;
        Ok(InstructionWriteResponse {
            path: path_for_response(&target.path),
            modified_at: modified_at_millis(&metadata)?,
            size: metadata.len(),
        })
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

fn rename_instruction(
    path: &Path,
    new_name: &str,
    expect_directory: bool,
) -> Result<InstructionRenameResponse, String> {
    validate_instruction_name(new_name)?;
    let roots = read_configured_root_strings()?;
    let target = validate_existing_target(path, &roots)?;
    if paths_equal(&target.root, &target.path) {
        return Err("registered instruction roots cannot be renamed".to_string());
    }
    if target.metadata.is_dir() != expect_directory {
        return Err(if expect_directory {
            "instruction path is not a directory".to_string()
        } else {
            "instruction path is not a file".to_string()
        });
    }
    if !expect_directory && !is_instruction_file(&target.path) {
        return Err("only .md, .txt, and .html instruction files are supported".to_string());
    }

    let parent = target
        .path
        .parent()
        .ok_or_else(|| "instruction path has no parent directory".to_string())?;
    let destination_name = if expect_directory {
        new_name.to_string()
    } else {
        let extension = instruction_extension(&target.path)
            .ok_or_else(|| "instruction file has an unsupported extension".to_string())?;
        format!("{new_name}.{extension}")
    };
    let destination = parent.join(destination_name);
    ensure_destination_within_root(&target.root, &destination)?;
    if paths_equal(&target.path, &destination) && target.path.file_name() == destination.file_name()
    {
        return Err("new instruction name is unchanged".to_string());
    }
    if destination.exists() && !paths_equal(&target.path, &destination) {
        return Err("an instruction item with that name already exists".to_string());
    }

    validate_existing_target(&target.path, &roots)?;
    fs::rename(&target.path, &destination).map_err(|error| {
        format!(
            "failed to rename {} to {}: {error}",
            target.path.display(),
            destination.display()
        )
    })?;
    let new_path = fs::canonicalize(&destination).unwrap_or(destination);
    Ok(InstructionRenameResponse {
        old_path: path_for_response(&target.path),
        new_path: path_for_response(&new_path),
    })
}

fn validate_instruction_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("instruction name cannot be empty".to_string());
    }
    if name.chars().count() > INSTRUCTION_NAME_MAX_CHARS {
        return Err(format!(
            "instruction name exceeds {INSTRUCTION_NAME_MAX_CHARS} characters"
        ));
    }
    if name == "." || name == ".." || name.contains("..") && name.chars().all(|c| c == '.') {
        return Err("instruction name cannot be . or ..".to_string());
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err("instruction name cannot end with a dot or space".to_string());
    }
    if name.chars().any(|character| {
        character < ' '
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err("instruction name contains a forbidden Windows character".to_string());
    }
    let reserved_stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    let reserved = matches!(reserved_stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || reserved_stem.strip_prefix("COM").is_some_and(|number| {
            matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
        || reserved_stem.strip_prefix("LPT").is_some_and(|number| {
            matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        });
    if reserved {
        return Err("instruction name is reserved by Windows".to_string());
    }
    Ok(())
}

fn normalize_extension(extension: &str) -> Result<String, String> {
    let extension = extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if matches!(extension.as_str(), "md" | "txt") {
        Ok(extension)
    } else {
        Err("instruction extension must be md or txt".to_string())
    }
}

fn is_instruction_file(path: &Path) -> bool {
    instruction_extension(path).is_some()
}

fn is_editable_instruction_file(path: &Path) -> bool {
    matches!(instruction_extension(path).as_deref(), Some("md" | "txt"))
}

fn instruction_extension(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
    matches!(extension.as_str(), "md" | "txt" | "html").then_some(extension)
}

fn entry_from_metadata(path: &Path, metadata: &Metadata) -> Result<InstructionEntry, String> {
    if metadata.is_dir() {
        Ok(InstructionEntry {
            name: file_name_text(path)?,
            path: path_for_response(path),
            kind: "folder".to_string(),
            extension: None,
            modified_at: modified_at_millis(metadata).ok(),
            size: None,
            read_only: metadata.permissions().readonly(),
        })
    } else if metadata.is_file() && is_instruction_file(path) {
        Ok(InstructionEntry {
            name: file_name_text(path)?,
            path: path_for_response(path),
            kind: "file".to_string(),
            extension: instruction_extension(path),
            modified_at: Some(modified_at_millis(metadata)?),
            size: Some(metadata.len()),
            read_only: metadata.permissions().readonly(),
        })
    } else {
        Err("unsupported instruction entry".to_string())
    }
}

fn sort_entries(entries: &mut [InstructionEntry]) {
    entries.sort_by(|left, right| {
        let left_folder = left.kind == "folder";
        let right_folder = right.kind == "folder";
        right_folder
            .cmp(&left_folder)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
            .then_with(|| left.path.cmp(&right.path))
    });
}

fn modified_at_millis(metadata: &Metadata) -> Result<u64, String> {
    let modified = metadata
        .modified()
        .map_err(|error| format!("failed to read instruction modified time: {error}"))?;
    modified
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|_| "instruction modified time is before the Unix epoch".to_string())
}

fn ensure_expected_mtime(metadata: &Metadata, expected: u64) -> Result<(), String> {
    let actual = modified_at_millis(metadata)?;
    if actual != expected {
        Err(format!(
            "conflict: instruction was modified externally (expected {expected}, found {actual})"
        ))
    } else {
        Ok(())
    }
}

fn unique_temp_path(parent: &Path) -> PathBuf {
    let sequence = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    parent.join(format!(
        ".life-launcher-instruction-{}-{time}-{sequence}.tmp",
        std::process::id()
    ))
}

#[cfg(windows)]
fn replace_file_atomically(destination: &Path, replacement: &Path) -> Result<(), String> {
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let replacement_wide: Vec<u16> = replacement
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        ReplaceFileW(
            PCWSTR(destination_wide.as_ptr()),
            PCWSTR(replacement_wide.as_ptr()),
            PCWSTR::null(),
            REPLACE_FILE_FLAGS(0),
            None,
            None,
        )
        .map_err(|error| format!("failed to atomically replace instruction file: {error}"))
    }
}

#[cfg(not(windows))]
fn replace_file_atomically(destination: &Path, replacement: &Path) -> Result<(), String> {
    fs::rename(replacement, destination)
        .map_err(|error| format!("failed to atomically replace instruction file: {error}"))
}

#[cfg(windows)]
fn recycle_path(path: PathBuf) -> Result<(), String> {
    std::thread::spawn(move || recycle_path_sta(&path))
        .join()
        .map_err(|_| "recycle bin operation thread panicked".to_string())?
}

#[cfg(windows)]
fn recycle_path_sta(path: &Path) -> Result<(), String> {
    struct ComGuard;
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }

    let path_wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|error| format!("failed to initialize recycle bin COM operation: {error}"))?;
        let _guard = ComGuard;
        let item: IShellItem =
            SHCreateItemFromParsingName(PCWSTR(path_wide.as_ptr()), None::<&IBindCtx>)
                .map_err(|error| format!("failed to create recycle bin shell item: {error}"))?;
        let operation: IFileOperation =
            CoCreateInstance(&FileOperation, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| format!("failed to create recycle bin operation: {error}"))?;
        operation
            .SetOperationFlags(
                FOFX_RECYCLEONDELETE
                    | FOF_NOCONFIRMATION
                    | FOF_NOERRORUI
                    | FOF_NORECURSEREPARSE
                    | FOF_SILENT,
            )
            .map_err(|error| format!("failed to configure recycle bin operation: {error}"))?;
        operation
            .DeleteItem(&item, None::<&IFileOperationProgressSink>)
            .map_err(|error| format!("failed to queue recycle bin operation: {error}"))?;
        operation
            .PerformOperations()
            .map_err(|error| format!("recycle bin operation failed: {error}"))?;
        if operation
            .GetAnyOperationsAborted()
            .map_err(|error| format!("failed to verify recycle bin operation: {error}"))?
            .as_bool()
        {
            return Err("recycle bin operation was aborted".to_string());
        }
    }
    if path.exists() {
        return Err("recycle bin operation did not move the instruction path".to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn recycle_path(_path: PathBuf) -> Result<(), String> {
    Err("moving instructions to the recycle bin is unsupported on this platform".to_string())
}

fn ensure_destination_within_root(root: &Path, destination: &Path) -> Result<(), String> {
    reject_parent_components(destination)?;
    if !path_is_within(destination, root) {
        return Err("instruction destination is outside the registered root".to_string());
    }
    Ok(())
}

fn ensure_no_reparse_chain(root: &Path, target: &Path) -> Result<(), String> {
    if !path_is_within_text(target, root) {
        return Err("instruction path is outside the registered root".to_string());
    }
    let root_key = path_key(&root.to_string_lossy());
    let mut current = Some(target);
    while let Some(path) = current {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
        if is_blocked_reparse_point(path, &metadata) {
            return Err(format!(
                "instruction path contains a symlink, junction, or unsupported reparse point: {}",
                path.display()
            ));
        }
        if path_key(&path.to_string_lossy()) == root_key {
            return Ok(());
        }
        current = path.parent();
    }
    Err("instruction path did not resolve back to its registered root".to_string())
}

#[cfg(windows)]
fn is_blocked_reparse_point(path: &Path, metadata: &Metadata) -> bool {
    if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT_VALUE == 0 {
        return false;
    }
    reparse_tag(path).is_none_or(|tag| !is_cloud_reparse_tag(tag))
}

#[cfg(windows)]
fn reparse_tag(path: &Path) -> Option<u32> {
    let metadata = fs::symlink_metadata(path).ok()?;
    let mut flags = FILE_FLAG_OPEN_REPARSE_POINT.0;
    if metadata.is_dir() {
        flags |= FILE_FLAG_BACKUP_SEMANTICS.0;
    }
    let handle = OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0 | FILE_SHARE_DELETE.0)
        .custom_flags(flags)
        .open(path)
        .ok()?;
    let mut information = FILE_ATTRIBUTE_TAG_INFO::default();
    unsafe {
        GetFileInformationByHandleEx(
            HANDLE(handle.as_raw_handle()),
            FileAttributeTagInfo,
            (&mut information as *mut FILE_ATTRIBUTE_TAG_INFO).cast(),
            std::mem::size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
        )
        .ok()?;
    }
    Some(information.ReparseTag)
}

#[cfg(windows)]
fn is_cloud_reparse_tag(tag: u32) -> bool {
    tag & !IO_REPARSE_TAG_CLOUD_MASK == IO_REPARSE_TAG_CLOUD
}

#[cfg(not(windows))]
fn is_blocked_reparse_point(_path: &Path, metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn reject_parent_components(path: &Path) -> Result<(), String> {
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("instruction path cannot contain .. traversal".to_string());
    }
    Ok(())
}

fn normalize_local_drive_path_text(path: &str) -> Option<String> {
    let mut normalized = path.trim().replace('/', "\\");
    if normalized
        .get(..8)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("\\\\?\\UNC\\"))
        || normalized.starts_with("\\\\.\\")
    {
        return None;
    }
    if let Some(stripped) = normalized.strip_prefix("\\\\?\\") {
        normalized = stripped.to_string();
    }
    if normalized.starts_with("\\\\") {
        return None;
    }
    let bytes = normalized.as_bytes();
    if bytes.len() < 3 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' || bytes[2] != b'\\' {
        return None;
    }
    while normalized.len() > 3 && normalized.ends_with('\\') {
        normalized.pop();
    }
    let path = Path::new(&normalized);
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return None;
    }
    Some(normalized)
}

fn path_key(path: &str) -> String {
    normalize_local_drive_path_text(path)
        .unwrap_or_else(|| path.trim().replace('/', "\\"))
        .to_lowercase()
}

fn path_is_within_text(path: &Path, root: &Path) -> bool {
    let path = path_key(&path.to_string_lossy());
    let root = path_key(&root.to_string_lossy());
    path == root
        || path
            .strip_prefix(&root)
            .is_some_and(|rest| root.ends_with('\\') || rest.starts_with('\\'))
}

fn path_is_within(path: &Path, root: &Path) -> bool {
    path_is_within_text(path, root)
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    path_key(&left.to_string_lossy()) == path_key(&right.to_string_lossy())
}

fn path_for_response(path: &Path) -> String {
    normalize_local_drive_path_text(&path.to_string_lossy())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn file_name_text(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| format!("instruction path has no file name: {}", path.display()))
}

fn root_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| path_for_response(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_only_unique_local_drive_roots_up_to_limit() {
        let roots = vec![
            " C:/Docs/ ".to_string(),
            "c:\\docs".to_string(),
            "\\\\server\\share".to_string(),
            "X:\\One".to_string(),
            "E:\\Two".to_string(),
            "F:\\Three".to_string(),
            "G:\\Four".to_string(),
            "H:\\Ignored".to_string(),
        ];
        assert_eq!(
            normalize_instruction_folder_settings(&roots),
            vec!["C:\\Docs", "X:\\One", "E:\\Two", "F:\\Three", "G:\\Four"]
        );
    }

    #[cfg(windows)]
    #[test]
    fn explorer_target_for_instruction_file_is_its_parent_folder() {
        let root = temp_root("reveal-parent");
        let instruction = root.join("guide.md");
        fs::write(&instruction, "guide").expect("write instruction");
        let root_text = path_for_response(&root);
        let target = validate_existing_target(&instruction, std::slice::from_ref(&root_text))
            .expect("validate instruction");
        assert_eq!(instruction_explorer_folder(&target).unwrap(), root);
        fs::remove_dir_all(root).expect("remove root");
    }

    #[test]
    fn rejects_unc_relative_and_traversal_paths() {
        assert!(normalize_local_drive_path_text("\\\\server\\share").is_none());
        assert!(normalize_local_drive_path_text("\\\\?\\UNC\\server\\share").is_none());
        assert!(normalize_local_drive_path_text("docs\\guide").is_none());
        assert!(normalize_local_drive_path_text("C:\\root\\..\\escape").is_none());
        assert_eq!(
            normalize_local_drive_path_text("\\\\?\\C:\\Docs\\"),
            Some("C:\\Docs".to_string())
        );
        assert!(path_is_within_text(
            Path::new("C:\\Docs"),
            Path::new("C:\\")
        ));
        assert!(!path_is_within_text(
            Path::new("X:\\Docs"),
            Path::new("C:\\")
        ));
    }

    #[test]
    fn validates_windows_instruction_names() {
        for invalid in [
            "", "..", "CON", "con.txt", "COM1", "LPT9.log", "bad.", "bad ", "a/b", "a:b",
        ] {
            assert!(validate_instruction_name(invalid).is_err(), "{invalid}");
        }
        assert!(validate_instruction_name("Guide v2").is_ok());
        assert!(validate_instruction_name(&"a".repeat(INSTRUCTION_NAME_MAX_CHARS)).is_ok());
        assert!(validate_instruction_name(&"a".repeat(INSTRUCTION_NAME_MAX_CHARS + 1)).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn search_matches_root_parent_and_entry_names_without_reading_content() {
        let root = Path::new(r"C:\Instructions\Kickboxing");
        let path = root.join(r"Knee Drills\Warmup.md");
        assert!(path_matches_instruction_search(&path, root, "kick"));
        assert!(path_matches_instruction_search(&path, root, "knee"));
        assert!(path_matches_instruction_search(&path, root, "warmup"));
        assert!(!path_matches_instruction_search(&path, root, "contents"));
    }

    #[cfg(windows)]
    fn temp_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "life-launcher-instruction-{label}-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create temp root");
        fs::canonicalize(root).expect("canonicalize temp root")
    }

    #[cfg(windows)]
    #[test]
    fn reads_utf8_bom_and_rejects_binary_and_oversized_files() {
        let root = temp_root("read");
        let root_text = path_for_response(&root);
        let bom_path = root.join("bom.md");
        fs::write(&bom_path, [UTF8_BOM, "hello".as_bytes()].concat()).expect("write BOM file");
        let response = read_instruction_for_roots(&bom_path, std::slice::from_ref(&root_text))
            .expect("read BOM file");
        assert_eq!(response.content, "hello");

        let binary_path = root.join("binary.txt");
        fs::write(&binary_path, b"a\0b").expect("write binary file");
        assert!(
            read_instruction_for_roots(&binary_path, std::slice::from_ref(&root_text)).is_err()
        );

        let large_path = root.join("large.md");
        let large = File::create(&large_path).expect("create large file");
        large
            .set_len(INSTRUCTION_FILE_MAX_BYTES + 1)
            .expect("size large file");
        assert!(read_instruction_for_roots(&large_path, std::slice::from_ref(&root_text)).is_err());
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn reports_read_only_instruction_files() {
        let root = temp_root("read-only");
        let root_text = path_for_response(&root);
        let path = root.join("locked.md");
        fs::write(&path, "read only").expect("write file");
        let original_permissions = fs::metadata(&path).expect("metadata").permissions();
        let mut permissions = original_permissions.clone();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).expect("set read only");

        let response = read_instruction_for_roots(&path, std::slice::from_ref(&root_text))
            .expect("read instruction");
        assert!(response.read_only);

        fs::set_permissions(&path, original_permissions).expect("restore permissions");
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn reads_html_as_read_only_and_rejects_app_writes() {
        let root = temp_root("html-read-only");
        let root_text = path_for_response(&root);
        let path = root.join("guide.html");
        let content = "<!doctype html><h1>Guide</h1><script>alert('no')</script>";
        fs::write(&path, content).expect("write HTML file");

        let response = read_instruction_for_roots(&path, std::slice::from_ref(&root_text))
            .expect("read HTML instruction");
        assert_eq!(response.content, content);
        assert!(response.read_only);

        let error = write_instruction_for_roots(
            &path,
            "replacement",
            response.modified_at,
            std::slice::from_ref(&root_text),
        )
        .expect_err("HTML writes must be rejected");
        assert!(error.contains("read-only"));
        assert_eq!(fs::read_to_string(&path).expect("read original"), content);
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn allows_cloud_reparse_tags_without_allowing_links() {
        assert!(is_cloud_reparse_tag(IO_REPARSE_TAG_CLOUD));
        assert!(is_cloud_reparse_tag(0x9000_601A));
        assert!(!is_cloud_reparse_tag(0xA000_000C));
        assert!(!is_cloud_reparse_tag(0xA000_0003));
    }

    #[cfg(windows)]
    #[test]
    fn summarizes_supported_instruction_files_and_subfolders() {
        let root = temp_root("summary");
        let nested = root.join("nested");
        fs::create_dir(&nested).expect("create nested folder");
        fs::write(root.join("one.md"), "one").expect("write markdown");
        fs::write(nested.join("two.txt"), "two").expect("write text");
        fs::write(root.join("ignored.png"), "not an instruction").expect("write ignored file");

        let summary = summarize_instruction_folder(&root).expect("summarize folder");
        assert_eq!(summary.instruction_count, 2);
        assert_eq!(summary.folder_count, 1);
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn write_conflict_preserves_original_file() {
        let root = temp_root("conflict");
        let root_text = path_for_response(&root);
        let path = root.join("guide.md");
        fs::write(&path, "original").expect("write original");
        let metadata = fs::metadata(&path).expect("metadata");
        let modified = modified_at_millis(&metadata).expect("mtime");

        let error = write_instruction_for_roots(
            &path,
            "replacement",
            modified.saturating_sub(1),
            std::slice::from_ref(&root_text),
        )
        .expect_err("mtime conflict");
        assert!(error.starts_with("conflict:"));
        assert_eq!(
            fs::read_to_string(&path).expect("read original"),
            "original"
        );
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn successful_write_replaces_file_and_returns_new_metadata() {
        let root = temp_root("write");
        let root_text = path_for_response(&root);
        let path = root.join("guide.txt");
        fs::write(&path, "before").expect("write original");
        let modified = modified_at_millis(&fs::metadata(&path).expect("metadata")).expect("mtime");
        let response =
            write_instruction_for_roots(&path, "after", modified, std::slice::from_ref(&root_text))
                .expect("write instruction");
        assert_eq!(response.size, 5);
        assert_eq!(fs::read_to_string(&path).expect("read saved"), "after");
        fs::remove_dir_all(root).expect("remove temp root");
    }

    #[cfg(windows)]
    #[test]
    fn rejects_hard_linked_instruction_files() {
        let root = temp_root("hard-link-root");
        let outside = temp_root("hard-link-outside");
        let outside_path = outside.join("shared.md");
        let linked_path = root.join("linked.md");
        fs::write(&outside_path, "outside").expect("write outside file");
        fs::hard_link(&outside_path, &linked_path).expect("create hard link");

        let root_text = path_for_response(&root);
        let error = read_instruction_for_roots(&linked_path, std::slice::from_ref(&root_text))
            .expect_err("hard-linked instruction must be rejected");
        assert!(error.contains("hard links"));

        fs::remove_dir_all(root).expect("remove root");
        fs::remove_dir_all(outside).expect("remove outside");
    }

    #[cfg(windows)]
    #[test]
    fn locked_instruction_handle_blocks_external_writers() {
        let root = temp_root("write-lock");
        let path = root.join("guide.md");
        fs::write(&path, "before").expect("write original");

        let lock = open_instruction_file_handle(&path).expect("lock instruction file");
        assert!(OpenOptions::new().write(true).open(&path).is_err());
        drop(lock);
        assert!(OpenOptions::new().write(true).open(&path).is_ok());

        fs::remove_dir_all(root).expect("remove root");
    }

    #[cfg(windows)]
    #[test]
    fn searches_one_thousand_files_and_deep_long_paths_without_reading_bodies() {
        let root = temp_root("large-tree");
        for index in 0..1_000 {
            fs::write(root.join(format!("guide-{index:04}.md")), b"\0binary body")
                .expect("write instruction fixture");
        }

        let mut deep = root.clone();
        for level in 1..=14 {
            deep = deep.join(format!("level-{level:02}"));
            fs::create_dir(&deep).expect("create deep folder");
        }
        let long_name = format!("{}-needle.txt", "long-instruction-name-".repeat(5));
        fs::write(deep.join(&long_name), b"\0body must remain unread").expect("write deep fixture");

        let exact = search_instruction_files_in_roots("guide-0999", vec![root.clone()])
            .expect("search one thousand files");
        assert_eq!(exact.len(), 1);
        assert_eq!(exact[0].name, "guide-0999.md");

        let deep_result = search_instruction_files_in_roots("needle", vec![root.clone()])
            .expect("search deep long path");
        assert_eq!(deep_result.len(), 1);
        assert_eq!(deep_result[0].name, long_name);

        fs::remove_dir_all(root).expect("remove root");
    }

    #[cfg(windows)]
    #[test]
    fn rejects_symlink_in_target_chain() {
        use std::os::windows::fs::symlink_dir;

        let root = temp_root("link");
        let outside = temp_root("outside");
        fs::write(outside.join("escape.md"), "outside").expect("write outside file");
        let link = root.join("linked");
        if symlink_dir(&outside, &link).is_err() {
            let status = std::process::Command::new("cmd.exe")
                .args(["/C", "mklink", "/J"])
                .arg(&link)
                .arg(&outside)
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .expect("start junction creation");
            assert!(
                status.success(),
                "create symlink or junction for security test"
            );
        }
        let root_text = path_for_response(&root);
        assert!(validate_existing_target(
            &link.join("escape.md"),
            std::slice::from_ref(&root_text)
        )
        .is_err());
        fs::remove_dir(&link).expect("remove link");
        fs::remove_dir_all(root).expect("remove root");
        fs::remove_dir_all(outside).expect("remove outside");
    }
}
