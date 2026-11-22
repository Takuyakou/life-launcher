//! V160-B1: open an instruction ZIP as a book, one image at a time.
//!
//! Safety rules (fixed by the design):
//! - only images (JPEG/PNG/GIF/WebP) inside a `.zip` under a registered instruction root;
//! - never extract to disk, never use an entry name as a path, never open a nested ZIP;
//! - read the central directory first, then only the requested page, with size and ratio limits.

#[cfg(test)]
mod tests;

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

#[tauri::command(async)]
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
