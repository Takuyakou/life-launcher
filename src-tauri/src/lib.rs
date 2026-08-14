mod commands;
mod models;
mod startup;
mod state;

use commands::actions::execute_actions;
use commands::config::{
    backup_config_before_instruction_change, load_config, load_next_step_freshness,
    open_config_backups, open_data_folder, restore_backup, save_config, select_backup_folder,
    select_backup_zip, update_instruction_references,
};
use commands::drop::resolve_drop_item;
use commands::icons::{delete_button_icon_cache, ensure_button_icon_cache};
use commands::instructions::{
    choose_instruction_root, create_instruction_file, create_instruction_folder,
    inspect_instruction_folder, list_instruction_directory, list_instruction_roots,
    move_instruction_to_recycle_bin, open_instruction_folder, open_instruction_in_default_editor,
    read_instruction, rename_instruction_file, rename_instruction_folder,
    reveal_instruction_in_explorer, search_instruction_files, validate_instruction_root,
    write_instruction,
};
use commands::main_shell_drop::{enable_main_shell_drop, remove_main_shell_drop_target};
use commands::notes::{
    load_notes_history, load_today_notes, save_notes_for_date, save_today_notes,
};
use commands::sessions::{
    delete_session_entry, load_do_now_candidates, load_next_step_suggestions, load_session_entries,
    load_session_summary, load_today_session_total, load_weekly_review, record_manual_session,
    record_session, update_session_entry,
};
use commands::shell_drop_poc::{
    start_shell_drop_poc, stop_shell_drop_poc, stop_shell_drop_poc_internal,
};
use startup::{
    apply_dashboard_settings_at_startup, focus_dashboard_window, focus_main_window,
    reapply_dashboard_settings, resume_dashboard_shortcuts, shortcut_action, start_config_watcher,
    suspend_dashboard_shortcuts,
};
use state::{AppState, RegisteredShortcutAction};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }));
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .skip_initial_state("life-launcher-instruction")
                .skip_initial_state("dictionary")
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(|app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                match shortcut_action(app, shortcut) {
                                    Some(RegisteredShortcutAction::Main) => {
                                        let _ = app.emit("main-shortcut-toggle", ());
                                    }
                                    Some(RegisteredShortcutAction::Launcher) => {
                                        let _ = app.emit("launcher-shortcut-toggle", ());
                                    }
                                    Some(RegisteredShortcutAction::Mini) => {
                                        let _ = app.emit("mini-shortcut-toggle", ());
                                    }
                                    Some(RegisteredShortcutAction::Instruction) => {
                                        let _ = app.emit("instruction-shortcut-toggle", ());
                                    }
                                    None => {}
                                }
                            }
                        })
                        .build(),
                )?;

                let open_item =
                    MenuItem::with_id(app, "open", "Life Launcherを開く", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open_item, &quit_item])?;
                let mut tray = TrayIconBuilder::with_id("life-launcher-tray")
                    .tooltip("Life Launcher")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => focus_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            focus_main_window(tray.app_handle());
                        }
                    });
                if let Some(icon) = app.default_window_icon() {
                    tray = tray.icon(icon.clone());
                }
                tray.build(app)?;
            }

            apply_dashboard_settings_at_startup(app.handle())?;
            start_config_watcher(app.handle().clone())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            load_next_step_freshness,
            save_config,
            backup_config_before_instruction_change,
            update_instruction_references,
            open_config_backups,
            open_data_folder,
            select_backup_folder,
            select_backup_zip,
            restore_backup,
            execute_actions,
            resolve_drop_item,
            ensure_button_icon_cache,
            delete_button_icon_cache,
            validate_instruction_root,
            choose_instruction_root,
            list_instruction_roots,
            list_instruction_directory,
            search_instruction_files,
            read_instruction,
            write_instruction,
            create_instruction_file,
            create_instruction_folder,
            rename_instruction_file,
            rename_instruction_folder,
            move_instruction_to_recycle_bin,
            inspect_instruction_folder,
            open_instruction_in_default_editor,
            open_instruction_folder,
            reveal_instruction_in_explorer,
            load_notes_history,
            load_today_notes,
            save_notes_for_date,
            save_today_notes,
            load_session_entries,
            load_session_summary,
            load_do_now_candidates,
            load_weekly_review,
            load_next_step_suggestions,
            update_session_entry,
            delete_session_entry,
            load_today_session_total,
            record_session,
            record_manual_session,
            reapply_dashboard_settings,
            suspend_dashboard_shortcuts,
            resume_dashboard_shortcuts,
            focus_dashboard_window,
            enable_main_shell_drop,
            start_shell_drop_poc,
            stop_shell_drop_poc
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. }) {
                remove_main_shell_drop_target(app);
                let _ = stop_shell_drop_poc_internal(app);
            }
        });
}
