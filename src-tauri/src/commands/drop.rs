#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(windows)]
use std::{cmp::Reverse, fs};

use serde::Deserialize;
use tauri::AppHandle;

use crate::models::{Action, DropButtonDraft, DropResolveInput};

const SHORTCUT_PATH_ENV: &str = "LIFE_LAUNCHER_SHORTCUT_PATH";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ShortcutDetails {
    target_path: String,
    arguments: String,
    #[serde(default)]
    icon_location: String,
}

#[tauri::command]
pub async fn resolve_drop_item(
    _app: AppHandle,
    input: DropResolveInput,
) -> Result<DropButtonDraft, String> {
    tauri::async_runtime::spawn_blocking(move || match input.kind.as_str() {
        "url" => resolve_url_drop(&input.value, input.suggested_label.as_deref()),
        "path" => resolve_path_drop(&input.value),
        other => Err(format!("unsupported drop kind: {other}")),
    })
    .await
    .map_err(|error| format!("failed to resolve dropped item: {error}"))?
}

fn resolve_url_drop(raw: &str, suggested_label: Option<&str>) -> Result<DropButtonDraft, String> {
    let url =
        normalize_http_url(raw).ok_or_else(|| "drop text is not a supported URL".to_string())?;
    let label = chrome_bookmark_label(&url)
        .or_else(|| {
            suggested_label
                .map(str::trim)
                .filter(|label| !label.is_empty())
                .map(str::to_string)
        })
        .unwrap_or_else(|| url_label(&url));

    Ok(DropButtonDraft {
        label,
        group: None,
        icon_source: None,
        action: Action::OpenUrl { url: url.clone() },
        source: url,
    })
}

#[cfg(windows)]
fn chrome_bookmark_label(url: &str) -> Option<String> {
    let user_data = PathBuf::from(std::env::var_os("LOCALAPPDATA")?)
        .join("Google")
        .join("Chrome")
        .join("User Data");
    chrome_bookmark_label_from_user_data(&user_data, url)
}

#[cfg(not(windows))]
fn chrome_bookmark_label(_url: &str) -> Option<String> {
    None
}

#[cfg(windows)]
fn chrome_bookmark_label_from_user_data(user_data: &Path, url: &str) -> Option<String> {
    const MAX_BOOKMARKS_BYTES: u64 = 64 * 1024 * 1024;
    const MAX_LOCAL_STATE_BYTES: u64 = 4 * 1024 * 1024;

    let active_profile =
        read_json_file_limited(&user_data.join("Local State"), MAX_LOCAL_STATE_BYTES).and_then(
            |value| {
                value
                    .pointer("/profile/last_used")
                    .and_then(serde_json::Value::as_str)
                    .filter(|name| safe_profile_name(name))
                    .map(str::to_string)
            },
        );

    let mut bookmark_files = fs::read_dir(user_data)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() {
                return None;
            }
            let bookmarks = entry.path().join("Bookmarks");
            let metadata = bookmarks.metadata().ok()?;
            if !metadata.is_file() || metadata.len() > MAX_BOOKMARKS_BYTES {
                return None;
            }
            Some((
                active_profile
                    .as_deref()
                    .is_some_and(|active| entry.file_name() == active),
                Reverse(metadata.modified().ok()),
                bookmarks,
            ))
        })
        .collect::<Vec<_>>();
    bookmark_files.sort_by_key(|(active, modified, _)| (!*active, *modified));

    bookmark_files.into_iter().find_map(|(_, _, path)| {
        let value = read_json_file_limited(&path, MAX_BOOKMARKS_BYTES)?;
        find_chrome_bookmark_name(value.get("roots")?, url, 0)
    })
}

#[cfg(windows)]
fn read_json_file_limited(path: &Path, max_bytes: u64) -> Option<serde_json::Value> {
    let metadata = path.metadata().ok()?;
    if !metadata.is_file() || metadata.len() > max_bytes {
        return None;
    }
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

#[cfg(windows)]
fn safe_profile_name(name: &str) -> bool {
    !name.is_empty()
        && Path::new(name)
            .components()
            .all(|component| matches!(component, std::path::Component::Normal(_)))
        && Path::new(name).components().count() == 1
}

#[cfg(windows)]
fn find_chrome_bookmark_name(value: &serde_json::Value, url: &str, depth: usize) -> Option<String> {
    if depth > 64 {
        return None;
    }
    if value.get("type").and_then(serde_json::Value::as_str) == Some("url")
        && value.get("url").and_then(serde_json::Value::as_str) == Some(url)
    {
        return value
            .get("name")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_string);
    }
    value
        .as_object()
        .into_iter()
        .flat_map(|object| object.values())
        .chain(value.as_array().into_iter().flat_map(|array| array.iter()))
        .find_map(|child| find_chrome_bookmark_name(child, url, depth + 1))
}

fn normalize_http_url(raw: &str) -> Option<String> {
    let url = raw.trim();
    if url.get(..8)?.eq_ignore_ascii_case("https://") {
        Some(format!("https://{}", &url[8..]))
    } else if url.get(..7)?.eq_ignore_ascii_case("http://") {
        Some(format!("http://{}", &url[7..]))
    } else {
        None
    }
}

fn resolve_path_drop(raw: &str) -> Result<DropButtonDraft, String> {
    let path = expand_env_path(raw.trim());
    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err(format!("dropped path does not exist: {path}"));
    }

    let extension = path_ref
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if extension == "lnk" {
        return resolve_shortcut(path_ref);
    }

    let label = path_label(path_ref);
    let action = if path_ref.is_dir() {
        Action::OpenFolder { path: path.clone() }
    } else if extension == "exe" {
        Action::OpenApp {
            path: path.clone(),
            args: Vec::new(),
        }
    } else {
        Action::OpenFile { path: path.clone() }
    };

    Ok(DropButtonDraft {
        label,
        group: None,
        // Windows Shell can resolve icons for folders and associated file types as well.
        icon_source: Some(path.clone()),
        action,
        source: path,
    })
}

fn powershell_shortcut_command(script: &str, path: &Path) -> Command {
    let mut command = Command::new("powershell.exe");
    command
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .env(SHORTCUT_PATH_ENV, path);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn resolve_shortcut(path: &Path) -> Result<DropButtonDraft, String> {
    let script = r#"
$shortcutPath = $env:LIFE_LAUNCHER_SHORTCUT_PATH
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
[pscustomobject]@{
  TargetPath = $shortcut.TargetPath
  Arguments = $shortcut.Arguments
  IconLocation = $shortcut.IconLocation
} | ConvertTo-Json -Compress
"#;

    let output = powershell_shortcut_command(script, path)
        .output()
        .map_err(|error| format!("failed to resolve shortcut: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let details: ShortcutDetails = serde_json::from_str(stdout.trim())
        .map_err(|error| format!("failed to parse shortcut details: {error}"))?;
    let target_path = expand_env_path(details.target_path.trim());
    if target_path.is_empty() {
        return Err("shortcut target is empty".to_string());
    }
    let icon_source = shortcut_icon_source(path, &target_path, &details.icon_location);

    let target = PathBuf::from(&target_path);
    let extension = target
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let args = split_windows_args(&details.arguments);
    let action = if target.is_dir() {
        Action::OpenFolder {
            path: target_path.clone(),
        }
    } else if extension == "exe" {
        Action::OpenApp {
            path: target_path.clone(),
            args,
        }
    } else {
        Action::OpenFile {
            path: target_path.clone(),
        }
    };

    Ok(DropButtonDraft {
        label: path_label(path),
        group: None,
        icon_source: Some(icon_source),
        action,
        source: format!("{} -> {}", path.display(), target_path),
    })
}

fn shortcut_icon_source(shortcut: &Path, target_path: &str, icon_location: &str) -> String {
    let clean_location = icon_location.trim().trim_matches('"');
    let location_path = clean_location
        .rsplit_once(',')
        .filter(|(_, index)| index.trim().parse::<i32>().is_ok())
        .map_or(clean_location, |(path, _)| path)
        .trim()
        .trim_matches('"');
    let expanded_location = expand_env_path(location_path);

    if !expanded_location.is_empty() && Path::new(&expanded_location).is_file() {
        return expanded_location;
    }

    let expanded_target = expand_env_path(target_path.trim());
    if !expanded_target.is_empty() && Path::new(&expanded_target).exists() {
        return expanded_target;
    }

    shortcut.to_string_lossy().to_string()
}

fn split_windows_args(raw: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = raw.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '"' => in_quotes = !in_quotes,
            '\\' if chars.peek() == Some(&'"') => {
                current.push('"');
                let _ = chars.next();
            }
            ch if ch.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    args.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        args.push(current);
    }

    args
}

fn path_label(path: &Path) -> String {
    path.file_stem()
        .or_else(|| path.file_name())
        .and_then(|name| name.to_str())
        .unwrap_or("New Button")
        .to_string()
}

fn url_label(url: &str) -> String {
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    without_scheme
        .split('/')
        .next()
        .filter(|label| !label.trim().is_empty())
        .unwrap_or(url)
        .to_string()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_drop_normalizes_http_scheme_case() {
        let draft = resolve_url_drop("HTTPS://example.com/path", None).expect("valid URL");

        match draft.action {
            Action::OpenUrl { url } => assert_eq!(url, "https://example.com/path"),
            action => panic!("expected open_url, got {action:?}"),
        }
    }

    #[cfg(windows)]
    #[test]
    fn url_drop_prefers_bookmark_name_from_active_chrome_profile() {
        let root = std::env::temp_dir().join(format!(
            "life-launcher-chrome-bookmark-test-{}",
            std::process::id()
        ));
        let default = root.join("Default");
        let active = root.join("Profile 1");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&default).expect("create default profile");
        fs::create_dir_all(&active).expect("create active profile");
        fs::write(
            root.join("Local State"),
            br#"{"profile":{"last_used":"Profile 1"}}"#,
        )
        .expect("write local state");
        fs::write(
            default.join("Bookmarks"),
            br#"{"roots":{"bookmark_bar":{"type":"folder","children":[{"type":"url","name":"Default name","url":"https://example.com/"}]}}}"#,
        )
        .expect("write default bookmarks");
        fs::write(
            active.join("Bookmarks"),
            br#"{"roots":{"bookmark_bar":{"type":"folder","children":[{"type":"url","name":"My Chrome bookmark","url":"https://example.com/"}]}}}"#,
        )
        .expect("write active bookmarks");

        assert_eq!(
            chrome_bookmark_label_from_user_data(&root, "https://example.com/").as_deref(),
            Some("My Chrome bookmark")
        );

        fs::remove_dir_all(root).expect("remove chrome bookmark test");
    }

    #[test]
    fn shortcut_path_is_passed_only_through_environment() {
        let shortcut_path = Path::new(r"C:\Users\Me\Desktop\Sample App.lnk");
        let command = powershell_shortcut_command("Write-Output 'shortcut'", shortcut_path);
        let args: Vec<_> = command.get_args().collect();

        assert!(!args.contains(&shortcut_path.as_os_str()));
        assert!(command.get_envs().any(|(key, value)| {
            key == SHORTCUT_PATH_ENV && value == Some(shortcut_path.as_os_str())
        }));
    }

    #[test]
    fn shortcut_icon_source_removes_icon_index() {
        let current_exe = std::env::current_exe().expect("current exe");
        let icon_location = format!("\"{}\",0", current_exe.display());

        assert_eq!(
            shortcut_icon_source(Path::new("fallback.lnk"), "missing.exe", &icon_location),
            current_exe.to_string_lossy()
        );
    }

    #[test]
    fn shortcut_icon_source_falls_back_to_existing_target() {
        let current_exe = std::env::current_exe().expect("current exe");

        assert_eq!(
            shortcut_icon_source(
                Path::new("fallback.lnk"),
                &current_exe.to_string_lossy(),
                ",0"
            ),
            current_exe.to_string_lossy()
        );
    }
}
