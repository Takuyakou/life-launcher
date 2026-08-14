use serde::{Deserialize, Serialize};

pub const CONFIG_VERSION: u8 = 2;
pub const TODAY_ITEM_LIMIT: usize = 3;
pub const WEEKLY_FOCUS_LIMIT: usize = 3;
pub const EXECUTION_TRIGGER_MAX_CHARS: usize = 40;
pub const OVERLAY_PAGE_NAME_MAX_CHARS: usize = 24;
pub const DEFAULT_TIMER_MINUTES: u16 = 25;
pub const SHORT_TIMER_MINUTES: u16 = 5;
pub const DEFAULT_DAY_START_HOUR: u8 = 4;
pub const DEFAULT_BACKUP_KEEP: u16 = 30;
pub const INSTRUCTION_FOLDER_LIMIT: usize = 5;
pub const INSTRUCTION_NAME_MAX_CHARS: usize = 48;
pub const INSTRUCTION_FILE_MAX_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(rename = "$schema", default, skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    pub version: u8,
    #[serde(default)]
    pub groups: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overlay_pages: Option<Vec<OverlayPage>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dictionary_order: Option<Vec<String>>,
    pub buttons: Vec<LauncherButton>,
    pub projects: Vec<Project>,
    pub today: Today,
    pub inbox: Vec<InboxItem>,
    pub settings: Settings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPage {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherButton {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(default = "default_button_visibility")]
    pub show_in_sidebar: bool,
    #[serde(default = "default_button_visibility")]
    pub show_in_overlay: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overlay_page_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub aliases: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub actions: Vec<Action>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub north_star: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weekly_focus: Option<bool>,
    pub next_step: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_step_trigger: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_step_updated_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_step_reviewed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub button_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub button_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_timer_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub short_timer_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_note_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_open_on_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Today {
    pub date: String,
    #[serde(default)]
    pub victory: TodayVictory,
    #[serde(default)]
    pub items: Vec<TodayItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayVictory {
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayItem {
    pub text: String,
    pub done: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub button_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_open_on_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxItem {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub button_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_open_on_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniWindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstructionFolderIdentity {
    pub path: String,
    pub identity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub always_on_top: bool,
    pub focus_hotkey: Option<String>,
    #[serde(default = "default_launcher_hotkey")]
    pub launcher_hotkey: Option<String>,
    #[serde(default)]
    pub mini_hotkey: Option<String>,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default = "default_timer_minutes")]
    pub default_timer_minutes: u16,
    #[serde(default = "short_timer_minutes")]
    pub short_timer_minutes: u16,
    #[serde(default = "default_day_start_hour")]
    pub day_start_hour: u8,
    #[serde(default)]
    pub backup_folder: Option<String>,
    #[serde(default = "default_backup_keep")]
    pub backup_keep: u16,
    #[serde(default = "default_mini_mode")]
    pub mini_mode: bool,
    #[serde(default)]
    pub mini_window_position: Option<MiniWindowPosition>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restart_short_first: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_folders: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_folder_identities: Option<Vec<InstructionFolderIdentity>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instruction_hotkey: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionRoot {
    pub name: String,
    pub path: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstructionEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    pub read_only: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionReadResponse {
    pub name: String,
    pub path: String,
    pub content: String,
    pub modified_at: u64,
    pub size: u64,
    pub read_only: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionWriteResponse {
    pub path: String,
    pub modified_at: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionRenameResponse {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionRecycleResponse {
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionFolderSummary {
    pub instruction_count: u64,
    pub folder_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionReferenceUpdateResponse {
    pub project_names: Vec<String>,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type", content = "payload")]
pub enum Action {
    OpenApp {
        path: String,
        #[serde(default)]
        args: Vec<String>,
    },
    OpenUrl {
        url: String,
    },
    OpenFolder {
        path: String,
    },
    OpenFile {
        path: String,
    },
    RunScript {
        path: String,
        #[serde(default)]
        args: Vec<String>,
    },
    OpenShellSpecial {
        item: ShellSpecialItem,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShellSpecialItem {
    RecycleBin,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadConfigResponse {
    pub config: AppConfig,
    pub path: String,
    pub backup_path: String,
    pub error: Option<String>,
    pub backup_error: Option<String>,
    pub changed: bool,
    pub morning_victory_suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConfigResponse {
    pub config: AppConfig,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub index: usize,
    pub action_type: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogInput {
    pub project_id: Option<String>,
    pub label: String,
    pub started_at: String,
    pub minutes: u32,
    pub note: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSessionInput {
    pub project_id: Option<String>,
    pub label: String,
    pub date: String,
    pub started_at: String,
    pub minutes: u32,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub date: String,
    pub project_id: Option<String>,
    pub label: String,
    pub started_at: String,
    pub minutes: u32,
    #[serde(default)]
    pub note: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub manual: bool,
}

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTotalResponse {
    pub date: String,
    pub total_minutes: u32,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayNotesResponse {
    pub date: String,
    pub items: Vec<String>,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayNotesInput {
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSessionTotal {
    pub project_id: Option<String>,
    pub label: String,
    pub active_days: u32,
    pub total_minutes: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSessionEntry {
    pub row_key: String,
    pub id: Option<String>,
    pub date: String,
    pub project_id: Option<String>,
    pub label: String,
    pub started_at: String,
    pub minutes: u32,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummaryResponse {
    pub date: String,
    pub today_minutes: u32,
    pub week_minutes: u32,
    pub active_days: u32,
    pub projects: Vec<ProjectSessionTotal>,
    pub all_time_projects: Vec<ProjectSessionTotal>,
    pub recent_sessions: Vec<RecentSessionEntry>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyReviewProjectSummary {
    pub project_id: Option<String>,
    pub label: String,
    pub session_count: u32,
    pub total_minutes: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyReviewResponse {
    pub week_key: String,
    pub previous_week_start: String,
    pub previous_week_end: String,
    pub total_minutes: u32,
    pub active_days: u32,
    pub projects: Vec<WeeklyReviewProjectSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NextStepFreshnessResponse {
    pub stale_project_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoNowCandidate {
    pub project_id: String,
    pub reason: String,
    pub restart_eligible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoNowResponse {
    pub date: String,
    pub candidates: Vec<DoNowCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntriesFilter {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub date_scope: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntryRow {
    pub row_key: String,
    pub id: Option<String>,
    pub date: String,
    pub project_id: Option<String>,
    pub label: String,
    pub started_at: String,
    pub minutes: u32,
    pub note: String,
    pub manual: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntriesResponse {
    pub date: String,
    pub entries: Vec<SessionEntryRow>,
    pub path: String,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionEntryInput {
    pub row_key: String,
    pub date: String,
    pub project_id: Option<String>,
    pub label: String,
    pub started_at: String,
    pub minutes: u32,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSessionEntryInput {
    pub row_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesHistoryEntry {
    pub date: String,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesHistoryResponse {
    pub entries: Vec<NotesHistoryEntry>,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesForDateInput {
    pub date: String,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropResolveInput {
    pub kind: String,
    pub value: String,
    #[serde(default)]
    pub suggested_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DropButtonDraft {
    pub label: String,
    pub group: Option<String>,
    pub icon_source: Option<String>,
    pub action: Action,
    pub source: String,
}

pub fn default_timer_minutes() -> u16 {
    DEFAULT_TIMER_MINUTES
}

pub fn short_timer_minutes() -> u16 {
    SHORT_TIMER_MINUTES
}

pub fn default_day_start_hour() -> u8 {
    DEFAULT_DAY_START_HOUR
}

pub fn default_backup_keep() -> u16 {
    DEFAULT_BACKUP_KEEP
}

pub fn default_mini_mode() -> bool {
    true
}

pub fn default_launcher_hotkey() -> Option<String> {
    Some("Ctrl+K".to_string())
}

pub fn default_button_visibility() -> bool {
    true
}

pub fn date_key_at<Tz: chrono::TimeZone>(now: chrono::DateTime<Tz>, day_start_hour: u8) -> String {
    let hour_offset = i64::from(day_start_hour.min(23));
    (now - chrono::Duration::hours(hour_offset))
        .date_naive()
        .to_string()
}

pub fn today_date(day_start_hour: u8) -> String {
    date_key_at(chrono::Local::now(), day_start_hour)
}

pub fn week_start_date(date: chrono::NaiveDate) -> chrono::NaiveDate {
    use chrono::Datelike;

    date - chrono::Duration::days(i64::from(date.weekday().num_days_from_monday()))
}

fn default_settings() -> Settings {
    Settings {
        always_on_top: false,
        focus_hotkey: Some("Alt+Space".to_string()),
        launcher_hotkey: default_launcher_hotkey(),
        mini_hotkey: None,
        auto_start: false,
        default_timer_minutes: DEFAULT_TIMER_MINUTES,
        short_timer_minutes: SHORT_TIMER_MINUTES,
        day_start_hour: DEFAULT_DAY_START_HOUR,
        backup_folder: None,
        backup_keep: DEFAULT_BACKUP_KEEP,
        mini_mode: true,
        mini_window_position: None,
        restart_short_first: Some(true),
        instruction_folders: None,
        instruction_folder_identities: None,
        instruction_hotkey: None,
    }
}

pub fn initial_config() -> AppConfig {
    AppConfig {
        schema: Some("./config.schema.json".to_string()),
        version: CONFIG_VERSION,
        groups: Vec::new(),
        overlay_pages: Some(Vec::new()),
        dictionary_order: Some(Vec::new()),
        buttons: Vec::new(),
        projects: Vec::new(),
        today: Today {
            date: today_date(DEFAULT_DAY_START_HOUR),
            victory: TodayVictory::default(),
            items: Vec::new(),
        },
        inbox: Vec::new(),
        settings: default_settings(),
    }
}

#[cfg(test)]
pub fn sample_config() -> AppConfig {
    AppConfig {
        schema: Some("./config.schema.json".to_string()),
        version: CONFIG_VERSION,
        groups: vec!["サンプル学習".to_string(), "資料".to_string()],
        overlay_pages: Some(vec![
            OverlayPage {
                id: "overlay-page-1".to_string(),
                name: "サンプル学習".to_string(),
            },
            OverlayPage {
                id: "overlay-page-2".to_string(),
                name: "資料".to_string(),
            },
        ]),
        dictionary_order: Some(vec!["music-web".to_string(), "documents".to_string()]),
        buttons: vec![
            LauncherButton {
                id: "music-web".to_string(),
                label: "Sample Notes".to_string(),
                icon: Some("♪".to_string()),
                icon_source: None,
                group: Some("サンプル学習".to_string()),
                show_in_sidebar: true,
                show_in_overlay: true,
                overlay_page_id: Some("overlay-page-1".to_string()),
                aliases: Vec::new(),
                description: None,
                actions: vec![Action::OpenUrl {
                    url: "https://example.invalid/sample".to_string(),
                }],
            },
            LauncherButton {
                id: "documents".to_string(),
                label: "Documents".to_string(),
                icon: Some("□".to_string()),
                icon_source: None,
                group: Some("資料".to_string()),
                show_in_sidebar: true,
                show_in_overlay: true,
                overlay_page_id: Some("overlay-page-2".to_string()),
                aliases: Vec::new(),
                description: None,
                actions: vec![Action::OpenFolder {
                    path: "%USERPROFILE%/Documents".to_string(),
                }],
            },
        ],
        projects: vec![
            Project {
                id: "compose".to_string(),
                name: "サンプル学習".to_string(),
                north_star: None,
                weekly_focus: None,
                next_step: "資料を1ページ読む".to_string(),
                next_step_trigger: None,
                next_step_updated_at: None,
                next_step_reviewed_at: None,
                button_id: None,
                button_ids: vec!["music-web".to_string()],
                default_timer_minutes: None,
                short_timer_minutes: None,
                start_note_template: None,
                color_id: None,
                instruction_path: None,
                instruction_open_on_start: None,
            },
            Project {
                id: "organize".to_string(),
                name: "整理".to_string(),
                north_star: None,
                weekly_focus: None,
                next_step: "サンプルフォルダを開く".to_string(),
                next_step_trigger: None,
                next_step_updated_at: None,
                next_step_reviewed_at: None,
                button_id: None,
                button_ids: vec!["documents".to_string()],
                default_timer_minutes: None,
                short_timer_minutes: None,
                start_note_template: None,
                color_id: None,
                instruction_path: None,
                instruction_open_on_start: None,
            },
        ],
        today: Today {
            date: today_date(DEFAULT_DAY_START_HOUR),
            victory: TodayVictory::default(),
            items: vec![
                TodayItem {
                    text: "最初の一手を決める".to_string(),
                    done: false,
                    trigger: None,
                    project_id: None,
                    button_ids: Vec::new(),
                    instruction_path: None,
                    instruction_open_on_start: None,
                },
                TodayItem {
                    text: "起動ボタンを1つ試す".to_string(),
                    done: false,
                    trigger: None,
                    project_id: None,
                    button_ids: Vec::new(),
                    instruction_path: None,
                    instruction_open_on_start: None,
                },
            ],
        },
        inbox: vec![InboxItem {
            text: "よく使うアプリのパスをconfig.jsonに足す".to_string(),
            project_id: None,
            button_ids: Vec::new(),
            instruction_path: None,
            instruction_open_on_start: None,
        }],
        settings: default_settings(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{FixedOffset, TimeZone};

    #[test]
    fn initial_config_is_a_generic_empty_shell() {
        let config = initial_config();

        assert!(config.groups.is_empty());
        assert!(config.buttons.is_empty());
        assert!(config.projects.is_empty());
        assert!(config.today.victory.text.is_empty());
        assert!(config.today.items.is_empty());
        assert!(config.inbox.is_empty());
        assert_eq!(config.settings.default_timer_minutes, DEFAULT_TIMER_MINUTES);
        assert_eq!(config.settings.short_timer_minutes, SHORT_TIMER_MINUTES);
    }

    #[test]
    fn date_key_uses_previous_day_before_day_start_hour() {
        let timezone = FixedOffset::east_opt(9 * 60 * 60).expect("timezone");
        let before_start = timezone
            .with_ymd_and_hms(2026, 7, 5, 3, 59, 0)
            .single()
            .expect("datetime");

        assert_eq!(date_key_at(before_start, 4), "2026-07-04");
    }

    #[test]
    fn date_key_uses_current_day_at_day_start_hour() {
        let timezone = FixedOffset::east_opt(9 * 60 * 60).expect("timezone");
        let at_start = timezone
            .with_ymd_and_hms(2026, 7, 5, 4, 0, 0)
            .single()
            .expect("datetime");

        assert_eq!(date_key_at(at_start, 4), "2026-07-05");
    }

    #[test]
    fn week_start_is_monday() {
        let sunday = chrono::NaiveDate::from_ymd_opt(2026, 7, 12).expect("date");
        let monday = chrono::NaiveDate::from_ymd_opt(2026, 7, 6).expect("date");

        assert_eq!(week_start_date(sunday), monday);
        assert_eq!(week_start_date(monday), monday);
    }
}
