use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

use chrono::{Duration, Local, NaiveDate};
use tauri::AppHandle;

use crate::commands::config::{backups_path, configured_day_start_hour, load_config_internal};
use crate::models::{
    today_date, week_start_date, DeleteSessionEntryInput, DoNowCandidate, DoNowResponse,
    ManualSessionInput, Project, ProjectSessionTotal, RecentSessionEntry, SessionEntriesFilter,
    SessionEntriesResponse, SessionEntryRow, SessionLogEntry, SessionLogInput,
    SessionSummaryResponse, SessionTotalResponse, UpdateSessionEntryInput,
    WeeklyReviewProjectSummary, WeeklyReviewResponse,
};

const CONFIG_DIR_NAME: &str = "life-launcher";
const SESSIONS_FILE_NAME: &str = "sessions.jsonl";

#[tauri::command]
pub fn load_today_session_total(_app: AppHandle) -> Result<SessionTotalResponse, String> {
    let path = sessions_path()?;
    let date = today_date(configured_day_start_hour());
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
    session: SessionLogInput,
) -> Result<SessionTotalResponse, String> {
    let path = sessions_path()?;
    let date = today_date(configured_day_start_hour());

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
    session: ManualSessionInput,
) -> Result<SessionSummaryResponse, String> {
    let path = sessions_path()?;
    let date = session.date.trim();
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|error| format!("manual session date must be YYYY-MM-DD: {error}"))?;
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
    let date = today_date(configured_day_start_hour());
    let today = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|error| format!("failed to parse today date {date}: {error}"))?;
    let week_start = week_start_date(today);
    let entries = read_session_entries(&path)?;
    let mut today_minutes = 0u32;
    let mut week_minutes = 0u32;
    let all_time_projects = project_totals(&entries);
    let mut weekly_entries = Vec::new();

    for entry in &entries {
        let Ok(entry_date) = NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d") else {
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
        if NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d").is_ok() {
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
    let date = today_date(configured_day_start_hour());
    let today = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|error| format!("failed to parse today date {date}: {error}"))?;
    let current_week_start = week_start_date(today);
    let previous_week_start = current_week_start - Duration::days(7);
    let previous_week_end = current_week_start - Duration::days(1);
    let entries = read_session_entries(&sessions_path()?)?;
    Ok(build_weekly_review(
        &entries,
        current_week_start,
        previous_week_start,
        previous_week_end,
    ))
}

#[tauri::command]
pub fn load_do_now_candidates(app: AppHandle) -> Result<DoNowResponse, String> {
    let config = load_config_internal(&app)?.config;
    let date = today_date(config.settings.day_start_hour);
    let entries = read_session_entries(&sessions_path()?)?;

    Ok(DoNowResponse {
        candidates: build_do_now_candidates(&config.projects, &entries, &date),
        date,
    })
}

fn build_do_now_candidates(
    projects: &[Project],
    entries: &[SessionLogEntry],
    date: &str,
) -> Vec<DoNowCandidate> {
    let today = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok();
    let mut candidates = projects
        .iter()
        .enumerate()
        .filter(|(_, project)| {
            project.weekly_focus == Some(true) && !project.next_step.trim().is_empty()
        })
        .map(|(manual_index, project)| {
            let last_started_at = entries
                .iter()
                .filter(|entry| {
                    entry.date == date && entry.project_id.as_deref() == Some(project.id.as_str())
                })
                .map(|entry| entry.started_at.as_str())
                .max()
                .map(ToString::to_string);
            let last_session_date = entries
                .iter()
                .filter(|entry| entry.project_id.as_deref() == Some(project.id.as_str()))
                .filter_map(|entry| NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d").ok())
                .max();
            let restart_eligible = today
                .zip(last_session_date)
                .is_some_and(|(today, last)| today.signed_duration_since(last).num_days() >= 14);
            (
                manual_index,
                project.id.clone(),
                last_started_at,
                restart_eligible,
            )
        })
        .collect::<Vec<_>>();

    candidates.sort_by(|left, right| {
        left.2
            .is_some()
            .cmp(&right.2.is_some())
            .then_with(|| left.2.cmp(&right.2))
            .then_with(|| left.0.cmp(&right.0))
    });

    candidates
        .iter()
        .enumerate()
        .map(
            |(index, (_, project_id, last_started_at, restart_eligible))| {
                let reason = if last_started_at.is_none() {
                    "noToday"
                } else if candidates
                    .iter()
                    .enumerate()
                    .any(|(other_index, candidate)| {
                        other_index != index && candidate.2 == *last_started_at
                    })
                {
                    "manualOrder"
                } else {
                    "oldestToday"
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
    current_week_start: NaiveDate,
    previous_week_start: NaiveDate,
    previous_week_end: NaiveDate,
) -> WeeklyReviewResponse {
    let mut total_minutes = 0u32;
    let mut active_dates = std::collections::BTreeSet::<String>::new();
    let mut project_totals = BTreeMap::<String, (Option<String>, String, u32, u32)>::new();

    for entry in entries {
        let Ok(entry_date) = NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d") else {
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
        week_key: current_week_start.to_string(),
        previous_week_start: previous_week_start.to_string(),
        previous_week_end: previous_week_end.to_string(),
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
    let date = today_date(configured_day_start_hour());
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
    input: UpdateSessionEntryInput,
) -> Result<SessionEntriesResponse, String> {
    let path = sessions_path()?;
    let mut read = read_session_file(&path)?;
    let row_key = input.row_key.trim();
    if row_key.is_empty() {
        return Err("session row key is required".to_string());
    }
    let date = input.date.trim();
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|error| format!("session date must be YYYY-MM-DD: {error}"))?;
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
    input: DeleteSessionEntryInput,
) -> Result<SessionEntriesResponse, String> {
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
    let project_id = project_id.trim();
    if project_id.is_empty() {
        return Ok(Vec::new());
    }

    let mut suggestions = Vec::new();
    for entry in read_session_entries(&path)?.iter().rev() {
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
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "%APPDATA% is not available".to_string())?;
    Ok(app_data.join(CONFIG_DIR_NAME).join(SESSIONS_FILE_NAME))
}

fn total_for_date(path: &PathBuf, date: &str) -> Result<u32, String> {
    let entries = read_session_entries(path)?;
    Ok(entries
        .into_iter()
        .filter(|entry| entry.date == date)
        .fold(0u32, |total, entry| total.saturating_add(entry.minutes)))
}

fn active_days_between(entries: &[SessionLogEntry], start: NaiveDate, end: NaiveDate) -> u32 {
    let dates = entries
        .iter()
        .filter_map(|entry| {
            NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d")
                .ok()
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
    let today_date = NaiveDate::parse_from_str(today, "%Y-%m-%d")
        .map_err(|error| format!("failed to parse today date {today}: {error}"))?;
    let week_start = week_start_date(today_date);

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
            let Ok(entry_date) = NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d") else {
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
        Local::now().timestamp_nanos_opt().unwrap_or_default()
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
        Local::now().format("%Y%m%d-%H%M%S")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_legacy_session_without_note() {
        let path = std::env::temp_dir().join(format!(
            "life-launcher-legacy-session-{}.jsonl",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        fs::write(
            &path,
            r#"{"date":"2026-07-08","projectId":"compose","label":"サンプル学習","startedAt":"10:00","minutes":12}"#,
        )
        .expect("write legacy session");

        let entries = read_session_entries(&path).expect("read sessions");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].note, "");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn normalizes_manual_session_start_time() {
        assert_eq!(
            normalize_started_at("0:05").expect("normalize midnight range"),
            "00:05"
        );
        assert_eq!(
            normalize_started_at("23:59").expect("normalize latest minute"),
            "23:59"
        );
        assert!(normalize_started_at("24:00").is_err());
        assert!(normalize_started_at("10:99").is_err());
    }

    #[test]
    fn recent_sessions_returns_latest_thirty_with_notes() {
        let entries = (0..35)
            .map(|index| SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: Some("compose".to_string()),
                label: format!("サンプル学習{index}"),
                started_at: format!("10:{index:02}"),
                minutes: 10,
                note: format!("note {index}"),
                manual: false,
            })
            .collect::<Vec<_>>();

        let recent = recent_sessions(&entries);
        assert_eq!(recent.len(), 30);
        assert_eq!(recent[0].note, "note 34");
        assert_eq!(recent[29].note, "note 5");
    }

    #[test]
    fn project_totals_include_all_records_and_keep_unclassified_entries() {
        let entries = vec![
            SessionLogEntry {
                id: None,
                date: "2026-07-01".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "10:00".to_string(),
                minutes: 25,
                note: String::new(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-20".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "11:00".to_string(),
                minutes: 15,
                note: String::new(),
                manual: true,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-20".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "11:30".to_string(),
                minutes: 5,
                note: String::new(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-20".to_string(),
                project_id: None,
                label: String::new(),
                started_at: "12:00".to_string(),
                minutes: 10,
                note: String::new(),
                manual: false,
            },
        ];

        let totals = project_totals(&entries);

        assert_eq!(totals.len(), 2);
        assert_eq!(totals[0].project_id.as_deref(), Some("compose"));
        assert_eq!(totals[0].active_days, 2);
        assert_eq!(totals[0].total_minutes, 45);
        assert_eq!(totals[1].project_id, None);
        assert_eq!(totals[1].label, "未分類");
        assert_eq!(totals[1].active_days, 1);
        assert_eq!(totals[1].total_minutes, 10);
    }

    #[test]
    fn next_step_suggestions_are_unique_and_project_scoped() {
        let path = std::env::temp_dir().join(format!(
            "life-launcher-next-step-suggestions-{}.jsonl",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        let entries = [
            SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: Some("compose".to_string()),
                label: "compose".to_string(),
                started_at: "10:00".to_string(),
                minutes: 10,
                note: "loop".to_string(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: Some("other".to_string()),
                label: "other".to_string(),
                started_at: "11:00".to_string(),
                minutes: 10,
                note: "other note".to_string(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: None,
                label: "today".to_string(),
                started_at: "12:00".to_string(),
                minutes: 10,
                note: "today note".to_string(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: Some("compose".to_string()),
                label: "compose".to_string(),
                started_at: "13:00".to_string(),
                minutes: 10,
                note: "loop".to_string(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-08".to_string(),
                project_id: Some("compose".to_string()),
                label: "compose".to_string(),
                started_at: "14:00".to_string(),
                minutes: 10,
                note: "bass".to_string(),
                manual: false,
            },
        ];
        for entry in &entries {
            append_session_entry(&path, entry).expect("append session");
        }

        let mut suggestions = Vec::new();
        for entry in read_session_entries(&path)
            .expect("read sessions")
            .iter()
            .rev()
        {
            if entry.project_id.as_deref() != Some("compose") {
                continue;
            }
            let note = entry.note.trim();
            if note.is_empty() || suggestions.iter().any(|item| item == note) {
                continue;
            }
            suggestions.push(note.to_string());
        }

        assert_eq!(suggestions, vec!["bass".to_string(), "loop".to_string()]);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn weekly_review_aggregates_only_previous_week_facts() {
        let entries = vec![
            SessionLogEntry {
                id: None,
                date: "2026-07-06".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "10:00".to_string(),
                minutes: 30,
                note: String::new(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-06".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "11:00".to_string(),
                minutes: 15,
                note: String::new(),
                manual: true,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-12".to_string(),
                project_id: Some("study".to_string()),
                label: "学習".to_string(),
                started_at: "14:00".to_string(),
                minutes: 20,
                note: String::new(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-13".to_string(),
                project_id: Some("compose".to_string()),
                label: "サンプル学習".to_string(),
                started_at: "09:00".to_string(),
                minutes: 99,
                note: String::new(),
                manual: false,
            },
        ];
        let current_week_start = NaiveDate::from_ymd_opt(2026, 7, 13).expect("date");
        let previous_week_start = NaiveDate::from_ymd_opt(2026, 7, 6).expect("date");
        let previous_week_end = NaiveDate::from_ymd_opt(2026, 7, 12).expect("date");

        let review = build_weekly_review(
            &entries,
            current_week_start,
            previous_week_start,
            previous_week_end,
        );

        assert_eq!(review.week_key, "2026-07-13");
        assert_eq!(review.total_minutes, 65);
        assert_eq!(review.active_days, 2);
        assert_eq!(review.projects.len(), 2);
        let compose = review
            .projects
            .iter()
            .find(|project| project.project_id.as_deref() == Some("compose"))
            .expect("compose summary");
        assert_eq!(compose.session_count, 2);
        assert_eq!(compose.total_minutes, 45);
    }

    #[test]
    fn do_now_candidates_follow_explainable_priority_rules() {
        let mut projects = crate::models::sample_config().projects;
        projects[0].id = "first".to_string();
        projects[0].weekly_focus = Some(true);
        projects[0].next_step = "first step".to_string();
        projects[1].id = "second".to_string();
        projects[1].weekly_focus = Some(true);
        projects[1].next_step = "second step".to_string();
        let mut third = projects[0].clone();
        third.id = "third".to_string();
        third.name = "third".to_string();
        third.next_step = "third step".to_string();
        projects.push(third);

        let entries = vec![
            SessionLogEntry {
                id: None,
                date: "2026-07-16".to_string(),
                project_id: Some("first".to_string()),
                label: "first".to_string(),
                started_at: "11:00".to_string(),
                minutes: 10,
                note: String::new(),
                manual: false,
            },
            SessionLogEntry {
                id: None,
                date: "2026-07-16".to_string(),
                project_id: Some("second".to_string()),
                label: "second".to_string(),
                started_at: "09:00".to_string(),
                minutes: 10,
                note: String::new(),
                manual: false,
            },
        ];

        let candidates = build_do_now_candidates(&projects, &entries, "2026-07-16");

        assert_eq!(
            candidates
                .iter()
                .map(|candidate| candidate.project_id.as_str())
                .collect::<Vec<_>>(),
            vec!["third", "second", "first"]
        );
        assert_eq!(candidates[0].reason, "noToday");
        assert_eq!(candidates[1].reason, "oldestToday");
    }

    #[test]
    fn do_now_candidates_exclude_non_focus_and_empty_steps_and_use_manual_order_for_ties() {
        let mut projects = crate::models::sample_config().projects;
        projects[0].id = "first".to_string();
        projects[0].weekly_focus = Some(true);
        projects[0].next_step = "first step".to_string();
        projects[1].id = "second".to_string();
        projects[1].weekly_focus = Some(true);
        projects[1].next_step = "second step".to_string();
        let mut excluded = projects[0].clone();
        excluded.id = "excluded".to_string();
        excluded.weekly_focus = Some(false);
        projects.push(excluded);
        let mut empty = projects[0].clone();
        empty.id = "empty".to_string();
        empty.next_step.clear();
        projects.push(empty);
        let entries = ["first", "second"]
            .into_iter()
            .map(|project_id| SessionLogEntry {
                id: None,
                date: "2026-07-16".to_string(),
                project_id: Some(project_id.to_string()),
                label: project_id.to_string(),
                started_at: "10:00".to_string(),
                minutes: 10,
                note: String::new(),
                manual: false,
            })
            .collect::<Vec<_>>();

        let candidates = build_do_now_candidates(&projects, &entries, "2026-07-16");

        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].project_id, "first");
        assert_eq!(candidates[0].reason, "manualOrder");
        assert_eq!(candidates[1].project_id, "second");
    }

    #[test]
    fn restart_support_requires_an_existing_session_at_least_fourteen_days_old() {
        let mut project = crate::models::sample_config().projects.remove(0);
        project.weekly_focus = Some(true);
        project.next_step = "resume".to_string();

        let new_project = build_do_now_candidates(&[project.clone()], &[], "2026-07-16");
        assert!(!new_project[0].restart_eligible);

        let session_at = |date: &str| SessionLogEntry {
            id: None,
            date: date.to_string(),
            project_id: Some(project.id.clone()),
            label: project.name.clone(),
            started_at: "10:00".to_string(),
            minutes: 10,
            note: String::new(),
            manual: false,
        };
        let thirteen_days = build_do_now_candidates(
            &[project.clone()],
            &[session_at("2026-07-03")],
            "2026-07-16",
        );
        let fourteen_day_session = session_at("2026-07-02");
        let fourteen_days =
            build_do_now_candidates(&[project], &[fourteen_day_session], "2026-07-16");

        assert!(!thirteen_days[0].restart_eligible);
        assert!(fourteen_days[0].restart_eligible);
    }

    #[test]
    fn active_days_count_unique_current_week_dates_including_manual_sessions() {
        let entry = |date: &str, started_at: &str, manual: bool| SessionLogEntry {
            id: None,
            date: date.to_string(),
            project_id: Some("project".to_string()),
            label: "project".to_string(),
            started_at: started_at.to_string(),
            minutes: 10,
            note: String::new(),
            manual,
        };
        let entries = vec![
            entry("2026-07-12", "10:00", false),
            entry("2026-07-13", "09:00", false),
            entry("2026-07-13", "11:00", true),
            entry("2026-07-15", "12:00", false),
            entry("2026-07-20", "08:00", false),
        ];

        assert_eq!(
            active_days_between(
                &entries,
                NaiveDate::from_ymd_opt(2026, 7, 13).expect("date"),
                NaiveDate::from_ymd_opt(2026, 7, 19).expect("date"),
            ),
            2
        );
        assert_eq!(
            active_days_between(
                &[],
                NaiveDate::from_ymd_opt(2026, 7, 13).expect("date"),
                NaiveDate::from_ymd_opt(2026, 7, 19).expect("date"),
            ),
            0
        );
    }
}
