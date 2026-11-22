use std::collections::{HashMap, HashSet};

use super::super::instructions::normalize_instruction_folder_settings;
use crate::datetime;
use crate::models::{
    default_backup_keep, default_day_start_hour, default_focus_hotkey, default_timer_minutes,
    short_timer_minutes, AppConfig, InboxItem, LauncherButton, OverlayPage, Project, Settings,
    TodayVictory, CONFIG_VERSION, EXECUTION_TRIGGER_MAX_CHARS, OVERLAY_PAGE_NAME_MAX_CHARS,
    TODAY_ITEM_LIMIT, WEEKLY_FOCUS_LIMIT,
};

const CONFIG_SCHEMA_REF: &str = "./config.schema.json";
pub(super) const PROJECT_NORTH_STAR_MAX_CHARS: usize = 60;
const NEXT_STEP_RESUME_NOTE_MAX_CHARS: usize = 80;
const OVERLAY_ALL_PAGE_NAME: &str = "すべて";
const OVERLAY_UNCLASSIFIED_PAGE_NAME: &str = "未分類";
const LEGACY_UNCLASSIFIED_GROUP_NAME: &str = "その他";

pub(super) fn should_backup_before_config_rewrite(
    raw_version: u8,
    migrated_overlay_pages: bool,
) -> bool {
    raw_version < CONFIG_VERSION || migrated_overlay_pages
}

fn is_reserved_overlay_page_name(name: &str) -> bool {
    matches!(name, OVERLAY_ALL_PAGE_NAME | OVERLAY_UNCLASSIFIED_PAGE_NAME)
}

pub(super) fn migrate_overlay_pages_from_groups(config: &mut AppConfig) -> bool {
    if config.overlay_pages.is_some() {
        return false;
    }

    let mut ordered_names = Vec::new();
    let mut seen_names = HashSet::new();
    for raw_group in config.groups.iter().chain(
        config
            .buttons
            .iter()
            .filter_map(|button| button.group.as_ref()),
    ) {
        let name = raw_group.trim();
        if name.is_empty()
            || name == LEGACY_UNCLASSIFIED_GROUP_NAME
            || is_reserved_overlay_page_name(name)
            || !config.buttons.iter().any(|button| {
                button.show_in_overlay
                    && button
                        .group
                        .as_deref()
                        .is_some_and(|group| group.trim() == name)
            })
        {
            continue;
        }

        let name_key = name.to_lowercase();
        if seen_names.insert(name_key) {
            ordered_names.push(name.to_string());
        }
    }

    let pages: Vec<OverlayPage> = ordered_names
        .iter()
        .enumerate()
        .map(|(index, name)| OverlayPage {
            id: format!("overlay-page-{}", index + 1),
            name: name.clone(),
        })
        .collect();
    let page_ids_by_name: HashMap<String, String> = pages
        .iter()
        .map(|page| (page.name.to_lowercase(), page.id.clone()))
        .collect();

    for button in &mut config.buttons {
        button.overlay_page_id = if button.show_in_overlay {
            button.group.as_deref().and_then(|group| {
                let name = group.trim();
                if name.is_empty()
                    || name == LEGACY_UNCLASSIFIED_GROUP_NAME
                    || is_reserved_overlay_page_name(name)
                {
                    None
                } else {
                    page_ids_by_name.get(&name.to_lowercase()).cloned()
                }
            })
        } else {
            None
        };
    }

    config.overlay_pages = Some(pages);
    true
}

pub(crate) fn sanitize_config(mut config: AppConfig) -> (AppConfig, bool, Vec<String>) {
    let mut changed = false;
    let mut warnings = Vec::new();

    if config.version != CONFIG_VERSION {
        config.version = CONFIG_VERSION;
        changed = true;
        warnings.push(format!("version: migrated to {CONFIG_VERSION}"));
    }

    if config.schema.as_deref() != Some(CONFIG_SCHEMA_REF) {
        config.schema = Some(CONFIG_SCHEMA_REF.to_string());
        changed = true;
    }

    normalize_settings(&mut config.settings, &mut changed);

    let today = datetime::today_date(config.settings.day_start_hour);
    if config.today.date != today {
        config.today.date = today;
        config.today.items.clear();
        config.today.victory = TodayVictory::default();
        config.today.candidate_excluded_source_keys.clear();
        config.today.selection_mutation_tokens.clear();
        changed = true;
    }

    normalize_victory(&mut config.today.victory, &mut changed);

    if config.today.items.len() > TODAY_ITEM_LIMIT {
        config.today.items.truncate(TODAY_ITEM_LIMIT);
        changed = true;
        warnings.push("today.items: truncated to 3".to_string());
    }
    let mut seen_excluded_sources = std::collections::HashSet::new();
    let normalized_excluded_sources: Vec<String> = config
        .today
        .candidate_excluded_source_keys
        .iter()
        .map(|key| key.trim())
        .filter(|key| !key.is_empty())
        .filter(|key| seen_excluded_sources.insert((*key).to_string()))
        .map(str::to_string)
        .collect();
    if normalized_excluded_sources != config.today.candidate_excluded_source_keys {
        config.today.candidate_excluded_source_keys = normalized_excluded_sources;
        changed = true;
    }
    normalize_today_item_triggers(&mut config.today.items, &mut changed, &mut warnings);

    trim_empty_buttons(&mut config.buttons, &mut changed, &mut warnings);
    normalize_groups(&mut config.groups, &config.buttons, &mut changed);
    normalize_overlay_pages(
        &mut config.overlay_pages,
        &mut config.buttons,
        &mut changed,
        &mut warnings,
    );
    normalize_dictionary_order(
        &mut config.dictionary_order,
        &config.buttons,
        &mut changed,
        &mut warnings,
    );
    trim_empty_projects(&mut config.projects, &mut changed, &mut warnings);
    normalize_weekly_focus(&mut config.projects, &mut changed, &mut warnings);
    normalize_today_item_projects(&mut config.today.items, &config.projects, &mut changed);
    normalize_today_item_timer_snapshots(
        &mut config.today.items,
        &config.projects,
        &config.settings,
        &mut changed,
    );
    normalize_today_item_source_keys(
        &mut config.today.items,
        &config.today.date,
        &mut changed,
        &mut warnings,
    );
    trim_empty_inbox(&mut config.inbox, &mut changed);
    normalize_inbox_ids(&mut config.inbox, &mut changed);
    normalize_inbox_projects(&mut config.inbox, &config.projects, &mut changed);

    (config, changed, warnings)
}

pub(super) fn morning_victory_suggestion(config: &AppConfig) -> Option<String> {
    let day_start_hour = if config.settings.day_start_hour <= 23 {
        config.settings.day_start_hour
    } else {
        default_day_start_hour()
    };
    let today = datetime::today_date(day_start_hour);
    let text = config.today.victory.text.trim();

    if config.today.date != today && !config.today.victory.done && !text.is_empty() {
        Some(text.to_string())
    } else {
        None
    }
}

fn trim_empty_buttons(
    buttons: &mut Vec<LauncherButton>,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let before = buttons.len();
    buttons.retain(|button| !button.id.trim().is_empty() && !button.label.trim().is_empty());
    if buttons.len() != before {
        *changed = true;
        warnings.push("buttons: removed entries with empty id or label".to_string());
    }

    for button in buttons {
        if button
            .group
            .as_deref()
            .is_some_and(|group| group.trim().is_empty())
        {
            button.group = None;
            *changed = true;
        }
        if button
            .icon_source
            .as_deref()
            .is_some_and(|source| source.trim().is_empty())
        {
            button.icon_source = None;
            *changed = true;
        }
        let aliases = normalize_aliases(&button.aliases);
        if button.aliases != aliases {
            button.aliases = aliases;
            *changed = true;
        }
        if button
            .description
            .as_deref()
            .is_some_and(|description| description.trim().is_empty())
        {
            button.description = None;
            *changed = true;
        }
    }
}

fn normalize_aliases(aliases: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for alias in aliases {
        let clean = alias.trim();
        if clean.is_empty() {
            continue;
        }
        if !normalized.iter().any(|existing| existing == clean) {
            normalized.push(clean.to_string());
        }
        if normalized.len() >= 20 {
            break;
        }
    }
    normalized
}

fn normalize_groups(groups: &mut Vec<String>, buttons: &[LauncherButton], changed: &mut bool) {
    let mut normalized: Vec<String> = Vec::new();

    for group in groups
        .iter()
        .chain(buttons.iter().filter_map(|button| button.group.as_ref()))
    {
        let clean = group.trim();
        if clean.is_empty() {
            continue;
        }

        if !normalized.iter().any(|existing| existing == clean) {
            normalized.push(clean.to_string());
        }
    }

    if *groups != normalized {
        *groups = normalized;
        *changed = true;
    }
}

fn normalize_overlay_pages(
    overlay_pages: &mut Option<Vec<OverlayPage>>,
    buttons: &mut [LauncherButton],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let Some(pages) = overlay_pages.as_mut() else {
        return;
    };

    let original_pages = pages.clone();
    let mut normalized_pages = Vec::new();
    let mut seen_ids = HashSet::new();
    let mut seen_names = HashSet::new();

    for page in pages.iter() {
        let id = page.id.trim();
        let raw_name = page.name.trim();
        if id.is_empty() || raw_name.is_empty() || is_reserved_overlay_page_name(raw_name) {
            continue;
        }

        let name: String = raw_name.chars().take(OVERLAY_PAGE_NAME_MAX_CHARS).collect();
        let name_key = name.to_lowercase();
        if !seen_ids.insert(id.to_string()) || !seen_names.insert(name_key) {
            continue;
        }

        if name.chars().count() < raw_name.chars().count() {
            warnings.push(format!(
                "overlayPages.{}: truncated name to {} characters",
                id, OVERLAY_PAGE_NAME_MAX_CHARS
            ));
        }
        normalized_pages.push(OverlayPage {
            id: id.to_string(),
            name,
        });
    }

    if original_pages != normalized_pages {
        *pages = normalized_pages;
        *changed = true;
        if original_pages.len() != pages.len() {
            warnings.push("overlayPages: removed invalid or duplicate entries".to_string());
        }
    }

    let valid_ids: HashSet<&str> = pages.iter().map(|page| page.id.as_str()).collect();
    for button in buttons {
        let normalized_id = button
            .overlay_page_id
            .as_deref()
            .map(str::trim)
            .filter(|id| !id.is_empty() && valid_ids.contains(id))
            .map(str::to_string);
        if button.overlay_page_id != normalized_id {
            button.overlay_page_id = normalized_id;
            *changed = true;
        }
    }
}

fn normalize_dictionary_order(
    dictionary_order: &mut Option<Vec<String>>,
    buttons: &[LauncherButton],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let original = dictionary_order.clone();
    let visible_ids: HashSet<&str> = buttons
        .iter()
        .filter(|button| button.show_in_overlay)
        .map(|button| button.id.as_str())
        .collect();
    let mut seen = HashSet::new();
    let mut normalized = Vec::with_capacity(visible_ids.len());

    for id in dictionary_order.as_deref().unwrap_or_default() {
        if !id.is_empty() && visible_ids.contains(id.as_str()) && seen.insert(id.clone()) {
            normalized.push(id.clone());
        }
    }

    for button in buttons.iter().filter(|button| button.show_in_overlay) {
        if seen.insert(button.id.clone()) {
            normalized.push(button.id.clone());
        }
    }

    let next = Some(normalized);
    if original != next {
        if original.is_some() {
            warnings.push(
                "dictionaryOrder: removed unknown, hidden, or duplicate ids and appended missing buttons"
                    .to_string(),
            );
        }
        *dictionary_order = next;
        *changed = true;
    }
}

fn normalize_victory(victory: &mut TodayVictory, changed: &mut bool) {
    if victory.text.trim().is_empty() && victory.done {
        victory.done = false;
        *changed = true;
    }
}

pub(super) fn trim_empty_projects(
    projects: &mut Vec<Project>,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let before = projects.len();
    projects.retain(|project| !project.id.trim().is_empty() && !project.name.trim().is_empty());
    if projects.len() != before {
        *changed = true;
        warnings.push("projects: removed entries with empty id or name".to_string());
    }

    for project in projects {
        if let Some(north_star) = project.north_star.take() {
            let trimmed = north_star.trim();
            if trimmed.is_empty() {
                *changed = true;
            } else {
                let normalized = trimmed
                    .chars()
                    .take(PROJECT_NORTH_STAR_MAX_CHARS)
                    .collect::<String>();
                if normalized != north_star {
                    *changed = true;
                }
                if trimmed.chars().count() > PROJECT_NORTH_STAR_MAX_CHARS {
                    warnings.push("projects: truncated northStar to 60 characters".to_string());
                }
                project.north_star = Some(normalized);
            }
        }

        if project
            .next_step
            .as_ref()
            .is_some_and(|step| step.text.trim().is_empty())
        {
            project.next_step = None;
            *changed = true;
        }
        if let Some(next_step) = project.next_step.as_mut() {
            normalize_execution_trigger(
                &mut next_step.trigger,
                "projects.nextStep.trigger",
                changed,
                warnings,
            );
            if next_step
                .source_wishlist_id
                .as_deref()
                .is_some_and(|value| value.trim().is_empty())
            {
                next_step.source_wishlist_id = None;
                *changed = true;
            }
            if let Some(raw_resume_note) = next_step.resume_note.clone() {
                let trimmed = raw_resume_note.trim();
                let normalized = if trimmed.is_empty() {
                    None
                } else {
                    let cut: String = trimmed
                        .chars()
                        .take(NEXT_STEP_RESUME_NOTE_MAX_CHARS)
                        .collect();
                    let final_note = cut.trim_end().to_string();
                    if final_note.is_empty() {
                        None
                    } else {
                        Some(final_note)
                    }
                };
                if normalized.as_deref() != Some(raw_resume_note.as_str()) {
                    next_step.resume_note = normalized;
                    *changed = true;
                }
            }
            normalize_project_timestamp(&mut next_step.updated_at, changed);
            normalize_project_timestamp(&mut next_step.reviewed_at, changed);
            if next_step.updated_at.is_none() && next_step.reviewed_at.is_none() {
                let baseline = datetime::format_rfc3339_auto(datetime::now_utc());
                next_step.updated_at = Some(baseline.clone());
                next_step.reviewed_at = Some(baseline);
                *changed = true;
            }
            normalize_next_step_execution(
                &mut next_step.button_ids,
                &mut next_step.default_timer_minutes,
                &mut next_step.short_timer_minutes,
                &mut next_step.start_note_template,
                &mut next_step.instruction_path,
                &mut next_step.instruction_open_on_start,
                changed,
                warnings,
            );
        }
        if let Some(pending) = project.legacy_next_step_settings.as_mut() {
            normalize_next_step_execution(
                &mut pending.button_ids,
                &mut pending.default_timer_minutes,
                &mut pending.short_timer_minutes,
                &mut pending.start_note_template,
                &mut pending.instruction_path,
                &mut pending.instruction_open_on_start,
                changed,
                warnings,
            );
            if pending.is_empty() {
                project.legacy_next_step_settings = None;
                *changed = true;
            }
        }

        if project.color_id.as_deref().is_some_and(|color_id| {
            !matches!(
                color_id,
                "amber"
                    | "blue"
                    | "green"
                    | "violet"
                    | "rose"
                    | "cyan"
                    | "orange"
                    | "slate"
                    | "lime"
                    | "magenta"
                    | "sand"
                    | "coral"
            )
        }) {
            project.color_id = None;
            *changed = true;
            warnings.push("projects: removed an invalid colorId".to_string());
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn normalize_next_step_execution(
    button_ids: &mut Vec<String>,
    default_timer_minutes: &mut Option<u32>,
    short_timer_minutes: &mut Option<u32>,
    start_note_template: &mut Option<String>,
    instruction_path: &mut Option<String>,
    instruction_open_on_start: &mut Option<bool>,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let normalized: Vec<String> = button_ids
        .iter()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
        .fold(Vec::new(), |mut ids, id| {
            if !ids.iter().any(|item| item == id) {
                ids.push(id.to_string());
            }
            ids
        });
    if *button_ids != normalized {
        *button_ids = normalized;
        *changed = true;
    }
    for timer in [default_timer_minutes, short_timer_minutes] {
        if timer.is_some_and(|minutes| !(1..=240).contains(&minutes)) {
            *timer = None;
            *changed = true;
            warnings.push("projects.nextStep: removed an invalid timer override".to_string());
        }
    }
    if let Some(template) = start_note_template.take() {
        let trimmed = template.trim();
        if !trimmed.is_empty() {
            *start_note_template = Some(trimmed.to_string());
        }
        if trimmed != template {
            *changed = true;
        }
    }
    if let Some(path) = instruction_path.take() {
        let normalized = normalize_instruction_folder_settings(std::slice::from_ref(&path));
        if normalized.first() != Some(&path) {
            *changed = true;
        }
        *instruction_path = normalized.into_iter().next();
    }
    if instruction_path.is_none() && instruction_open_on_start.is_some() {
        *instruction_open_on_start = None;
        *changed = true;
    }
}

fn normalize_project_timestamp(value: &mut Option<String>, changed: &mut bool) {
    let Some(raw) = value.take() else {
        return;
    };
    let trimmed = raw.trim();
    if datetime::parse_rfc3339(trimmed).is_some() {
        if trimmed != raw {
            *changed = true;
        }
        *value = Some(trimmed.to_string());
    } else {
        *changed = true;
    }
}

pub(super) fn project_is_stale_at(project: &Project, now: datetime::Instant) -> bool {
    let Some(next_step) = project.next_step.as_ref() else {
        return false;
    };
    // P10-05 (D11): the basis is the newer of "reviewed" and "updated". An unreadable side is
    // ignored; when neither can be read the Project is not stale (same as before).
    let reviewed = next_step
        .reviewed_at
        .as_ref()
        .and_then(|value| datetime::parse_rfc3339(value));
    let updated = next_step
        .updated_at
        .as_ref()
        .and_then(|value| datetime::parse_rfc3339(value));
    let Some(basis) = reviewed
        .into_iter()
        .chain(updated)
        .max_by_key(|value| datetime::timestamp_millis(*value))
    else {
        return false;
    };

    datetime::is_at_least_days_old(basis, now, 14)
}

fn normalize_today_item_projects(
    items: &mut [crate::models::TodayItem],
    projects: &[Project],
    changed: &mut bool,
) {
    let project_ids = projects
        .iter()
        .map(|project| project.id.as_str())
        .collect::<HashSet<_>>();
    for item in items {
        let should_remove = item.project_id.as_deref().is_some_and(|project_id| {
            project_id.trim().is_empty() || !project_ids.contains(project_id)
        });
        if should_remove {
            item.project_id = None;
            *changed = true;
        }
    }
}

fn normalize_today_item_timer_snapshots(
    items: &mut [crate::models::TodayItem],
    projects: &[Project],
    settings: &crate::models::Settings,
    changed: &mut bool,
) {
    for item in items {
        let project = item
            .project_id
            .as_deref()
            .and_then(|project_id| projects.iter().find(|project| project.id == project_id));
        let default_minutes = project
            .and_then(|project| project.next_step.as_ref())
            .and_then(|step| step.default_timer_minutes)
            .unwrap_or(settings.default_timer_minutes.into());
        let short_minutes = project
            .and_then(|project| project.next_step.as_ref())
            .and_then(|step| step.short_timer_minutes)
            .unwrap_or(settings.short_timer_minutes.into());

        if item
            .default_timer_minutes
            .is_none_or(|minutes| !(1..=240).contains(&minutes))
        {
            item.default_timer_minutes = Some(default_minutes);
            *changed = true;
        }
        if item
            .short_timer_minutes
            .is_none_or(|minutes| !(1..=240).contains(&minutes))
        {
            item.short_timer_minutes = Some(short_minutes);
            *changed = true;
        }
    }
}

fn normalize_today_item_triggers(
    items: &mut [crate::models::TodayItem],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    for item in items {
        normalize_execution_trigger(&mut item.trigger, "today.items.trigger", changed, warnings);
    }
}

fn normalize_today_item_source_keys(
    items: &mut [crate::models::TodayItem],
    date: &str,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let mut seen = HashSet::new();
    for (index, item) in items.iter_mut().enumerate() {
        let was_missing = item
            .source_key
            .as_deref()
            .is_none_or(|value| value.trim().is_empty());
        let base = item
            .source_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .or_else(|| {
                item.project_id
                    .as_deref()
                    .map(|project_id| format!("project:{project_id}"))
            })
            .unwrap_or_else(|| format!("legacy:{date}:{}", index + 1));
        let mut source_key = base.clone();
        let mut suffix = 2;
        while !seen.insert(source_key.clone()) {
            source_key = format!("{base}:{suffix}");
            suffix += 1;
        }

        if item.source_key.as_deref() != Some(source_key.as_str()) {
            item.source_key = Some(source_key);
            *changed = true;
        }
        if was_missing && item.done {
            item.done = false;
            *changed = true;
            warnings.push(
                "today.items.done: legacy manual completion normalized to incomplete".to_string(),
            );
        }
    }
}

fn normalize_execution_trigger(
    trigger: &mut Option<String>,
    field: &str,
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let Some(value) = trigger.take() else {
        return;
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        *changed = true;
        return;
    }

    let normalized = trimmed
        .chars()
        .take(EXECUTION_TRIGGER_MAX_CHARS)
        .collect::<String>();
    if normalized != value {
        *changed = true;
    }
    if trimmed.chars().count() > EXECUTION_TRIGGER_MAX_CHARS {
        warnings.push(format!("{field}: truncated to 40 characters"));
    }
    *trigger = Some(normalized);
}

fn trim_empty_inbox(inbox: &mut Vec<InboxItem>, changed: &mut bool) {
    let before = inbox.len();
    inbox.retain(|item| !item.text.trim().is_empty());
    if inbox.len() != before {
        *changed = true;
    }
}

fn normalize_inbox_ids(inbox: &mut [InboxItem], changed: &mut bool) {
    let reserved = inbox
        .iter()
        .filter_map(|item| item.id.as_deref().map(str::trim))
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    for (index, item) in inbox.iter_mut().enumerate() {
        let existing_id = item
            .id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let base = existing_id
            .clone()
            .unwrap_or_else(|| format!("legacy-{}", index + 1));
        let mut id = base.clone();
        let mut suffix = 2;
        while seen.contains(&id)
            || (existing_id.as_deref() != Some(id.as_str()) && reserved.contains(&id))
        {
            id = format!("{base}-{suffix}");
            suffix += 1;
        }
        seen.insert(id.clone());
        if item.id.as_deref() != Some(id.as_str()) {
            item.id = Some(id);
            *changed = true;
        }
    }
}

fn normalize_inbox_projects(inbox: &mut [InboxItem], projects: &[Project], changed: &mut bool) {
    let project_ids = projects
        .iter()
        .map(|project| project.id.as_str())
        .collect::<HashSet<_>>();
    for item in inbox {
        let should_remove = item.project_id.as_deref().is_some_and(|project_id| {
            project_id.trim().is_empty() || !project_ids.contains(project_id)
        });
        if should_remove {
            item.project_id = None;
            *changed = true;
        }
    }
}

fn normalize_weekly_focus(
    projects: &mut [Project],
    changed: &mut bool,
    warnings: &mut Vec<String>,
) {
    let mut focused_count = 0;
    let mut trimmed = false;
    for project in projects {
        if project.weekly_focus == Some(true) {
            if focused_count < WEEKLY_FOCUS_LIMIT {
                focused_count += 1;
            } else {
                project.weekly_focus = None;
                *changed = true;
                trimmed = true;
            }
        }
    }
    if trimmed {
        warnings.push("projects: limited weeklyFocus to 3".to_string());
    }
}

pub(super) fn normalize_settings(settings: &mut Settings, changed: &mut bool) {
    if let Some(hotkey) = &settings.focus_hotkey {
        if hotkey.trim().is_empty() {
            settings.focus_hotkey = None;
            *changed = true;
        } else if hotkey.trim().eq_ignore_ascii_case("Alt+Space") {
            settings.focus_hotkey = default_focus_hotkey();
            *changed = true;
        }
    }
    if settings.default_timer_minutes == 0 {
        settings.default_timer_minutes = default_timer_minutes();
        *changed = true;
    }
    if settings.default_timer_minutes > 240 {
        settings.default_timer_minutes = 240;
        *changed = true;
    }
    if settings.short_timer_minutes == 0 {
        settings.short_timer_minutes = short_timer_minutes();
        *changed = true;
    }
    if settings.short_timer_minutes > 240 {
        settings.short_timer_minutes = 240;
        *changed = true;
    }
    if settings.day_start_hour > 23 {
        settings.day_start_hour = default_day_start_hour();
        *changed = true;
    }
    if settings
        .backup_folder
        .as_deref()
        .is_some_and(|folder| folder.trim().is_empty())
    {
        settings.backup_folder = None;
        *changed = true;
    }
    if settings.backup_keep == 0 {
        settings.backup_keep = default_backup_keep();
        *changed = true;
    }
    if let Some(folders) = settings.instruction_folders.take() {
        let normalized = normalize_instruction_folder_settings(&folders);
        if normalized != folders {
            *changed = true;
        }
        settings.instruction_folders = Some(normalized);
    }
    if let Some(hotkey) = settings.instruction_hotkey.take() {
        let trimmed = hotkey.trim();
        if trimmed.is_empty() {
            *changed = true;
        } else {
            if trimmed != hotkey {
                *changed = true;
            }
            settings.instruction_hotkey = Some(trimmed.to_string());
        }
    }
    // P10-11 (§8.2): an unreadable timestamp is only dropped; it is never replaced here.
    if let Some(stamp) = settings.first_run_done_at.take() {
        let trimmed = stamp.trim();
        if trimmed.is_empty() || datetime::parse_rfc3339(trimmed).is_none() {
            *changed = true;
        } else {
            if trimmed != stamp {
                *changed = true;
            }
            settings.first_run_done_at = Some(trimmed.to_string());
        }
    }
}
