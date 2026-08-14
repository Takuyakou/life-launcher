use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::config::configured_day_start_hour;
use crate::models::{
    today_date, NotesForDateInput, NotesHistoryEntry, NotesHistoryResponse, TodayNotesInput,
    TodayNotesResponse,
};

const CONFIG_DIR_NAME: &str = "life-launcher";
const NOTES_FILE_NAME: &str = "notes.json";
const NOTE_ITEM_LIMIT: usize = 3;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct NotesDay {
    #[serde(default)]
    items: Vec<String>,
}

#[tauri::command]
pub fn load_today_notes(_app: AppHandle) -> Result<TodayNotesResponse, String> {
    let path = notes_path()?;
    let date = today_date(configured_day_start_hour());
    let notes = read_notes_file(&path)?;
    let items = notes
        .get(&date)
        .map(|day| sanitize_note_items(&day.items))
        .unwrap_or_default();

    Ok(TodayNotesResponse {
        date,
        items,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn save_today_notes(
    _app: AppHandle,
    input: TodayNotesInput,
) -> Result<TodayNotesResponse, String> {
    let path = notes_path()?;
    let date = today_date(configured_day_start_hour());
    let mut notes = read_notes_file(&path)?;
    let items = sanitize_note_items(&input.items);

    if items.is_empty() {
        notes.remove(&date);
    } else {
        notes.insert(
            date.clone(),
            NotesDay {
                items: items.clone(),
            },
        );
    }

    write_notes_file(&path, &notes)?;

    Ok(TodayNotesResponse {
        date,
        items,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn load_notes_history(_app: AppHandle) -> Result<NotesHistoryResponse, String> {
    let path = notes_path()?;
    let notes = read_notes_file(&path)?;

    Ok(NotesHistoryResponse {
        entries: notes_to_history(notes),
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn save_notes_for_date(
    _app: AppHandle,
    input: NotesForDateInput,
) -> Result<NotesHistoryResponse, String> {
    let path = notes_path()?;
    let mut notes = read_notes_file(&path)?;
    let date = input.date.trim();
    if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
        return Err(format!("invalid note date: {}", input.date));
    }

    let items = sanitize_note_items(&input.items);
    if items.is_empty() {
        notes.remove(date);
    } else {
        notes.insert(
            date.to_string(),
            NotesDay {
                items: items.clone(),
            },
        );
    }

    write_notes_file(&path, &notes)?;

    Ok(NotesHistoryResponse {
        entries: notes_to_history(notes),
        path: path.to_string_lossy().to_string(),
    })
}

fn notes_path() -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "%APPDATA% is not available".to_string())?;
    Ok(app_data.join(CONFIG_DIR_NAME).join(NOTES_FILE_NAME))
}

fn read_notes_file(path: &PathBuf) -> Result<BTreeMap<String, NotesDay>, String> {
    if !path.exists() {
        return Ok(BTreeMap::new());
    }

    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(BTreeMap::new());
    }

    serde_json::from_str(&raw).map_err(|error| format!("notes.json is not valid JSON: {error}"))
}

fn write_notes_file(path: &PathBuf, notes: &BTreeMap<String, NotesDay>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let temp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(notes)
        .map_err(|error| format!("failed to serialize notes: {error}"))?;
    fs::write(&temp_path, json)
        .map_err(|error| format!("failed to write {}: {error}", temp_path.display()))?;

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

fn sanitize_note_items(items: &[String]) -> Vec<String> {
    items
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .take(NOTE_ITEM_LIMIT)
        .map(ToString::to_string)
        .collect()
}

fn notes_to_history(notes: BTreeMap<String, NotesDay>) -> Vec<NotesHistoryEntry> {
    notes
        .into_iter()
        .rev()
        .filter_map(|(date, day)| {
            let items = sanitize_note_items(&day.items);
            if items.is_empty() {
                None
            } else {
                Some(NotesHistoryEntry { date, items })
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_empty_notes_to_no_items() {
        let items = vec!["".to_string(), "  ".to_string()];

        assert!(sanitize_note_items(&items).is_empty());
    }

    #[test]
    fn sanitizes_single_note() {
        let items = vec![" 1つできた ".to_string()];

        assert_eq!(sanitize_note_items(&items), vec!["1つできた".to_string()]);
    }

    #[test]
    fn sanitizes_notes_to_max_three_items() {
        let items = vec![
            "1".to_string(),
            "2".to_string(),
            "3".to_string(),
            "4".to_string(),
        ];

        assert_eq!(
            sanitize_note_items(&items),
            vec!["1".to_string(), "2".to_string(), "3".to_string()]
        );
    }
}
