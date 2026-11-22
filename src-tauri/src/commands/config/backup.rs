use std::collections::HashSet;
use std::fs;
use std::io::Write;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::Value;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{ReplaceFileW, REPLACE_FILE_FLAGS};
#[cfg(windows)]
use windows_core::PCWSTR;

use super::{
    backups_path, config_dir_path, ensure_config_schema_file, CONFIG_FILE_NAME,
    CONFIG_SCHEMA_FILE_NAME,
};
use crate::datetime;
use crate::models::AppConfig;

pub(super) const ICON_CACHE_DIR_NAME: &str = "icons";
const ICON_BACKUP_PREFIX: &str = "icons/";
pub(super) const BACKUP_KEEP_COUNT: usize = 5;
pub(super) const DAILY_BACKUP_PREFIX: &str = "lifelauncher-backup-";
pub(super) const DAILY_BACKUP_SUFFIX: &str = ".zip";
pub(crate) const RUNTIME_BACKUP_FILES: [&str; 4] = [
    CONFIG_FILE_NAME,
    "sessions.jsonl",
    "notes.json",
    CONFIG_SCHEMA_FILE_NAME,
];
pub(super) static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn unique_temp_path(path: &Path, purpose: &str) -> PathBuf {
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("life-launcher");
    path.with_file_name(format!(
        ".{file_name}.{}.{}.{}.tmp",
        std::process::id(),
        sequence,
        purpose
    ))
}

pub(super) fn write_bytes_atomically(
    path: &Path,
    bytes: &[u8],
    purpose: &str,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = unique_temp_path(path, purpose);
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| format!("failed to create {}: {error}", temp_path.display()))?;
        file.write_all(bytes)
            .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;
        file.sync_all()
            .map_err(|error| format!("failed to flush {}: {error}", temp_path.display()))?;
        drop(file);

        if path.exists() {
            replace_file_atomically(path, &temp_path)
        } else {
            fs::rename(&temp_path, path).map_err(|error| {
                format!(
                    "failed to rename {} to {}: {error}",
                    temp_path.display(),
                    path.display()
                )
            })
        }
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[cfg(windows)]
pub(super) fn replace_file_atomically(
    destination: &Path,
    replacement: &Path,
) -> Result<(), String> {
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
        .map_err(|error| {
            format!(
                "failed to atomically replace {}: {error}",
                destination.display()
            )
        })
    }
}

#[cfg(not(windows))]
pub(super) fn replace_file_atomically(
    destination: &Path,
    replacement: &Path,
) -> Result<(), String> {
    fs::rename(replacement, destination).map_err(|error| {
        format!(
            "failed to atomically replace {}: {error}",
            destination.display()
        )
    })
}

pub fn write_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("failed to serialize config: {error}"))?;
    write_bytes_atomically(path, json.as_bytes(), "config")
}

pub(crate) fn backup_existing_config(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let backup_dir = backups_path()?;
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("failed to create {}: {error}", backup_dir.display()))?;

    let timestamp = datetime::format_file_stamp_nanos(datetime::now_local());
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

pub(super) fn daily_backup(config: &AppConfig) -> Result<Option<PathBuf>, String> {
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

    let date_key = datetime::today_date(config.settings.day_start_hour);
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

pub(crate) fn create_forced_user_backup(config: &AppConfig) -> Result<PathBuf, String> {
    let folder = config
        .settings
        .backup_folder
        .as_ref()
        .ok_or_else(|| "backup folder is not configured".to_string())?;
    let backup_dir = PathBuf::from(folder);
    if !backup_dir.is_dir() {
        return Err(format!(
            "backup folder does not exist or is not a directory: {}",
            backup_dir.display()
        ));
    }

    ensure_config_schema_file()?;
    let entries = daily_backup_entries()?;
    let timestamp = datetime::format_file_stamp_nanos(datetime::now_local());
    let mut backup_path = backup_dir.join(format!(
        "{DAILY_BACKUP_PREFIX}{timestamp}{DAILY_BACKUP_SUFFIX}"
    ));
    let mut collision = 0u16;
    while backup_path.exists() {
        collision = collision.saturating_add(1);
        backup_path = backup_dir.join(format!(
            "{DAILY_BACKUP_PREFIX}{timestamp}-{collision}{DAILY_BACKUP_SUFFIX}"
        ));
    }
    write_zip(&backup_path, &entries)?;

    let written = fs::read(&backup_path)
        .map_err(|error| format!("failed to verify {}: {error}", backup_path.display()))?;
    let verified = read_zip(&written)?;
    if verified.len() != entries.len()
        || entries.iter().any(|expected| {
            verified
                .iter()
                .find(|entry| entry.name == expected.name)
                .is_none_or(|entry| entry.data != expected.data)
        })
    {
        return Err(format!(
            "backup validation failed: {}",
            backup_path.display()
        ));
    }
    Ok(backup_path)
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
    let icons_dir = data_dir.join(ICON_CACHE_DIR_NAME);
    if icons_dir.is_dir() {
        let mut icon_paths = fs::read_dir(&icons_dir)
            .map_err(|error| format!("failed to read {}: {error}", icons_dir.display()))?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        icon_paths.sort();
        for path in icon_paths {
            let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            let entry_name = format!("{ICON_BACKUP_PREFIX}{file_name}");
            if icon_backup_file_name(&entry_name).is_none() {
                continue;
            }
            let data = fs::read(&path)
                .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
            entries.push(ZipEntry {
                name: entry_name,
                data,
            });
        }
    }
    Ok(entries)
}

pub(super) fn icon_backup_file_name(entry_name: &str) -> Option<&str> {
    let file_name = entry_name.strip_prefix(ICON_BACKUP_PREFIX)?;
    let stem = file_name.strip_suffix(".png")?;
    if stem.is_empty()
        || !stem
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return None;
    }
    Some(file_name)
}

pub(super) fn restore_backup_from_path(zip_path: &PathBuf) -> Result<PathBuf, String> {
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
    for entry in entries
        .iter()
        .filter(|entry| icon_backup_file_name(&entry.name).is_some())
    {
        if !entry.data.starts_with(b"\x89PNG\r\n\x1a\n") {
            return Err(format!("backup icon is not a PNG file: {}", entry.name));
        }
    }

    let data_dir = config_dir_path()?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create {}: {error}", data_dir.display()))?;
    let pre_restore_dir = backups_path()?.join(format!(
        "pre-restore-{}",
        datetime::format_file_stamp_nanos(datetime::now_local())
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
    let current_icons_dir = data_dir.join(ICON_CACHE_DIR_NAME);
    if current_icons_dir.is_dir() {
        let retreat_icons_dir = pre_restore_dir.join(ICON_CACHE_DIR_NAME);
        fs::create_dir_all(&retreat_icons_dir).map_err(|error| {
            format!(
                "failed to create pre-restore icon backup {}: {error}",
                retreat_icons_dir.display()
            )
        })?;
        for entry in fs::read_dir(&current_icons_dir)
            .map_err(|error| format!("failed to read {}: {error}", current_icons_dir.display()))?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        {
            let file_name = entry.file_name();
            let entry_name = format!("{ICON_BACKUP_PREFIX}{}", file_name.to_string_lossy());
            if icon_backup_file_name(&entry_name).is_some() {
                fs::copy(entry.path(), retreat_icons_dir.join(file_name)).map_err(|error| {
                    format!(
                        "failed to retreat icon cache {}: {error}",
                        entry.path().display()
                    )
                })?;
            }
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
    let restored_icons = entries
        .iter()
        .filter_map(|entry| icon_backup_file_name(&entry.name).map(|name| (name, &entry.data)))
        .collect::<Vec<_>>();
    if !restored_icons.is_empty() {
        if current_icons_dir.exists() {
            fs::remove_dir_all(&current_icons_dir).map_err(|error| {
                format!(
                    "failed to replace icon cache {}: {error}",
                    current_icons_dir.display()
                )
            })?;
        }
        fs::create_dir_all(&current_icons_dir).map_err(|error| {
            format!("failed to create {}: {error}", current_icons_dir.display())
        })?;
        for (file_name, data) in restored_icons {
            atomic_write_bytes(&current_icons_dir.join(file_name), data)?;
        }
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

pub(super) fn prune_config_backups(backup_dir: &PathBuf) -> Result<(), String> {
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

pub(crate) struct ZipEntry {
    pub(crate) name: String,
    pub(crate) data: Vec<u8>,
}

struct CentralDirectoryEntry {
    name: String,
    crc32: u32,
    size: u32,
    offset: u32,
}

pub(crate) fn write_zip(path: &Path, entries: &[ZipEntry]) -> Result<(), String> {
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

    write_bytes_atomically(path, &bytes, "backup")
}

pub(crate) fn read_zip(bytes: &[u8]) -> Result<Vec<ZipEntry>, String> {
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
    let mut entry_names = HashSet::new();
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
        if !RUNTIME_BACKUP_FILES.contains(&name.as_str()) && icon_backup_file_name(&name).is_none()
        {
            return Err(format!("backup ZIP contains unexpected entry: {name}"));
        }
        if !entry_names.insert(name.clone()) {
            return Err(format!("backup ZIP contains duplicate entry: {name}"));
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

pub(crate) fn atomic_write_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    write_bytes_atomically(path, bytes, "restore")
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
