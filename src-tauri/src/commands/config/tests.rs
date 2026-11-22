#[cfg(not(windows))]
use super::backup::replace_file_atomically;
use super::backup::{
    daily_backup, icon_backup_file_name, prune_config_backups, restore_backup_from_path,
    write_bytes_atomically, BACKUP_KEEP_COUNT, DAILY_BACKUP_PREFIX, DAILY_BACKUP_SUFFIX,
    ICON_CACHE_DIR_NAME,
};
use super::sanitize::{
    migrate_overlay_pages_from_groups, morning_victory_suggestion, normalize_settings,
    project_is_stale_at, should_backup_before_config_rewrite, trim_empty_projects,
    PROJECT_NORTH_STAR_MAX_CHARS,
};
use super::*;
use crate::models::{
    default_timer_minutes, sample_config, InboxItem, LauncherButton, OverlayPage, Project,
    TodayItem, CONFIG_VERSION, EXECUTION_TRIGGER_MAX_CHARS, OVERLAY_PAGE_NAME_MAX_CHARS,
    TODAY_ITEM_LIMIT, WEEKLY_FOCUS_LIMIT,
};
use std::sync::Mutex;
use std::time::Duration;

#[test]
fn legacy_windows_system_menu_shortcut_migrates_once() {
    let mut settings = sample_config().settings;
    settings.focus_hotkey = Some(" alt+space ".to_string());
    let mut changed = false;

    normalize_settings(&mut settings, &mut changed);

    assert!(changed);
    assert_eq!(settings.focus_hotkey.as_deref(), Some("Ctrl+Alt+Space"));

    changed = false;
    normalize_settings(&mut settings, &mut changed);
    assert!(!changed);
}

#[test]
fn project_colors_accept_the_twelve_known_ids_and_repair_unknown_ones() {
    const COLORS: [&str; 12] = [
        "amber", "blue", "green", "violet", "rose", "cyan", "orange", "slate", "lime", "magenta",
        "sand", "coral",
    ];
    let mut projects = COLORS
        .iter()
        .enumerate()
        .map(|(index, color)| Project {
            id: format!("p{index}"),
            name: format!("P{index}"),
            north_star: None,
            weekly_focus: None,
            color_id: Some((*color).to_string()),
            next_step: None,
            legacy_next_step_settings: None,
        })
        .collect::<Vec<_>>();
    let mut changed = false;
    let mut warnings = Vec::new();
    trim_empty_projects(&mut projects, &mut changed, &mut warnings);
    assert!(!changed);
    assert!(warnings.is_empty());
    for (project, color) in projects.iter().zip(COLORS) {
        assert_eq!(project.color_id.as_deref(), Some(color));
    }

    let mut projects = vec![Project {
        id: "p".to_string(),
        name: "P".to_string(),
        north_star: None,
        weekly_focus: None,
        color_id: Some("unknown".to_string()),
        next_step: None,
        legacy_next_step_settings: None,
    }];
    let mut changed = false;
    let mut warnings = Vec::new();
    trim_empty_projects(&mut projects, &mut changed, &mut warnings);
    assert!(changed);
    assert_eq!(projects[0].color_id, None);
    assert!(warnings
        .iter()
        .any(|warning| warning == "projects: removed an invalid colorId"));
}

#[test]
fn generated_config_schema_is_valid_json_with_project_fields() {
    let schema: serde_json::Value =
        serde_json::from_str(config_schema_json()).expect("config schema must be valid JSON");
    let colors = schema["$defs"]["project"]["properties"]["colorId"]["enum"]
        .as_array()
        .expect("project color enum");
    assert_eq!(colors.len(), 12);
    for color in ["lime", "magenta", "sand", "coral"] {
        assert!(
            colors.iter().any(|value| value == color),
            "missing project color {color}"
        );
    }
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
    assert_eq!(
        schema["$defs"]["settings"]["properties"]["mainDisplaySize"]["enum"],
        serde_json::json!(["standard", "large", "xlarge"])
    );
    assert_eq!(
        schema["$defs"]["settings"]["properties"]["mainDisplaySize"]["default"],
        "standard"
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
    assert_eq!(schema["properties"]["version"]["const"], CONFIG_VERSION);
    assert_eq!(
        schema["$defs"]["nextStep"]["properties"]["generationId"]["minLength"],
        1
    );
    assert_eq!(
        schema["$defs"]["todayItem"]["properties"]["sourceGenerationId"]["minLength"],
        1
    );
    assert_eq!(
        schema["$defs"]["nextStep"]["properties"]["trigger"]["maxLength"],
        EXECUTION_TRIGGER_MAX_CHARS
    );
    assert_eq!(
        schema["$defs"]["todayItem"]["properties"]["trigger"]["maxLength"],
        40
    );
    assert_eq!(
        schema["$defs"]["nextStep"]["properties"]["updatedAt"]["format"],
        "date-time"
    );
    assert_eq!(
        schema["$defs"]["nextStep"]["properties"]["reviewedAt"]["format"],
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
        schema["$defs"]["nextStep"]["properties"]["instructionOpenOnStart"]["type"],
        "boolean"
    );
    assert_eq!(
        schema["$defs"]["project"]["properties"]["nextStep"]["$ref"],
        "#/$defs/nextStep"
    );
    assert_eq!(
        schema["$defs"]["project"]["properties"]["legacyNextStepSettings"]["$ref"],
        "#/$defs/nextStepExecutionSettings"
    );
    assert_eq!(
        schema["$defs"]["today"]["properties"]["candidateExcludedSourceKeys"]["uniqueItems"],
        true
    );
    assert_eq!(
        schema["$defs"]["today"]["properties"]["selectionMutationTokens"]["additionalProperties"]
            ["type"],
        "string"
    );
    assert_eq!(
        schema["properties"]["sourceCompletions"]["items"]["$ref"],
        "#/$defs/sourceCompletion"
    );
    assert!(schema["$defs"]["project"]["required"]
        .as_array()
        .expect("project required fields")
        .iter()
        .all(|field| field != "northStar" && field != "weeklyFocus" && field != "nextStep"));
}

#[test]
fn generated_config_schema_has_source_wishlist_id_and_expand_timer_on_start() {
    let schema: serde_json::Value =
        serde_json::from_str(config_schema_json()).expect("config schema must be valid JSON");
    let next_step = &schema["$defs"]["nextStep"]["properties"];
    assert_eq!(
        next_step["sourceWishlistId"],
        serde_json::json!({ "type": "string", "minLength": 1 })
    );
    assert_eq!(
        next_step["expandTimerOnStart"],
        serde_json::json!({ "type": "boolean" })
    );
    assert_eq!(
        schema["$defs"]["nextStepExecutionSettings"]["properties"]["expandTimerOnStart"],
        serde_json::json!({ "type": "boolean" })
    );
    assert_eq!(
        schema["$defs"]["nextStep"]["additionalProperties"], false,
        "nextStep must keep rejecting unknown keys"
    );
    assert_eq!(
        schema["$defs"]["nextStepExecutionSettings"]["additionalProperties"], false,
        "nextStepExecutionSettings must keep rejecting unknown keys"
    );
}

fn config_json_with_source_wishlist_id(value: Option<&str>) -> serde_json::Value {
    let mut json =
        serde_json::to_value(sample_config()).expect("sample config must serialize to JSON");
    let next_step = json["projects"][0]["nextStep"]
        .as_object_mut()
        .expect("sample project must have a next step");
    match value {
        Some(value) => {
            next_step.insert(
                "sourceWishlistId".to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
        None => {
            next_step.remove("sourceWishlistId");
        }
    }
    json
}

#[test]
fn source_wishlist_id_survives_a_read_sanitize_and_write_round_trip() {
    let json = config_json_with_source_wishlist_id(Some("wish-list-1"));
    let config: AppConfig =
        serde_json::from_value(json).expect("config with sourceWishlistId must deserialize");
    assert_eq!(
        config.projects[0]
            .next_step
            .as_ref()
            .and_then(|step| step.source_wishlist_id.as_deref()),
        Some("wish-list-1")
    );

    let (config, _changed, _warnings) = sanitize_config(config);
    let written = serde_json::to_value(&config).expect("config must serialize");
    assert_eq!(
        written["projects"][0]["nextStep"]["sourceWishlistId"],
        serde_json::json!("wish-list-1")
    );
}

#[test]
fn source_wishlist_id_is_omitted_when_absent() {
    let json = config_json_with_source_wishlist_id(None);
    let config: AppConfig =
        serde_json::from_value(json).expect("config without sourceWishlistId must deserialize");
    assert_eq!(
        config.projects[0]
            .next_step
            .as_ref()
            .and_then(|step| step.source_wishlist_id.clone()),
        None
    );

    let (config, _changed, _warnings) = sanitize_config(config);
    let written = serde_json::to_value(&config).expect("config must serialize");
    assert!(
        written["projects"][0]["nextStep"]
            .get("sourceWishlistId")
            .is_none(),
        "sourceWishlistId must not be written when it is absent"
    );
}

#[test]
fn source_wishlist_id_is_removed_when_empty() {
    for value in ["", "   "] {
        let json = config_json_with_source_wishlist_id(Some(value));
        let config: AppConfig =
            serde_json::from_value(json).expect("config with empty sourceWishlistId");
        let (config, changed, _warnings) = sanitize_config(config);
        assert!(changed, "empty sourceWishlistId must count as a change");
        assert_eq!(
            config.projects[0]
                .next_step
                .as_ref()
                .and_then(|step| step.source_wishlist_id.clone()),
            None
        );
        let written = serde_json::to_value(&config).expect("config must serialize");
        assert!(
            written["projects"][0]["nextStep"]
                .get("sourceWishlistId")
                .is_none(),
            "empty sourceWishlistId must not be written"
        );
    }
}

#[test]
fn source_wishlist_id_stays_when_the_wishlist_item_is_gone() {
    let json = config_json_with_source_wishlist_id(Some("missing-wish"));
    let config: AppConfig = serde_json::from_value(json).expect("config must deserialize");
    assert!(config
        .inbox
        .iter()
        .all(|item| item.id.as_deref() != Some("missing-wish")));

    let (config, _changed, _warnings) = sanitize_config(config);
    let written = serde_json::to_value(&config).expect("config must serialize");
    assert_eq!(
        written["projects"][0]["nextStep"]["sourceWishlistId"],
        serde_json::json!("missing-wish"),
        "an unknown wishlist id must not be dropped"
    );
}

#[test]
fn first_run_done_at_is_stamped_once_and_kept_afterwards() {
    let mut settings = sample_config().settings;
    assert_eq!(settings.first_run_done_at, None);
    assert!(stamp_first_run_done_at(&mut settings));
    let stamp = settings
        .first_run_done_at
        .clone()
        .expect("the first save must record the stamp");
    assert!(
        datetime::parse_rfc3339(&stamp).is_some(),
        "the stamp must be an RFC 3339 instant: {stamp}"
    );

    assert!(!stamp_first_run_done_at(&mut settings));
    assert_eq!(settings.first_run_done_at.as_deref(), Some(stamp.as_str()));
}

#[test]
fn first_run_done_at_survives_a_read_sanitize_and_write_round_trip() {
    let mut config = sample_config();
    config.settings.first_run_done_at = Some("2026-11-15T09:00:00+09:00".to_string());
    let (config, _changed, _warnings) = sanitize_config(config);
    assert_eq!(
        config.settings.first_run_done_at.as_deref(),
        Some("2026-11-15T09:00:00+09:00")
    );
    let written = serde_json::to_value(&config).expect("config must serialize");
    assert_eq!(
        written["settings"]["firstRunDoneAt"],
        serde_json::json!("2026-11-15T09:00:00+09:00")
    );
}

#[test]
fn unreadable_first_run_done_at_is_dropped_without_being_replaced() {
    for value in ["", "   ", "not-a-date", "2026-11-15"] {
        let mut config = sample_config();
        config.settings.first_run_done_at = Some(value.to_string());
        let (config, changed, _warnings) = sanitize_config(config);
        assert!(changed, "{value:?} must count as a change");
        assert_eq!(
            config.settings.first_run_done_at, None,
            "{value:?} must be dropped"
        );
        let written = serde_json::to_value(&config).expect("config must serialize");
        assert!(
            written["settings"].get("firstRunDoneAt").is_none(),
            "{value:?} must not be written"
        );
    }
}

#[test]
fn loading_never_stamps_first_run_done_at() {
    let mut config = sample_config();
    config.settings.first_run_done_at = None;
    let (config, _changed, _warnings) = sanitize_config(config);
    assert_eq!(
        config.settings.first_run_done_at, None,
        "sanitize (the load path) must not create the stamp"
    );
}

#[test]
fn generated_config_schema_has_first_run_done_at() {
    let schema: serde_json::Value =
        serde_json::from_str(config_schema_json()).expect("config schema must be valid JSON");
    assert_eq!(
        schema["$defs"]["settings"]["properties"]["firstRunDoneAt"],
        serde_json::json!({ "type": "string", "format": "date-time" })
    );
    let required = schema["$defs"]["settings"]["required"]
        .as_array()
        .expect("settings required fields");
    assert!(
        required.iter().all(|field| field != "firstRunDoneAt"),
        "firstRunDoneAt must stay optional"
    );
}

#[test]
fn optional_project_today_and_inbox_fields_default_for_legacy_inputs() {
    let project: Project = serde_json::from_value(serde_json::json!({
        "id": "legacy",
        "name": "旧プロジェクト",
        "nextStep": {
            "text": "従来の次の一手"
        }
    }))
    .expect("v3 project without optional fields must remain readable");

    assert_eq!(project.north_star, None);
    assert_eq!(project.weekly_focus, None);
    let next_step = project.next_step.expect("next step");
    assert_eq!(next_step.trigger, None);
    assert_eq!(next_step.updated_at, None);
    assert_eq!(next_step.reviewed_at, None);

    let today_item: crate::models::TodayItem = serde_json::from_value(serde_json::json!({
        "text": "従来の今日の項目",
        "done": false
    }))
    .expect("legacy today item without trigger must remain readable");
    assert_eq!(today_item.trigger, None);

    let legacy_inbox: InboxItem = serde_json::from_value(serde_json::json!({
        "text": "legacy"
    }))
    .expect("legacy inbox must remain readable");
    assert!(legacy_inbox.button_ids.is_empty());
    assert_eq!(legacy_inbox.instruction_path, None);
}

#[test]
fn instruction_reference_update_preserves_unrelated_config_and_rewrites_descendants() {
    let mut config = sample_config();
    config.settings.instruction_folders =
        Some(vec!["C:\\Docs".to_string(), "X:\\Other".to_string()]);
    let next_step = config.projects[0].next_step.as_mut().expect("next step");
    next_step.instruction_path = Some("c:\\docs\\Sub\\Guide.md".to_string());
    next_step.instruction_open_on_start = Some(true);
    config.today.items[0].instruction_path = Some("C:\\Docs\\Sub\\Today.md".to_string());
    config.today.items[0].instruction_open_on_start = Some(true);
    config.inbox[0].instruction_path = Some("C:\\Docs\\Sub\\Inbox.md".to_string());
    config.inbox[0].instruction_open_on_start = Some(true);
    let original_buttons = serde_json::to_value(&config.buttons).expect("serialize buttons");

    let (projects, root_removed, changed) = rewrite_instruction_references_in_config(
        &mut config,
        "C:\\Docs\\Sub",
        Some("C:\\Docs\\Renamed"),
        false,
    );
    assert!(changed);
    assert_eq!(projects, vec![config.projects[0].name.clone()]);
    assert!(!root_removed);
    assert_eq!(
        config.projects[0]
            .next_step
            .as_ref()
            .and_then(|step| step.instruction_path.as_deref()),
        Some("C:\\Docs\\Renamed\\Guide.md")
    );
    assert_eq!(
        config.today.items[0].instruction_path.as_deref(),
        Some("C:\\Docs\\Renamed\\Today.md")
    );
    assert_eq!(
        config.inbox[0].instruction_path.as_deref(),
        Some("C:\\Docs\\Renamed\\Inbox.md")
    );
    assert_eq!(
        serde_json::to_value(&config.buttons).unwrap(),
        original_buttons
    );

    for unregister_root in [false, true] {
        let mut removed = config.clone();
        let (projects, root_removed, changed) = rewrite_instruction_references_in_config(
            &mut removed,
            "C:\\Docs",
            None,
            unregister_root,
        );
        assert!(changed);
        assert_eq!(projects, vec![config.projects[0].name.clone()]);
        assert_eq!(root_removed, unregister_root);
        let next_step = removed.projects[0].next_step.as_ref().expect("next step");
        assert_eq!(next_step.instruction_path, None);
        assert_eq!(next_step.instruction_open_on_start, None);
        assert_eq!(removed.today.items[0].instruction_path, None);
        assert_eq!(removed.today.items[0].instruction_open_on_start, None);
        assert_eq!(removed.inbox[0].instruction_path, None);
        assert_eq!(removed.inbox[0].instruction_open_on_start, None);
        assert_eq!(
            serde_json::to_value(&removed.buttons).unwrap(),
            original_buttons
        );
        let expected_roots = if unregister_root {
            vec!["X:\\Other".to_string()]
        } else {
            vec!["C:\\Docs".to_string(), "X:\\Other".to_string()]
        };
        assert_eq!(removed.settings.instruction_folders, Some(expected_roots));
    }
}

#[cfg(windows)]
#[test]
fn reconciles_renamed_instruction_root_and_project_reference_by_folder_identity() {
    let parent = std::env::temp_dir().join(format!(
        "life-launcher-instruction-root-identity-{}",
        datetime::timestamp_nanos(datetime::now_local())
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
    config.projects[0]
        .next_step
        .as_mut()
        .expect("next step")
        .instruction_path = Some(format!("{old_path}\\Guide.md"));

    assert!(reconcile_config_instruction_roots(&mut config));
    let new_path = new_root.to_string_lossy().to_string();
    assert_eq!(
        config.settings.instruction_folders.as_deref(),
        Some([new_path.clone()].as_slice())
    );
    assert_eq!(
        config.projects[0]
            .next_step
            .as_ref()
            .and_then(|step| step.instruction_path.as_deref()),
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
    let next_step = config.projects[0].next_step.as_mut().expect("next step");
    next_step.updated_at = None;
    next_step.reviewed_at = None;

    let (config, changed, warnings) = sanitize_config(config);
    let project = &config.projects[0];

    assert!(changed);
    assert!(warnings.is_empty());
    let next_step = project.next_step.as_ref().expect("next step");
    assert!(next_step.updated_at.is_some());
    assert!(next_step.reviewed_at.is_some());
    assert!(!project_is_stale_at(project, datetime::now_utc()));
}

#[test]
fn next_step_freshness_changes_at_fourteen_days() {
    let mut project = sample_config().projects.remove(0);
    let next_step = project.next_step.as_mut().expect("next step");
    next_step.updated_at = Some("2026-07-02T12:00:00Z".to_string());
    next_step.reviewed_at = None;
    let thirteen_days = datetime::parse_rfc3339("2026-07-15T12:00:00Z").expect("datetime");
    let fourteen_days = datetime::parse_rfc3339("2026-07-16T12:00:00Z").expect("datetime");

    assert!(!project_is_stale_at(&project, thirteen_days));
    assert!(project_is_stale_at(&project, fourteen_days));

    project.next_step.as_mut().expect("next step").reviewed_at =
        Some("2026-07-10T12:00:00Z".to_string());
    assert!(!project_is_stale_at(&project, fourteen_days));
}

#[test]
fn p10_05_next_step_freshness_uses_the_newer_of_reviewed_and_updated() {
    let now = datetime::parse_rfc3339("2026-07-16T12:00:00Z").expect("datetime");
    let stale_before = datetime::format_rfc3339_auto(
        datetime::parse_rfc3339("2026-07-02T12:00:00Z").expect("datetime"),
    );
    let recent = datetime::format_rfc3339_auto(
        datetime::parse_rfc3339("2026-07-15T12:00:00Z").expect("datetime"),
    );

    let mut project = sample_config().projects.remove(0);

    // Reviewed 14 days ago, updated yesterday: the newer date wins, so not stale.
    {
        let step = project.next_step.as_mut().expect("next step");
        step.reviewed_at = Some(stale_before.clone());
        step.updated_at = Some(recent.clone());
    }
    assert!(!project_is_stale_at(&project, now));

    // Updated 14 days ago, reviewed yesterday: same answer the other way round.
    {
        let step = project.next_step.as_mut().expect("next step");
        step.reviewed_at = Some(recent.clone());
        step.updated_at = Some(stale_before.clone());
    }
    assert!(!project_is_stale_at(&project, now));

    // Both 14 days old: stale.
    {
        let step = project.next_step.as_mut().expect("next step");
        step.reviewed_at = Some(stale_before.clone());
        step.updated_at = Some(stale_before.clone());
    }
    assert!(project_is_stale_at(&project, now));

    // Only one side readable: that side decides.
    {
        let step = project.next_step.as_mut().expect("next step");
        step.reviewed_at = Some("not a date".to_string());
        step.updated_at = Some(recent.clone());
    }
    assert!(!project_is_stale_at(&project, now));
    {
        let step = project.next_step.as_mut().expect("next step");
        step.reviewed_at = Some(stale_before.clone());
        step.updated_at = Some("not a date".to_string());
    }
    assert!(project_is_stale_at(&project, now));
}

#[test]
fn legacy_inbox_items_get_unique_stable_ids_once() {
    let mut config = sample_config();
    config.inbox = vec![
        InboxItem {
            id: None,
            text: "same".to_string(),
            project_id: None,
            button_ids: Vec::new(),
            instruction_path: None,
            instruction_open_on_start: None,
        },
        InboxItem {
            id: None,
            text: "same".to_string(),
            project_id: None,
            button_ids: Vec::new(),
            instruction_path: None,
            instruction_open_on_start: None,
        },
        InboxItem {
            id: Some("legacy-1".to_string()),
            text: "existing collision".to_string(),
            project_id: None,
            button_ids: Vec::new(),
            instruction_path: None,
            instruction_open_on_start: None,
        },
    ];

    let (config, changed, _) = sanitize_config(config);
    assert!(changed);
    assert_eq!(config.inbox[0].id.as_deref(), Some("legacy-1-2"));
    assert_eq!(config.inbox[1].id.as_deref(), Some("legacy-2"));
    assert_eq!(config.inbox[2].id.as_deref(), Some("legacy-1"));

    let (config, changed_again, _) = sanitize_config(config);
    assert!(!changed_again);
    assert_eq!(config.inbox[0].id.as_deref(), Some("legacy-1-2"));
    assert_eq!(config.inbox[1].id.as_deref(), Some("legacy-2"));
    assert_eq!(config.inbox[2].id.as_deref(), Some("legacy-1"));
}

#[test]
fn today_timer_minutes_are_snapshotted_once_from_the_project() {
    let mut config = sample_config();
    let project_id = config.projects[0].id.clone();
    let next_step = config.projects[0].next_step.as_mut().expect("next step");
    next_step.default_timer_minutes = Some(37);
    next_step.short_timer_minutes = Some(7);
    config.today.items[0].project_id = Some(project_id);
    config.today.items[0].default_timer_minutes = None;
    config.today.items[0].short_timer_minutes = None;

    let (mut config, changed, _) = sanitize_config(config);
    assert!(changed);
    assert_eq!(config.today.items[0].default_timer_minutes, Some(37));
    assert_eq!(config.today.items[0].short_timer_minutes, Some(7));

    let next_step = config.projects[0].next_step.as_mut().expect("next step");
    next_step.default_timer_minutes = Some(25);
    next_step.short_timer_minutes = Some(5);
    let (config, _, _) = sanitize_config(config);
    assert_eq!(config.today.items[0].default_timer_minutes, Some(37));
    assert_eq!(config.today.items[0].short_timer_minutes, Some(7));
}

#[test]
fn invalid_today_timer_snapshots_fall_back_to_global_settings() {
    let mut config = sample_config();
    config.today.items[0].project_id = None;
    config.today.items[0].default_timer_minutes = Some(0);
    config.today.items[0].short_timer_minutes = Some(241);

    let expected_default = u32::from(config.settings.default_timer_minutes);
    let expected_short = u32::from(config.settings.short_timer_minutes);
    let (config, changed, _) = sanitize_config(config);
    assert!(changed);
    assert_eq!(
        config.today.items[0].default_timer_minutes,
        Some(expected_default)
    );
    assert_eq!(
        config.today.items[0].short_timer_minutes,
        Some(expected_short)
    );
}

#[test]
fn inbox_project_reference_keeps_valid_id_and_removes_unknown_id_only() {
    let mut config = sample_config();
    let valid_project_id = config.projects[0].id.clone();
    config.inbox = vec![
        InboxItem {
            id: Some("valid-item".to_string()),
            text: "valid".to_string(),
            project_id: Some(valid_project_id.clone()),
            button_ids: Vec::new(),
            instruction_path: None,
            instruction_open_on_start: None,
        },
        InboxItem {
            id: Some("unknown-item".to_string()),
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
        project.remove("northStar");
        project.remove("weeklyFocus");
        let next_step = project
            .get_mut("nextStep")
            .and_then(Value::as_object_mut)
            .expect("next step");
        next_step.remove("updatedAt");
        next_step.remove("reviewedAt");
        next_step.remove("instructionPath");
        next_step.remove("instructionOpenOnStart");
    }
    let settings = legacy_value["settings"].as_object_mut().expect("settings");
    settings.remove("restartShortFirst");
    settings.remove("instructionFolders");
    settings.remove("instructionFolderIdentities");
    settings.remove("instructionHotkey");

    let legacy: AppConfig = serde_json::from_value(legacy_value).expect("legacy config");
    assert!(legacy.projects.iter().all(|project| project
        .next_step
        .as_ref()
        .is_none_or(|step| step.updated_at.is_none())));
    assert_eq!(legacy.settings.restart_short_first, None);
    assert_eq!(legacy.settings.instruction_folders, None);
    assert_eq!(legacy.settings.instruction_folder_identities, None);
    assert_eq!(legacy.settings.instruction_hotkey, None);
    assert_eq!(legacy.overlay_pages, None);

    let mut partial_value = serde_json::to_value(sample_config()).expect("sample config");
    partial_value["projects"][0]["northStar"] = serde_json::json!("方向");
    partial_value["projects"][0]["nextStep"]["instructionPath"] =
        serde_json::json!("C:\\Manuals\\start.md");
    partial_value["projects"][0]["nextStep"]["instructionOpenOnStart"] = serde_json::json!(true);
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
    let partial_next_step = partial.projects[0].next_step.as_ref().expect("next step");
    assert_eq!(
        partial_next_step.instruction_path.as_deref(),
        Some("C:\\Manuals\\start.md")
    );
    assert_eq!(partial_next_step.instruction_open_on_start, Some(true));
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
    config.projects[0]
        .next_step
        .as_mut()
        .expect("next step")
        .trigger = Some(format!("  {}  ", "後".repeat(41)));
    config.today.items[0].trigger = Some("  夕食後  ".to_string());
    config.today.items[1].trigger = Some("   ".to_string());

    let (config, changed, warnings) = sanitize_config(config);

    assert!(changed);
    let project_trigger = config.projects[0]
        .next_step
        .as_ref()
        .and_then(|step| step.trigger.as_deref())
        .expect("project trigger remains set");
    assert_eq!(project_trigger.chars().count(), EXECUTION_TRIGGER_MAX_CHARS);
    assert_eq!(config.today.items[0].trigger.as_deref(), Some("夕食後"));
    assert_eq!(config.today.items[1].trigger, None);
    assert!(warnings
        .iter()
        .any(|warning| warning.contains("projects.nextStep.trigger: truncated")));
}

#[test]
fn legacy_today_completion_is_reset_when_stable_source_keys_are_added() {
    let mut config = sample_config();
    config.today.items[0].done = true;
    assert!(config
        .today
        .items
        .iter()
        .all(|item| item.source_key.is_none()));

    let (config, changed, warnings) = sanitize_config(config);

    assert!(changed);
    assert!(config.today.items.iter().all(|item| !item.done));
    let source_keys = config
        .today
        .items
        .iter()
        .map(|item| item.source_key.as_deref().expect("source key"))
        .collect::<HashSet<_>>();
    assert_eq!(source_keys.len(), config.today.items.len());
    assert!(warnings
        .iter()
        .any(|warning| warning.contains("legacy manual completion")));

    let (_, changed_again, warnings_again) = sanitize_config(config);
    assert!(!changed_again);
    assert!(warnings_again.is_empty());
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
        datetime::timestamp_nanos(datetime::now_local())
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
fn load_migrates_dictionary_order_once_and_persists_hide_show_transitions() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-dictionary-load-migration-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let previous_appdata = std::env::var_os("APPDATA");
    std::env::set_var("APPDATA", &root);

    let path = config_path().expect("config path");
    let mut legacy = sample_config();
    legacy.dictionary_order = None;
    write_config(&path, &legacy).expect("write legacy config");
    let legacy_bytes = fs::read(&path).expect("read legacy config");
    let legacy_json: Value = serde_json::from_slice(&legacy_bytes).expect("parse legacy config");
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

    let mut config = second.config;
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

static ENV_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn backup_icon_entries_allow_only_flat_png_cache_names() {
    assert_eq!(
        icon_backup_file_name("icons/cached-button_1.png"),
        Some("cached-button_1.png")
    );
    for invalid in [
        "icons/",
        "icons/../outside.png",
        "icons/nested/icon.png",
        "icons/icon.ico",
        "icons/icon name.png",
        "other/icon.png",
    ] {
        assert_eq!(icon_backup_file_name(invalid), None, "{invalid}");
    }
}

#[test]
fn keeps_only_latest_five_config_backups() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-backup-test-{}",
        datetime::timestamp_nanos(datetime::now_local())
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

// V151-S3-2: the config files below were written by the v1.5.0 app itself (the public demo
// profile and the lead's v1.5.0 test profile). Reading them with the v1.5.1 code must give the
// same "しばらく動いていないもの" answer as v1.5.0 did.
#[test]
fn reads_v150_config_fixtures_with_the_same_staleness() {
    let now = datetime::parse_rfc3339("2026-11-20T06:00:00Z").expect("fixed now");
    let public: AppConfig = serde_json::from_str(include_str!(
        "../../../tests/fixtures/v150/public/config-v150.json"
    ))
    .expect("public v1.5.0 config");
    let lead: AppConfig = serde_json::from_str(include_str!(
        "../../../tests/fixtures/v150/lead/config-v150.json"
    ))
    .expect("lead v1.5.0 config");

    let stale_ids = |config: &AppConfig| {
        config
            .projects
            .iter()
            .filter(|project| project_is_stale_at(project, now))
            .map(|project| project.id.clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(
        stale_ids(&public),
        [
            "sample-stretch".to_string(),
            "sample-writing".to_string(),
            "sample-music".to_string(),
            "sample-home".to_string()
        ]
    );
    assert!(stale_ids(&lead).is_empty());
    assert_eq!(public.settings.first_run_done_at.as_deref(), None);
    assert_eq!(
        lead.settings.first_run_done_at.as_deref(),
        Some("2026-11-19T14:21:31.260Z")
    );
}

#[test]
fn keeps_the_latest_five_v150_backup_names() {
    let dir = std::env::temp_dir().join(format!(
        "life-launcher-v150-backups-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    fs::create_dir_all(&dir).expect("create backup dir");
    let names = [
        "config-20261118-120000-000000000.json",
        "config-20261119-232600-027915400.json",
        "config-20261119-232643-944431000.json",
        "config-20261119-232645-392691100.json",
        "config-20261119-232717-843668500.json",
        "config-20261120-010016-351359600.json",
    ];
    for name in names {
        fs::write(dir.join(name), b"{}").expect("write v1.5.0 backup");
    }

    prune_config_backups(&dir).expect("prune v1.5.0 backups");

    let mut kept = fs::read_dir(&dir)
        .expect("read backup dir")
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    kept.sort();
    assert_eq!(kept, names[1..].to_vec());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn creates_daily_backup_zip_and_prunes_old_generations() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-daily-backup-test-{}",
        datetime::timestamp_nanos(datetime::now_local())
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
    fs::create_dir_all(data_dir.join(ICON_CACHE_DIR_NAME)).expect("create icons");
    fs::write(
        data_dir.join(ICON_CACHE_DIR_NAME).join("cached-button.png"),
        b"\x89PNG\r\n\x1a\nicon",
    )
    .expect("write cached icon");
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
    let backup_entries = read_zip(&backup_bytes).expect("read backup entries");
    assert_eq!(
        backup_entries
            .iter()
            .find(|entry| entry.name == "icons/cached-button.png")
            .map(|entry| entry.data.as_slice()),
        Some(b"\x89PNG\r\n\x1a\nicon".as_slice())
    );

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
        datetime::timestamp_nanos(datetime::now_local())
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
                data:
                    br#"{"date":"2026-07-08","label":"restore","startedAt":"10:00","minutes":12}"#
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
            ZipEntry {
                name: "icons/restored-button.png".to_string(),
                data: b"\x89PNG\r\n\x1a\nrestored".to_vec(),
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
    assert_eq!(
        fs::read(
            data_dir
                .join(ICON_CACHE_DIR_NAME)
                .join("restored-button.png")
        )
        .expect("read restored icon"),
        b"\x89PNG\r\n\x1a\nrestored"
    );

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
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let previous_appdata = std::env::var_os("APPDATA");
    std::env::set_var("APPDATA", &root);
    let data_dir = config_dir_path().expect("config dir");
    fs::create_dir_all(&data_dir).expect("create data dir");
    fs::write(data_dir.join(CONFIG_FILE_NAME), b"{\"version\":2}").expect("write current");
    fs::create_dir_all(data_dir.join(ICON_CACHE_DIR_NAME)).expect("create icons");
    fs::write(
        data_dir
            .join(ICON_CACHE_DIR_NAME)
            .join("current-button.png"),
        b"\x89PNG\r\n\x1a\ncurrent",
    )
    .expect("write current icon");

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
    assert!(pre_restore_dir
        .join(ICON_CACHE_DIR_NAME)
        .join("current-button.png")
        .exists());
    assert!(data_dir
        .join(ICON_CACHE_DIR_NAME)
        .join("current-button.png")
        .exists());

    if let Some(value) = previous_appdata {
        std::env::set_var("APPDATA", value);
    } else {
        std::env::remove_var("APPDATA");
    }
    let _ = fs::remove_dir_all(root);
}

#[test]
fn source_completion_history_is_optional_for_legacy_config() {
    let mut value = serde_json::to_value(sample_config()).expect("serialize sample config");
    value
        .as_object_mut()
        .expect("config object")
        .remove("sourceCompletions");
    let legacy: AppConfig = serde_json::from_value(value).expect("legacy config parses");
    assert!(legacy.source_completions.is_empty());
}

#[test]
fn today_candidate_exclusions_are_backward_compatible_and_normalized() {
    let mut value = serde_json::to_value(sample_config()).expect("serialize sample config");
    value
        .get_mut("today")
        .and_then(serde_json::Value::as_object_mut)
        .expect("today object")
        .remove("candidateExcludedSourceKeys");
    let legacy: AppConfig = serde_json::from_value(value).expect("legacy config parses");
    assert!(legacy.today.candidate_excluded_source_keys.is_empty());

    let mut config = legacy;
    config.today.candidate_excluded_source_keys = vec![
        " project:compose ".to_string(),
        "".to_string(),
        "project:compose".to_string(),
        "wishlist:item-1".to_string(),
    ];
    let (config, changed, _) = sanitize_config(config);
    assert!(changed);
    assert_eq!(
        config.today.candidate_excluded_source_keys,
        vec!["project:compose".to_string(), "wishlist:item-1".to_string()]
    );

    let mut value = serde_json::to_value(sample_config()).expect("serialize sample config");
    value
        .get_mut("today")
        .and_then(serde_json::Value::as_object_mut)
        .expect("today object")
        .remove("selectionMutationTokens");
    let legacy: AppConfig = serde_json::from_value(value).expect("legacy config parses");
    assert!(legacy.today.selection_mutation_tokens.is_empty());
}

#[test]
fn today_candidate_exclusions_reset_with_the_today_boundary() {
    let mut config = sample_config();
    config.today.date = "2000-01-01".to_string();
    config.today.candidate_excluded_source_keys = vec!["project:compose".to_string()];
    config
        .today
        .selection_mutation_tokens
        .insert("project:compose".to_string(), "old-op".to_string());

    let (config, changed, _) = sanitize_config(config);
    assert!(changed);
    assert!(config.today.candidate_excluded_source_keys.is_empty());
    assert!(config.today.selection_mutation_tokens.is_empty());
}

#[test]
fn undo_today_selection_restores_only_the_target_delta_at_its_neighbor() {
    let mut config = sample_config();
    let source_key = "project:compose".to_string();
    let item = TodayItem {
        text: "資料を1ページ読む".to_string(),
        done: true,
        source_key: Some(source_key.clone()),
        source_generation_id: None,
        trigger: Some("朝".to_string()),
        project_id: Some("compose".to_string()),
        button_ids: vec!["music-web".to_string()],
        instruction_path: None,
        instruction_open_on_start: None,
        default_timer_minutes: Some(25),
        short_timer_minutes: Some(5),
        expand_timer_on_start: None,
    };
    config.today.items = vec![
        TodayItem {
            source_key: Some("manual:later".to_string()),
            text: "後から追加".to_string(),
            ..config.today.items[0].clone()
        },
        TodayItem {
            source_key: Some("manual:next".to_string()),
            text: "次の隣".to_string(),
            ..config.today.items[1].clone()
        },
    ];
    config
        .today
        .selection_mutation_tokens
        .insert(source_key.clone(), "op-1".to_string());
    config.settings.backup_keep = 17;
    let input = UndoTodaySelectionInput {
        operation_id: "op-1".to_string(),
        day_key: config.today.date.clone(),
        source_key: source_key.clone(),
        item: Some(item.clone()),
        previous_source_key: None,
        next_source_key: Some("manual:next".to_string()),
        source_snapshot: current_source_snapshot(&config, &source_key),
        restore_exclusion: false,
    };

    let result = apply_undo_today_selection(config, &input).expect("target undo succeeds");
    assert_eq!(result.today.items[1], item);
    assert_eq!(result.today.items[0].text, "後から追加");
    assert_eq!(result.today.items[2].text, "次の隣");
    assert_eq!(result.settings.backup_keep, 17);
    assert!(!result
        .today
        .selection_mutation_tokens
        .contains_key(&source_key));
}

#[test]
fn undo_today_selection_rejects_a_stale_token_or_edited_source() {
    let mut config = sample_config();
    let source_key = "project:compose".to_string();
    config.today.items.clear();
    config
        .today
        .selection_mutation_tokens
        .insert(source_key.clone(), "newer-op".to_string());
    let mut input = UndoTodaySelectionInput {
        operation_id: "old-op".to_string(),
        day_key: config.today.date.clone(),
        source_key: source_key.clone(),
        item: None,
        previous_source_key: None,
        next_source_key: None,
        source_snapshot: current_source_snapshot(&config, &source_key),
        restore_exclusion: true,
    };
    assert!(apply_undo_today_selection(config.clone(), &input).is_err());

    input.operation_id = "newer-op".to_string();
    input.source_snapshot = Some(serde_json::json!({"stale": true}));
    assert!(apply_undo_today_selection(config, &input).is_err());
}

#[test]
fn undo_today_selection_rejects_full_capacity_and_accepts_retry_after_a_slot_opens() {
    let mut config = sample_config();
    let source_key = "project:compose".to_string();
    let mut removed_item = config.today.items[0].clone();
    removed_item.source_key = Some(source_key.clone());
    removed_item.project_id = Some("compose".to_string());
    config.today.items = (0..TODAY_ITEM_LIMIT)
        .map(|index| TodayItem {
            source_key: Some(format!("manual:{index}")),
            text: format!("existing item {index}"),
            ..config.today.items[0].clone()
        })
        .collect();
    config
        .today
        .selection_mutation_tokens
        .insert(source_key.clone(), "retry-op".to_string());
    config.settings.backup_keep = 17;
    let input = UndoTodaySelectionInput {
        operation_id: "retry-op".to_string(),
        day_key: config.today.date.clone(),
        source_key: source_key.clone(),
        item: Some(removed_item.clone()),
        previous_source_key: Some("manual:0".to_string()),
        next_source_key: Some("manual:2".to_string()),
        source_snapshot: current_source_snapshot(&config, &source_key),
        restore_exclusion: false,
    };

    let error = apply_undo_today_selection(config.clone(), &input)
        .expect_err("full Today must reject undo");
    assert!(error.contains("今日の3件が埋まっている"));

    config.today.items.remove(1);
    let expected_items = vec![
        config.today.items[0].clone(),
        removed_item,
        config.today.items[1].clone(),
    ];
    let result = apply_undo_today_selection(config, &input)
        .expect("the same undo succeeds once one slot is free");
    assert_eq!(result.today.items, expected_items);
    assert_eq!(result.today.items.len(), TODAY_ITEM_LIMIT);
    assert_eq!(result.settings.backup_keep, 17);
    assert!(!result
        .today
        .selection_mutation_tokens
        .contains_key(&source_key));
}

#[test]
fn undo_candidate_exclusion_accepts_defaulted_snapshot_without_adopting_an_item() {
    let mut config = sample_config();
    let source_key = "project:compose".to_string();
    config.projects[0]
        .next_step
        .as_mut()
        .expect("next step")
        .button_ids
        .clear();
    config.today.items.clear();
    config
        .today
        .candidate_excluded_source_keys
        .push(source_key.clone());
    config
        .today
        .selection_mutation_tokens
        .insert(source_key.clone(), "exclude-op".to_string());
    let omitted_snapshot = current_source_snapshot(&config, &source_key).expect("snapshot");
    assert!(omitted_snapshot["nextStep"].get("buttonIds").is_none());
    let mut defaulted_snapshot = omitted_snapshot.clone();
    defaulted_snapshot["nextStep"]["buttonIds"] = serde_json::json!([]);
    let mut input = UndoTodaySelectionInput {
        operation_id: "exclude-op".to_string(),
        day_key: config.today.date.clone(),
        source_key: source_key.clone(),
        item: None,
        previous_source_key: None,
        next_source_key: None,
        source_snapshot: current_source_snapshot(&config, &source_key),
        restore_exclusion: true,
    };
    for snapshot in [omitted_snapshot, defaulted_snapshot] {
        input.source_snapshot = Some(snapshot);
        let result = apply_undo_today_selection(config.clone(), &input)
            .expect("omitted and defaulted nested buttonIds describe the same source");
        assert!(result.today.items.is_empty());
        assert!(!result
            .today
            .candidate_excluded_source_keys
            .contains(&source_key));
        assert!(!result
            .today
            .selection_mutation_tokens
            .contains_key(&source_key));
    }
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

fn production_v2_config_value() -> Value {
    let mut value = serde_json::to_value(sample_config()).expect("serialize sample config");
    value["version"] = Value::from(2);
    value["projects"] = serde_json::json!([
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
        }
    ]);
    value
}

#[test]
fn production_load_backs_up_exact_v2_bytes_and_migrates_only_once() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-v2-production-load-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let previous_appdata = std::env::var_os("APPDATA");
    std::env::set_var("APPDATA", &root);
    let path = config_path().expect("config path");
    fs::create_dir_all(path.parent().expect("config parent")).expect("create config parent");
    let mut raw_v2 = serde_json::to_vec(&production_v2_config_value()).expect("serialize raw v2");
    raw_v2.extend_from_slice(b"\r\n");
    fs::write(&path, &raw_v2).expect("write raw v2");

    let first = load_config_from_disk().expect("load and migrate v2");
    assert!(first.changed);
    assert!(!first.save_blocked);
    assert_eq!(first.config.version, CONFIG_VERSION);
    let first_written = fs::read(&path).expect("read migrated v3");
    assert_ne!(first_written, raw_v2);
    let first_backups = config_backup_files();
    assert_eq!(first_backups.len(), 1);
    assert_eq!(
        fs::read(&first_backups[0]).expect("read raw migration backup"),
        raw_v2
    );

    let second = load_config_from_disk().expect("reload migrated v3");
    assert!(!second.changed);
    assert!(!second.save_blocked);
    assert_eq!(fs::read(&path).expect("read stable v3"), first_written);
    assert_eq!(config_backup_files(), first_backups);

    restore_test_appdata(previous_appdata, &root);
}

#[test]
fn production_load_blocks_unsafe_roots_and_preserves_original_bytes() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-blocked-production-load-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let previous_appdata = std::env::var_os("APPDATA");
    std::env::set_var("APPDATA", &root);
    let path = config_path().expect("config path");
    fs::create_dir_all(path.parent().expect("config parent")).expect("create config parent");

    let mut future = serde_json::to_value(sample_config()).expect("serialize future config");
    future["version"] = Value::from(CONFIG_VERSION + 1);
    let mut invalid_v3 =
        serde_json::to_value(sample_config()).expect("serialize invalid v3 config");
    invalid_v3["projects"][0]["nextStep"]["text"] = Value::from(42);
    let mut conflicting_v3 =
        serde_json::to_value(sample_config()).expect("serialize conflicting v3 config");
    conflicting_v3["projects"][0]["legacyNextStepSettings"] =
        serde_json::json!({ "shortTimerMinutes": 5 });
    let cases = [
        ("array root", b"[]".to_vec()),
        ("invalid json", b"{not-json".to_vec()),
        (
            "future version",
            serde_json::to_vec(&future).expect("serialize future version"),
        ),
        (
            "invalid v3",
            serde_json::to_vec(&invalid_v3).expect("serialize invalid v3"),
        ),
        (
            "active and pending v3",
            serde_json::to_vec(&conflicting_v3).expect("serialize conflicting v3"),
        ),
    ];

    for (label, bytes) in cases {
        fs::write(&path, &bytes).expect("write unsafe config");
        let response = load_config_from_disk().expect("return blocked load response");
        assert!(response.save_blocked, "{label} must block saves");
        assert!(!response.changed, "{label} must not report a rewrite");
        assert!(response.error.is_some(), "{label} must explain the failure");
        assert_eq!(
            fs::read(&path).expect("read preserved unsafe config"),
            bytes,
            "{label} must remain byte-for-byte unchanged"
        );
        assert!(
            config_backup_files().is_empty(),
            "{label} must not create a migration backup"
        );
    }

    restore_test_appdata(previous_appdata, &root);
}

#[test]
fn central_save_validation_rejects_invalid_existing_config_without_writing() {
    let _guard = ENV_LOCK.lock().expect("env lock");
    let root = std::env::temp_dir().join(format!(
        "life-launcher-save-validation-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let previous_appdata = std::env::var_os("APPDATA");
    std::env::set_var("APPDATA", &root);
    let path = config_path().expect("config path");
    fs::create_dir_all(path.parent().expect("config parent")).expect("create config parent");
    let original = b"{\"version\":3,\"projects\":\"broken\"}\r\n";
    fs::write(&path, original).expect("write invalid existing config");

    let error = validate_existing_config_before_save(&path)
        .expect_err("invalid existing config must block the central save path");
    assert!(error.contains("save was blocked"));
    assert_eq!(
        fs::read(&path).expect("read rejected existing config"),
        original
    );
    assert!(config_backup_files().is_empty());

    restore_test_appdata(previous_appdata, &root);
}

#[test]
fn failed_atomic_replacement_retains_original_destination() {
    let root = std::env::temp_dir().join(format!(
        "life-launcher-atomic-replace-failure-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    fs::create_dir_all(&root).expect("create replacement root");
    let destination = root.join("config.json");
    let original = b"original config bytes";
    fs::write(&destination, original).expect("write original destination");

    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;

        let locked_destination = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&destination)
            .expect("lock original against replacement");
        write_config(&destination, &sample_config())
            .expect_err("locked destination must reject atomic replacement");
        drop(locked_destination);
    }
    #[cfg(not(windows))]
    {
        let missing_replacement = root.join("missing.tmp");
        replace_file_atomically(&destination, &missing_replacement)
            .expect_err("missing replacement must fail atomically");
    }
    assert_eq!(
        fs::read(&destination).expect("read retained destination"),
        original
    );
    assert!(fs::read_dir(&root)
        .expect("read replacement root")
        .filter_map(Result::ok)
        .all(|entry| !entry.file_name().to_string_lossy().ends_with(".tmp")));

    let _ = fs::remove_dir_all(root);
}

#[test]
fn unique_atomic_write_ignores_a_locked_legacy_temp_file() {
    let root = std::env::temp_dir().join(format!(
        "life-launcher-unique-temp-{}",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    fs::create_dir_all(&root).expect("create unique temp root");
    let destination = root.join("config.schema.json");
    let legacy_temp = destination.with_extension("json.tmp");
    fs::write(&legacy_temp, b"legacy temp").expect("write legacy temp");

    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;

        let locked_legacy_temp = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&legacy_temp)
            .expect("lock legacy temp file");
        write_bytes_atomically(&destination, b"new schema", "schema")
            .expect("unique temp name should avoid the locked legacy file");
        drop(locked_legacy_temp);
    }
    #[cfg(not(windows))]
    write_bytes_atomically(&destination, b"new schema", "schema")
        .expect("unique temp name should avoid the legacy file");

    assert_eq!(
        fs::read(&destination).expect("read destination"),
        b"new schema"
    );
    assert_eq!(
        fs::read(&legacy_temp).expect("read legacy temp"),
        b"legacy temp"
    );

    let _ = fs::remove_dir_all(root);
}
