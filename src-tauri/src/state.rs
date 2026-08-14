use std::sync::Mutex;
use std::time::Instant;

use notify::RecommendedWatcher;
use tauri_plugin_global_shortcut::Shortcut;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RegisteredShortcutAction {
    Main,
    Launcher,
    Mini,
    Instruction,
}

#[derive(Default)]
pub struct AppState {
    pub config_write_lock: Mutex<()>,
    pub suppress_reload_until: Mutex<Option<Instant>>,
    pub registered_shortcuts: Mutex<Vec<(Shortcut, RegisteredShortcutAction)>>,
    pub config_watcher: Mutex<Option<RecommendedWatcher>>,
    pub shell_drop_poc_hwnd: Mutex<Option<isize>>,
}
