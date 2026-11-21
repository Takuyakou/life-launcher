//! V160-B1: open an instruction ZIP as a book, one image at a time.
//!
//! Safety rules (fixed by the design):
//! - only images (JPEG/PNG/GIF/WebP) inside a `.zip` under a registered instruction root;
//! - never extract to disk, never use an entry name as a path, never open a nested ZIP;
//! - read the central directory first, then only the requested page, with size and ratio limits.

use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use zip::{CompressionMethod, ZipArchive};

use super::config::{atomic_write_bytes, config_dir_path};
use super::instructions::{
    configured_instruction_roots, path_is_within, validate_instruction_book_path,
};
use crate::datetime;

/// The webview listens for this so a `p.N` chip refreshes after the book saves.
pub const BOOK_STATE_CHANGED_EVENT: &str = "instruction-book-state-changed";

const BOOK_STATE_FILE_NAME: &str = "instruction-books.json";
const BOOK_STATE_VERSION: u8 = 1;
const MAX_BOOKS: usize = 500;
const MAX_ZIP_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_ZIP_ENTRIES: usize = 20_000;
const MAX_BOOK_PAGES: usize = 5_000;
const MAX_PAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 200;
const RATIO_MIN_BYTES: u64 = 1024 * 1024;
const DEFAULT_ZOOM_PERCENT: u16 = 100;
const ALLOWED_ZOOM_PERCENTS: [u16; 6] = [100, 125, 150, 200, 300, 400];

const PAGE_TYPE_JPEG: u8 = 1;
const PAGE_TYPE_PNG: u8 = 2;
const PAGE_TYPE_GIF: u8 = 3;
const PAGE_TYPE_WEBP: u8 = 4;

fn default_zoom_percent() -> u16 {
    DEFAULT_ZOOM_PERCENT
}

fn normalize_zoom_percent_i64(value: i64) -> u16 {
    if ALLOWED_ZOOM_PERCENTS
        .iter()
        .any(|&allowed| i64::from(allowed) == value)
    {
        value as u16
    } else {
        DEFAULT_ZOOM_PERCENT
    }
}

fn deserialize_zoom_percent<'de, D>(deserializer: D) -> Result<u16, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = serde_json::Value::deserialize(deserializer)?;
    Ok(raw
        .as_i64()
        .map(normalize_zoom_percent_i64)
        .unwrap_or(DEFAULT_ZOOM_PERCENT))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionBookOpenResponse {
    pub page_count: usize,
    pub truncated: bool,
    pub skipped_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstructionBookState {
    pub direction: String,
    pub spread: bool,
    pub cover_single: bool,
    pub last_page: u32,
    #[serde(
        default = "default_zoom_percent",
        deserialize_with = "deserialize_zoom_percent"
    )]
    pub zoom_percent: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl Default for InstructionBookState {
    fn default() -> Self {
        Self {
            direction: "rtl".to_string(),
            spread: true,
            cover_single: true,
            last_page: 1,
            zoom_percent: DEFAULT_ZOOM_PERCENT,
            updated_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BookStateFile {
    #[serde(default = "default_book_state_version")]
    version: u8,
    #[serde(default)]
    books: BTreeMap<String, InstructionBookState>,
}

fn default_book_state_version() -> u8 {
    BOOK_STATE_VERSION
}

impl Default for BookStateFile {
    fn default() -> Self {
        Self {
            version: BOOK_STATE_VERSION,
            books: BTreeMap::new(),
        }
    }
}

struct CachedBook {
    path: PathBuf,
    modified_ms: u128,
    archive: ZipArchive<File>,
    pages: Vec<usize>,
    truncated: bool,
    skipped_count: usize,
}

static BOOK_CACHE: OnceLock<Mutex<Vec<CachedBook>>> = OnceLock::new();

fn book_cache() -> &'static Mutex<Vec<CachedBook>> {
    BOOK_CACHE.get_or_init(|| Mutex::new(Vec::new()))
}

fn file_modified_ms(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
        .unwrap_or(0)
}

fn is_book_image_extension(name: &str) -> bool {
    let last = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let Some(dot) = last.rfind('.') else {
        return false;
    };
    matches!(
        last[dot + 1..].to_ascii_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "gif"
    )
}

/// One entry is pageable only when every rule in B1 holds. `size` is the declared uncompressed
/// size from the central directory; this never decompresses data.
fn page_candidate(
    name: &str,
    is_dir: bool,
    encrypted: bool,
    method: CompressionMethod,
    size: u64,
    compressed_size: u64,
) -> bool {
    if is_dir || name.is_empty() {
        return false;
    }
    let last = name.rsplit(['/', '\\']).next().unwrap_or(name);
    if last.starts_with('.') || name.contains("__MACOSX") {
        return false;
    }
    if !is_book_image_extension(name) {
        return false;
    }
    if encrypted {
        return false;
    }
    if !matches!(
        method,
        CompressionMethod::Stored | CompressionMethod::Deflated
    ) {
        return false;
    }
    if size > MAX_PAGE_BYTES {
        return false;
    }
    if size >= RATIO_MIN_BYTES
        && (compressed_size == 0 || size > compressed_size.saturating_mul(MAX_COMPRESSION_RATIO))
    {
        return false;
    }
    true
}

fn digit_run_end(bytes: &[u8], start: usize) -> usize {
    let mut end = start;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    end
}

fn trim_leading_zeroes(bytes: &[u8]) -> &[u8] {
    let mut start = 0;
    while start + 1 < bytes.len() && bytes[start] == b'0' {
        start += 1;
    }
    &bytes[start..]
}

/// Case-insensitive natural order: digit runs compare as numbers, so `2.jpg` sorts before `10.jpg`.
fn natural_compare(left: &str, right: &str) -> Ordering {
    let left = left.to_lowercase();
    let right = right.to_lowercase();
    let left = left.as_bytes();
    let right = right.as_bytes();
    let (mut i, mut j) = (0usize, 0usize);
    while i < left.len() && j < right.len() {
        let left_digit = left[i].is_ascii_digit();
        let right_digit = right[j].is_ascii_digit();
        if left_digit && right_digit {
            let left_end = digit_run_end(left, i);
            let right_end = digit_run_end(right, j);
            let left_digits = trim_leading_zeroes(&left[i..left_end]);
            let right_digits = trim_leading_zeroes(&right[j..right_end]);
            let order = left_digits
                .len()
                .cmp(&right_digits.len())
                .then_with(|| left_digits.cmp(right_digits));
            if order != Ordering::Equal {
                return order;
            }
            i = left_end;
            j = right_end;
            continue;
        }
        if left[i] != right[j] {
            return left[i].cmp(&right[j]);
        }
        i += 1;
        j += 1;
    }
    (left.len() - i).cmp(&(right.len() - j))
}

fn zip_size_allowed(size: u64) -> bool {
    size <= MAX_ZIP_BYTES
}

pub(crate) fn open_book_for_roots(
    path: &Path,
    roots: &[String],
) -> Result<(PathBuf, InstructionBookOpenResponse), String> {
    let canonical = validate_instruction_book_path(path, roots)?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| format!("failed to read {}: {error}", canonical.display()))?;
    if !zip_size_allowed(metadata.len()) {
        return Err("大きすぎて開けません(4GB まで)".to_string());
    }
    let modified_ms = file_modified_ms(&metadata);

    {
        let mut cache = book_cache()
            .lock()
            .map_err(|_| "failed to lock the ZIP book cache".to_string())?;
        if let Some(position) = cache
            .iter()
            .position(|entry| entry.path == canonical && entry.modified_ms == modified_ms)
        {
            let entry = cache.remove(position);
            let response = InstructionBookOpenResponse {
                page_count: entry.pages.len(),
                truncated: entry.truncated,
                skipped_count: entry.skipped_count,
            };
            cache.push(entry);
            return Ok((canonical, response));
        }
    }

    let file = File::open(&canonical)
        .map_err(|error| format!("failed to open {}: {error}", canonical.display()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("failed to read the ZIP central directory: {error}"))?;
    let total_entries = archive.len();
    if total_entries > MAX_ZIP_ENTRIES {
        return Err("ZIP の項目が多すぎます(20,000 まで)".to_string());
    }

    let mut candidates: Vec<(String, usize)> = Vec::new();
    for index in 0..total_entries {
        // Encrypted entries cannot even be opened without a password; they are simply skipped.
        let Ok(entry) = archive.by_index(index) else {
            continue;
        };
        let name = match entry.name() {
            Ok(name) => name.to_string(),
            Err(_) => continue,
        };
        if page_candidate(
            &name,
            entry.is_dir(),
            entry.encrypted(),
            entry.compression(),
            entry.size(),
            entry.compressed_size(),
        ) {
            candidates.push((name, index));
        }
    }
    let eligible = candidates.len();
    if eligible == 0 {
        return Err("この ZIP には開ける画像がありません".to_string());
    }
    candidates.sort_by(|left, right| {
        natural_compare(&left.0, &right.0).then_with(|| left.0.cmp(&right.0))
    });
    let truncated = eligible > MAX_BOOK_PAGES;
    let pages = candidates
        .into_iter()
        .take(MAX_BOOK_PAGES)
        .map(|(_, index)| index)
        .collect::<Vec<_>>();
    let response = InstructionBookOpenResponse {
        page_count: pages.len(),
        truncated,
        skipped_count: total_entries - eligible,
    };
    let mut cache = book_cache()
        .lock()
        .map_err(|_| "failed to lock the ZIP book cache".to_string())?;
    cache.push(CachedBook {
        path: canonical.clone(),
        modified_ms,
        archive,
        pages,
        truncated,
        skipped_count: response.skipped_count,
    });
    if cache.len() > 2 {
        cache.remove(0);
    }
    Ok((canonical, response))
}

fn detect_page_type(bytes: &[u8]) -> Option<u8> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(PAGE_TYPE_JPEG);
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(PAGE_TYPE_PNG);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(PAGE_TYPE_GIF);
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some(PAGE_TYPE_WEBP);
    }
    None
}

fn read_page_for_roots(path: &Path, index: usize, roots: &[String]) -> Result<Vec<u8>, String> {
    let canonical = validate_instruction_book_path(path, roots)?;
    let (canonical, _) = open_book_for_roots(&canonical, roots)?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| format!("failed to read {}: {error}", canonical.display()))?;
    let modified_ms = file_modified_ms(&metadata);

    let mut cache = book_cache()
        .lock()
        .map_err(|_| "failed to lock the ZIP book cache".to_string())?;
    let position = cache
        .iter()
        .position(|entry| entry.path == canonical && entry.modified_ms == modified_ms)
        .ok_or_else(|| "the ZIP book cache no longer has this file".to_string())?;
    let entry = cache.remove(position);
    let archive_index = entry.pages.get(index).copied();
    cache.push(entry);
    let position = cache.len() - 1;
    let Some(archive_index) = archive_index else {
        return Err("page index is out of range".to_string());
    };
    let mut file = cache[position]
        .archive
        .by_index(archive_index)
        .map_err(|error| format!("failed to read ZIP page: {error}"))?;
    if file.encrypted() {
        return Err("this ZIP entry is encrypted".to_string());
    }
    if !matches!(
        file.compression(),
        CompressionMethod::Stored | CompressionMethod::Deflated
    ) {
        return Err("this ZIP entry uses an unsupported compression method".to_string());
    }
    if file.size() > MAX_PAGE_BYTES {
        return Err("このページは大きすぎるため表示しません(64MB まで)".to_string());
    }
    let declared = file.size().min(MAX_PAGE_BYTES) as usize;
    let mut bytes = Vec::with_capacity(declared.saturating_add(1));
    bytes.push(0);
    file.by_ref()
        .take(MAX_PAGE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("failed to decompress ZIP page: {error}"))?;
    if bytes.len().saturating_sub(1) as u64 > MAX_PAGE_BYTES {
        return Err("このページは大きすぎるため表示しません(64MB まで)".to_string());
    }
    let page_type = detect_page_type(&bytes[1..])
        .ok_or_else(|| "このページは画像ではないため表示しません".to_string())?;
    bytes[0] = page_type;
    Ok(bytes)
}

pub(crate) fn evict_books_under_path(path: &Path) {
    if let Ok(mut cache) = book_cache().lock() {
        cache.retain(|entry| !path_is_within(&entry.path, path));
    }
}

pub(crate) fn release_all_books() {
    if let Ok(mut cache) = book_cache().lock() {
        cache.clear();
    }
}

#[tauri::command]
pub fn open_instruction_book(path: String) -> Result<InstructionBookOpenResponse, String> {
    let roots = configured_instruction_roots()?;
    let (_, response) = open_book_for_roots(Path::new(&path), &roots)?;
    Ok(response)
}

#[tauri::command]
pub fn close_instruction_book(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let target = Path::new(trimmed);
    if let Ok(canonical) = fs::canonicalize(target) {
        evict_books_under_path(&canonical);
    }
    evict_books_under_path(target);
    Ok(())
}

#[tauri::command]
pub fn release_instruction_books() -> Result<(), String> {
    release_all_books();
    Ok(())
}

#[tauri::command]
pub fn read_instruction_book_page(
    path: String,
    index: usize,
) -> Result<tauri::ipc::Response, String> {
    let roots = configured_instruction_roots()?;
    Ok(tauri::ipc::Response::new(read_page_for_roots(
        Path::new(&path),
        index,
        &roots,
    )?))
}

// --- per-book memory (instruction-books.json) ---------------------------------------------

fn state_file_path(dir: &Path) -> PathBuf {
    dir.join(BOOK_STATE_FILE_NAME)
}

fn read_state_file(dir: &Path) -> (BookStateFile, bool) {
    let path = state_file_path(dir);
    if !path.exists() {
        return (BookStateFile::default(), false);
    }
    match fs::read_to_string(&path)
        .map_err(|error| error.to_string())
        .and_then(|text| {
            serde_json::from_str::<BookStateFile>(&text).map_err(|error| error.to_string())
        }) {
        Ok(mut file) => {
            if file.version == 0 {
                file.version = BOOK_STATE_VERSION;
            }
            (file, false)
        }
        Err(_) => (BookStateFile::default(), true),
    }
}

fn write_state_file(dir: &Path, file: &BookStateFile, broken: bool) -> Result<(), String> {
    let path = state_file_path(dir);
    if broken && path.exists() {
        let stamp = datetime::format_file_stamp_nanos(datetime::now_local());
        let backup = dir.join(format!("instruction-books.broken-{stamp}.json"));
        fs::copy(&path, &backup)
            .map_err(|error| format!("failed to keep the broken book state: {error}"))?;
    }
    let mut json = serde_json::to_string_pretty(file)
        .map_err(|error| format!("failed to serialize book state: {error}"))?;
    json.push('\n');
    atomic_write_bytes(&path, json.as_bytes())
}

fn sanitize_state(mut state: InstructionBookState) -> InstructionBookState {
    if state.direction != "ltr" {
        state.direction = "rtl".to_string();
    }
    if state.last_page == 0 {
        state.last_page = 1;
    }
    if !ALLOWED_ZOOM_PERCENTS.contains(&state.zoom_percent) {
        state.zoom_percent = DEFAULT_ZOOM_PERCENT;
    }
    state
}

fn load_state_in_dir(dir: &Path, path_key: &str) -> InstructionBookState {
    let (file, _) = read_state_file(dir);
    file.books
        .get(path_key)
        .cloned()
        .map(sanitize_state)
        .unwrap_or_default()
}

fn save_state_in_dir(
    dir: &Path,
    path_key: &str,
    mut state: InstructionBookState,
    updated_at: &str,
) -> Result<InstructionBookState, String> {
    if state.direction != "rtl" && state.direction != "ltr" {
        return Err("book direction must be rtl or ltr".to_string());
    }
    state = sanitize_state(state);
    state.updated_at = Some(updated_at.to_string());
    let (mut file, broken) = read_state_file(dir);
    file.books.insert(path_key.to_string(), state.clone());
    if file.books.len() > MAX_BOOKS {
        let mut keys = file
            .books
            .iter()
            .map(|(key, value)| {
                (
                    value.updated_at.clone().unwrap_or_default(),
                    key.to_string(),
                )
            })
            .collect::<Vec<_>>();
        keys.sort();
        let remove_count = file.books.len().saturating_sub(MAX_BOOKS);
        for (_, key) in keys.into_iter().take(remove_count) {
            file.books.remove(&key);
        }
    }
    write_state_file(dir, &file, broken)?;
    Ok(state)
}

fn normalize_state_path(path: &str) -> String {
    path.replace('/', "\\").trim_end_matches('\\').to_string()
}

fn rewrite_state_key(key: &str, old_path: &str, new_path: Option<&str>) -> Option<Option<String>> {
    let key_norm = normalize_state_path(key);
    let old_norm = normalize_state_path(old_path);
    if old_norm.is_empty() {
        return None;
    }
    let key_parts: Vec<&str> = key_norm.split('\\').collect();
    let old_parts: Vec<&str> = old_norm.split('\\').collect();
    if key_parts.len() < old_parts.len()
        || !key_parts[..old_parts.len()]
            .iter()
            .zip(&old_parts)
            .all(|(left, right)| left.to_lowercase() == right.to_lowercase())
    {
        return None;
    }
    let rewritten = new_path.map(|next| {
        if key_parts.len() == old_parts.len() {
            next.to_string()
        } else {
            let next_norm = normalize_state_path(next);
            format!("{}\\{}", next_norm, key_parts[old_parts.len()..].join("\\"))
        }
    });
    Some(rewritten)
}

fn rename_state_in_dir(dir: &Path, old_path: &str, new_path: Option<&str>) {
    let (mut file, broken) = read_state_file(dir);
    let moves: Vec<(String, Option<String>)> = file
        .books
        .keys()
        .filter_map(|key| {
            rewrite_state_key(key, old_path, new_path).map(|next_key| (key.clone(), next_key))
        })
        .collect();
    if moves.is_empty() {
        return;
    }
    let mut removed = Vec::with_capacity(moves.len());
    for (old_key, next_key) in moves {
        if let Some(state) = file.books.remove(&old_key) {
            removed.push((next_key, state));
        }
    }
    for (next_key, state) in removed {
        if let Some(target_key) = next_key {
            file.books.insert(target_key, state);
        }
    }
    let _ = write_state_file(dir, &file, broken);
}

/// Called after an instruction rename/move/remove so the remembered page follows the file.
pub(crate) fn rename_instruction_book_state(old_path: &str, new_path: Option<&str>) {
    let Ok(dir) = config_dir_path() else {
        return;
    };
    rename_state_in_dir(&dir, old_path, new_path);
}

#[tauri::command]
pub fn load_instruction_book_state(path: String) -> Result<InstructionBookState, String> {
    let roots = configured_instruction_roots()?;
    let canonical = validate_instruction_book_path(Path::new(&path), &roots)?;
    let dir = config_dir_path()?;
    Ok(load_state_in_dir(
        &dir,
        &crate::commands::instructions::path_for_response(&canonical),
    ))
}

#[tauri::command]
pub fn save_instruction_book_state(
    app: AppHandle,
    path: String,
    state: InstructionBookState,
) -> Result<InstructionBookState, String> {
    let roots = configured_instruction_roots()?;
    let canonical = validate_instruction_book_path(Path::new(&path), &roots)?;
    let key = crate::commands::instructions::path_for_response(&canonical);
    let dir = config_dir_path()?;
    let updated_at = datetime::format_rfc3339_millis_utc(datetime::now_utc());
    let saved = save_state_in_dir(&dir, &key, state, &updated_at)?;
    let _ = app.emit(BOOK_STATE_CHANGED_EVENT, serde_json::json!({ "path": key }));
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0];
    const GIF: &[u8] = b"GIF89a\x01\x00\x01\x00";
    const WEBP: &[u8] = b"RIFF\x04\x00\x00\x00WEBPVP8 ";

    fn temp_root(label: &str) -> PathBuf {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "life-launcher-book-{label}-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("create temp root");
        fs::canonicalize(root).expect("canonicalize temp root")
    }

    fn make_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let cursor = Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
        for (name, data) in entries {
            writer
                .start_file(*name, SimpleFileOptions::default())
                .expect("start file");
            writer.write_all(data).expect("write file");
        }
        writer.finish().expect("finish zip").into_inner()
    }

    fn make_zip_with_options(entries: &[(&str, &[u8], SimpleFileOptions)]) -> Vec<u8> {
        let cursor = Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
        for (name, data, options) in entries {
            writer.start_file(*name, *options).expect("start file");
            writer.write_all(data).expect("write file");
        }
        writer.finish().expect("finish zip").into_inner()
    }

    /// OR the encryption bit (general purpose flag bit 0) into both headers.
    fn mark_encrypted(bytes: &mut [u8]) {
        let mut index = 0;
        while index + 10 <= bytes.len() {
            if &bytes[index..index + 4] == b"PK\x03\x04" {
                let flags = u16::from_le_bytes([bytes[index + 6], bytes[index + 7]]) | 1;
                bytes[index + 6..index + 8].copy_from_slice(&flags.to_le_bytes());
            } else if &bytes[index..index + 4] == b"PK\x01\x02" {
                let flags = u16::from_le_bytes([bytes[index + 8], bytes[index + 9]]) | 1;
                bytes[index + 8..index + 10].copy_from_slice(&flags.to_le_bytes());
            }
            index += 1;
        }
    }

    /// Replace the compression method with 12 (Bzip2) in both headers.
    fn mark_unsupported_compression(bytes: &mut [u8]) {
        let mut index = 0;
        while index + 12 <= bytes.len() {
            if &bytes[index..index + 4] == b"PK\x03\x04" {
                bytes[index + 8..index + 10].copy_from_slice(&12u16.to_le_bytes());
            } else if &bytes[index..index + 4] == b"PK\x01\x02" {
                bytes[index + 10..index + 12].copy_from_slice(&12u16.to_le_bytes());
            }
            index += 1;
        }
    }

    fn write_book_file(root: &Path, name: &str, bytes: &[u8]) -> PathBuf {
        let path = root.join(name);
        fs::write(&path, bytes).expect("write zip");
        path
    }

    fn roots_for(root: &Path) -> Vec<String> {
        vec![root.to_string_lossy().to_string()]
    }

    fn test_cache_guard() -> std::sync::MutexGuard<'static, ()> {
        static TEST_CACHE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        TEST_CACHE_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn cached_book_count() -> usize {
        book_cache().lock().map(|cache| cache.len()).unwrap_or(0)
    }

    fn is_book_cached(path: &Path) -> bool {
        let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        book_cache()
            .lock()
            .map(|cache| {
                cache
                    .iter()
                    .any(|entry| path_is_within(&entry.path, &canonical) && entry.path == canonical)
            })
            .unwrap_or(false)
    }

    #[test]
    fn natural_order_compares_numbers_and_ignores_case() {
        let mut names = vec!["10.jpg", "2.jpg", "1.JPG", "A.jpg"];
        names.sort_by(|left, right| natural_compare(left, right));
        assert_eq!(names, vec!["1.JPG", "2.jpg", "10.jpg", "A.jpg"]);
        assert_eq!(natural_compare("2.jpg", "02.jpg"), Ordering::Equal);
    }

    #[test]
    fn page_filter_applies_every_rule() {
        let stored = CompressionMethod::Stored;
        assert!(zip_size_allowed(MAX_ZIP_BYTES));
        assert!(!zip_size_allowed(MAX_ZIP_BYTES + 1));
        assert!(page_candidate("a.jpg", false, false, stored, 10, 10));
        assert!(page_candidate("dir/a.JPEG", false, false, stored, 10, 10));
        assert!(!page_candidate("a.svg", false, false, stored, 10, 10));
        assert!(!page_candidate("a.jpg", true, false, stored, 10, 10));
        assert!(!page_candidate(".__a.jpg", false, false, stored, 10, 10));
        assert!(!page_candidate(
            "__MACOSX/._a.jpg",
            false,
            false,
            stored,
            10,
            10
        ));
        assert!(!page_candidate("a.jpg", false, true, stored, 10, 10));
        assert!(!page_candidate(
            "a.jpg",
            false,
            false,
            CompressionMethod::BZIP2,
            10,
            10
        ));
        assert!(!page_candidate(
            "a.jpg",
            false,
            false,
            stored,
            MAX_PAGE_BYTES + 1,
            10
        ));
        assert!(page_candidate(
            "a.jpg",
            false,
            false,
            stored,
            MAX_PAGE_BYTES,
            MAX_PAGE_BYTES / 4
        ));
        assert!(page_candidate(
            "a.jpg",
            false,
            false,
            stored,
            RATIO_MIN_BYTES - 1,
            1
        ));
        assert!(!page_candidate(
            "a.jpg",
            false,
            false,
            stored,
            RATIO_MIN_BYTES,
            1
        ));
        assert!(!page_candidate(
            "a.jpg",
            false,
            false,
            stored,
            RATIO_MIN_BYTES * 10,
            0
        ));
    }

    #[test]
    fn opens_only_images_and_reports_skipped_items() {
        let _guard = test_cache_guard();
        let root = temp_root("open");
        let path = write_book_file(
            &root,
            "book.zip",
            &make_zip(&[
                ("1.jpg", JPEG),
                ("2.png", PNG),
                ("10.gif", GIF),
                ("11.webp", WEBP),
                ("notes.txt", b"text"),
                ("nested.zip", b"PK\x03\x04"),
                ("__MACOSX/._1.jpg", JPEG),
                (".hidden.jpg", JPEG),
                ("folder/", b""),
            ]),
        );
        let (_, response) = open_book_for_roots(&path, &roots_for(&root)).expect("open book");
        assert_eq!(response.page_count, 4);
        assert!(!response.truncated);
        assert_eq!(response.skipped_count, 5);
    }

    #[test]
    fn rejects_a_zip_without_images() {
        let root = temp_root("empty");
        let path = write_book_file(&root, "book.zip", &make_zip(&[("a.txt", b"text")]));
        let error = open_book_for_roots(&path, &roots_for(&root)).expect_err("must reject");
        assert_eq!(error, "この ZIP には開ける画像がありません");
    }

    #[test]
    fn rejects_a_file_outside_the_instruction_roots() {
        let root = temp_root("inside");
        let outside = temp_root("outside");
        let path = write_book_file(&outside, "book.zip", &make_zip(&[("1.jpg", JPEG)]));
        open_book_for_roots(&path, &roots_for(&root)).expect_err("outside root must be rejected");
    }

    #[test]
    fn rejects_encrypted_and_unsupported_compression_entries() {
        let root = temp_root("flags");
        let mut encrypted = make_zip(&[("1.jpg", JPEG)]);
        mark_encrypted(&mut encrypted);
        let encrypted_path = write_book_file(&root, "encrypted.zip", &encrypted);
        let error = open_book_for_roots(&encrypted_path, &roots_for(&root)).expect_err("encrypted");
        assert_eq!(error, "この ZIP には開ける画像がありません");

        let mut bzip2 = make_zip(&[("1.jpg", JPEG)]);
        mark_unsupported_compression(&mut bzip2);
        let bzip2_path = write_book_file(&root, "bzip2.zip", &bzip2);
        let error = open_book_for_roots(&bzip2_path, &roots_for(&root)).expect_err("bzip2");
        assert_eq!(error, "この ZIP には開ける画像がありません");
    }

    #[test]
    fn reads_the_requested_page_and_decides_the_type_from_the_head() {
        let _guard = test_cache_guard();
        let root = temp_root("read");
        let path = write_book_file(
            &root,
            "book.zip",
            &make_zip(&[
                ("1.jpg", PNG),
                ("2.jpg", b"not an image at all"),
                ("3.gif", GIF),
                ("4.webp", WEBP),
            ]),
        );
        let roots = roots_for(&root);
        let (_, response) = open_book_for_roots(&path, &roots).expect("open book");
        assert_eq!(response.page_count, 4);

        let first = read_page_for_roots(&path, 0, &roots).expect("read first page");
        assert_eq!(first[0], PAGE_TYPE_PNG);
        assert_eq!(&first[1..], PNG);

        let error = read_page_for_roots(&path, 1, &roots).expect_err("fake jpg");
        assert_eq!(error, "このページは画像ではないため表示しません");
        assert_eq!(
            read_page_for_roots(&path, 2, &roots).expect("read gif")[0],
            PAGE_TYPE_GIF
        );
        assert_eq!(
            read_page_for_roots(&path, 3, &roots).expect("read webp")[0],
            PAGE_TYPE_WEBP
        );
        assert!(read_page_for_roots(&path, 4, &roots).is_err());
    }

    #[test]
    fn deflated_pages_are_read_normally() {
        let _guard = test_cache_guard();
        let root = temp_root("deflate");
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let path = write_book_file(
            &root,
            "book.zip",
            &make_zip_with_options(&[("1.jpg", JPEG, options)]),
        );
        let roots = roots_for(&root);
        let (_, response) = open_book_for_roots(&path, &roots).expect("open book");
        assert_eq!(response.page_count, 1);
        assert_eq!(
            read_page_for_roots(&path, 0, &roots).expect("read page")[0],
            PAGE_TYPE_JPEG
        );
    }

    #[test]
    fn truncates_after_five_thousand_pages() {
        let _guard = test_cache_guard();
        let root = temp_root("truncated");
        let entries = (0..MAX_BOOK_PAGES + 5)
            .map(|index| (format!("{index:05}.png"), PNG))
            .collect::<Vec<_>>();
        let borrowed = entries
            .iter()
            .map(|(name, data)| (name.as_str(), *data))
            .collect::<Vec<_>>();
        let path = write_book_file(&root, "book.zip", &make_zip(&borrowed));
        let (_, response) = open_book_for_roots(&path, &roots_for(&root)).expect("open book");
        assert_eq!(response.page_count, MAX_BOOK_PAGES);
        assert!(response.truncated);
    }

    #[test]
    fn rejects_more_than_twenty_thousand_entries() {
        let root = temp_root("too-many");
        let entries = (0..MAX_ZIP_ENTRIES + 1)
            .map(|index| (format!("{index:06}.txt"), b"".as_slice()))
            .collect::<Vec<_>>();
        let borrowed = entries
            .iter()
            .map(|(name, data)| (name.as_str(), *data))
            .collect::<Vec<_>>();
        let path = write_book_file(&root, "book.zip", &make_zip(&borrowed));
        let error = open_book_for_roots(&path, &roots_for(&root)).expect_err("too many entries");
        assert_eq!(error, "ZIP の項目が多すぎます(20,000 まで)");
    }

    #[test]
    fn book_state_defaults_save_load_and_rename() {
        let dir = temp_root("state");
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\a.zip"),
            InstructionBookState::default()
        );
        let saved = save_state_in_dir(
            &dir,
            "C:\\Books\\a.zip",
            InstructionBookState {
                direction: "ltr".to_string(),
                spread: false,
                cover_single: false,
                last_page: 34,
                zoom_percent: 200,
                updated_at: None,
            },
            "2026-11-21T02:00:00.000Z",
        )
        .expect("save state");
        assert_eq!(saved.last_page, 34);
        assert_eq!(saved.zoom_percent, 200);
        let loaded = load_state_in_dir(&dir, "C:\\Books\\a.zip");
        assert_eq!(loaded.direction, "ltr");
        assert!(!loaded.spread);
        assert!(!loaded.cover_single);
        assert_eq!(loaded.last_page, 34);
        assert_eq!(loaded.zoom_percent, 200);

        rename_state_in_dir(&dir, "C:\\Books\\a.zip", Some("C:\\Books\\b.zip"));
        assert_eq!(load_state_in_dir(&dir, "C:\\Books\\b.zip").last_page, 34);
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\a.zip"),
            InstructionBookState::default()
        );
        rename_state_in_dir(&dir, "C:\\Books\\b.zip", None);
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\b.zip"),
            InstructionBookState::default()
        );
    }

    #[test]
    fn folder_rename_migrates_child_book_states_only() {
        let dir = temp_root("state-folder-rename");
        let first = "C:\\Books\\教材\\book1.zip";
        let nested = "C:\\Books\\教材\\sub\\book2.zip";
        let similar = "C:\\Books\\教材2\\other.zip";
        for (path, page) in [(first, 12), (nested, 48), (similar, 77)] {
            save_state_in_dir(
                &dir,
                path,
                InstructionBookState {
                    direction: "rtl".to_string(),
                    spread: true,
                    cover_single: true,
                    last_page: page,
                    zoom_percent: 150,
                    updated_at: None,
                },
                "2026-11-21T02:00:00.000Z",
            )
            .expect("save state");
        }

        rename_state_in_dir(&dir, "c:\\books\\教材", Some("C:\\Books\\教材-renamed"));

        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\教材-renamed\\book1.zip").last_page,
            12
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\教材-renamed\\sub\\book2.zip").last_page,
            48
        );
        assert_eq!(
            load_state_in_dir(&dir, first),
            InstructionBookState::default()
        );
        assert_eq!(
            load_state_in_dir(&dir, nested),
            InstructionBookState::default()
        );
        assert_eq!(load_state_in_dir(&dir, similar).last_page, 77);
    }

    #[test]
    fn book_state_keeps_the_latest_five_hundred() {
        let dir = temp_root("state-prune");
        for index in 0..MAX_BOOKS {
            save_state_in_dir(
                &dir,
                &format!("C:\\Books\\{index}.zip"),
                InstructionBookState::default(),
                &format!("2026-11-20T00:{:02}:00.000Z", index % 60),
            )
            .expect("save state");
        }
        save_state_in_dir(
            &dir,
            "C:\\Books\\newest.zip",
            InstructionBookState::default(),
            "2026-11-21T02:00:00.000Z",
        )
        .expect("save newest");
        let (file, broken) = read_state_file(&dir);
        assert!(!broken);
        assert_eq!(file.books.len(), MAX_BOOKS);
        assert!(file.books.contains_key("C:\\Books\\newest.zip"));
        assert!(!file.books.contains_key("C:\\Books\\0.zip"));
    }

    #[test]
    fn broken_state_is_kept_before_overwriting() {
        let dir = temp_root("state-broken");
        fs::write(state_file_path(&dir), b"{ not json").expect("write broken state");
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\a.zip"),
            InstructionBookState::default()
        );
        save_state_in_dir(
            &dir,
            "C:\\Books\\a.zip",
            InstructionBookState::default(),
            "2026-11-21T02:00:00.000Z",
        )
        .expect("save over broken state");
        let broken = fs::read_dir(&dir)
            .expect("read dir")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("instruction-books.broken-")
            })
            .count();
        assert_eq!(broken, 1);
    }

    #[test]
    fn close_instruction_book_evicts_only_that_book() {
        let _guard = test_cache_guard();
        release_all_books();
        let root = temp_root("close-one");
        let a = write_book_file(&root, "a.zip", &make_zip(&[("1.jpg", JPEG)]));
        let b = write_book_file(&root, "b.zip", &make_zip(&[("1.jpg", PNG)]));
        let roots = roots_for(&root);
        open_book_for_roots(&a, &roots).expect("open a");
        open_book_for_roots(&b, &roots).expect("open b");
        assert!(is_book_cached(&a));
        assert!(is_book_cached(&b));

        close_instruction_book(a.to_string_lossy().to_string()).expect("close a");
        assert!(!is_book_cached(&a));
        assert!(is_book_cached(&b));
        release_all_books();
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn release_instruction_books_clears_every_cached_book() {
        let _guard = test_cache_guard();
        release_all_books();
        let root = temp_root("release-all");
        let a = write_book_file(&root, "a.zip", &make_zip(&[("1.jpg", JPEG)]));
        let b = write_book_file(&root, "b.zip", &make_zip(&[("1.jpg", PNG)]));
        let roots = roots_for(&root);
        open_book_for_roots(&a, &roots).expect("open a");
        open_book_for_roots(&b, &roots).expect("open b");
        assert_eq!(cached_book_count(), 2);

        release_instruction_books().expect("release all");
        assert_eq!(cached_book_count(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn renaming_instruction_file_or_folder_evicts_cached_books() {
        let _guard = test_cache_guard();
        release_all_books();
        let root = temp_root("rename-evict");
        let folder = root.join("教材");
        fs::create_dir_all(&folder).expect("create folder");
        let sub = write_book_file(&folder, "sub.zip", &make_zip(&[("1.jpg", JPEG)]));
        let top = write_book_file(&root, "top.zip", &make_zip(&[("1.jpg", PNG)]));
        let roots = roots_for(&root);
        open_book_for_roots(&sub, &roots).expect("open sub");
        open_book_for_roots(&top, &roots).expect("open top");
        assert!(is_book_cached(&sub));
        assert!(is_book_cached(&top));

        super::super::instructions::rename_instruction_for_roots(&folder, "教材-new", true, &roots)
            .expect("rename folder");
        assert!(!is_book_cached(&sub));
        assert!(is_book_cached(&top));

        super::super::instructions::rename_instruction_for_roots(&top, "top-new", false, &roots)
            .expect("rename file");
        assert!(!is_book_cached(&top));
        assert_eq!(cached_book_count(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn zoom_percent_defaults_and_sanitizes_invalid_values() {
        let dir = temp_root("state-zoom");
        let write_cases = r#"{
  "version": 1,
  "books": {
    "C:\\Books\\legacy.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 5 },
    "C:\\Books\\z175.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 1, "zoomPercent": 175 },
    "C:\\Books\\z0.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 1, "zoomPercent": 0 },
    "C:\\Books\\zneg.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 1, "zoomPercent": -5 },
    "C:\\Books\\z1000.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 1, "zoomPercent": 1000 },
    "C:\\Books\\z200.zip": { "direction": "rtl", "spread": true, "coverSingle": true, "lastPage": 1, "zoomPercent": 200 }
  }
}"#;
        fs::write(state_file_path(&dir), write_cases).expect("write cases");
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\legacy.zip").zoom_percent,
            100
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\z175.zip").zoom_percent,
            100
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\z0.zip").zoom_percent,
            100
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\zneg.zip").zoom_percent,
            100
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\z1000.zip").zoom_percent,
            100
        );
        assert_eq!(
            load_state_in_dir(&dir, "C:\\Books\\z200.zip").zoom_percent,
            200
        );

        let sanitized = sanitize_state(InstructionBookState {
            direction: "rtl".to_string(),
            spread: true,
            cover_single: true,
            last_page: 1,
            zoom_percent: 175,
            updated_at: None,
        });
        assert_eq!(sanitized.zoom_percent, 100);
        let _ = fs::remove_dir_all(dir);
    }
}
