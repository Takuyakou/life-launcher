use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, State};

use crate::commands::config::{
    config_dir_path, config_path, ensure_config_schema_file, load_config_internal, read_zip,
    reconcile_config_instruction_roots, sanitize_config, validate_project_v3_invariants,
    write_config, write_zip, ZipEntry, RUNTIME_BACKUP_FILES,
};
use crate::models::{AppConfig, InboxItem, NextStepV3, Project};
use crate::state::AppState;

const IMPORT_VERSION: u64 = 1;
const MAX_IMPORT_BYTES: usize = 256 * 1024;
const MAX_PROJECTS: usize = 30;
const MAX_WISHES: usize = 100;
const MAX_PROJECT_NAME_CHARS: usize = 120;
const MAX_NEXT_STEP_TEXT_CHARS: usize = 120;
const MAX_WISH_TEXT_CHARS: usize = 120;
const MAX_GOAL_CHARS: usize = 60;
const MAX_TRIGGER_CHARS: usize = 40;
const MIN_TIMER_MINUTES: u32 = 1;
const MAX_TIMER_MINUTES: u32 = 240;
const IMPORT_BACKUP_DIR: &str = "imports";
const IMPORT_BACKUP_PREFIX: &str = "import-";
const IMPORT_BACKUP_KEEP: usize = 20;
const PROJECT_COLOR_IDS: [&str; 12] = [
    "amber", "blue", "green", "violet", "rose", "cyan", "orange", "slate", "lime", "magenta",
    "sand", "coral",
];

static IMPORT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn new_id(prefix: &str) -> String {
    let sequence = IMPORT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let timestamp = chrono::Utc::now().timestamp_millis();
    format!("{prefix}-{timestamp:x}-{sequence:x}")
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn char_len(value: &str) -> usize {
    value.chars().count()
}

fn normalize_name(value: &str) -> String {
    value.trim().to_lowercase()
}

pub(crate) fn config_fingerprint(config: &AppConfig) -> String {
    let bytes = serde_json::to_vec(config).unwrap_or_default();
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100_0000_01b3);
    }
    format!("{hash:016x}")
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectedItem {
    pub path: String,
    pub reason: String,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewProject {
    pub name: String,
    pub color: Option<String>,
    pub goal: Option<String>,
    pub next_step: Option<String>,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewExistingProject {
    pub name: String,
    pub fill_color: Option<String>,
    pub fill_goal: Option<String>,
    pub next_step_action: String,
    pub next_step_reason: Option<String>,
    pub next_step_text: Option<String>,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewNextStep {
    pub project: String,
    pub text: String,
    pub action: String,
    pub reason: Option<String>,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWish {
    pub text: String,
    pub project: Option<String>,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCounts {
    pub new_projects: usize,
    pub existing_projects: usize,
    pub next_steps: usize,
    pub wishes: usize,
    pub rejected: usize,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub new_projects: Vec<PreviewProject>,
    pub existing_projects: Vec<PreviewExistingProject>,
    pub next_steps: Vec<PreviewNextStep>,
    pub wishes: Vec<PreviewWish>,
    pub rejected: Vec<RejectedItem>,
    pub ignored: Vec<String>,
    pub merged: Vec<String>,
    pub skipped: Vec<String>,
    pub counts: PreviewCounts,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewResponse {
    pub preview: ImportPreview,
    pub fingerprint: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCommitResponse {
    pub config: AppConfig,
    pub path: String,
    pub import_id: String,
    pub fingerprint: String,
    pub preview: ImportPreview,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportUndoResponse {
    pub config: AppConfig,
    pub path: String,
}

#[derive(Clone)]
struct ParsedNextStep {
    text: String,
    trigger: Option<String>,
    minutes: Option<u32>,
    short_minutes: Option<u32>,
}

#[derive(Clone)]
struct ParsedProject {
    normalized: String,
    name: String,
    color: Option<String>,
    goal: Option<String>,
    next_step: Option<ParsedNextStep>,
    wishes: Vec<String>,
}

struct ParsedImport {
    projects: Vec<ParsedProject>,
    wishes: Vec<String>,
    ignored: Vec<String>,
    rejected: Vec<RejectedItem>,
    merged: Vec<String>,
}

fn rejected(path: impl Into<String>, reason: impl Into<String>) -> RejectedItem {
    RejectedItem {
        path: path.into(),
        reason: reason.into(),
    }
}

fn unknown_keys(
    object: &Map<String, Value>,
    allowed: &[&str],
    prefix: &str,
    ignored: &mut Vec<String>,
) {
    for key in object.keys() {
        if !allowed.contains(&key.as_str()) {
            ignored.push(format!("{prefix}{key}"));
        }
    }
}

fn parse_next_step(
    object: &Map<String, Value>,
    index: usize,
    ignored: &mut Vec<String>,
    rejected_items: &mut Vec<RejectedItem>,
) -> Option<ParsedNextStep> {
    let path = format!("projects[{index}].nextStep");
    unknown_keys(
        object,
        &["text", "trigger", "minutes", "shortMinutes"],
        &format!("{path}."),
        ignored,
    );
    let Some(text) = object.get("text").and_then(Value::as_str) else {
        rejected_items.push(rejected(
            format!("{path}.text"),
            "次の一手の本文がありません",
        ));
        return None;
    };
    let text = text.trim();
    if text.is_empty() {
        rejected_items.push(rejected(format!("{path}.text"), "次の一手の本文が空です"));
        return None;
    }
    if char_len(text) > MAX_NEXT_STEP_TEXT_CHARS {
        rejected_items.push(rejected(
            format!("{path}.text"),
            format!("次の一手の本文が{MAX_NEXT_STEP_TEXT_CHARS}文字を超えています"),
        ));
        return None;
    }

    let mut trigger = None;
    if let Some(value) = object.get("trigger") {
        match value.as_str().map(str::trim) {
            Some(value) if char_len(value) <= MAX_TRIGGER_CHARS => {
                if !value.is_empty() {
                    trigger = Some(value.to_string());
                }
            }
            Some(_) => rejected_items.push(rejected(
                format!("{path}.trigger"),
                format!("きっかけが{MAX_TRIGGER_CHARS}文字を超えています"),
            )),
            None => rejected_items.push(rejected(
                format!("{path}.trigger"),
                "きっかけが文字ではありません",
            )),
        }
    }

    let parse_minutes = |key: &str, rejected_items: &mut Vec<RejectedItem>| -> Option<u32> {
        let value = object.get(key)?;
        let Some(number) = value.as_u64() else {
            rejected_items.push(rejected(
                format!("{path}.{key}"),
                format!("{key} が整数ではありません"),
            ));
            return None;
        };
        let number = u32::try_from(number).ok()?;
        if !(MIN_TIMER_MINUTES..=MAX_TIMER_MINUTES).contains(&number) {
            rejected_items.push(rejected(
                format!("{path}.{key}"),
                format!("{key} は{MIN_TIMER_MINUTES}〜{MAX_TIMER_MINUTES}の範囲で指定してください"),
            ));
            return None;
        }
        Some(number)
    };
    let minutes = parse_minutes("minutes", rejected_items);
    let short_minutes = parse_minutes("shortMinutes", rejected_items);

    Some(ParsedNextStep {
        text: text.to_string(),
        trigger,
        minutes,
        short_minutes,
    })
}

fn parse_project(
    value: &Value,
    index: usize,
    ignored: &mut Vec<String>,
    rejected_items: &mut Vec<RejectedItem>,
) -> Option<ParsedProject> {
    let path = format!("projects[{index}]");
    let Some(object) = value.as_object() else {
        rejected_items.push(rejected(path, "プロジェクトがオブジェクトではありません"));
        return None;
    };
    unknown_keys(
        object,
        &["name", "color", "goal", "nextStep", "wishes"],
        &format!("{path}."),
        ignored,
    );

    let Some(name) = object.get("name").and_then(Value::as_str) else {
        rejected_items.push(rejected(
            format!("{path}.name"),
            "プロジェクト名がありません",
        ));
        return None;
    };
    let name = name.trim();
    if name.is_empty() {
        rejected_items.push(rejected(format!("{path}.name"), "プロジェクト名が空です"));
        return None;
    }
    if char_len(name) > MAX_PROJECT_NAME_CHARS {
        rejected_items.push(rejected(
            format!("{path}.name"),
            format!("プロジェクト名が{MAX_PROJECT_NAME_CHARS}文字を超えています"),
        ));
        return None;
    }

    let mut color = None;
    if let Some(value) = object.get("color") {
        if let Some(value) = value.as_str() {
            if PROJECT_COLOR_IDS.contains(&value) {
                color = Some(value.to_string());
            } else {
                ignored.push(format!("{path}.color"));
            }
        } else {
            ignored.push(format!("{path}.color"));
        }
    }

    let mut goal = None;
    if let Some(value) = object.get("goal") {
        if let Some(value) = value.as_str() {
            let value = value.trim();
            if !value.is_empty() {
                if char_len(value) <= MAX_GOAL_CHARS {
                    goal = Some(value.to_string());
                } else {
                    rejected_items.push(rejected(
                        format!("{path}.goal"),
                        format!("目標が{MAX_GOAL_CHARS}文字を超えています"),
                    ));
                }
            }
        } else {
            rejected_items.push(rejected(format!("{path}.goal"), "目標が文字ではありません"));
        }
    }

    let next_step = object
        .get("nextStep")
        .and_then(Value::as_object)
        .map(|object| parse_next_step(object, index, ignored, rejected_items))
        .unwrap_or(None);
    if object.get("nextStep").is_some()
        && object.get("nextStep").and_then(Value::as_object).is_none()
    {
        rejected_items.push(rejected(
            format!("{path}.nextStep"),
            "次の一手がオブジェクトではありません",
        ));
    }

    let mut wishes = Vec::new();
    if let Some(value) = object.get("wishes") {
        if let Some(array) = value.as_array() {
            for (wish_index, wish) in array.iter().enumerate() {
                let wish_path = format!("{path}.wishes[{wish_index}]");
                let Some(wish) = wish.as_str() else {
                    rejected_items.push(rejected(wish_path, "やりたいことが文字ではありません"));
                    continue;
                };
                let wish = wish.trim();
                if wish.is_empty() {
                    rejected_items.push(rejected(wish_path, "やりたいことが空です"));
                } else if char_len(wish) > MAX_WISH_TEXT_CHARS {
                    rejected_items.push(rejected(
                        wish_path,
                        format!("やりたいことが{MAX_WISH_TEXT_CHARS}文字を超えています"),
                    ));
                } else {
                    wishes.push(wish.to_string());
                }
            }
        } else {
            rejected_items.push(rejected(
                format!("{path}.wishes"),
                "やりたいことが配列ではありません",
            ));
        }
    }

    Some(ParsedProject {
        normalized: normalize_name(name),
        name: name.to_string(),
        color,
        goal,
        next_step,
        wishes,
    })
}

fn parse_import(json: &str) -> Result<ParsedImport, String> {
    if json.len() > MAX_IMPORT_BYTES {
        return Err("JSONが256 KBを超えています".to_string());
    }
    let value: Value =
        serde_json::from_str(json).map_err(|error| format!("JSONを読めません: {error}"))?;
    let Some(object) = value.as_object() else {
        return Err("JSONの一番上がオブジェクトではありません".to_string());
    };
    match object.get("lifeLauncherImport").and_then(Value::as_u64) {
        Some(IMPORT_VERSION) => {}
        Some(_) => return Err("この形式の版には対応していません".to_string()),
        None => return Err("「lifeLauncherImport」がありません".to_string()),
    }

    let mut ignored = Vec::new();
    unknown_keys(
        object,
        &["lifeLauncherImport", "projects", "wishes"],
        "",
        &mut ignored,
    );
    let mut rejected_items = Vec::new();
    let mut merged = Vec::new();

    let empty_values: Vec<Value> = Vec::new();
    let project_values: &[Value] = match object.get("projects") {
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| "projects が配列ではありません".to_string())?,
        None => &empty_values,
    };
    if project_values.len() > MAX_PROJECTS {
        return Err(format!("プロジェクトが{MAX_PROJECTS}件を超えています"));
    }
    let wish_values: &[Value] = match object.get("wishes") {
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| "wishes が配列ではありません".to_string())?,
        None => &empty_values,
    };
    let mut raw_wish_count = wish_values.len();
    for value in project_values {
        if let Some(wishes) = value.get("wishes").and_then(Value::as_array) {
            raw_wish_count += wishes.len();
        }
    }
    if raw_wish_count > MAX_WISHES {
        return Err(format!("やりたいことが{MAX_WISHES}件を超えています"));
    }

    let mut projects: Vec<ParsedProject> = Vec::new();
    for (index, value) in project_values.iter().enumerate() {
        let Some(project) = parse_project(value, index, &mut ignored, &mut rejected_items) else {
            continue;
        };
        if let Some(existing) = projects
            .iter_mut()
            .find(|item| item.normalized == project.normalized)
        {
            existing.wishes.extend(project.wishes);
            if existing.color.is_none() {
                existing.color = project.color;
            }
            if existing.goal.is_none() {
                existing.goal = project.goal;
            }
            if existing.next_step.is_none() {
                existing.next_step = project.next_step;
            }
            merged.push(project.name);
            continue;
        }
        projects.push(project);
    }

    let mut wishes = Vec::new();
    for (index, value) in wish_values.iter().enumerate() {
        let path = format!("wishes[{index}]");
        let Some(wish) = value.as_str() else {
            rejected_items.push(rejected(path, "やりたいことが文字ではありません"));
            continue;
        };
        let wish = wish.trim();
        if wish.is_empty() {
            rejected_items.push(rejected(path, "やりたいことが空です"));
        } else if char_len(wish) > MAX_WISH_TEXT_CHARS {
            rejected_items.push(rejected(
                path,
                format!("やりたいことが{MAX_WISH_TEXT_CHARS}文字を超えています"),
            ));
        } else {
            wishes.push(wish.to_string());
        }
    }

    Ok(ParsedImport {
        projects,
        wishes,
        ignored,
        rejected: rejected_items,
        merged,
    })
}

fn build_next_step(parsed: ParsedNextStep) -> NextStepV3 {
    NextStepV3 {
        text: parsed.text,
        generation_id: Some(new_id("generation")),
        trigger: parsed.trigger,
        updated_at: Some(now_iso()),
        reviewed_at: Some(now_iso()),
        button_ids: Vec::new(),
        default_timer_minutes: parsed.minutes,
        short_timer_minutes: parsed.short_minutes,
        expand_timer_on_start: None,
        start_note_template: None,
        instruction_path: None,
        instruction_open_on_start: None,
    }
}

struct ImportPlan {
    config: AppConfig,
    preview: ImportPreview,
}

fn add_wish(
    config: &mut AppConfig,
    project_id: Option<String>,
    text: String,
    preview: &mut ImportPreview,
) {
    let text = text.trim().to_string();
    if text.is_empty() {
        return;
    }
    if config
        .inbox
        .iter()
        .any(|item| item.project_id == project_id && item.text.trim() == text)
    {
        preview.skipped.push(format!(
            "「{text}」は同じ文のやりたいことがあるため足しません"
        ));
        return;
    }
    let project = project_id
        .as_ref()
        .and_then(|id| config.projects.iter().find(|project| &project.id == id))
        .map(|project| project.name.clone());
    config.inbox.push(InboxItem {
        id: Some(new_id("wishlist")),
        text: text.clone(),
        project_id,
        button_ids: Vec::new(),
        instruction_path: None,
        instruction_open_on_start: None,
    });
    preview.wishes.push(PreviewWish { text, project });
}

fn build_import_plan(current: &AppConfig, parsed: ParsedImport) -> Result<ImportPlan, String> {
    let mut config = current.clone();
    let mut preview = ImportPreview {
        ignored: parsed.ignored,
        rejected: parsed.rejected,
        merged: parsed.merged,
        ..ImportPreview::default()
    };

    for project in parsed.projects {
        let existing_index = config
            .projects
            .iter()
            .position(|item| normalize_name(&item.name) == project.normalized);

        if let Some(index) = existing_index {
            let (existing_id, existing_name) = {
                let existing = &config.projects[index];
                (existing.id.clone(), existing.name.clone())
            };
            let mut fill_color = None;
            let mut fill_goal = None;
            let mut next_step_action = "insert".to_string();
            let mut next_step_reason = None;
            let mut next_step_text = None;
            let next_step = project.next_step.clone();
            {
                let existing = &mut config.projects[index];
                if existing.color_id.is_none() {
                    if let Some(color) = &project.color {
                        existing.color_id = Some(color.clone());
                        fill_color = Some(color.clone());
                    }
                }
                if existing
                    .north_star
                    .as_deref()
                    .is_none_or(|value| value.trim().is_empty())
                {
                    if let Some(goal) = &project.goal {
                        existing.north_star = Some(goal.clone());
                        fill_goal = Some(goal.clone());
                    }
                }
                if let Some(next_step) = &next_step {
                    next_step_text = Some(next_step.text.clone());
                    let has_next_step = existing
                        .next_step
                        .as_ref()
                        .is_some_and(|step| !step.text.trim().is_empty());
                    if has_next_step {
                        next_step_action = "wishlist".to_string();
                        next_step_reason = Some(
                            "このプロジェクトにはすでに次の一手があるため、やりたいことに入れます"
                                .to_string(),
                        );
                    } else if existing.legacy_next_step_settings.is_some() {
                        next_step_action = "wishlist".to_string();
                        next_step_reason = Some(
                            "このプロジェクトには前の実行設定が残っているため、やりたいことに入れます"
                                .to_string(),
                        );
                    } else {
                        existing.next_step = Some(build_next_step(next_step.clone()));
                    }
                }
            }
            if let Some(next_step) = next_step {
                if next_step_action == "wishlist" {
                    add_wish(
                        &mut config,
                        Some(existing_id.clone()),
                        next_step.text,
                        &mut preview,
                    );
                }
                preview.next_steps.push(PreviewNextStep {
                    project: existing_name.clone(),
                    text: next_step_text.clone().unwrap_or_default(),
                    action: next_step_action.clone(),
                    reason: next_step_reason.clone(),
                });
            }
            for wish in project.wishes {
                add_wish(&mut config, Some(existing_id.clone()), wish, &mut preview);
            }
            preview.existing_projects.push(PreviewExistingProject {
                name: existing_name,
                fill_color,
                fill_goal,
                next_step_action,
                next_step_reason,
                next_step_text,
            });
        } else {
            let id = new_id("project");
            let next_step = project.next_step.map(build_next_step);
            let next_step_text = next_step.as_ref().map(|step| step.text.clone());
            config.projects.push(Project {
                id: id.clone(),
                name: project.name.clone(),
                north_star: project.goal.clone(),
                weekly_focus: None,
                color_id: project.color.clone(),
                next_step,
                legacy_next_step_settings: None,
            });
            preview.new_projects.push(PreviewProject {
                name: project.name.clone(),
                color: project.color.clone(),
                goal: project.goal.clone(),
                next_step: next_step_text.clone(),
            });
            if let Some(text) = next_step_text {
                preview.next_steps.push(PreviewNextStep {
                    project: project.name.clone(),
                    text,
                    action: "insert".to_string(),
                    reason: None,
                });
            }
            for wish in project.wishes {
                add_wish(&mut config, Some(id.clone()), wish, &mut preview);
            }
        }
    }

    for wish in parsed.wishes {
        add_wish(&mut config, None, wish, &mut preview);
    }

    preview.counts = PreviewCounts {
        new_projects: preview.new_projects.len(),
        existing_projects: preview.existing_projects.len(),
        next_steps: preview.next_steps.len(),
        wishes: preview.wishes.len(),
        rejected: preview.rejected.len(),
    };
    validate_project_v3_invariants(&config)?;
    Ok(ImportPlan { config, preview })
}

#[tauri::command]
pub fn preview_import(app: AppHandle, json: String) -> Result<ImportPreviewResponse, String> {
    let parsed = parse_import(&json)?;
    let current = load_config_internal(&app)?.config;
    let plan = build_import_plan(&current, parsed)?;
    Ok(ImportPreviewResponse {
        preview: plan.preview,
        fingerprint: config_fingerprint(&current),
    })
}

#[tauri::command]
pub fn commit_import(
    app: AppHandle,
    state: State<'_, AppState>,
    json: String,
    fingerprint: String,
) -> Result<ImportCommitResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let current = load_config_internal(&app)?.config;
    if config_fingerprint(&current) != fingerprint {
        return Err("stale:設定が変わったため、もう一度確かめてください".to_string());
    }
    let parsed = parse_import(&json)?;
    let plan = build_import_plan(&current, parsed)?;
    let ImportPlan { config, preview } = plan;
    validate_project_v3_invariants(&config)?;
    let (mut config, _changed, _warnings) = sanitize_config(config);
    reconcile_config_instruction_roots(&mut config);

    let data_dir = config_dir_path()?;
    ensure_config_schema_file()?;
    let import_id = new_id("import");
    create_import_backup_in(&data_dir, &import_id)?;
    let path = config_path()?;
    *state
        .suppress_reload_until
        .lock()
        .map_err(|_| "failed to lock reload state".to_string())? =
        Some(Instant::now() + Duration::from_millis(900));
    write_config(&path, &config)?;

    Ok(ImportCommitResponse {
        fingerprint: config_fingerprint(&config),
        config,
        path: path.to_string_lossy().to_string(),
        import_id,
        preview,
    })
}

#[tauri::command]
pub fn undo_import(
    app: AppHandle,
    state: State<'_, AppState>,
    import_id: String,
    fingerprint: String,
) -> Result<ImportUndoResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let current = load_config_internal(&app)?.config;
    let data_dir = config_dir_path()?;
    let backup_path = import_backup_path(&data_dir, &import_id)?;
    if config_fingerprint(&current) != fingerprint {
        return Err(format!(
            "changed:取り込んだあとに変更があるため戻せません。バックアップ: {}",
            backup_path.display()
        ));
    }
    let restored = restore_import_backup_in(&data_dir, &import_id)?;
    validate_project_v3_invariants(&restored)?;
    let (mut config, _changed, _warnings) = sanitize_config(restored);
    reconcile_config_instruction_roots(&mut config);
    let path = config_path()?;
    ensure_config_schema_file()?;
    write_config(&path, &config)?;
    Ok(ImportUndoResponse {
        config,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn read_import_json(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|error| format!("ファイルを読めません: {error}"))?;
    if !metadata.is_file() {
        return Err("ファイルではありません".to_string());
    }
    if metadata.len() > MAX_IMPORT_BYTES as u64 {
        return Err("ファイルが256 KBを超えています".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| format!("ファイルを読めません: {error}"))?;
    if bytes.len() > MAX_IMPORT_BYTES {
        return Err("ファイルが256 KBを超えています".to_string());
    }
    let bytes = bytes
        .strip_prefix(&[0xEF, 0xBB, 0xBF][..])
        .unwrap_or(bytes.as_slice());
    String::from_utf8(bytes.to_vec()).map_err(|_| "UTF-8として読めません".to_string())
}

fn import_backup_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("backups").join(IMPORT_BACKUP_DIR)
}

fn import_backup_path(data_dir: &Path, import_id: &str) -> Result<PathBuf, String> {
    if import_id.is_empty()
        || !import_id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return Err("取り込みIDが不正です".to_string());
    }
    Ok(import_backup_dir(data_dir).join(format!("{import_id}.zip")))
}

fn runtime_backup_entries(data_dir: &Path) -> Result<Vec<ZipEntry>, String> {
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
    Ok(entries)
}

fn create_import_backup_in(data_dir: &Path, import_id: &str) -> Result<PathBuf, String> {
    let dir = import_backup_dir(data_dir);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create {}: {error}", dir.display()))?;
    let entries = runtime_backup_entries(data_dir)?;
    let path = import_backup_path(data_dir, import_id)?;
    write_zip(&path, &entries)?;
    let written =
        fs::read(&path).map_err(|error| format!("failed to verify {}: {error}", path.display()))?;
    let verified = read_zip(&written)?;
    if verified.len() != entries.len()
        || entries.iter().any(|expected| {
            verified
                .iter()
                .find(|entry| entry.name == expected.name)
                .is_none_or(|entry| entry.data != expected.data)
        })
    {
        return Err(format!("backup validation failed: {}", path.display()));
    }
    prune_import_backups(&dir, IMPORT_BACKUP_KEEP)?;
    Ok(path)
}

fn prune_import_backups(dir: &Path, keep: usize) -> Result<(), String> {
    let mut files = fs::read_dir(dir)
        .map_err(|error| format!("failed to read {}: {error}", dir.display()))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with(IMPORT_BACKUP_PREFIX) && name.ends_with(".zip")
                })
        })
        .collect::<Vec<_>>();
    files.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
    });
    for path in files.into_iter().rev().skip(keep) {
        fs::remove_file(&path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))?;
    }
    Ok(())
}

fn restore_import_backup_in(data_dir: &Path, import_id: &str) -> Result<AppConfig, String> {
    let path = import_backup_path(data_dir, import_id)?;
    let bytes = fs::read(&path).map_err(|error| format!("バックアップを読めません: {error}"))?;
    let entries = read_zip(&bytes)?;
    let config_entry = entries
        .iter()
        .find(|entry| entry.name == "config.json")
        .ok_or_else(|| "バックアップに設定がありません".to_string())?;
    let config: AppConfig = serde_json::from_slice(&config_entry.data)
        .map_err(|error| format!("設定を読めません: {error}"))?;
    Ok(config)
}

#[cfg(test)]
mod tests {
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
        let plan = build_import_plan(config, parsed).expect("plan");
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
                trigger: None,
                updated_at: None,
                reviewed_at: None,
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
        let json = r#"{"lifeLauncherImport":1,"projects":[{"name":"英語","nextStep":{"text":"新しい一手"}}]}"#;
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
}
