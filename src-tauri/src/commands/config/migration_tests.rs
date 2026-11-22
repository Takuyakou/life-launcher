use super::backup::TEMP_FILE_SEQUENCE;
use super::*;
use crate::models::{sample_config, Action, LauncherButton};
use std::sync::atomic::Ordering;

fn v2_config_value() -> Value {
    let mut source = serde_json::to_value(sample_config()).expect("sample config");
    source["version"] = Value::from(2);
    source["projects"] = serde_json::json!([
        {
            "id": "compose",
            "name": "サンプル学習",
            "northStar": "小さく学び続ける",
            "weeklyFocus": true,
            "nextStep": "資料を1ページ読む",
            "nextStepTrigger": "PCを開いたら",
            "nextStepUpdatedAt": "2026-07-01T00:00:00Z",
            "nextStepReviewedAt": "2026-07-02T00:00:00Z",
            "buttonIds": ["music-web"],
            "defaultTimerMinutes": 36,
            "shortTimerMinutes": 5,
            "startNoteTemplate": "前回の続き",
            "colorId": "green",
            "instructionPath": "C:\\Manuals\\compose.html",
            "instructionOpenOnStart": true
        },
        {
            "id": "writing",
            "name": "文章",
            "weeklyFocus": false,
            "nextStep": "",
            "buttonId": "documents",
            "shortTimerMinutes": 7,
            "colorId": "blue"
        }
    ]);
    source
}

#[test]
fn config_v2_to_v3_value_migration_is_idempotent_and_preserves_snapshots() {
    let source = v2_config_value();
    let expected_today = source["today"].clone();
    let expected_inbox = source["inbox"].clone();

    let (migrated, changed) = migrate_config_value_to_v3(&source).expect("migrate v2");
    assert!(changed);
    assert_eq!(migrated["version"], 3);
    assert_eq!(migrated["today"], expected_today);
    assert_eq!(migrated["inbox"], expected_inbox);
    assert_eq!(
        migrated["projects"][0]["nextStep"]["text"],
        "資料を1ページ読む"
    );
    assert_eq!(
        migrated["projects"][1]["legacyNextStepSettings"]["buttonIds"][0],
        "documents"
    );
    assert!(migrated["projects"][1].get("nextStep").is_none());

    let (again, changed_again) = migrate_config_value_to_v3(&migrated).expect("accept v3");
    assert!(!changed_again);
    assert_eq!(again, migrated);

    let (first, migrated) = decode_config_for_v3(&source).expect("decode v2");
    assert!(migrated);
    assert_eq!(first.version, 3);
    let written = serde_json::to_value(&first).expect("serialize v3");
    let (second, migrated_again) = decode_config_for_v3(&written).expect("decode v3");
    assert!(!migrated_again);
    assert_eq!(serde_json::to_value(second).unwrap(), written);
}

#[test]
fn config_migration_rejects_future_version_and_invalid_project_collection() {
    let mut future = serde_json::to_value(sample_config()).unwrap();
    future["version"] = Value::from(99);
    assert!(migrate_config_value_to_v3(&future)
        .expect_err("future version must fail")
        .contains("newer"));

    let mut invalid = v2_config_value();
    invalid["projects"][0]["name"] = Value::Null;
    assert!(migrate_config_value_to_v3(&invalid)
        .expect_err("invalid projects must fail")
        .contains("migration was not attempted"));
}

#[test]
fn config_v3_decoder_rejects_non_object_root_without_panicking() {
    let error =
        decode_config_for_v3(&serde_json::json!([])).expect_err("array root must be rejected");
    assert!(error.contains("version") || error.contains("root"));
}

fn config_json_with_resume_note(value: Option<&str>) -> serde_json::Value {
    let mut json =
        serde_json::to_value(sample_config()).expect("sample config must serialize to JSON");
    let next_step = json["projects"][0]["nextStep"]
        .as_object_mut()
        .expect("sample project must have a next step");
    match value {
        Some(value) => {
            next_step.insert(
                "resumeNote".to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
        None => {
            next_step.remove("resumeNote");
        }
    }
    json
}

#[test]
fn resume_note_survives_a_read_sanitize_and_write_round_trip() {
    let json = config_json_with_resume_note(Some("  3章の途中から  "));
    let config: AppConfig =
        serde_json::from_value(json).expect("config with resumeNote must deserialize");
    let (config, changed, _warnings) = sanitize_config(config);
    assert!(changed, "trimmed resumeNote must count as a change");
    assert_eq!(
        config.projects[0]
            .next_step
            .as_ref()
            .and_then(|step| step.resume_note.as_deref()),
        Some("3章の途中から")
    );

    let written = serde_json::to_value(&config).expect("config must serialize");
    assert_eq!(
        written["projects"][0]["nextStep"]["resumeNote"],
        serde_json::json!("3章の途中から")
    );
}

#[test]
fn resume_note_is_removed_when_empty() {
    for value in ["", "   ", "\t\n"] {
        let json = config_json_with_resume_note(Some(value));
        let config: AppConfig = serde_json::from_value(json).expect("config with empty resumeNote");
        let (config, changed, _warnings) = sanitize_config(config);
        assert!(changed, "empty resumeNote must count as a change");
        assert_eq!(
            config.projects[0]
                .next_step
                .as_ref()
                .and_then(|step| step.resume_note.clone()),
            None
        );
        let written = serde_json::to_value(&config).expect("config must serialize");
        assert!(
            written["projects"][0]["nextStep"]
                .get("resumeNote")
                .is_none(),
            "empty resumeNote must not be written"
        );
    }
}

#[test]
fn resume_note_is_cut_to_80_chars() {
    let long_note = "あ".repeat(95);
    let json = config_json_with_resume_note(Some(&long_note));
    let config: AppConfig = serde_json::from_value(json).expect("config with long resumeNote");
    let (config, changed, _warnings) = sanitize_config(config);
    assert!(changed, "over-length resumeNote must count as a change");
    let saved = config.projects[0]
        .next_step
        .as_ref()
        .and_then(|step| step.resume_note.as_deref())
        .expect("truncated resumeNote must remain");
    assert_eq!(saved.chars().count(), 80);
    assert_eq!(saved, "あ".repeat(80));
}

#[test]
fn generated_config_schema_has_resume_note() {
    let schema: serde_json::Value =
        serde_json::from_str(config_schema_json()).expect("config schema must be valid JSON");
    let next_step = &schema["$defs"]["nextStep"]["properties"];
    assert_eq!(
        next_step["resumeNote"],
        serde_json::json!({ "type": "string", "minLength": 1, "maxLength": 80 })
    );
    let required = schema["$defs"]["nextStep"]["required"]
        .as_array()
        .expect("nextStep required fields");
    assert!(
        required.iter().all(|field| field != "resumeNote"),
        "resumeNote must stay optional"
    );
}

#[test]
fn missing_launch_targets_reports_only_missing_local_paths() {
    let unique = format!(
        "life-launcher-missing-test-{}-{}",
        std::process::id(),
        TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let dir = std::env::temp_dir().join(unique);
    fs::create_dir_all(&dir).expect("create temp test dir");
    let existing_file = dir.join("present.txt");
    fs::write(&existing_file, "ok").expect("write temp test file");
    let missing_file = dir.join("gone.txt");
    let missing_instruction = dir.join("missing-guide.md");

    let mut config = sample_config();
    config.buttons = vec![
        LauncherButton {
            id: "btn-existing".to_string(),
            label: "あるファイル".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenFile {
                path: existing_file.to_string_lossy().to_string(),
            }],
        },
        LauncherButton {
            id: "btn-missing".to_string(),
            label: "ないファイル".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenFile {
                path: missing_file.to_string_lossy().to_string(),
            }],
        },
        LauncherButton {
            id: "btn-url".to_string(),
            label: "URL".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenUrl {
                url: "https://example.com".to_string(),
            }],
        },
        LauncherButton {
            id: "btn-unexpanded".to_string(),
            label: "未展開".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenApp {
                path: "%LIFE_LAUNCHER_UNKNOWN_ENV_VAR_XYZ%\\app.exe".to_string(),
                args: vec![],
            }],
        },
        LauncherButton {
            id: "btn-unc".to_string(),
            label: "ネットワーク".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenFolder {
                path: r"\\server\share\x".to_string(),
            }],
        },
        LauncherButton {
            id: "btn-unreferenced-missing".to_string(),
            label: "未使用のないファイル".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: vec![],
            description: None,
            actions: vec![Action::OpenFile {
                path: missing_file.to_string_lossy().to_string(),
            }],
        },
    ];

    config.projects[0].next_step.as_mut().unwrap().button_ids = vec![
        "btn-existing".to_string(),
        "btn-missing".to_string(),
        "btn-url".to_string(),
        "btn-unexpanded".to_string(),
        "btn-unc".to_string(),
    ];
    config.projects[0]
        .next_step
        .as_mut()
        .unwrap()
        .instruction_path = Some(missing_instruction.to_string_lossy().to_string());
    config.projects[1]
        .next_step
        .as_mut()
        .unwrap()
        .instruction_path = Some(existing_file.to_string_lossy().to_string());

    let checks = collect_launch_target_checks(&config);
    let result = evaluate_missing_launch_targets(checks);

    let _ = fs::remove_dir_all(&dir);

    assert_eq!(result.missing_button_ids, vec!["btn-missing".to_string()]);
    assert_eq!(
        result.missing_instruction_project_ids,
        vec![config.projects[0].id.clone()]
    );
}
