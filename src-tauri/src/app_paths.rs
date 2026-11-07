//! 保存先を起動の最初に1回だけ決めて、アプリのすべての処理がここを見る。
//!
//! 環境変数 `LIFE_LAUNCHER_TEST_PROFILE` に「テスト用のフォルダ」の絶対パスが入っている
//! ときだけ、テスト用の起動として保存先をそのフォルダの中へ切り替える。入っていない
//! ときは今までと同じ保存先になる。
//!
//! 普段の保存先に届くパス（同じ・中・親）は受け付けない。黙って普段のデータへ戻ると、
//! 実機確認のつもりが普段のデータを書き換えてしまうため。

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;

/// テスト用の起動を切り替える環境変数。
pub const TEST_PROFILE_ENV: &str = "LIFE_LAUNCHER_TEST_PROFILE";

/// データ（設定・ノート・記録・アイコン・バックアップ・初期化の控え）のフォルダ名。
pub const CONFIG_DIR_NAME: &str = "life-launcher";

/// テスト用のフォルダの中に作る、データのフォルダ名。
pub const TEST_DATA_DIR_NAME: &str = "life-launcher";

/// テスト用のフォルダの中に作る、窓の状態のファイル名。
pub const TEST_WINDOW_STATE_FILE_NAME: &str = "window-state.json";

/// テスト用のフォルダの中に作る、WebView2 のデータのフォルダ名。
pub const TEST_WEBVIEW_DIR_NAME: &str = "webview";

/// Tauri の識別子（`src-tauri/tauri.conf.json` の `identifier`）。窓の状態と WebView2 の
/// 普段の保存先がこの名前で決まる。テストで tauri.conf.json と一致することを確かめる。
pub const APP_IDENTIFIER: &str = "com.takuyakou.lifelauncher";

/// 普段の保存先。テスト用のフォルダがここに届かないことを確かめるために使う。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalPaths {
    /// `%APPDATA%\life-launcher`
    pub data_dir: PathBuf,
    /// `%APPDATA%\<identifier>`（窓の状態の保存先のフォルダ）
    pub window_state_dir: PathBuf,
    /// `%LOCALAPPDATA%\<identifier>`（WebView2 のデータのフォルダ。取れないこともある）
    pub webview_data_dir: Option<PathBuf>,
    /// `%APPDATA%`
    pub roaming: PathBuf,
    /// `%LOCALAPPDATA%`
    pub local: Option<PathBuf>,
    /// `%USERPROFILE%`
    pub user_profile: Option<PathBuf>,
}

impl NormalPaths {
    fn protected(&self) -> Vec<PathBuf> {
        let mut paths = vec![
            self.data_dir.clone(),
            self.window_state_dir.clone(),
            self.roaming.clone(),
        ];
        if let Some(local) = &self.local {
            paths.push(local.clone());
        }
        if let Some(webview) = &self.webview_data_dir {
            paths.push(webview.clone());
        }
        if let Some(user) = &self.user_profile {
            paths.push(user.clone());
        }
        paths
    }
}

/// 起動の最初に決める保存先。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    test_profile: Option<PathBuf>,
    data_dir: PathBuf,
    window_state_file: Option<PathBuf>,
    webview_data_dir: Option<PathBuf>,
    normal: NormalPaths,
}

impl AppPaths {
    /// 環境変数と Windows の標準のフォルダから保存先を決める。
    pub fn bootstrap() -> Result<Self, String> {
        Self::bootstrap_with(std::env::var_os(TEST_PROFILE_ENV), |name| {
            std::env::var_os(name)
        })
    }

    fn bootstrap_with(
        test_profile: Option<OsString>,
        env: impl Fn(&str) -> Option<OsString>,
    ) -> Result<Self, String> {
        let roaming = env("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| "%APPDATA% is not available".to_string())?;
        let local = env("LOCALAPPDATA").map(PathBuf::from);
        let user_profile = env("USERPROFILE").map(PathBuf::from);
        let normal = NormalPaths {
            data_dir: roaming.join(CONFIG_DIR_NAME),
            window_state_dir: roaming.join(APP_IDENTIFIER),
            webview_data_dir: local.as_ref().map(|path| path.join(APP_IDENTIFIER)),
            roaming,
            local,
            user_profile,
        };
        Self::resolve(test_profile.as_deref(), normal)
    }

    /// テスト用のフォルダを受け取って保存先を決める。受け付けられないときは理由を返す。
    pub fn resolve(
        test_profile: Option<&std::ffi::OsStr>,
        normal: NormalPaths,
    ) -> Result<Self, String> {
        let Some(raw) = test_profile else {
            return Ok(Self {
                test_profile: None,
                data_dir: normal.data_dir.clone(),
                window_state_file: None,
                webview_data_dir: None,
                normal,
            });
        };
        let profile = validate_test_profile(Path::new(raw), &normal)?;
        let data_dir = profile.join(TEST_DATA_DIR_NAME);
        let window_state_file = profile.join(TEST_WINDOW_STATE_FILE_NAME);
        let webview_data_dir = profile.join(TEST_WEBVIEW_DIR_NAME);
        Ok(Self {
            test_profile: Some(profile),
            data_dir,
            window_state_file: Some(window_state_file),
            webview_data_dir: Some(webview_data_dir),
            normal,
        })
    }

    pub fn is_test_profile(&self) -> bool {
        self.test_profile.is_some()
    }

    pub fn test_profile(&self) -> Option<&Path> {
        self.test_profile.as_deref()
    }

    /// データ（設定・ノート・記録・アイコン・バックアップ・初期化の控え）のフォルダ。
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    /// 窓の状態の保存ファイル。テスト用の起動のときだけ、テスト用のフォルダの中を指す。
    pub fn window_state_file(&self) -> Option<&Path> {
        self.window_state_file.as_deref()
    }

    /// WebView2 のデータのフォルダ。テスト用の起動のときだけ、テスト用のフォルダの中を指す。
    pub fn webview_data_dir(&self) -> Option<&Path> {
        self.webview_data_dir.as_deref()
    }
}

/// パスを、実体（シンボリックリンク・ジャンクション）を解決した形にする。
/// まだ無いフォルダは、いちばん近い存在する親を解決してから残りを足す。
fn normalize(path: &Path) -> PathBuf {
    if let Ok(canonical) = std::fs::canonicalize(path) {
        return strip_verbatim(canonical);
    }
    let mut existing = path.to_path_buf();
    let mut rest = Vec::new();
    loop {
        match existing.parent() {
            Some(parent) if !existing.as_os_str().is_empty() => {
                if let Some(name) = existing.file_name() {
                    rest.push(name.to_os_string());
                }
                existing = parent.to_path_buf();
                if let Ok(canonical) = std::fs::canonicalize(&existing) {
                    let mut result = strip_verbatim(canonical);
                    for name in rest.iter().rev() {
                        result.push(name);
                    }
                    return result;
                }
            }
            _ => break,
        }
    }
    strip_verbatim(path.to_path_buf())
}

/// `canonicalize` が付ける `\\?\` を外して、ふつうのパスに戻す。
fn strip_verbatim(path: PathBuf) -> PathBuf {
    let raw = path.as_os_str().to_string_lossy().to_string();
    if let Some(rest) = raw.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        path
    }
}

/// `child` が `parent` と同じか、その中にあるか（Windows なので大文字小文字を区別しない）。
fn is_same_or_within(child: &Path, parent: &Path) -> bool {
    let child = normalize(child);
    let parent = normalize(parent);
    let child: Vec<_> = child
        .components()
        .map(|part| part.as_os_str().to_string_lossy().to_lowercase())
        .collect();
    let parent: Vec<_> = parent
        .components()
        .map(|part| part.as_os_str().to_string_lossy().to_lowercase())
        .collect();
    if parent.len() > child.len() {
        return false;
    }
    child[..parent.len()] == parent[..]
}

fn is_drive_root(path: &Path) -> bool {
    let mut components = path.components();
    matches!(components.next(), Some(Component::Prefix(_)))
        && matches!(components.next(), Some(Component::RootDir))
        && components.next().is_none()
}

/// テスト用のフォルダとして使えるか確かめる。使えないときは理由を返す。
fn validate_test_profile(raw: &Path, normal: &NormalPaths) -> Result<PathBuf, String> {
    let raw_text = raw.to_string_lossy().trim().to_string();
    if raw_text.is_empty() {
        return Err("テスト用のフォルダが空です".to_string());
    }
    if !raw.is_absolute() {
        return Err(format!(
            "テスト用のフォルダは絶対パスで指定してください: {raw_text}"
        ));
    }
    if raw
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return Err(format!("テスト用のフォルダに .. は使えません: {raw_text}"));
    }

    let profile = normalize(raw);
    if is_drive_root(&profile) {
        return Err(format!(
            "ドライブのルートはテスト用のフォルダに使えません: {}",
            profile.display()
        ));
    }
    for protected in normal.protected() {
        let protected = normalize(&protected);
        if is_same_or_within(&profile, &protected) {
            return Err(format!(
                "テスト用のフォルダが普段の保存先の中にあります: {} (普段の保存先: {})",
                profile.display(),
                protected.display()
            ));
        }
        if is_same_or_within(&protected, &profile) {
            return Err(format!(
                "テスト用のフォルダが普段の保存先を含んでいます: {} (普段の保存先: {})",
                profile.display(),
                protected.display()
            ));
        }
    }

    std::fs::create_dir_all(&profile).map_err(|error| {
        format!(
            "テスト用のフォルダを作れません: {}: {error}",
            profile.display()
        )
    })?;
    let probe = profile.join(".life-launcher-write-probe");
    std::fs::write(&probe, b"probe").map_err(|error| {
        format!(
            "テスト用のフォルダに書けません: {}: {error}",
            profile.display()
        )
    })?;
    let _ = std::fs::remove_file(&probe);

    Ok(profile)
}

static PATHS: OnceLock<AppPaths> = OnceLock::new();

/// 起動の最初に1回だけ保存先を決める。
pub fn init(paths: AppPaths) -> Result<(), String> {
    PATHS
        .set(paths)
        .map_err(|_| "保存先はすでに決まっています".to_string())
}

pub fn current() -> Option<&'static AppPaths> {
    PATHS.get()
}

/// データのフォルダ。起動の最初に決めた値を使う。
///
/// まだ決まっていないとき（単体テストが `%APPDATA%` を一時フォルダへ向けて
/// 保存先を組み立てる場合）だけ、`%APPDATA%\life-launcher` を使う。
pub fn data_dir() -> Result<PathBuf, String> {
    if let Some(paths) = current() {
        return Ok(paths.data_dir().to_path_buf());
    }
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "%APPDATA% is not available".to_string())?;
    Ok(app_data.join(CONFIG_DIR_NAME))
}

pub fn is_test_profile() -> bool {
    current().is_some_and(AppPaths::is_test_profile)
}

pub fn test_profile_path() -> Option<PathBuf> {
    current().and_then(|paths| paths.test_profile().map(Path::to_path_buf))
}

pub fn window_state_file() -> Option<PathBuf> {
    current().and_then(|paths| paths.window_state_file().map(Path::to_path_buf))
}

pub fn webview_data_dir() -> Option<PathBuf> {
    current().and_then(|paths| paths.webview_data_dir().map(Path::to_path_buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("life-launcher-paths-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("temp root");
        root
    }

    fn normal_at(root: &Path) -> NormalPaths {
        let roaming = root.join("roaming");
        let local = root.join("local");
        NormalPaths {
            data_dir: roaming.join(CONFIG_DIR_NAME),
            window_state_dir: roaming.join(APP_IDENTIFIER),
            webview_data_dir: Some(local.join(APP_IDENTIFIER)),
            roaming,
            local: Some(local),
            user_profile: Some(root.join("user")),
        }
    }

    #[test]
    fn without_the_variable_the_normal_locations_are_used() {
        let root = temp_root("normal");
        let normal = normal_at(&root);
        let paths = AppPaths::resolve(None, normal.clone()).expect("resolve");
        assert!(!paths.is_test_profile());
        assert_eq!(paths.data_dir(), normal.data_dir);
        assert_eq!(paths.window_state_file(), None);
        assert_eq!(paths.webview_data_dir(), None);
    }

    #[test]
    fn with_the_variable_every_location_moves_into_the_profile() {
        let root = temp_root("test");
        let profile = root.join("profile");
        let paths =
            AppPaths::resolve(Some(profile.as_os_str()), normal_at(&root)).expect("resolve");
        assert!(paths.is_test_profile());
        let profile = normalize(&profile);
        assert_eq!(paths.data_dir(), profile.join(TEST_DATA_DIR_NAME));
        assert_eq!(
            paths.window_state_file(),
            Some(profile.join(TEST_WINDOW_STATE_FILE_NAME)).as_deref()
        );
        assert_eq!(
            paths.webview_data_dir(),
            Some(profile.join(TEST_WEBVIEW_DIR_NAME)).as_deref()
        );
    }

    #[test]
    fn empty_relative_and_parent_paths_are_rejected() {
        let root = temp_root("reject");
        let normal = normal_at(&root);
        for raw in [
            OsString::from(""),
            OsString::from("profile"),
            OsString::from("a/../b"),
        ] {
            assert!(
                AppPaths::resolve(Some(&raw), normal.clone()).is_err(),
                "{raw:?}"
            );
        }
    }

    #[test]
    fn paths_that_reach_the_normal_locations_are_rejected() {
        let root = temp_root("protected");
        let normal = normal_at(&root);
        let data = normal.data_dir.clone();
        let window_state = normal.window_state_dir.clone();
        let webview = normal.webview_data_dir.clone().unwrap();
        let roaming = normal.roaming.clone();
        let local = normal.local.clone().unwrap();
        let user = normal.user_profile.clone().unwrap();
        let cases = [
            data.clone(),
            data.join("inner"),
            window_state.clone(),
            webview.clone(),
            roaming.clone(),
            roaming.join("other"),
            local.clone(),
            user.clone(),
            root.clone(),
        ];
        for raw in cases {
            assert!(
                AppPaths::resolve(Some(raw.as_os_str()), normal.clone()).is_err(),
                "{}",
                raw.display()
            );
        }
    }

    #[test]
    fn short_names_that_reach_the_normal_location_are_rejected() {
        let root = temp_root("short-name");
        let mut normal = normal_at(&root);
        normal.data_dir = root
            .join("a-very-long-directory-name-for-8-3")
            .join(CONFIG_DIR_NAME);
        std::fs::create_dir_all(&normal.data_dir).expect("data dir");
        let Some(short_data) = short_path(&normal.data_dir) else {
            return;
        };
        if short_data == normal.data_dir {
            return;
        }
        let candidate = short_data.join("inner");
        assert!(
            AppPaths::resolve(Some(candidate.as_os_str()), normal).is_err(),
            "{}",
            candidate.display()
        );
    }

    #[cfg(windows)]
    fn short_path(path: &Path) -> Option<PathBuf> {
        let command = format!("for %I in (\"{}\") do @echo %~sI", path.display());
        let output = std::process::Command::new("cmd")
            .args(["/C", &command])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        (!text.is_empty()).then(|| PathBuf::from(text))
    }

    #[cfg(not(windows))]
    fn short_path(_path: &Path) -> Option<PathBuf> {
        None
    }

    #[test]
    fn drive_roots_are_rejected() {
        let root = temp_root("drive");
        let normal = normal_at(&root);
        let system = std::env::var_os("SystemDrive").unwrap_or_else(|| OsString::from("C:"));
        let drive_root = PathBuf::from(format!("{}\\", system.to_string_lossy()));
        assert!(AppPaths::resolve(Some(drive_root.as_os_str()), normal).is_err());
    }

    #[test]
    fn a_junction_that_reaches_the_normal_location_is_rejected() {
        let root = temp_root("junction");
        let normal = normal_at(&root);
        std::fs::create_dir_all(&normal.data_dir).expect("data dir");
        let junction = root.join("junction-to-data");
        #[cfg(windows)]
        {
            let status = std::process::Command::new("cmd")
                .args([
                    "/C",
                    "mklink",
                    "/J",
                    &junction.to_string_lossy(),
                    &normal.data_dir.to_string_lossy(),
                ])
                .status();
            if !matches!(status, Ok(status) if status.success()) {
                eprintln!("junction を作れないため、この確認は省略します");
                return;
            }
        }
        assert!(AppPaths::resolve(Some(junction.as_os_str()), normal).is_err());
    }

    #[test]
    fn the_identifier_matches_tauri_conf() {
        let conf = include_str!("../tauri.conf.json");
        assert!(conf.contains(&format!("\"identifier\": \"{APP_IDENTIFIER}\"")));
    }
}
