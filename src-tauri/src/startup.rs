use std::str::FromStr;
use std::sync::mpsc;
use std::time::Instant;

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager};
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::commands::config::{config_path, load_config_internal};
use crate::state::{AppState, RegisteredShortcutAction};

#[tauri::command]
pub fn reapply_dashboard_settings(app: AppHandle) -> Result<(), String> {
    apply_dashboard_settings(&app)
}

#[tauri::command]
pub fn suspend_dashboard_shortcuts(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut registered = state
        .registered_shortcuts
        .lock()
        .map_err(|_| "failed to lock shortcut state".to_string())?;
    for (shortcut, _) in registered.iter() {
        app.global_shortcut()
            .unregister(*shortcut)
            .map_err(|error| format!("failed to suspend shortcut: {error}"))?;
    }
    registered.clear();
    Ok(())
}

#[tauri::command]
pub fn resume_dashboard_shortcuts(app: AppHandle) -> Result<(), String> {
    apply_dashboard_settings_with_shortcut_policy(&app, false)
}

#[tauri::command]
pub fn focus_dashboard_window(app: AppHandle) -> Result<(), String> {
    focus_main_window(&app);
    Ok(())
}

pub fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn apply_dashboard_settings(app: &AppHandle) -> Result<(), String> {
    apply_dashboard_settings_with_shortcut_policy(app, true)
}

pub fn apply_dashboard_settings_at_startup(app: &AppHandle) -> Result<(), String> {
    apply_dashboard_settings_with_shortcut_policy(app, false)
}

fn apply_dashboard_settings_with_shortcut_policy(
    app: &AppHandle,
    shortcut_errors_are_fatal: bool,
) -> Result<(), String> {
    let loaded = load_config_internal(app)?;
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(loaded.config.settings.always_on_top)
            .map_err(|error| error.to_string())?;
    }

    sync_autostart(app, loaded.config.settings.auto_start);
    let shortcut_result = register_shortcuts(
        app,
        loaded.config.settings.focus_hotkey.as_deref(),
        loaded.config.settings.launcher_hotkey.as_deref(),
        loaded.config.settings.mini_hotkey.as_deref(),
        loaded.config.settings.instruction_hotkey.as_deref(),
    );
    if let Err(error) = shortcut_result {
        if shortcut_errors_are_fatal {
            return Err(error);
        }
        eprintln!("shortcut registration skipped during startup: {error}");
    }
    Ok(())
}

pub fn start_config_watcher(app: AppHandle) -> Result<(), String> {
    let path = config_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "config path has no parent directory".to_string())?
        .to_path_buf();
    std::fs::create_dir_all(&parent).map_err(|error| error.to_string())?;

    let (tx, rx) = mpsc::channel();
    let mut watcher = RecommendedWatcher::new(
        move |result| {
            let _ = tx.send(result);
        },
        Config::default(),
    )
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    *app.state::<AppState>()
        .config_watcher
        .lock()
        .map_err(|_| "failed to lock config watcher state".to_string())? = Some(watcher);
    std::thread::spawn(move || {
        for event in rx.into_iter().flatten() {
            let relevant = event.paths.iter().any(|event_path| event_path == &path);
            let changed = matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
            );
            if !relevant || !changed {
                continue;
            }

            let suppressed = app
                .state::<AppState>()
                .suppress_reload_until
                .lock()
                .ok()
                .and_then(|until| *until)
                .is_some_and(|until| until > Instant::now());

            if suppressed {
                continue;
            }

            let _ = apply_dashboard_settings(&app);
            let _ = app.emit("config-changed", ());
        }
    });

    Ok(())
}

pub fn shortcut_action(app: &AppHandle, shortcut: &Shortcut) -> Option<RegisteredShortcutAction> {
    app.state::<AppState>()
        .registered_shortcuts
        .lock()
        .ok()
        .and_then(|shortcuts| {
            shortcuts
                .iter()
                .find(|(registered, _)| registered == shortcut)
                .map(|(_, action)| *action)
        })
}

fn register_shortcuts(
    app: &AppHandle,
    main_hotkey: Option<&str>,
    launcher_hotkey: Option<&str>,
    mini_hotkey: Option<&str>,
    instruction_hotkey: Option<&str>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut registered = state
        .registered_shortcuts
        .lock()
        .map_err(|_| "failed to lock shortcut state".to_string())?;

    let requested = [
        (RegisteredShortcutAction::Main, main_hotkey),
        (RegisteredShortcutAction::Launcher, launcher_hotkey),
        (RegisteredShortcutAction::Mini, mini_hotkey),
        (RegisteredShortcutAction::Instruction, instruction_hotkey),
    ];
    let mut parsed = Vec::new();
    for (action, hotkey) in requested {
        let Some(hotkey) = hotkey.map(str::trim).filter(|value| !value.is_empty()) else {
            continue;
        };
        let shortcut = Shortcut::from_str(hotkey)
            .map_err(|error| format!("invalid shortcut `{hotkey}`: {error}"))?;
        if parsed
            .iter()
            .any(|(current, _): &(Shortcut, RegisteredShortcutAction)| current == &shortcut)
        {
            return Err(format!("duplicate shortcut: `{hotkey}`"));
        }
        parsed.push((shortcut, action));
    }

    let previous = registered.clone();
    for (shortcut, _) in &previous {
        let _ = app.global_shortcut().unregister(*shortcut);
    }

    let mut next = Vec::new();
    for (shortcut, action) in parsed {
        if let Err(error) = app.global_shortcut().register(shortcut) {
            for (registered_shortcut, _) in &next {
                let _ = app.global_shortcut().unregister(*registered_shortcut);
            }
            let mut restored = Vec::new();
            let mut rollback_errors = Vec::new();
            for (previous_shortcut, previous_action) in &previous {
                match app.global_shortcut().register(*previous_shortcut) {
                    Ok(()) => restored.push((*previous_shortcut, *previous_action)),
                    Err(rollback_error) => rollback_errors.push(rollback_error.to_string()),
                }
            }
            *registered = restored;
            let rollback_detail = if rollback_errors.is_empty() {
                String::new()
            } else {
                format!(
                    "; failed to restore prior shortcuts: {}",
                    rollback_errors.join(", ")
                )
            };
            return Err(format!(
                "failed to register shortcut: {error}{rollback_detail}"
            ));
        }
        next.push((shortcut, action));
    }
    *registered = next;

    Ok(())
}

fn sync_autostart(app: &AppHandle, enabled: bool) {
    #[cfg(desktop)]
    {
        let manager = app.autolaunch();
        let current = manager.is_enabled().unwrap_or(false);
        if enabled && !current {
            if let Err(error) = manager.enable() {
                eprintln!("failed to enable autoStart: {error}");
            }
        } else if !enabled && current {
            if let Err(error) = manager.disable() {
                eprintln!("failed to disable autoStart: {error}");
            }
        }
    }

    #[cfg(not(desktop))]
    {
        let _ = (app, enabled);
    }
}
