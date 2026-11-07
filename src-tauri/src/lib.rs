mod app_paths;
mod commands;
mod display_awake;
mod models;
mod startup;
mod state;

use commands::actions::execute_actions;
use commands::config::{
    backup_config_before_instruction_change, load_config, load_next_step_freshness,
    open_config_backups, open_data_folder, restore_backup, save_config, select_backup_folder,
    select_backup_zip, test_profile_info, undo_today_selection, update_instruction_references,
};
use commands::drop::{choose_launcher_target, resolve_drop_item};
use commands::explorer::reveal_launcher_item;
use commands::icons::{delete_button_icon_cache, ensure_button_icon_cache};
use commands::instructions::{
    choose_instruction_root, create_instruction_file, create_instruction_folder,
    inspect_instruction_folder, list_instruction_directory, list_instruction_roots,
    move_instruction_to_recycle_bin, open_instruction_folder, open_instruction_in_default_editor,
    read_instruction, read_instruction_bytes, read_instruction_info, rename_instruction_file,
    rename_instruction_folder, reveal_instruction_in_explorer, search_instruction_files,
    validate_instruction_root, write_instruction,
};
use commands::main_shell_drop::{enable_main_shell_drop, remove_main_shell_drop_target};
use commands::notes::{
    load_notes_history, load_today_notes, save_notes_for_date, save_today_notes,
};
use commands::reset::{
    acknowledge_software_reset_recovery, create_software_reset_backup,
    load_software_reset_recovery, prepare_software_reset, recover_interrupted_software_reset,
    software_reset,
};
use commands::sessions::{
    delete_session_entry, load_do_now_candidates, load_next_step_suggestions, load_session_entries,
    load_session_summary, load_today_session_total, load_weekly_review, record_manual_session,
    record_session, update_session_entry,
};
use commands::shell_drop_poc::{
    start_shell_drop_poc, stop_shell_drop_poc, stop_shell_drop_poc_internal,
};
use display_awake::{set_display_awake, DisplayAwakeState};
use startup::{
    apply_dashboard_settings_at_startup, focus_dashboard_window, focus_main_window,
    reapply_dashboard_settings, resume_dashboard_shortcuts, shortcut_action,
    shortcut_registration_status, start_config_watcher, suspend_dashboard_shortcuts,
};
use state::{AppState, RegisteredShortcutAction};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

/// 保存・復元の対象にタイトルバーの有無(DECORATIONS)を含めない。
/// v1.4.1 までの保存状態は `"decorated": true` のため、これを含めると
/// decorations: false にした初回起動で標準のタイトルバーが復元されて二重になる。
#[cfg(desktop)]
const WINDOW_STATE_FLAGS: tauri_plugin_window_state::StateFlags =
    tauri_plugin_window_state::StateFlags::all()
        .difference(tauri_plugin_window_state::StateFlags::DECORATIONS);

/// 起動をやめるときに、理由をダイアログで出す。
/// release ビルドはコンソールを持たないため、`eprintln!` だけでは理由が伝わらない。
fn show_startup_error(message: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let text: Vec<u16> = std::ffi::OsStr::new(message)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let title: Vec<u16> = std::ffi::OsStr::new("Life Launcher")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        // MB_OK | MB_ICONERROR | MB_SETFOREGROUND
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                text.as_ptr(),
                title.as_ptr(),
                0x0000_0010 | 0x0001_0000,
            );
        }
    }
    #[cfg(not(windows))]
    {
        let _ = message;
    }
}

#[cfg(windows)]
extern "system" {
    fn MessageBoxW(
        hwnd: *mut std::ffi::c_void,
        text: *const u16,
        caption: *const u16,
        message_type: u32,
    ) -> i32;
}

/// P97-04: the tray tooltip carries the app version, and the test profile stays distinguishable.
fn tray_tooltip_text(test_profile: bool, version: &str) -> String {
    if test_profile {
        format!("Life Launcher (テスト) {version}")
    } else {
        format!("Life Launcher {version}")
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 保存先（普段の起動かテスト用の起動か）は、ここで1回だけ決める。
    // 決められないときは、普段のデータに黙って戻らずに理由を出して終了する。
    let paths = match app_paths::AppPaths::bootstrap() {
        Ok(paths) => paths,
        Err(message) => {
            eprintln!("Life Launcher を起動できません: {message}");
            show_startup_error(&message);
            std::process::exit(2);
        }
    };
    let test_profile = paths.is_test_profile();
    if let Err(message) = app_paths::init(paths) {
        eprintln!("保存先を決められません: {message}");
        show_startup_error(&format!("保存先を決められません: {message}"));
        std::process::exit(2);
    }

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // テスト用の起動は、普段のアプリと別に起動できるようにする（1つしか起動しない仕組みを付けない）。
        if !test_profile {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                focus_main_window(app);
            }));
        }
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .manage(AppState::default())
        .manage(DisplayAwakeState::default())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // メインの窓は tauri.conf.json で `create: false` にして、ここで作る。
            // テスト用の起動のときだけ、WebView2 のデータをテスト用のフォルダへ向ける
            // （tauri.conf.json の data_directory は絶対パスを受け付けないため）。
            if let Some(window_config) = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .cloned()
            {
                let mut window_config = window_config;
                if test_profile {
                    window_config.title = format!("{} (テスト)", window_config.title);
                }
                let mut window_builder =
                    tauri::WebviewWindowBuilder::from_config(app.handle(), &window_config)?;
                if let Some(data_dir) = app_paths::webview_data_dir() {
                    window_builder = window_builder.data_directory(data_dir);
                }
                window_builder.build()?;
            }

            // テスト用の起動ではアイコンのキャッシュもテスト用のフォルダにあるため、
            // asset プロトコルの範囲にそのフォルダを足す。
            if let Some(profile) = app_paths::test_profile_path() {
                if let Err(error) = app
                    .asset_protocol_scope()
                    .allow_directory(profile.join(app_paths::CONFIG_DIR_NAME), true)
                {
                    eprintln!("failed to allow the test profile for the asset protocol: {error}");
                }
            }

            recover_interrupted_software_reset(app.handle())?;
            let mut window_state = tauri_plugin_window_state::Builder::default()
                .with_state_flags(WINDOW_STATE_FLAGS)
                .skip_initial_state("life-launcher-instruction")
                .skip_initial_state("dictionary");
            if let Some(file) = app_paths::window_state_file() {
                // テスト用の起動では、窓の状態もテスト用のフォルダに保存する。
                window_state = window_state.with_filename(file.to_string_lossy().to_string());
            }
            app.handle().plugin(window_state.build())?;
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
                // テスト用の起動は、トレイのメニューの一番上で見分けられるようにする。
                let test_item = if test_profile {
                    Some(MenuItem::with_id(
                        app,
                        "test-profile",
                        "テスト用の起動",
                        false,
                        None::<&str>,
                    )?)
                } else {
                    None
                };
                let menu = match &test_item {
                    Some(item) => Menu::with_items(app, &[item, &open_item, &quit_item])?,
                    None => Menu::with_items(app, &[&open_item, &quit_item])?,
                };
                let tray_tooltip =
                    tray_tooltip_text(test_profile, &app.package_info().version.to_string());
                let mut tray = TrayIconBuilder::with_id("life-launcher-tray")
                    .tooltip(tray_tooltip)
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
            if let Ok(raw_delay) = std::env::var("LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS") {
                if let Ok(delay_ms) = raw_delay.parse::<u64>() {
                    if (1_000..=120_000).contains(&delay_ms) {
                        let app_handle = app.handle().clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                            app_handle.exit(0);
                        });
                    }
                }
            }
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
            undo_today_selection,
            backup_config_before_instruction_change,
            update_instruction_references,
            open_config_backups,
            open_data_folder,
            select_backup_folder,
            select_backup_zip,
            restore_backup,
            create_software_reset_backup,
            prepare_software_reset,
            software_reset,
            load_software_reset_recovery,
            acknowledge_software_reset_recovery,
            execute_actions,
            resolve_drop_item,
            choose_launcher_target,
            reveal_launcher_item,
            ensure_button_icon_cache,
            delete_button_icon_cache,
            validate_instruction_root,
            choose_instruction_root,
            list_instruction_roots,
            list_instruction_directory,
            search_instruction_files,
            read_instruction,
            read_instruction_info,
            read_instruction_bytes,
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
            shortcut_registration_status,
            suspend_dashboard_shortcuts,
            resume_dashboard_shortcuts,
            focus_dashboard_window,
            enable_main_shell_drop,
            start_shell_drop_poc,
            stop_shell_drop_poc,
            set_display_awake,
            test_profile_info
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. }) {
                app.state::<DisplayAwakeState>().shutdown();
                remove_main_shell_drop_target(app);
                let _ = stop_shell_drop_poc_internal(app);
            }
        });
}

#[cfg(all(test, desktop))]
mod window_state_flags_tests {
    use super::WINDOW_STATE_FLAGS;
    use serde::Deserialize;
    use tauri_plugin_window_state::StateFlags;

    /// 保存・復元の対象からタイトルバーの有無(DECORATIONS)が外れていること。
    /// 位置・大きさ・最大化・表示・全画面は今までどおり扱う。
    #[test]
    fn excluded_decorations_keeps_other_flags() {
        let kept = StateFlags::SIZE
            | StateFlags::POSITION
            | StateFlags::MAXIMIZED
            | StateFlags::VISIBLE
            | StateFlags::FULLSCREEN;
        assert!(WINDOW_STATE_FLAGS.contains(kept));
        assert!(!WINDOW_STATE_FLAGS.contains(StateFlags::DECORATIONS));
    }

    /// v1.4.1 が保存した状態ファイルと同じ形のテストデータ。
    /// 項目名と形は tauri-plugin-window-state 2.4.1 の非公開構造体
    /// `WindowState`(width, height, x, y, prev_x, prev_y, maximized, visible,
    /// decorated, fullscreen)を写した合成値。`decorations` ではなく `decorated`
    /// であることに注意。
    const V141_STATE_JSON: &str = r#"{
        "main": {
            "width": 1080,
            "height": 680,
            "x": 120,
            "y": 84,
            "prev_x": 120,
            "prev_y": 84,
            "maximized": false,
            "visible": true,
            "decorated": true,
            "fullscreen": false
        }
    }"#;

    #[derive(Debug, Deserialize, PartialEq)]
    struct WindowStateMirror {
        width: u32,
        height: u32,
        x: i32,
        y: i32,
        prev_x: i32,
        prev_y: i32,
        maximized: bool,
        visible: bool,
        decorated: bool,
        fullscreen: bool,
    }

    /// v1.4.1 の形の状態ファイル(`"decorated": true` を含む)が問題なく
    /// 読み取れて、位置・大きさ・最大化の値は保持されること。
    /// プラグインの `WindowState` は非公開のため、同じ項目のミラー構造体で
    /// 確かめる。プラグインを更新して項目名が変わった場合、このテストが
    /// 失敗して再確認を促す。
    #[test]
    fn v141_state_file_shape_still_deserializes() {
        let states: std::collections::HashMap<String, WindowStateMirror> =
            serde_json::from_str(V141_STATE_JSON).expect("v1.4.1 形の状態ファイルを読める");
        let main = states.get("main").expect("main の状態がある");
        assert_eq!(main.width, 1080);
        assert_eq!(main.height, 680);
        assert_eq!(main.x, 120);
        assert_eq!(main.y, 84);
        assert!(!main.maximized);
        assert!(main.decorated);
    }
}

#[cfg(test)]
mod tray_tooltip_tests {
    use super::tray_tooltip_text;

    #[test]
    fn tray_tooltip_carries_the_version_for_both_profiles() {
        assert_eq!(tray_tooltip_text(false, "1.4.3"), "Life Launcher 1.4.3");
        assert_eq!(
            tray_tooltip_text(true, "1.4.3"),
            "Life Launcher (テスト) 1.4.3"
        );
    }
}
