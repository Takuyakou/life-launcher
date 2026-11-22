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
