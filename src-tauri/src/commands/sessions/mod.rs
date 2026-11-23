#[cfg(test)]
mod tests;

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::commands::config::{backups_path, configured_day_start_hour, load_config_internal};
use crate::datetime::{self, Date};
use crate::models::{
    DeleteSessionEntryInput, DoNowCandidate, DoNowResponse, ManualSessionInput, Project,
    ProjectSessionTotal, RecentSessionEntry, SessionEntriesFilter, SessionEntriesResponse,
    SessionEntryRow, SessionLogEntry, SessionLogInput, SessionSummaryResponse,
    SessionTotalResponse, Today, UpdateSessionEntryInput, WeeklyReviewProjectSummary,
    WeeklyReviewResponse,
};
use crate::state::AppState;

const SESSIONS_FILE_NAME: &str = "sessions.jsonl";

#[tauri::command]
pub fn load_today_session_total(_app: AppHandle) -> Result<SessionTotalResponse, String> {
    let path = sessions_path()?;
    let date = datetime::today_date(configured_day_start_hour());
    let total_minutes = total_for_date(&path, &date)?;

    Ok(SessionTotalResponse {
        date,
        total_minutes,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn record_session(
    _app: AppHandle,
    state: State<'_, AppState>,
    session: SessionLogInput,
) -> Result<SessionTotalResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let path = sessions_path()?;
    let date = datetime::today_date(configured_day_start_hour());

    if session.minutes > 0 {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }

        let entry = SessionLogEntry {
            id: Some(new_session_id()),
            date: date.clone(),
            project_id: session.project_id,
            label: session.label,
            started_at: session.started_at,
            minutes: session.minutes,
            note: session.note,
            manual: false,
        };
        append_session_entry(&path, &entry)?;
    }

    let total_minutes = total_for_date(&path, &date)?;
    Ok(SessionTotalResponse {
        date,
        total_minutes,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn record_manual_session(
    _app: AppHandle,
    state: State<'_, AppState>,
    session: ManualSessionInput,
) -> Result<SessionSummaryResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let path = sessions_path()?;
    let date = session.date.trim();
    datetime::parse_date(date)
        .ok_or_else(|| format!("manual session date must be YYYY-MM-DD: {date}"))?;
    if session.minutes == 0 {
        return Err("manual session minutes must be greater than 0".to_string());
    }
    let started_at = normalize_started_at(&session.started_at)?;

    let entry = SessionLogEntry {
        id: Some(new_session_id()),
        date: date.to_string(),
        project_id: session.project_id,
        label: session.label,
        started_at,
        minutes: session.minutes,
        note: session.note,
        manual: true,
    };
    append_session_entry(&path, &entry)?;
    load_session_summary(_app)
}

#[tauri::command]
pub fn load_session_summary(_app: AppHandle) -> Result<SessionSummaryResponse, String> {
    let path = sessions_path()?;
    let date = datetime::today_date(configured_day_start_hour());
    let today =
        datetime::parse_date(&date).ok_or_else(|| format!("failed to parse today date {date}"))?;
    let week_start = datetime::week_start_date(today);
    let entries = read_session_entries(&path)?;
    let mut today_minutes = 0u32;
    let mut week_minutes = 0u32;
    let all_time_projects = project_totals(&entries);
    let mut weekly_entries = Vec::new();

    for entry in &entries {
        let Some(entry_date) = datetime::parse_date(&entry.date) else {
            continue;
        };
        if entry.date == date {
            today_minutes = today_minutes.saturating_add(entry.minutes);
        }
        if entry_date < week_start || entry_date > today {
            continue;
        }

        week_minutes = week_minutes.saturating_add(entry.minutes);
        weekly_entries.push(entry.clone());
    }

    Ok(SessionSummaryResponse {
        date,
        today_minutes,
        week_minutes,
        active_days: active_days_between(&entries, week_start, today),
        projects: project_totals(&weekly_entries),
        all_time_projects,
        recent_sessions: recent_sessions(&entries),
        path: path.to_string_lossy().to_string(),
    })
}

fn project_totals(entries: &[SessionLogEntry]) -> Vec<ProjectSessionTotal> {
    let mut totals = BTreeMap::<String, (Option<String>, String, u32, BTreeSet<String>)>::new();
    for entry in entries {
        let key = entry
            .project_id
            .clone()
            .unwrap_or_else(|| format!("label:{}", entry.label));
        let total = totals.entry(key).or_insert_with(|| {
            (
                entry.project_id.clone(),
                display_session_label(entry),
                0,
                BTreeSet::new(),
            )
        });
        total.2 = total.2.saturating_add(entry.minutes);
        if datetime::parse_date(&entry.date).is_some() {
            total.3.insert(entry.date.clone());
        }
    }

    let mut projects = totals
        .into_values()
        .map(
            |(project_id, label, total_minutes, active_dates)| ProjectSessionTotal {
                project_id,
                label,
                active_days: active_dates.len() as u32,
                total_minutes,
            },
        )
        .collect::<Vec<_>>();
    projects.sort_by(|a, b| {
        b.total_minutes
            .cmp(&a.total_minutes)
            .then_with(|| a.label.cmp(&b.label))
    });
    projects
}

#[tauri::command]
pub fn load_weekly_review(_app: AppHandle) -> Result<WeeklyReviewResponse, String> {
    let date = datetime::today_date(configured_day_start_hour());
    let today =
        datetime::parse_date(&date).ok_or_else(|| format!("failed to parse today date {date}"))?;
    let current_week_start = datetime::week_start_date(today);
    let previous_week_start = datetime::add_days(current_week_start, -7);
    let previous_week_end = datetime::add_days(current_week_start, -1);
    let entries = read_session_entries(&sessions_path()?)?;
    Ok(build_weekly_review(
        &entries,
        current_week_start,
        previous_week_start,
        previous_week_end,
    ))
}

#[tauri::command]
pub fn load_do_now_candidates(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DoNowResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let _write_guard = state
        .config_write_lock
        .lock()
        .map_err(|_| "failed to lock config writes".to_string())?;
    let config = load_config_internal(&app)?.config;
    let date = datetime::today_date(config.settings.day_start_hour);
    let entries = read_session_entries(&sessions_path()?)?;

    Ok(DoNowResponse {
        candidates: build_do_now_candidates(&config.projects, &entries, &config.today, &date),
        date,
    })
}

/// Where today's Today3 holds an unfinished item adopted from this Project's current Next Step
/// (same generation, strictly: both missing counts as equal, only one present does not).
/// The position counts unfinished cards from the left (0-based); finished cards and cards that
/// belong to no project still take a place, so the numbers compare like the visible order.
fn project_today3_position(project: &Project, today: &Today, date: &str) -> Option<usize> {
    let step = project.next_step.as_ref()?;
    if today.date != date {
        return None;
    }
    let source_key = format!("project:{}", project.id);
    today
        .items
        .iter()
        .filter(|item| !item.done)
        .position(|item| {
            item.source_key.as_deref().map(str::trim) == Some(source_key.as_str())
                && item.source_generation_id == step.generation_id
        })
}

fn build_do_now_candidates(
    projects: &[Project],
    entries: &[SessionLogEntry],
    today_state: &Today,
    date: &str,
) -> Vec<DoNowCandidate> {
    let today = datetime::parse_date(date);
    let mut candidates = projects
        .iter()
        .enumerate()
        .filter(|(_, project)| {
            project
                .next_step
                .as_ref()
                .is_some_and(|step| !step.text.trim().is_empty())
        })
        .map(|(manual_index, project)| {
            let today3_position = project_today3_position(project, today_state, date);
            let weekly_focus = project.weekly_focus == Some(true);
            let executed_today = entries.iter().any(|entry| {
                entry.date == date && entry.project_id.as_deref() == Some(project.id.as_str())
            });
            let last_session = entries
                .iter()
                .filter(|entry| entry.project_id.as_deref() == Some(project.id.as_str()))
                .filter_map(|entry| {
                    datetime::parse_date(&entry.date)
                        .map(|entry_date| (entry_date, entry.started_at.clone()))
                })
                .max();
            let restart_eligible = today
                .zip(last_session.as_ref().map(|(last_date, _)| *last_date))
                .is_some_and(|(today, last)| (today - last).whole_days() >= 14);
            (
                manual_index,
                weekly_focus,
                project.id.clone(),
                executed_today,
                last_session,
                restart_eligible,
                today3_position,
            )
        })
        .collect::<Vec<_>>();

    candidates.sort_by(|left, right| {
        // A Project whose current Next Step is in Today3 comes first, in Today3's left-to-right
        // order (unfinished cards only); not a filter.
        right
            .6
            .is_some()
            .cmp(&left.6.is_some())
            .then_with(|| left.6.cmp(&right.6))
            .then_with(|| right.1.cmp(&left.1))
            .then_with(|| left.3.cmp(&right.3))
            .then_with(|| left.4.cmp(&right.4))
            .then_with(|| left.0.cmp(&right.0))
    });

    candidates
        .iter()
        .enumerate()
        .map(
            |(
                index,
                (
                    _,
                    weekly_focus,
                    project_id,
                    executed_today,
                    last_session,
                    restart_eligible,
                    today3_position,
                ),
            )| {
                let reason = if today3_position.is_some() {
                    "today3"
                } else if !executed_today {
                    "noToday"
                } else if candidates
                    .iter()
                    .enumerate()
                    .any(|(other_index, candidate)| {
                        other_index != index
                            && candidate.1 == *weekly_focus
                            && candidate.3 == *executed_today
                            && candidate.4 == *last_session
                            && candidate.6.is_some() == today3_position.is_some()
                    })
                {
                    "manualOrder"
                } else {
                    "oldestSession"
                };
                DoNowCandidate {
                    project_id: project_id.clone(),
                    reason: reason.to_string(),
                    restart_eligible: *restart_eligible,
                }
            },
        )
        .collect()
}

fn build_weekly_review(
    entries: &[SessionLogEntry],
    current_week_start: Date,
    previous_week_start: Date,
    previous_week_end: Date,
) -> WeeklyReviewResponse {
    let mut total_minutes = 0u32;
    let mut active_dates = std::collections::BTreeSet::<String>::new();
    let mut project_totals = BTreeMap::<String, (Option<String>, String, u32, u32)>::new();

    for entry in entries {
        let Some(entry_date) = datetime::parse_date(&entry.date) else {
            continue;
        };
        if entry_date < previous_week_start || entry_date > previous_week_end {
            continue;
        }

        total_minutes = total_minutes.saturating_add(entry.minutes);
        active_dates.insert(entry.date.clone());
        let key = entry
            .project_id
            .clone()
            .unwrap_or_else(|| format!("label:{}", entry.label));
        let label = if entry.label.trim().is_empty() {
            "未分類".to_string()
        } else {
            entry.label.clone()
        };
        let total = project_totals
            .entry(key)
            .or_insert((entry.project_id.clone(), label, 0, 0));
        total.2 = total.2.saturating_add(1);
        total.3 = total.3.saturating_add(entry.minutes);
    }

    WeeklyReviewResponse {
        week_key: datetime::format_date(current_week_start),
        previous_week_start: datetime::format_date(previous_week_start),
        previous_week_end: datetime::format_date(previous_week_end),
        total_minutes,
        active_days: u32::try_from(active_dates.len()).unwrap_or(u32::MAX),
        projects: project_totals
            .into_values()
            .map(
                |(project_id, label, session_count, total_minutes)| WeeklyReviewProjectSummary {
                    project_id,
                    label,
                    session_count,
                    total_minutes,
                },
            )
            .collect(),
    }
}

#[tauri::command]
pub fn load_session_entries(
    _app: AppHandle,
    filter: Option<SessionEntriesFilter>,
) -> Result<SessionEntriesResponse, String> {
    let path = sessions_path()?;
    let date = datetime::today_date(configured_day_start_hour());
    let read = read_session_file(&path)?;
    let entries = filter_session_entries(&read.entries, filter.as_ref(), &date)?;

    Ok(SessionEntriesResponse {
        date,
        entries,
        path: path.to_string_lossy().to_string(),
        warning: invalid_lines_warning(read.invalid_count),
    })
}

#[tauri::command]
pub fn update_session_entry(
    _app: AppHandle,
    state: State<'_, AppState>,
    input: UpdateSessionEntryInput,
) -> Result<SessionEntriesResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let path = sessions_path()?;
    let mut read = read_session_file(&path)?;
    let row_key = input.row_key.trim();
    if row_key.is_empty() {
        return Err("session row key is required".to_string());
    }
    let date = input.date.trim();
    datetime::parse_date(date).ok_or_else(|| format!("session date must be YYYY-MM-DD: {date}"))?;
    if input.minutes == 0 {
        return Err("session minutes must be greater than 0".to_string());
    }
    let label = input.label.trim();
    if label.is_empty() {
        return Err("session label is required".to_string());
    }
    let started_at = input.started_at.trim();
    if started_at.is_empty() {
        return Err("session start time is required".to_string());
    }

    let index = read
        .entries
        .iter()
        .enumerate()
        .find_map(|(index, entry)| (session_row_key(index, entry) == row_key).then_some(index))
        .ok_or_else(|| "session entry was not found".to_string())?;

    let entry = &mut read.entries[index];
    if entry.id.is_none() {
        entry.id = Some(new_session_id());
    }
    entry.date = date.to_string();
    entry.project_id = normalize_optional(input.project_id);
    entry.label = label.to_string();
    entry.started_at = started_at.to_string();
    entry.minutes = input.minutes;
    entry.note = input.note;

    backup_sessions_file(&path)?;
    rewrite_session_entries(&path, &read.entries)?;
    load_session_entries(_app, None)
}

#[tauri::command]
pub fn delete_session_entry(
    _app: AppHandle,
    state: State<'_, AppState>,
    input: DeleteSessionEntryInput,
) -> Result<SessionEntriesResponse, String> {
    let _reset_guard = state.begin_app_write()?;
    let path = sessions_path()?;
    let mut read = read_session_file(&path)?;
    let row_key = input.row_key.trim();
    if row_key.is_empty() {
        return Err("session row key is required".to_string());
    }

    let index = read
        .entries
        .iter()
        .enumerate()
        .find_map(|(index, entry)| (session_row_key(index, entry) == row_key).then_some(index))
        .ok_or_else(|| "session entry was not found".to_string())?;
    read.entries.remove(index);

    backup_sessions_file(&path)?;
    rewrite_session_entries(&path, &read.entries)?;
    load_session_entries(_app, None)
}

#[tauri::command]
pub fn load_next_step_suggestions(
    _app: AppHandle,
    project_id: String,
) -> Result<Vec<String>, String> {
    let path = sessions_path()?;
    load_next_step_suggestions_from_path(&path, &project_id)
}

fn load_next_step_suggestions_from_path(
    path: &PathBuf,
    project_id: &str,
) -> Result<Vec<String>, String> {
    let project_id = project_id.trim();
    if project_id.is_empty() {
        return Ok(Vec::new());
    }

    let mut suggestions = Vec::new();
    for entry in read_session_entries(path)?.iter().rev() {
        if entry.project_id.as_deref() != Some(project_id) {
            continue;
        }
        let note = entry.note.trim();
        if note.is_empty() || suggestions.iter().any(|item| item == note) {
            continue;
        }
        suggestions.push(note.to_string());
        if suggestions.len() >= 5 {
            break;
        }
    }

    Ok(suggestions)
}

fn append_session_entry(path: &PathBuf, entry: &SessionLogEntry) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let line = serde_json::to_string(entry)
        .map_err(|error| format!("failed to serialize session: {error}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open {}: {error}", path.display()))?;
    file.write_all(line.as_bytes())
        .map_err(|error| format!("failed to write session: {error}"))?;
    file.write_all(b"\n")
        .map_err(|error| format!("failed to finish session line: {error}"))?;
    Ok(())
}

fn sessions_path() -> Result<PathBuf, String> {
    // 保存先は起動の最初に1回だけ決める（app_paths）。ここで %APPDATA% を直接読まない。
    Ok(crate::app_paths::data_dir()?.join(SESSIONS_FILE_NAME))
}

fn total_for_date(path: &PathBuf, date: &str) -> Result<u32, String> {
    let entries = read_session_entries(path)?;
    Ok(entries
        .into_iter()
        .filter(|entry| entry.date == date)
        .fold(0u32, |total, entry| total.saturating_add(entry.minutes)))
}

fn active_days_between(entries: &[SessionLogEntry], start: Date, end: Date) -> u32 {
    let dates = entries
        .iter()
        .filter_map(|entry| {
            datetime::parse_date(&entry.date)
                .filter(|date| *date >= start && *date <= end)
                .map(|_| entry.date.clone())
        })
        .collect::<std::collections::BTreeSet<_>>();
    u32::try_from(dates.len()).unwrap_or(u32::MAX)
}

fn read_session_entries(path: &PathBuf) -> Result<Vec<SessionLogEntry>, String> {
    Ok(read_session_file(path)?.entries)
}

struct SessionReadResult {
    entries: Vec<SessionLogEntry>,
    invalid_count: usize,
}

fn read_session_file(path: &PathBuf) -> Result<SessionReadResult, String> {
    if !path.exists() {
        return Ok(SessionReadResult {
            entries: Vec::new(),
            invalid_count: 0,
        });
    }

    let file = fs::File::open(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();
    let mut invalid_count = 0usize;

    for line in reader.lines() {
        let line = line.map_err(|error| format!("failed to read session line: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<SessionLogEntry>(&line) {
            Ok(entry) => entries.push(entry),
            Err(_) => invalid_count = invalid_count.saturating_add(1),
        }
    }

    Ok(SessionReadResult {
        entries,
        invalid_count,
    })
}

fn filter_session_entries(
    entries: &[SessionLogEntry],
    filter: Option<&SessionEntriesFilter>,
    today: &str,
) -> Result<Vec<SessionEntryRow>, String> {
    let query = filter
        .and_then(|filter| filter.query.as_ref())
        .map(|query| query.trim().to_lowercase())
        .filter(|query| !query.is_empty());
    let project_id = filter
        .and_then(|filter| filter.project_id.as_ref())
        .map(|project_id| project_id.trim().to_string())
        .filter(|project_id| !project_id.is_empty());
    let date_scope = filter
        .and_then(|filter| filter.date_scope.as_ref())
        .map(|scope| scope.trim().to_lowercase())
        .filter(|scope| !scope.is_empty())
        .unwrap_or_else(|| "all".to_string());
    let today_date =
        datetime::parse_date(today).ok_or_else(|| format!("failed to parse today date {today}"))?;
    let week_start = datetime::week_start_date(today_date);

    let mut rows = Vec::new();
    for (index, entry) in entries.iter().enumerate().rev() {
        if let Some(project_id) = project_id.as_ref() {
            if entry.project_id.as_deref() != Some(project_id.as_str()) {
                continue;
            }
        }

        if date_scope == "today" && entry.date != today {
            continue;
        }
        if date_scope == "week" {
            let Some(entry_date) = datetime::parse_date(&entry.date) else {
                continue;
            };
            if entry_date < week_start || entry_date > today_date {
                continue;
            }
        }

        if let Some(query) = query.as_ref() {
            let searchable = format!(
                "{} {} {} {}",
                entry.date, entry.started_at, entry.label, entry.note
            )
            .to_lowercase();
            if !searchable.contains(query) {
                continue;
            }
        }

        rows.push(session_entry_row(index, entry));
    }

    Ok(rows)
}

fn recent_sessions(entries: &[SessionLogEntry]) -> Vec<RecentSessionEntry> {
    entries
        .iter()
        .rev()
        .take(30)
        .map(|entry| RecentSessionEntry {
            row_key: entry.id.clone().unwrap_or_default(),
            id: entry.id.clone(),
            date: entry.date.clone(),
            project_id: entry.project_id.clone(),
            label: if entry.label.trim().is_empty() {
                "未分類".to_string()
            } else {
                entry.label.clone()
            },
            started_at: entry.started_at.clone(),
            minutes: entry.minutes,
            note: entry.note.clone(),
        })
        .collect()
}

fn session_entry_row(index: usize, entry: &SessionLogEntry) -> SessionEntryRow {
    SessionEntryRow {
        row_key: session_row_key(index, entry),
        id: entry.id.clone(),
        date: entry.date.clone(),
        project_id: entry.project_id.clone(),
        label: display_session_label(entry),
        started_at: entry.started_at.clone(),
        minutes: entry.minutes,
        note: entry.note.clone(),
        manual: entry.manual,
    }
}

fn session_row_key(index: usize, entry: &SessionLogEntry) -> String {
    entry
        .id
        .clone()
        .unwrap_or_else(|| format!("legacy:{index}"))
}

fn display_session_label(entry: &SessionLogEntry) -> String {
    if entry.label.trim().is_empty() {
        "未分類".to_string()
    } else {
        entry.label.clone()
    }
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_started_at(value: &str) -> Result<String, String> {
    let value = value.trim();
    let Some((hour, minute)) = value.split_once(':') else {
        return Err("manual session start time must be HH:mm".to_string());
    };
    let hour = hour
        .parse::<u8>()
        .map_err(|_| "manual session start time hour must be 0-23".to_string())?;
    let minute = minute
        .parse::<u8>()
        .map_err(|_| "manual session start time minute must be 0-59".to_string())?;
    if hour > 23 || minute > 59 {
        return Err("manual session start time must be between 00:00 and 23:59".to_string());
    }
    Ok(format!("{hour:02}:{minute:02}"))
}

fn new_session_id() -> String {
    format!(
        "session_{}",
        datetime::timestamp_nanos(datetime::now_local())
    )
}

fn invalid_lines_warning(invalid_count: usize) -> Option<String> {
    (invalid_count > 0).then(|| {
        format!(
            "sessions.jsonl に読み込めない行が {invalid_count} 件あります。有効な行だけを表示しています。"
        )
    })
}

fn backup_sessions_file(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let backup_dir = backups_path()?.join(format!(
        "pre-session-edit-{}",
        datetime::format_file_stamp_seconds(datetime::now_local())
    ));
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("failed to create {}: {error}", backup_dir.display()))?;
    let backup_path = backup_dir.join(SESSIONS_FILE_NAME);
    fs::copy(path, &backup_path).map_err(|error| {
        format!(
            "failed to backup {} to {}: {error}",
            path.display(),
            backup_path.display()
        )
    })?;
    Ok(())
}

fn rewrite_session_entries(path: &PathBuf, entries: &[SessionLogEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("jsonl.tmp");
    let mut file = fs::File::create(&temp_path)
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;
    for entry in entries {
        let line = serde_json::to_string(entry)
            .map_err(|error| format!("failed to serialize session: {error}"))?;
        file.write_all(line.as_bytes())
            .map_err(|error| format!("failed to write session: {error}"))?;
        file.write_all(b"\n")
            .map_err(|error| format!("failed to finish session line: {error}"))?;
    }
    drop(file);

    match fs::rename(&temp_path, path) {
        Ok(_) => Ok(()),
        Err(first_error) => {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|error| format!("failed to replace {}: {error}", path.display()))?;
                fs::rename(&temp_path, path).map_err(|error| {
                    format!(
                        "failed to rename {} to {} after replace attempt ({first_error}): {error}",
                        temp_path.display(),
                        path.display()
                    )
                })
            } else {
                Err(format!(
                    "failed to rename {} to {}: {first_error}",
                    temp_path.display(),
                    path.display()
                ))
            }
        }
    }
}
