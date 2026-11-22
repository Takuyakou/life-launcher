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
    assert!(read_instruction_for_roots(&binary_path, std::slice::from_ref(&root_text)).is_err());

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
    assert!(
        validate_existing_target(&link.join("escape.md"), std::slice::from_ref(&root_text))
            .is_err()
    );
    fs::remove_dir(&link).expect("remove link");
    fs::remove_dir_all(root).expect("remove root");
    fs::remove_dir_all(outside).expect("remove outside");
}

#[cfg(windows)]
#[test]
fn reads_mhtml_as_bytes_and_rejects_writes() {
    let root = temp_root("mhtml");
    let root_text = path_for_response(&root);
    let path = root.join("page.mhtml");
    let content =
        b"From: <Saved by Blink>\r\nContent-Type: multipart/related; boundary=\"b\"\r\n\r\n--b--\r\n";
    fs::write(&path, content).expect("write mhtml");

    let info = instruction_file_info_for_roots(&path, std::slice::from_ref(&root_text))
        .expect("mhtml info");
    assert_eq!(info.name, "page.mhtml");
    assert!(info.read_only);
    assert_eq!(info.size, content.len() as u64);

    let bytes = read_mhtml_bytes_for_roots(&path, std::slice::from_ref(&root_text))
        .expect("read mhtml bytes");
    assert_eq!(bytes, content);
    assert!(read_instruction_for_roots(&path, std::slice::from_ref(&root_text)).is_err());

    // MHTML is not required to be UTF-8 or NUL-free; it is decoded by the webview.
    let binary = root.join("binary.mhtml");
    let binary_content = [0x00_u8, 0xff, 0xfe, b'a'];
    fs::write(&binary, binary_content).expect("write binary mhtml");
    assert_eq!(
        read_mhtml_bytes_for_roots(&binary, std::slice::from_ref(&root_text))
            .expect("read binary mhtml"),
        binary_content
    );

    let error = write_instruction_for_roots(
        &path,
        "replacement",
        info.modified_at,
        std::slice::from_ref(&root_text),
    )
    .expect_err("MHTML writes must be rejected");
    assert!(error.contains("read-only"));
    assert_eq!(fs::read(&path).expect("read original"), content);

    let entry = entry_from_metadata(&path, &fs::symlink_metadata(&path).expect("metadata"))
        .expect("mhtml entry");
    assert_eq!(entry.extension.as_deref(), Some("mhtml"));

    for name in ["PAGE.MHTML", "page.mht"] {
        let variant = root.join(name);
        fs::write(&variant, content).expect("write mhtml variant");
        assert!(
            instruction_file_info_for_roots(&variant, std::slice::from_ref(&root_text))
                .expect("variant info")
                .read_only
        );
    }

    fs::remove_dir_all(root).expect("remove temp root");
}

#[cfg(windows)]
#[test]
fn mhtml_read_uses_the_20_mib_limit() {
    let root = temp_root("mhtml-large");
    let root_text = path_for_response(&root);
    let path = root.join("large.mhtml");
    let file = File::create(&path).expect("create large mhtml");
    file.set_len(INSTRUCTION_MHTML_MAX_BYTES + 1)
        .expect("size large mhtml");
    drop(file);
    let error = read_mhtml_bytes_for_roots(&path, std::slice::from_ref(&root_text))
        .expect_err("over the 20 MiB limit");
    assert!(error.contains("20 MiB"));

    // The normal 2 MiB limit does not apply to MHTML.
    let above_normal_limit = root.join("above-normal.mhtml");
    fs::write(
        &above_normal_limit,
        vec![b'a'; (INSTRUCTION_FILE_MAX_BYTES + 16) as usize],
    )
    .expect("write above the normal limit");
    assert!(
        read_mhtml_bytes_for_roots(&above_normal_limit, std::slice::from_ref(&root_text)).is_ok()
    );

    fs::remove_dir_all(root).expect("remove temp root");
}

#[cfg(windows)]
#[test]
fn rejects_mhtml_outside_registered_roots_and_through_links() {
    use std::os::windows::fs::symlink_dir;

    let root = temp_root("mhtml-scope");
    let outside = temp_root("mhtml-scope-outside");
    let root_text = path_for_response(&root);
    let outside_file = outside.join("escape.mhtml");
    fs::write(&outside_file, "outside").expect("write outside mhtml");
    assert!(read_mhtml_bytes_for_roots(&outside_file, std::slice::from_ref(&root_text)).is_err());

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
    assert!(read_mhtml_bytes_for_roots(
        &link.join("escape.mhtml"),
        std::slice::from_ref(&root_text)
    )
    .is_err());
    fs::remove_dir(&link).expect("remove link");
    fs::remove_dir_all(root).expect("remove root");
    fs::remove_dir_all(outside).expect("remove outside");
}
