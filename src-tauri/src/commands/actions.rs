use std::path::Path;
use std::process::Command;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::models::{Action, ActionResult, ShellSpecialItem};

#[tauri::command]
pub fn execute_actions(app: AppHandle, actions: Vec<Action>) -> Result<Vec<ActionResult>, String> {
    let mut results = Vec::with_capacity(actions.len());

    for (index, action) in actions.iter().enumerate() {
        let action_type = action_type(action).to_string();
        let result = execute_one(&app, action);
        results.push(ActionResult {
            index,
            action_type,
            ok: result.is_ok(),
            message: result.unwrap_or_else(|error| error),
        });
    }

    Ok(results)
}

fn execute_one(app: &AppHandle, action: &Action) -> Result<String, String> {
    match action {
        Action::OpenApp { path, args } => spawn_path(path, args).map(|_| "spawned app".to_string()),
        Action::OpenUrl { url } => app
            .opener()
            .open_url(url, None::<&str>)
            .map(|_| "opened url".to_string())
            .map_err(|error| error.to_string()),
        Action::OpenFolder { path } => {
            let expanded = expand_env_path(path);
            ensure_exists(&expanded)?;
            app.opener()
                .open_path(expanded, None::<&str>)
                .map(|_| "opened folder".to_string())
                .map_err(|error| error.to_string())
        }
        Action::OpenFile { path } => {
            let expanded = expand_env_path(path);
            ensure_exists(&expanded)?;
            app.opener()
                .open_path(expanded, None::<&str>)
                .map(|_| "opened file".to_string())
                .map_err(|error| error.to_string())
        }
        Action::RunScript { path, args } => {
            spawn_script(path, args).map(|_| "spawned script".to_string())
        }
        Action::OpenShellSpecial { item } => match item {
            ShellSpecialItem::RecycleBin => {
                open_recycle_bin().map(|_| "opened recycle bin".to_string())
            }
        },
    }
}

fn spawn_path(path: &str, args: &[String]) -> Result<(), String> {
    let expanded = expand_env_path(path);
    ensure_exists(&expanded)?;
    Command::new(expanded)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn spawn_script(path: &str, args: &[String]) -> Result<(), String> {
    let expanded = expand_env_path(path);
    ensure_exists(&expanded)?;
    let extension = Path::new(&expanded)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let mut command = match extension.as_str() {
        "ps1" => {
            let mut command = Command::new("powershell.exe");
            command
                .arg("-NoProfile")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-File")
                .arg(&expanded);
            command
        }
        "bat" | "cmd" => {
            let mut command = Command::new("cmd.exe");
            command.arg("/C").arg(&expanded);
            command
        }
        _ => Command::new(&expanded),
    };

    command
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn ensure_exists(path: &str) -> Result<(), String> {
    if Path::new(path).exists() {
        Ok(())
    } else {
        Err(format!("path does not exist: {path}"))
    }
}

fn expand_env_path(path: &str) -> String {
    let mut expanded = path.to_string();
    for (key, value) in std::env::vars() {
        let needle = format!("%{key}%");
        if expanded.contains(&needle) {
            expanded = expanded.replace(&needle, &value);
        }
    }
    expanded
}

fn action_type(action: &Action) -> &'static str {
    match action {
        Action::OpenApp { .. } => "open_app",
        Action::OpenUrl { .. } => "open_url",
        Action::OpenFolder { .. } => "open_folder",
        Action::OpenFile { .. } => "open_file",
        Action::RunScript { .. } => "run_script",
        Action::OpenShellSpecial { .. } => "open_shell_special",
    }
}

#[cfg(windows)]
fn open_recycle_bin() -> Result<(), String> {
    use windows::Win32::UI::Shell::{
        FOLDERID_RecycleBinFolder, ILFree, SHGetKnownFolderIDList, ShellExecuteExW,
        SEE_MASK_IDLIST, SHELLEXECUTEINFOW,
    };

    unsafe {
        let pidl = SHGetKnownFolderIDList(&FOLDERID_RecycleBinFolder, 0, None)
            .map_err(|error| error.to_string())?;
        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_IDLIST,
            lpIDList: pidl.cast(),
            nShow: 1,
            ..Default::default()
        };
        let result = ShellExecuteExW(&mut info).map_err(|error| error.to_string());
        ILFree(Some(pidl));
        result
    }
}

#[cfg(not(windows))]
fn open_recycle_bin() -> Result<(), String> {
    Err("ごみ箱はWindowsでのみ開けます".to_string())
}
