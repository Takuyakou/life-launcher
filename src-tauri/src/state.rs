use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock, RwLockReadGuard, RwLockWriteGuard};
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
    reset_gate: RwLock<()>,
    reset_in_progress: AtomicBool,
    pub suppress_reload_until: Mutex<Option<Instant>>,
    pub registered_shortcuts: Mutex<Vec<(Shortcut, RegisteredShortcutAction)>>,
    pub config_watcher: Mutex<Option<RecommendedWatcher>>,
    pub shell_drop_poc_hwnd: Mutex<Option<isize>>,
}

impl AppState {
    pub fn begin_app_write(&self) -> Result<RwLockReadGuard<'_, ()>, String> {
        let guard = self
            .reset_gate
            .read()
            .map_err(|_| "failed to lock software reset gate".to_string())?;
        if self.reset_in_progress.load(Ordering::Acquire) {
            return Err("software reset is in progress".to_string());
        }
        Ok(guard)
    }

    pub fn begin_software_reset(&self) -> Result<RwLockWriteGuard<'_, ()>, String> {
        let guard = self
            .reset_gate
            .write()
            .map_err(|_| "failed to lock software reset gate".to_string())?;
        if self.reset_in_progress.swap(true, Ordering::AcqRel) {
            return Err("software reset is already in progress".to_string());
        }
        Ok(guard)
    }

    pub fn begin_app_snapshot(&self) -> Result<RwLockWriteGuard<'_, ()>, String> {
        let guard = self
            .reset_gate
            .write()
            .map_err(|_| "failed to lock application snapshot gate".to_string())?;
        if self.reset_in_progress.load(Ordering::Acquire) {
            return Err("software reset is in progress".to_string());
        }
        Ok(guard)
    }

    pub fn cancel_software_reset(&self) {
        self.reset_in_progress.store(false, Ordering::Release);
    }

    pub fn software_reset_in_progress(&self) -> bool {
        self.reset_in_progress.load(Ordering::Acquire)
    }
}
