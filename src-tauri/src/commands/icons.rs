#[cfg(windows)]
use std::ffi::OsStr;
use std::fs;
#[cfg(windows)]
use std::io::Read;
#[cfg(windows)]
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
#[cfg(windows)]
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use regex::Regex;
#[cfg(windows)]
use reqwest::blocking::{Client, Response};
#[cfg(windows)]
use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE, LOCATION, USER_AGENT};
#[cfg(windows)]
use reqwest::{redirect::Policy, Url};

use crate::commands::config::config_dir_path;
use crate::models::{Action, LauncherButton, ShellSpecialItem};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
const ICON_SOURCE_ENV: &str = "LIFE_LAUNCHER_ICON_SOURCE";

#[cfg(windows)]
const ICON_OUTPUT_ENV: &str = "LIFE_LAUNCHER_ICON_OUTPUT";

#[cfg(windows)]
const FAVICON_CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
#[cfg(windows)]
const FAVICON_REQUEST_TIMEOUT: Duration = Duration::from_secs(6);
#[cfg(windows)]
const FAVICON_TOTAL_TIMEOUT: Duration = Duration::from_secs(15);
#[cfg(windows)]
const FAVICON_MAX_REDIRECTS: usize = 5;
#[cfg(windows)]
const FAVICON_MAX_CANDIDATES: usize = 8;
#[cfg(windows)]
const FAVICON_HTML_MAX_BYTES: usize = 512 * 1024;
#[cfg(windows)]
const FAVICON_IMAGE_MAX_BYTES: usize = 2 * 1024 * 1024;
#[cfg(windows)]
const FAVICON_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LifeLauncher/1.3";

#[tauri::command]
pub async fn ensure_button_icon_cache(button: LauncherButton) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || ensure_button_icon_cache_blocking(&button))
        .await
        .map_err(|error| format!("failed to join icon task: {error}"))?
}

#[tauri::command]
pub fn delete_button_icon_cache(button_id: String) -> Result<(), String> {
    let path = icon_cache_path(&button_id)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))?;
    }
    Ok(())
}

fn ensure_button_icon_cache_blocking(button: &LauncherButton) -> Result<Option<String>, String> {
    let cache_path = icon_cache_path(&button.id)?;
    if cache_path.exists() {
        return Ok(Some(cache_path.to_string_lossy().to_string()));
    }

    let icons_dir = cache_path
        .parent()
        .ok_or_else(|| "failed to resolve icons directory".to_string())?;
    fs::create_dir_all(icons_dir)
        .map_err(|error| format!("failed to create {}: {error}", icons_dir.display()))?;

    let mut created = false;
    if button.actions.iter().any(|action| {
        matches!(
            action,
            Action::OpenShellSpecial {
                item: ShellSpecialItem::RecycleBin
            }
        )
    }) {
        #[cfg(windows)]
        {
            if extract_recycle_bin_icon(&cache_path).is_err() {
                return Ok(None);
            }
            created = true;
        }
        #[cfg(not(windows))]
        {
            return Ok(None);
        }
    }

    if let Some(source_path) = icon_source_path(button) {
        let source = PathBuf::from(&source_path);
        if source.exists() {
            extract_shell_icon(&source, &cache_path)?;
            created = true;
        }
    }

    if !created && !cache_path.exists() {
        let Some(url) = favicon_source_url(button) else {
            return Ok(None);
        };
        fetch_favicon(&url, &cache_path)?;
    }

    if cache_path.exists() {
        Ok(Some(cache_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

fn icon_source_path(button: &LauncherButton) -> Option<String> {
    if let Some(icon_source) = button.icon_source.as_deref() {
        let clean = icon_source.trim();
        if !clean.is_empty() && is_safe_local_icon_source(clean) {
            return Some(clean.to_string());
        }
    }

    button.actions.iter().find_map(|action| match action {
        Action::OpenApp { path, .. }
        | Action::OpenFolder { path }
        | Action::OpenFile { path }
        | Action::RunScript { path, .. } => {
            Some(path.trim().to_string()).filter(|path| !path.is_empty())
        }
        Action::OpenUrl { .. } | Action::OpenShellSpecial { .. } => None,
    })
}

fn is_safe_local_icon_source(path: &str) -> bool {
    let source = Path::new(path);
    !source.as_os_str().is_empty()
        && !path.trim_start().starts_with("http://")
        && !path.trim_start().starts_with("https://")
}

fn favicon_source_url(button: &LauncherButton) -> Option<String> {
    button.actions.iter().find_map(|action| match action {
        Action::OpenUrl { url } => {
            let clean_url = url.trim();
            if clean_url.starts_with("http://") || clean_url.starts_with("https://") {
                Some(clean_url.to_string())
            } else {
                None
            }
        }
        _ => None,
    })
}

fn icon_cache_path(button_id: &str) -> Result<PathBuf, String> {
    Ok(config_dir_path()?
        .join("icons")
        .join(format!("{}.png", safe_icon_file_stem(button_id))))
}

fn safe_icon_file_stem(button_id: &str) -> String {
    let stem: String = button_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect();

    if stem.trim_matches('_').is_empty() {
        "button".to_string()
    } else {
        stem
    }
}

#[cfg(windows)]
fn powershell_icon_command(script: &str, source: &OsStr, output: &Path) -> Command {
    let mut command = Command::new("powershell.exe");
    command
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .env(ICON_SOURCE_ENV, source)
        .env(ICON_OUTPUT_ENV, output);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(windows)]
fn extract_recycle_bin_icon(output: &Path) -> Result<(), String> {
    let script = r#"
$ErrorActionPreference = "Stop"
$outputPath = $env:LIFE_LAUNCHER_ICON_OUTPUT
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class RecycleBinIcon {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
    public string szTypeName;
  }

  [DllImport("Shell32.dll")]
  public static extern int SHGetKnownFolderIDList(ref Guid rfid, uint dwFlags, IntPtr hToken, out IntPtr ppidl);

  [DllImport("Shell32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr SHGetFileInfo(IntPtr pidl, uint fileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint flags);

  [DllImport("User32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);

  [DllImport("Ole32.dll")]
  public static extern void CoTaskMemFree(IntPtr pv);
}
'@

$folderId = [Guid]::Parse("b7534046-3ecb-4c18-be4e-64cd4cb7d6ac")
$pidl = [IntPtr]::Zero
$info = New-Object RecycleBinIcon+SHFILEINFO
try {
  $hr = [RecycleBinIcon]::SHGetKnownFolderIDList([ref]$folderId, 0, [IntPtr]::Zero, [ref]$pidl)
  if ($hr -lt 0 -or $pidl -eq [IntPtr]::Zero) { throw "SHGetKnownFolderIDList failed: $hr" }

  $result = [RecycleBinIcon]::SHGetFileInfo($pidl, 0, [ref]$info, [System.Runtime.InteropServices.Marshal]::SizeOf($info), 0x108)
  if ($result -eq [IntPtr]::Zero -or $info.hIcon -eq [IntPtr]::Zero) { throw "SHGetFileInfo failed" }

  $icon = [System.Drawing.Icon]::FromHandle($info.hIcon)
  try {
    $bitmap = $icon.ToBitmap()
    try { $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose() }
  }
  finally {
    $icon.Dispose()
    [RecycleBinIcon]::DestroyIcon($info.hIcon) | Out-Null
  }
}
finally {
  if ($pidl -ne [IntPtr]::Zero) { [RecycleBinIcon]::CoTaskMemFree($pidl) }
}
"#;

    let mut command = Command::new("powershell.exe");
    command
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .env(ICON_OUTPUT_ENV, output);
    command.creation_flags(CREATE_NO_WINDOW);
    let result = command
        .output()
        .map_err(|error| format!("failed to extract recycle bin icon: {error}"))?;
    if !result.status.success() {
        let message = String::from_utf8_lossy(&result.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "failed to extract recycle bin icon".to_string()
        } else {
            message
        });
    }
    Ok(())
}

#[cfg(not(windows))]
fn extract_recycle_bin_icon(_output: &Path) -> Result<(), String> {
    Err("recycle bin icon is only available on Windows".to_string())
}

#[cfg(windows)]
fn extract_shell_icon(source: &Path, output: &Path) -> Result<(), String> {
    let script = r#"
$sourcePath = $env:LIFE_LAUNCHER_ICON_SOURCE
$outputPath = $env:LIFE_LAUNCHER_ICON_OUTPUT
Add-Type -AssemblyName System.Drawing

function Save-IconPng($icon, $path) {
  try {
    $bitmap = $icon.ToBitmap()
    try {
      $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $icon.Dispose()
  }
}

$extension = [System.IO.Path]::GetExtension($sourcePath).ToLowerInvariant()
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class ShellIcon {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
    public string szTypeName;
  }

  [DllImport("Shell32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);

  [DllImport("User32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@

$attributes = 0x80
if (Test-Path -LiteralPath $sourcePath -PathType Container) {
  $attributes = 0x10
}

$info = New-Object ShellIcon+SHFILEINFO
$flags = 0x100 -bor 0x400
$readEmbeddedIcon = $extension -eq ".ico" -or $extension -eq ".exe" -or $extension -eq ".dll"
if (-not $readEmbeddedIcon) {
  $flags = $flags -bor 0x10
}
$result = [ShellIcon]::SHGetFileInfo($sourcePath, $attributes, [ref]$info, [System.Runtime.InteropServices.Marshal]::SizeOf($info), $flags)
if ($result -eq [IntPtr]::Zero -or $info.hIcon -eq [IntPtr]::Zero) {
  throw "SHGetFileInfo failed"
}

$icon = [System.Drawing.Icon]::FromHandle($info.hIcon)
try {
  Save-IconPng $icon $outputPath
} finally {
  [ShellIcon]::DestroyIcon($info.hIcon) | Out-Null
}
"#;

    let output = powershell_icon_command(script, source.as_os_str(), output)
        .output()
        .map_err(|error| format!("failed to extract shell icon: {error}"))?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "failed to extract shell icon".to_string()
        } else {
            message
        });
    }

    Ok(())
}

#[cfg(not(windows))]
fn extract_shell_icon(_source: &Path, _output: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn fetch_favicon(source_url: &str, output: &Path) -> Result<(), String> {
    fetch_favicon_with_policy(source_url, output, false)
}

#[cfg(windows)]
fn fetch_favicon_with_policy(
    source_url: &str,
    output: &Path,
    allow_private_networks: bool,
) -> Result<(), String> {
    let source = validate_favicon_url(source_url)?;
    let deadline = Instant::now() + FAVICON_TOTAL_TIMEOUT;
    let mut candidates = Vec::new();

    if let Ok((page_url, response)) = send_safe_get(&source, deadline, allow_private_networks) {
        if is_html_content_type(&response) {
            if let Ok(html) = read_limited(response, FAVICON_HTML_MAX_BYTES) {
                let html = String::from_utf8_lossy(&html);
                candidates.extend(extract_icon_urls(&page_url, &html));
            }
        }
    }

    let mut fallback = source.clone();
    fallback.set_path("/favicon.ico");
    fallback.set_query(None);
    fallback.set_fragment(None);
    candidates.push(fallback);

    let mut seen = std::collections::HashSet::new();
    let mut last_error = None;
    for candidate in candidates.into_iter().take(FAVICON_MAX_CANDIDATES) {
        if !seen.insert(candidate.as_str().to_string()) {
            continue;
        }
        let result = (|| {
            let (_, response) = send_safe_get(&candidate, deadline, allow_private_networks)?;
            if !is_image_content_type(&response) {
                return Err("favicon response is not an image".to_string());
            }
            let bytes = read_limited(response, FAVICON_IMAGE_MAX_BYTES)?;
            if bytes.len() < 4 {
                return Err("favicon response is empty".to_string());
            }
            decode_favicon_bytes(&bytes, output)
        })();

        match result {
            Ok(()) => return Ok(()),
            Err(error) => last_error = Some(error),
        }
    }

    Err(last_error.unwrap_or_else(|| "favicon not found".to_string()))
}

#[cfg(windows)]
fn validate_favicon_url(source_url: &str) -> Result<Url, String> {
    let mut url = Url::parse(source_url).map_err(|_| "favicon URL is invalid".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("favicon URL must use http or https".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("favicon URL must not include credentials".to_string());
    }
    if url.host_str().is_none() {
        return Err("favicon URL must include a host".to_string());
    }
    url.set_fragment(None);
    Ok(url)
}

#[cfg(windows)]
fn send_safe_get(
    source: &Url,
    deadline: Instant,
    allow_private_networks: bool,
) -> Result<(Url, Response), String> {
    let mut current = source.clone();
    for redirect_count in 0..=FAVICON_MAX_REDIRECTS {
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| "favicon request timed out".to_string())?;
        let request_timeout = remaining.min(FAVICON_REQUEST_TIMEOUT);
        let (host, endpoint) = resolve_favicon_endpoint(&current, allow_private_networks)?;
        let client = Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .connect_timeout(FAVICON_CONNECT_TIMEOUT)
            .resolve(&host, endpoint)
            .build()
            .map_err(|error| format!("failed to prepare favicon request: {error}"))?;
        let response = client
            .get(current.clone())
            .header(USER_AGENT, FAVICON_USER_AGENT)
            .timeout(request_timeout)
            .send()
            .map_err(|error| format!("favicon request failed: {error}"))?;

        if response.status().is_redirection() {
            if redirect_count == FAVICON_MAX_REDIRECTS {
                return Err("favicon redirect limit exceeded".to_string());
            }
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or_else(|| "favicon redirect has no location".to_string())?
                .to_str()
                .map_err(|_| "favicon redirect location is invalid".to_string())?;
            current = validate_favicon_url(
                current
                    .join(location)
                    .map_err(|_| "favicon redirect URL is invalid".to_string())?
                    .as_str(),
            )?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!("favicon request returned {}", response.status()));
        }
        return Ok((current, response));
    }

    Err("favicon redirect limit exceeded".to_string())
}

#[cfg(windows)]
fn resolve_favicon_endpoint(
    url: &Url,
    allow_private_networks: bool,
) -> Result<(String, SocketAddr), String> {
    let host = url
        .host_str()
        .ok_or_else(|| "favicon URL must include a host".to_string())?
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if !allow_private_networks
        && (host == "localhost"
            || host.ends_with(".localhost")
            || host.ends_with(".local")
            || host.ends_with(".localdomain"))
    {
        return Err("favicon URL points to a local host".to_string());
    }

    let port = url
        .port_or_known_default()
        .ok_or_else(|| "favicon URL has no usable port".to_string())?;
    let endpoints: Vec<_> = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|_| "failed to resolve favicon host".to_string())?
        .collect();
    if endpoints.is_empty() {
        return Err("favicon host resolved to no addresses".to_string());
    }
    if !allow_private_networks
        && endpoints
            .iter()
            .any(|endpoint| !is_public_ip(endpoint.ip()))
    {
        return Err("favicon host resolved to a private or local address".to_string());
    }

    Ok((host, endpoints[0]))
}

#[cfg(windows)]
fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => is_public_ipv6(ip),
    }
}

#[cfg(windows)]
fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_link_local()
        || ip.is_loopback()
        || ip.is_multicast()
        || ip.is_private()
        || ip.is_unspecified())
}

#[cfg(windows)]
fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_public_ipv4(mapped);
    }
    let segments = ip.segments();
    !(ip.is_loopback()
        || ip.is_multicast()
        || ip.is_unspecified()
        || (segments[0] & 0xfe00) == 0xfc00
        || (segments[0] & 0xffc0) == 0xfe80
        || (segments[0] & 0xffc0) == 0xfec0
        || (segments[0] == 0x2001 && segments[1] == 0x0db8))
}

#[cfg(windows)]
fn read_limited(mut response: Response, max_bytes: usize) -> Result<Vec<u8>, String> {
    if response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err("favicon response is too large".to_string());
    }

    let mut bytes = Vec::new();
    response
        .by_ref()
        .take(max_bytes as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("failed to read favicon response: {error}"))?;
    if bytes.len() > max_bytes {
        return Err("favicon response is too large".to_string());
    }
    Ok(bytes)
}

#[cfg(windows)]
fn response_content_type(response: &Response) -> Option<&str> {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or_default().trim())
}

#[cfg(windows)]
fn is_html_content_type(response: &Response) -> bool {
    matches!(
        response_content_type(response),
        Some("text/html" | "application/xhtml+xml")
    )
}

#[cfg(windows)]
fn is_image_content_type(response: &Response) -> bool {
    response_content_type(response).is_some_and(|content_type| {
        content_type.starts_with("image/")
            || matches!(
                content_type,
                "application/octet-stream" | "binary/octet-stream"
            )
    })
}

#[cfg(windows)]
fn extract_icon_urls(page_url: &Url, html: &str) -> Vec<Url> {
    let link_pattern = Regex::new(r"(?is)<link\b[^>]*>").expect("valid link regex");
    let attr_pattern =
        Regex::new(r#"(?is)([a-z_:][-a-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#)
            .expect("valid attribute regex");
    let mut urls = Vec::new();

    for link in link_pattern.find_iter(html) {
        let mut rel = None;
        let mut href = None;
        for captures in attr_pattern.captures_iter(link.as_str()) {
            let name = captures[1].to_ascii_lowercase();
            let value = captures
                .get(2)
                .or_else(|| captures.get(3))
                .or_else(|| captures.get(4))
                .map(|value| value.as_str())
                .unwrap_or_default();
            match name.as_str() {
                "rel" => rel = Some(value),
                "href" => href = Some(value),
                _ => {}
            }
        }
        let is_icon = rel.is_some_and(|value| {
            value
                .split_ascii_whitespace()
                .any(|token| token.eq_ignore_ascii_case("icon"))
        });
        if is_icon {
            if let Some(url) = href.and_then(|value| page_url.join(value).ok()) {
                if matches!(url.scheme(), "http" | "https") {
                    urls.push(url);
                }
            }
        }
        if urls.len() >= FAVICON_MAX_CANDIDATES - 1 {
            break;
        }
    }

    urls
}

#[cfg(windows)]
fn decode_favicon_bytes(bytes: &[u8], output: &Path) -> Result<(), String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = std::env::temp_dir().join(format!(
        "life-launcher-favicon-{}-{nonce}.download",
        std::process::id()
    ));
    fs::write(&temp, bytes).map_err(|error| format!("failed to stage favicon: {error}"))?;

    let result = decode_favicon_file(&temp, output);
    let _ = fs::remove_file(&temp);
    if result.is_err() {
        let _ = fs::remove_file(output);
    }
    result
}

#[cfg(windows)]
fn decode_favicon_file(source: &Path, output: &Path) -> Result<(), String> {
    let script = r#"
$sourcePath = $env:LIFE_LAUNCHER_ICON_SOURCE
$outputPath = $env:LIFE_LAUNCHER_ICON_OUTPUT
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$bytes = [System.IO.File]::ReadAllBytes($sourcePath)
if ($bytes.Length -lt 4) { throw "favicon response is empty" }

if ($bytes[0] -eq 0 -and $bytes[1] -eq 0 -and $bytes[2] -eq 1 -and $bytes[3] -eq 0) {
  $icon = New-Object System.Drawing.Icon($sourcePath)
  try {
    $bitmap = $icon.ToBitmap()
    try {
      if ($bitmap.Width -gt 1024 -or $bitmap.Height -gt 1024) { throw "favicon dimensions are too large" }
      $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $icon.Dispose()
  }
} else {
  $image = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    if ($image.Width -gt 1024 -or $image.Height -gt 1024) { throw "favicon dimensions are too large" }
    $image.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $image.Dispose()
  }
}
"#;

    let command_output = powershell_icon_command(script, source.as_os_str(), output)
        .output()
        .map_err(|error| format!("failed to decode favicon: {error}"))?;
    if command_output.status.success() {
        Ok(())
    } else {
        let message = String::from_utf8_lossy(&command_output.stderr)
            .trim()
            .to_string();
        Err(if message.is_empty() {
            "failed to decode favicon".to_string()
        } else {
            message
        })
    }
}
#[cfg(not(windows))]
fn fetch_favicon(_source_url: &str, _output: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    fn one_pixel_bmp() -> Vec<u8> {
        let mut bytes = vec![
            b'B', b'M', 58, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0, 40, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
            1, 0, 24, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        bytes.extend_from_slice(&[0, 0, 255, 0]);
        bytes
    }

    #[cfg(windows)]
    #[test]
    fn icon_source_is_passed_only_through_environment() {
        let source = OsStr::new(r"C:\Media\sample video.mp4");
        let output = Path::new(r"C:\Cache\button.png");
        let command = powershell_icon_command("Write-Output 'icon'", source, output);
        let args: Vec<_> = command.get_args().collect();

        assert!(!args.contains(&source));
        assert!(!args.contains(&output.as_os_str()));
        assert!(command
            .get_envs()
            .any(|(key, value)| key == ICON_SOURCE_ENV && value == Some(source)));
        assert!(command
            .get_envs()
            .any(|(key, value)| { key == ICON_OUTPUT_ENV && value == Some(output.as_os_str()) }));
    }

    #[cfg(windows)]
    #[test]
    fn extracts_executable_icon_as_png() {
        let source = std::env::current_exe().expect("current exe");
        let output = std::env::temp_dir().join(format!(
            "life-launcher-icon-test-{}.png",
            std::process::id()
        ));
        let _ = fs::remove_file(&output);

        extract_shell_icon(&source, &output).expect("extract executable icon");
        assert!(fs::metadata(&output).expect("icon metadata").len() > 0);

        fs::remove_file(output).expect("remove test icon");
    }

    #[cfg(windows)]
    #[test]
    fn fetches_declared_bitmap_favicon_as_png() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::thread;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind favicon test server");
        let address = listener.local_addr().expect("favicon test address");
        let server = thread::spawn(move || {
            for index in 0..2 {
                let (mut stream, _) = listener.accept().expect("accept favicon request");
                let mut request = [0_u8; 2048];
                let size = stream.read(&mut request).expect("read favicon request");
                let request = String::from_utf8_lossy(&request[..size]);
                let (content_type, body) = if index == 0 {
                    assert!(request.starts_with("GET / "));
                    (
                        "text/html; charset=utf-8",
                        br#"<html><head><link rel="icon" href="/icon.bmp"></head></html>"#.to_vec(),
                    )
                } else {
                    assert!(request.starts_with("GET /icon.bmp "));
                    ("image/bmp", one_pixel_bmp())
                };
                let headers = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                stream
                    .write_all(headers.as_bytes())
                    .and_then(|_| stream.write_all(&body))
                    .expect("write favicon response");
            }
        });
        let output = std::env::temp_dir().join(format!(
            "life-launcher-favicon-test-{}.png",
            std::process::id()
        ));
        let _ = fs::remove_file(&output);

        fetch_favicon_with_policy(&format!("http://{address}/"), &output, true)
            .expect("fetch favicon");
        server.join().expect("favicon test server");
        let png = fs::read(&output).expect("read favicon png");
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");

        fs::remove_file(output).expect("remove favicon test output");
    }
    #[cfg(windows)]
    #[test]
    fn blocks_private_local_and_special_ip_ranges() {
        for address in [
            "0.0.0.0",
            "10.0.0.1",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.1.1",
            "172.16.0.1",
            "192.168.0.1",
            "198.18.0.1",
            "224.0.0.1",
            "255.255.255.255",
            "::1",
            "fc00::1",
            "fe80::1",
            "2001:db8::1",
            "::ffff:127.0.0.1",
        ] {
            let ip: IpAddr = address.parse().expect("valid test IP");
            assert!(!is_public_ip(ip), "{address} must be blocked");
        }
        assert!(is_public_ip("8.8.8.8".parse().expect("valid IPv4")));
        assert!(is_public_ip(
            "2606:4700:4700::1111".parse().expect("valid IPv6")
        ));
    }

    #[cfg(windows)]
    #[test]
    fn rejects_non_http_credentials_and_local_hosts() {
        assert!(validate_favicon_url("file:///C:/Windows/win.ini").is_err());
        assert!(validate_favicon_url("https://user:secret@example.com/").is_err());
        let localhost = validate_favicon_url("http://localhost/favicon.ico").expect("valid URL");
        assert!(resolve_favicon_endpoint(&localhost, false).is_err());
        let loopback = validate_favicon_url("http://127.0.0.1/favicon.ico").expect("valid URL");
        assert!(resolve_favicon_endpoint(&loopback, false).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn extracts_only_http_icon_links_with_a_candidate_limit() {
        let page = Url::parse("https://example.com/path/page.html").expect("valid URL");
        let mut html = String::from(
            r#"<link rel="stylesheet" href="/style.css"><link rel="icon" href="javascript:alert(1)">"#,
        );
        for index in 0..20 {
            html.push_str(&format!(
                r#"<link href="/icon-{index}.png" rel="shortcut icon">"#
            ));
        }
        let urls = extract_icon_urls(&page, &html);
        assert_eq!(urls.len(), FAVICON_MAX_CANDIDATES - 1);
        assert_eq!(urls[0].as_str(), "https://example.com/icon-0.png");
        assert!(urls
            .iter()
            .all(|url| matches!(url.scheme(), "http" | "https")));
    }

    #[cfg(windows)]
    #[test]
    fn rejects_response_declaring_an_oversized_body() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::thread;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind favicon test server");
        let address = listener.local_addr().expect("favicon test address");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept favicon request");
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).expect("read favicon request");
            let headers = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                FAVICON_IMAGE_MAX_BYTES + 1
            );
            stream
                .write_all(headers.as_bytes())
                .expect("write oversized response");
        });

        let url = validate_favicon_url(&format!("http://{address}/icon.png")).expect("valid URL");
        let (_, response) = send_safe_get(&url, Instant::now() + Duration::from_secs(5), true)
            .expect("receive response headers");
        let error = read_limited(response, FAVICON_IMAGE_MAX_BYTES).expect_err("reject body");
        assert!(error.contains("too large"));
        server.join().expect("favicon test server");
    }

    #[cfg(windows)]
    #[test]
    fn enforces_the_redirect_limit() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::thread;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind favicon test server");
        let address = listener.local_addr().expect("favicon test address");
        let server = thread::spawn(move || {
            for index in 0..=FAVICON_MAX_REDIRECTS {
                let (mut stream, _) = listener.accept().expect("accept redirect request");
                let mut request = [0_u8; 2048];
                let _ = stream.read(&mut request).expect("read redirect request");
                let response = format!(
                    "HTTP/1.1 302 Found\r\nLocation: /redirect-{}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    index + 1
                );
                stream
                    .write_all(response.as_bytes())
                    .expect("write redirect response");
            }
        });

        let url = validate_favicon_url(&format!("http://{address}/")).expect("valid URL");
        let error = send_safe_get(&url, Instant::now() + Duration::from_secs(10), true)
            .expect_err("reject redirect chain");
        assert!(error.contains("redirect limit"));
        server.join().expect("favicon test server");
    }

    #[test]
    fn safe_icon_file_stem_replaces_path_unsafe_chars() {
        assert_eq!(safe_icon_file_stem("abc-DEF_123"), "abc-DEF_123");
        assert_eq!(safe_icon_file_stem("HK/unsafe:name"), "HK_unsafe_name");
        assert_eq!(safe_icon_file_stem("///"), "button");
    }

    #[test]
    fn icon_source_path_uses_first_local_action() {
        let button = LauncherButton {
            id: "button".to_string(),
            label: "Button".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![
                Action::OpenUrl {
                    url: "https://example.com".to_string(),
                },
                Action::OpenFolder {
                    path: "C:/Work".to_string(),
                },
            ],
        };

        assert_eq!(icon_source_path(&button), Some("C:/Work".to_string()));
    }

    #[test]
    fn icon_source_path_prefers_explicit_source() {
        let button = LauncherButton {
            id: "button".to_string(),
            label: "Button".to_string(),
            icon: None,
            icon_source: Some("C:/Users/Me/Desktop/App.lnk".to_string()),
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![Action::OpenApp {
                path: "C:/Program Files/App/app.exe".to_string(),
                args: Vec::new(),
            }],
        };

        assert_eq!(
            icon_source_path(&button),
            Some("C:/Users/Me/Desktop/App.lnk".to_string())
        );
    }

    #[test]
    fn icon_source_path_uses_open_file_for_shell_icon() {
        let button = LauncherButton {
            id: "button".to_string(),
            label: "Button".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![Action::OpenFile {
                path: "C:/Work/sample.mid".to_string(),
            }],
        };

        assert_eq!(
            icon_source_path(&button),
            Some("C:/Work/sample.mid".to_string())
        );
    }

    #[test]
    fn icon_source_path_uses_explicit_file_source() {
        let button = LauncherButton {
            id: "button".to_string(),
            label: "Button".to_string(),
            icon: None,
            icon_source: Some("C:/Work/sample.mp4".to_string()),
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![Action::OpenFile {
                path: "C:/Work/sample.mp4".to_string(),
            }],
        };

        assert_eq!(
            icon_source_path(&button),
            Some("C:/Work/sample.mp4".to_string())
        );
    }

    #[test]
    fn favicon_source_url_uses_first_http_url() {
        let button = LauncherButton {
            id: "button".to_string(),
            label: "Button".to_string(),
            icon: None,
            icon_source: None,
            group: None,
            show_in_sidebar: true,
            show_in_overlay: true,
            overlay_page_id: None,
            aliases: Vec::new(),
            description: None,
            actions: vec![
                Action::OpenUrl {
                    url: "mailto:test@example.com".to_string(),
                },
                Action::OpenUrl {
                    url: "https://example.com/page".to_string(),
                },
            ],
        };

        assert_eq!(
            favicon_source_url(&button),
            Some("https://example.com/page".to_string())
        );
    }
}
