use super::*;
use crate::models::{sample_config, NextStepExecutionSettingsV3};

fn base_config() -> AppConfig {
    let mut config = sample_config();
    config.projects.clear();
    config.inbox.clear();
    config
}

fn parse_and_plan(config: &AppConfig, json: &str) -> (AppConfig, ImportPreview) {
    let parsed = parse_import(json).expect("parse");
    let plan = build_import_plan(config, parsed, &HashSet::new()).expect("plan");
    (plan.config, plan.preview)
}

fn parse_and_plan_excluding(
    config: &AppConfig,
    json: &str,
    excluded: &[&str],
) -> (AppConfig, ImportPreview) {
    let parsed = parse_import(json).expect("parse");
    let excluded: HashSet<String> = excluded.iter().map(|key| key.to_string()).collect();
    let plan = build_import_plan(config, parsed, &excluded).expect("plan");
    (plan.config, plan.preview)
}

#[test]
fn imports_new_projects_and_wishes() {
    let config = base_config();
    let json = r#"{
      "lifeLauncherImport": 1,
      "projects": [{
        "name": "英語",
        "color": "lime",
        "goal": "字幕なしで楽しむ",
        "nextStep": {"text": "音声モードで話す", "trigger": "夕食のあと", "minutes": 25, "shortMinutes": 5},
        "wishes": ["歌詞を訳す"]
      }],
      "wishes": ["プロジェクトなしのやりたいこと"]
    }"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(preview.counts.new_projects, 1);
    assert_eq!(preview.counts.next_steps, 1);
    assert_eq!(preview.counts.wishes, 2);
    assert_eq!(next.projects.len(), 1);
    assert_eq!(next.projects[0].color_id.as_deref(), Some("lime"));
    assert_eq!(
        next.projects[0].north_star.as_deref(),
        Some("字幕なしで楽しむ")
    );
    let next_step = next.projects[0].next_step.as_ref().expect("next step");
    assert_eq!(next_step.text, "音声モードで話す");
    assert!(next_step.generation_id.is_some());
    assert!(next_step.updated_at.is_some());
    assert_eq!(next_step.trigger.as_deref(), Some("夕食のあと"));
    assert_eq!(next_step.default_timer_minutes, Some(25));
    assert_eq!(next_step.short_timer_minutes, Some(5));
    assert_eq!(next.inbox.len(), 2);
}

#[test]
fn existing_next_step_moves_imported_step_to_wishes() {
    let mut config = base_config();
    config.projects.push(Project {
        id: "p1".to_string(),
        name: "英語".to_string(),
        north_star: None,
        weekly_focus: None,
        color_id: None,
        next_step: Some(NextStepV3 {
            text: "今の一手".to_string(),
            generation_id: None,
            source_wishlist_id: None,
            trigger: None,
            updated_at: None,
            reviewed_at: None,
            resume_note: None,
            button_ids: Vec::new(),
            default_timer_minutes: None,
            short_timer_minutes: None,
            expand_timer_on_start: None,
            start_note_template: None,
            instruction_path: None,
            instruction_open_on_start: None,
        }),
        legacy_next_step_settings: None,
    });
    let json = r#"{"lifeLauncherImport":1,"projects":[{"name":" 英語 ","color":"coral","goal":"目標","nextStep":{"text":"新しい一手"}}]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(preview.counts.existing_projects, 1);
    assert_eq!(preview.existing_projects[0].next_step_action, "wishlist");
    assert!(preview.existing_projects[0].next_step_reason.is_some());
    assert_eq!(
        next.projects[0].next_step.as_ref().unwrap().text,
        "今の一手"
    );
    assert_eq!(next.projects[0].color_id.as_deref(), Some("coral"));
    assert_eq!(next.projects[0].north_star.as_deref(), Some("目標"));
    assert_eq!(next.inbox.len(), 1);
    assert_eq!(next.inbox[0].text, "新しい一手");
    assert_eq!(next.inbox[0].project_id.as_deref(), Some("p1"));
}

#[test]
fn legacy_execution_settings_are_kept_and_step_goes_to_wishes() {
    let mut config = base_config();
    config.projects.push(Project {
        id: "p1".to_string(),
        name: "英語".to_string(),
        north_star: None,
        weekly_focus: None,
        color_id: None,
        next_step: None,
        legacy_next_step_settings: Some(NextStepExecutionSettingsV3::default()),
    });
    let json =
        r#"{"lifeLauncherImport":1,"projects":[{"name":"英語","nextStep":{"text":"新しい一手"}}]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert!(next.projects[0].legacy_next_step_settings.is_some());
    assert!(next.projects[0].next_step.is_none());
    assert_eq!(next.inbox.len(), 1);
    assert_eq!(preview.existing_projects[0].next_step_action, "wishlist");
    assert!(preview.existing_projects[0]
        .next_step_reason
        .as_deref()
        .is_some_and(|reason| reason.contains("前の実行設定")));
}

#[test]
fn duplicate_names_in_json_are_merged() {
    let config = base_config();
    let json = r#"{"lifeLauncherImport":1,"projects":[
      {"name":"英語","wishes":["A"]},
      {"name":" 英語 ","color":"sand","wishes":["B"]}
    ]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(next.projects.len(), 1);
    assert_eq!(preview.merged, vec!["英語".to_string()]);
    assert_eq!(next.inbox.len(), 2);
    assert_eq!(next.projects[0].color_id.as_deref(), Some("sand"));
}

#[test]
fn duplicate_wishes_are_skipped() {
    let mut config = base_config();
    config.inbox.push(InboxItem {
        id: Some("w1".to_string()),
        text: "歌詞を訳す".to_string(),
        project_id: None,
        button_ids: Vec::new(),
        instruction_path: None,
        instruction_open_on_start: None,
    });
    let json = r#"{"lifeLauncherImport":1,"wishes":["歌詞を訳す","別のこと"]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(next.inbox.len(), 2);
    assert_eq!(preview.counts.wishes, 1);
    assert_eq!(preview.skipped.len(), 1);
}

#[test]
fn rejects_invalid_limits_and_versions() {
    assert!(parse_import("not json").is_err());
    assert!(parse_import(r#"{"lifeLauncherImport":2}"#).is_err());
    assert!(parse_import(r#"{"projects":[]}"#).is_err());
    let too_many_projects = format!(
        r#"{{"lifeLauncherImport":1,"projects":[{}]}}"#,
        (0..31)
            .map(|index| format!(r#"{{"name":"P{index}"}}"#))
            .collect::<Vec<_>>()
            .join(",")
    );
    assert!(parse_import(&too_many_projects).is_err());
    let too_many_wishes = format!(
        r#"{{"lifeLauncherImport":1,"wishes":[{}]}}"#,
        (0..101)
            .map(|index| format!(r#""W{index}""#))
            .collect::<Vec<_>>()
            .join(",")
    );
    assert!(parse_import(&too_many_wishes).is_err());
}

#[test]
fn unknown_keys_and_invalid_color_are_reported_as_ignored() {
    let config = base_config();
    let json = r#"{"lifeLauncherImport":1,"extra":true,"projects":[{"name":"英語","color":"not-a-color","buttonIds":["x"],"nextStep":{"text":"一手","instructionPath":"x"}}]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(next.projects[0].color_id, None);
    assert!(preview.ignored.contains(&"extra".to_string()));
    assert!(preview.ignored.contains(&"projects[0].color".to_string()));
    assert!(preview
        .ignored
        .contains(&"projects[0].buttonIds".to_string()));
    assert!(preview
        .ignored
        .contains(&"projects[0].nextStep.instructionPath".to_string()));
}

#[test]
fn fingerprint_changes_with_config() {
    let config = base_config();
    let before = config_fingerprint(&config);
    let mut next = config.clone();
    next.projects.push(Project {
        id: "p1".to_string(),
        name: "P".to_string(),
        north_star: None,
        weekly_focus: None,
        color_id: None,
        next_step: None,
        legacy_next_step_settings: None,
    });
    assert_ne!(before, config_fingerprint(&next));
}

#[test]
fn own_import_write_suppresses_reload() {
    let state = AppState::default();
    suppress_reload_for_own_write(&state).expect("suppress reload");
    let until = *state.suppress_reload_until.lock().expect("lock");
    assert!(until.is_some_and(|value| value > std::time::Instant::now()));
}

#[test]
fn broken_config_blocks_import_preview_commit_and_undo_without_writing() {
    let dir = temp_dir("broken-config");
    let path = dir.join("config.json");
    let broken = b"{ this is not json".to_vec();
    fs::write(&path, &broken).expect("write broken config");
    let response = LoadConfigResponse {
        config: sample_config(),
        path: path.to_string_lossy().to_string(),
        backup_path: dir.join("backups").to_string_lossy().to_string(),
        error: Some("config.json is not valid JSON".to_string()),
        backup_error: None,
        changed: false,
        save_blocked: true,
        morning_victory_suggestion: None,
    };

    assert!(ensure_import_preview_allowed(&response).is_err());
    assert!(ensure_import_write_allowed(&response, &path, IMPORT_SAVE_BLOCKED).is_err());
    assert_eq!(fs::read(&path).expect("read broken config"), broken);

    let mut writable = response.clone();
    writable.save_blocked = false;
    assert!(ensure_import_write_allowed(&writable, &path, UNDO_SAVE_BLOCKED).is_err());
    assert_eq!(fs::read(&path).expect("read broken config"), broken);
    let _ = fs::remove_dir_all(&dir);
}

fn temp_dir(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "life-launcher-import-{label}-{}-{}",
        std::process::id(),
        new_id("test")
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    dir
}

#[test]
fn import_backup_is_created_verified_and_restored() {
    let dir = temp_dir("backup");
    let config = base_config();
    fs::write(
        dir.join("config.json"),
        serde_json::to_vec(&config).unwrap(),
    )
    .unwrap();
    fs::write(dir.join("sessions.jsonl"), b"{}").unwrap();
    fs::write(dir.join("notes.json"), b"{}").unwrap();
    fs::write(dir.join("config.schema.json"), b"{}").unwrap();

    let path = create_import_backup_in(&dir, "import-test-1").expect("backup");
    assert!(path.exists());
    let restored = restore_import_backup_in(&dir, "import-test-1").expect("restore");
    assert_eq!(restored.projects.len(), config.projects.len());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn import_backups_keep_only_the_newest_twenty() {
    let dir = temp_dir("prune");
    fs::write(dir.join("config.json"), b"{}").unwrap();
    for index in 0..21 {
        create_import_backup_in(&dir, &format!("import-{index:04}")).expect("backup");
    }
    let backups = fs::read_dir(import_backup_dir(&dir))
        .unwrap()
        .filter_map(|entry| entry.ok())
        .count();
    assert_eq!(backups, IMPORT_BACKUP_KEEP);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn read_import_json_handles_bom_size_and_invalid_utf8() {
    let dir = temp_dir("read");
    let bom_path = dir.join("bom.json");
    fs::write(&bom_path, [0xEF, 0xBB, 0xBF, b'{', b'}']).unwrap();
    assert_eq!(
        read_import_json(bom_path.to_string_lossy().to_string()).unwrap(),
        "{}"
    );

    let big_path = dir.join("big.json");
    fs::write(&big_path, vec![b'x'; MAX_IMPORT_BYTES + 1]).unwrap();
    assert!(read_import_json(big_path.to_string_lossy().to_string()).is_err());

    let invalid_path = dir.join("invalid.json");
    fs::write(&invalid_path, [0xFF, 0xFE, 0x00]).unwrap();
    assert!(read_import_json(invalid_path.to_string_lossy().to_string()).is_err());
    assert!(read_import_json(dir.to_string_lossy().to_string()).is_err());
    let _ = fs::remove_dir_all(&dir);
}

fn existing_project_with_step(step_text: &str) -> Project {
    let mut config = base_config();
    config.projects.push(Project {
        id: "p1".to_string(),
        name: "英語".to_string(),
        north_star: None,
        weekly_focus: None,
        color_id: None,
        next_step: Some(NextStepV3 {
            text: step_text.to_string(),
            generation_id: Some("generation-1".to_string()),
            source_wishlist_id: None,
            trigger: None,
            updated_at: None,
            reviewed_at: None,
            resume_note: None,
            button_ids: Vec::new(),
            default_timer_minutes: None,
            short_timer_minutes: None,
            expand_timer_on_start: None,
            start_note_template: None,
            instruction_path: None,
            instruction_open_on_start: None,
        }),
        legacy_next_step_settings: None,
    });
    config.projects.remove(0)
}

const TWO_PROJECTS_JSON: &str = r#"{
  "lifeLauncherImport": 1,
  "projects": [
    {"name": "英語", "color": "lime", "goal": "目標",
     "nextStep": {"text": "音声で話す", "minutes": 20, "shortMinutes": 5},
     "wishes": ["歌詞を訳す", "単語を10個"]},
    {"name": "部屋", "nextStep": {"text": "紙を2山に分ける"}, "wishes": ["本棚を直す"]}
  ],
  "wishes": ["ひとつ目", "ふたつ目"]
}"#;

#[test]
fn preview_rows_carry_stable_keys_and_the_values_written_in_the_answer() {
    let (_, preview) = parse_and_plan(&base_config(), TWO_PROJECTS_JSON);
    let project_keys: Vec<&str> = preview
        .new_projects
        .iter()
        .map(|p| p.key.as_str())
        .collect();
    assert_eq!(project_keys, ["p0", "p1"]);
    let step_keys: Vec<(&str, &str)> = preview
        .next_steps
        .iter()
        .map(|step| (step.key.as_str(), step.project_key.as_str()))
        .collect();
    assert_eq!(step_keys, [("p0.step", "p0"), ("p1.step", "p1")]);
    assert_eq!(preview.next_steps[0].minutes, Some(20));
    assert_eq!(preview.next_steps[0].short_minutes, Some(5));
    assert_eq!(preview.next_steps[1].minutes, None);
    assert_eq!(preview.next_steps[1].short_minutes, None);
    let wish_keys: Vec<(&str, Option<&str>)> = preview
        .wishes
        .iter()
        .map(|wish| (wish.key.as_str(), wish.project_key.as_deref()))
        .collect();
    assert_eq!(
        wish_keys,
        [
            ("p0.w0", Some("p0")),
            ("p0.w1", Some("p0")),
            ("p1.w0", Some("p1")),
            ("w0", None),
            ("w1", None),
        ]
    );
}

#[test]
fn an_empty_excluded_set_gives_the_same_result_as_before() {
    let (with_none, preview_none) = parse_and_plan(&base_config(), TWO_PROJECTS_JSON);
    let (with_empty, preview_empty) =
        parse_and_plan_excluding(&base_config(), TWO_PROJECTS_JSON, &[]);
    assert_eq!(with_none.projects.len(), with_empty.projects.len());
    assert_eq!(with_none.inbox.len(), with_empty.inbox.len());
    assert_eq!(preview_none.counts.wishes, preview_empty.counts.wishes);
    assert_eq!(
        preview_none.counts.next_steps,
        preview_empty.counts.next_steps
    );
}

#[test]
fn excluding_a_project_skips_it_whole_and_keeps_the_other_keys() {
    let (next, preview) = parse_and_plan_excluding(&base_config(), TWO_PROJECTS_JSON, &["p0"]);
    assert_eq!(next.projects.len(), 1);
    assert_eq!(next.projects[0].name, "部屋");
    assert_eq!(preview.new_projects.len(), 1);
    // The numbers are not closed up: the second project is still p1.
    assert_eq!(preview.new_projects[0].key, "p1");
    assert_eq!(preview.next_steps.len(), 1);
    assert!(next.inbox.iter().all(|item| item.text != "歌詞を訳す"));
    assert_eq!(next.inbox.len(), 3);
}

#[test]
fn excluding_a_step_or_a_wish_skips_only_that_row() {
    let (next, preview) = parse_and_plan_excluding(&base_config(), TWO_PROJECTS_JSON, &["p0.step"]);
    assert!(next.projects[0].next_step.is_none());
    assert!(next.projects[1].next_step.is_some());
    assert_eq!(preview.next_steps.len(), 1);
    assert_eq!(next.projects.len(), 2);

    let (next, preview) =
        parse_and_plan_excluding(&base_config(), TWO_PROJECTS_JSON, &["p0.w1", "w0"]);
    let texts: Vec<&str> = next.inbox.iter().map(|item| item.text.as_str()).collect();
    assert!(!texts.contains(&"単語を10個"));
    assert!(!texts.contains(&"ひとつ目"));
    assert!(texts.contains(&"歌詞を訳す"));
    assert!(texts.contains(&"ふたつ目"));
    assert_eq!(preview.wishes.len(), 3);
    assert_eq!(preview.next_steps.len(), 2);
}

#[test]
fn a_step_that_goes_to_the_wishlist_uses_the_step_key_and_leaves_with_it() {
    let mut config = base_config();
    config.projects.push(existing_project_with_step("今の一手"));
    let json = r#"{"lifeLauncherImport":1,"projects":[{"name":"英語","nextStep":{"text":"新しい一手"},"wishes":["もう一つ"]}]}"#;
    let (next, preview) = parse_and_plan(&config, json);
    assert_eq!(preview.next_steps[0].action, "wishlist");
    assert_eq!(preview.next_steps[0].key, "p0.step");
    let wish_keys: Vec<&str> = preview
        .wishes
        .iter()
        .map(|wish| wish.key.as_str())
        .collect();
    // The wish that took the step's place has the step's key; the screen shows them as one row.
    assert_eq!(wish_keys, ["p0.step", "p0.w0"]);
    assert_eq!(next.inbox.len(), 2);

    let (next, preview) = parse_and_plan_excluding(&config, json, &["p0.step"]);
    assert!(preview.next_steps.is_empty());
    assert_eq!(next.inbox.len(), 1);
    assert_eq!(next.inbox[0].text, "もう一つ");
    // The step stays as it was.
    assert_eq!(
        next.projects[0].next_step.as_ref().unwrap().text,
        "今の一手"
    );
}

#[test]
fn an_excluded_existing_project_gets_no_color_or_goal_and_unknown_keys_are_ignored() {
    let mut config = base_config();
    config.projects.push(existing_project_with_step("今の一手"));
    let json =
        r#"{"lifeLauncherImport":1,"projects":[{"name":"英語","color":"coral","goal":"目標"}]}"#;
    let (next, preview) = parse_and_plan_excluding(&config, json, &["p0", "p9", "zzz", "w99"]);
    assert!(next.projects[0].color_id.is_none());
    assert!(next.projects[0].north_star.is_none());
    assert!(preview.existing_projects.is_empty());

    let (next, preview) = parse_and_plan_excluding(&config, json, &["p9", "zzz"]);
    assert_eq!(next.projects[0].color_id.as_deref(), Some("coral"));
    assert_eq!(preview.existing_projects.len(), 1);
    assert_eq!(preview.existing_projects[0].key, "p0");
}
