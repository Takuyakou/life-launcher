use crate::commands::config::load_config_internal;
use crate::models::{Action, LauncherButton};
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf, Prefix};
use tauri::AppHandle;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use windows::Win32::System::Threading::CREATE_NO_WINDOW;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RevealKind {
    File,
    Folder,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RevealTarget {
    path: PathBuf,
    kind: RevealKind,
}

fn is_local_drive_absolute(path: &Path) -> bool {
    let mut components = path.components();
    let local_prefix = matches!(
        components.next(),
        Some(Component::Prefix(prefix))
            if matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
    );
    local_prefix && matches!(components.next(), Some(Component::RootDir))
}

fn action_target(action: &Action) -> Option<(&str, RevealKind)> {
    match action {
        Action::OpenApp { path, .. }
        | Action::OpenFile { path }
        | Action::RunScript { path, .. } => Some((path, RevealKind::File)),
        Action::OpenFolder { path } => Some((path, RevealKind::Folder)),
        Action::OpenUrl { .. } | Action::OpenShellSpecial { .. } => None,
    }
}

fn validate_reveal_target(button: &LauncherButton) -> Result<RevealTarget, String> {
    if button.actions.len() != 1 {
        return Err("launcher item does not have one unambiguous local target".to_string());
    }
    let (raw_path, kind) = action_target(&button.actions[0])
        .ok_or_else(|| "launcher item type cannot be revealed".to_string())?;
    let requested = PathBuf::from(raw_path.trim());
    if !is_local_drive_absolute(&requested) {
        return Err("launcher item is not a local drive path".to_string());
    }
    let path = fs::canonicalize(&requested)
        .map_err(|_| "launcher item path does not exist".to_string())?;
    if !is_local_drive_absolute(&path) {
        return Err("launcher item resolved outside a local drive".to_string());
    }
    let metadata =
        fs::metadata(&path).map_err(|_| "launcher item metadata is unavailable".to_string())?;
    let supported = match kind {
        RevealKind::File => metadata.is_file(),
        RevealKind::Folder => metadata.is_dir(),
    };
    if !supported {
        return Err("launcher item path type does not match its action".to_string());
    }
    Ok(RevealTarget { path, kind })
}

fn explorer_arguments(target: &RevealTarget) -> Vec<OsString> {
    match target.kind {
        RevealKind::File => vec![
            OsString::from("/select,"),
            target.path.clone().into_os_string(),
        ],
        RevealKind::Folder => vec![target.path.clone().into_os_string()],
    }
}

fn dispatch_explorer(
    target: &RevealTarget,
    spawn: impl FnOnce(&[OsString]) -> std::io::Result<()>,
) -> Result<(), String> {
    spawn(&explorer_arguments(target)).map_err(|_| "failed to open Explorer".to_string())
}

#[tauri::command]
pub fn reveal_launcher_item(app: AppHandle, button_id: String) -> Result<String, String> {
    let config = load_config_internal(&app)?.config;
    let button = config
        .buttons
        .iter()
        .find(|button| button.id == button_id)
        .ok_or_else(|| "launcher item was not found".to_string())?;
    let target = validate_reveal_target(button)?;

    #[cfg(windows)]
    dispatch_explorer(&target, |args| {
        let mut command = std::process::Command::new("explorer.exe");
        command.args(args).creation_flags(CREATE_NO_WINDOW.0);
        command.spawn().map(|_| ())
    })?;

    #[cfg(not(windows))]
    return Err("Explorer reveal is unsupported on this platform".to_string());

    Ok(target.path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ShellSpecialItem;

    fn button(action: Action) -> LauncherButton {
        LauncherButton {
            id: "fixture".to_string(),
            label: "Fixture".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![action],
        }
    }

    fn fixture_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "life-launcher-explorer-{name}-{}",
            std::process::id()
        ))
    }

    #[cfg(windows)]
    #[test]
    fn validates_existing_file_and_builds_separate_select_arguments() {
        let root = fixture_root("file");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        let file = root.join("item & safe, name.txt");
        fs::write(&file, b"fixture").expect("write fixture");
        let target = validate_reveal_target(&button(Action::OpenFile {
            path: file.to_string_lossy().to_string(),
        }))
        .expect("valid file target");
        let args = explorer_arguments(&target);
        assert_eq!(target.kind, RevealKind::File);
        assert_eq!(args[0], OsString::from("/select,"));
        assert_eq!(PathBuf::from(&args[1]), fs::canonicalize(&file).unwrap());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[cfg(windows)]
    #[test]
    fn validates_existing_folder_without_select_switch() {
        let root = fixture_root("folder");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        let target = validate_reveal_target(&button(Action::OpenFolder {
            path: root.to_string_lossy().to_string(),
        }))
        .expect("valid folder target");
        let args = explorer_arguments(&target);
        assert_eq!(target.kind, RevealKind::Folder);
        assert_eq!(
            args,
            vec![fs::canonicalize(&root).unwrap().into_os_string()]
        );
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[cfg(windows)]
    #[test]
    fn rejects_missing_and_mismatched_paths() {
        let missing = fixture_root("missing").join("absent.txt");
        assert!(validate_reveal_target(&button(Action::OpenFile {
            path: missing.to_string_lossy().to_string(),
        }))
        .is_err());

        let root = fixture_root("mismatch");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        assert!(validate_reveal_target(&button(Action::OpenFile {
            path: root.to_string_lossy().to_string(),
        }))
        .is_err());
        fs::remove_dir_all(root).expect("remove fixture root");
    }

    #[test]
    fn rejects_url_shell_and_ambiguous_actions() {
        assert!(validate_reveal_target(&button(Action::OpenUrl {
            url: "https://example.invalid".to_string(),
        }))
        .is_err());
        assert!(validate_reveal_target(&button(Action::OpenShellSpecial {
            item: ShellSpecialItem::RecycleBin,
        }))
        .is_err());
        let mut ambiguous = button(Action::OpenFolder {
            path: "C:\\Fixture".to_string(),
        });
        ambiguous.actions.push(Action::OpenFile {
            path: "C:\\Fixture\\item.txt".to_string(),
        });
        assert!(validate_reveal_target(&ambiguous).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn dispatch_returns_a_generic_error_without_exposing_the_path() {
        let root = fixture_root("dispatch");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        let target = validate_reveal_target(&button(Action::OpenFolder {
            path: root.to_string_lossy().to_string(),
        }))
        .expect("valid folder target");
        let error = dispatch_explorer(&target, |_| Err(std::io::Error::other("fixture failure")))
            .expect_err("dispatch should fail");
        assert_eq!(error, "failed to open Explorer");
        assert!(!error.contains(&root.to_string_lossy().to_string()));
        fs::remove_dir_all(root).expect("remove fixture root");
    }
}
