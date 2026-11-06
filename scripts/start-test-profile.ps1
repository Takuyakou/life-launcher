# テスト用の起動（普段のデータから切り離した起動）を始めるスクリプト。
#
#   powershell -ExecutionPolicy Bypass -File scripts/start-test-profile.ps1 -Exe <EXE のパス> [-Profile <フォルダ>] [-CopyCurrentData]
#
# -Profile を省くと release-candidate/native-check/profiles/<日時> を使う（.gitignore 済み）。
# 環境変数 LIFE_LAUNCHER_TEST_PROFILE は、起動する EXE のプロセスにだけ渡す
# （ユーザーやシステムの環境変数には書かない）。
param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [string]$Profile,
  [switch]$CopyCurrentData
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Identifier = "com.takuyakou.lifelauncher"
$DataDirName = "life-launcher"
$DataFiles = @("config.json", "notes.json", "sessions.jsonl", "config.schema.json")

function Resolve-FullPath([string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path)
  if (Test-Path -LiteralPath $full) {
    return (Resolve-Path -LiteralPath $full).Path
  }
  # まだ無いフォルダは、いちばん近い存在する親を解決してから残りを足す。
  $rest = @()
  $current = $full
  while ($current -and -not (Test-Path -LiteralPath $current)) {
    $rest = @([System.IO.Path]::GetFileName($current)) + $rest
    $parent = [System.IO.Path]::GetDirectoryName($current)
    if ($parent -eq $current) { break }
    $current = $parent
  }
  $resolved = if ($current -and (Test-Path -LiteralPath $current)) { (Resolve-Path -LiteralPath $current).Path } else { $full }
  foreach ($name in $rest) { $resolved = Join-Path $resolved $name }
  return $resolved
}

function Test-Within([string]$Child, [string]$Parent) {
  $childPath = (Resolve-FullPath $Child).TrimEnd("\")
  $parentPath = (Resolve-FullPath $Parent).TrimEnd("\")
  if ($parentPath -eq "") { return $false }
  $childPath = $childPath.ToLowerInvariant()
  $parentPath = $parentPath.ToLowerInvariant()
  return ($childPath -eq $parentPath) -or $childPath.StartsWith($parentPath + "\")
}

if (-not (Test-Path -LiteralPath $Exe)) {
  throw "EXE が見つかりません: $Exe"
}
$Exe = (Resolve-Path -LiteralPath $Exe).Path

if (-not $Profile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $Profile = Join-Path $RepoRoot "release-candidate\native-check\profiles\$stamp"
}

# テスト用のフォルダの検証（Rust 側と同じ判定）。
$rawProfile = $Profile.Trim()
if ($rawProfile -eq "") { throw "テスト用のフォルダが空です" }
if (-not [System.IO.Path]::IsPathRooted($rawProfile)) { throw "テスト用のフォルダは絶対パスで指定してください: $rawProfile" }
if ($rawProfile -match '(^|[\\/])\.\.([\\/]|$)') { throw "テスト用のフォルダに .. は使えません: $rawProfile" }

$profilePath = Resolve-FullPath $rawProfile
$roaming = [System.Environment]::GetFolderPath("ApplicationData")
$local = [System.Environment]::GetFolderPath("LocalApplicationData")
$userProfile = [System.Environment]::GetFolderPath("UserProfile")
$protected = @(
  (Join-Path $roaming $DataDirName),
  (Join-Path $roaming $Identifier),
  (Join-Path $local $Identifier),
  $roaming,
  $local,
  $userProfile
)
foreach ($guard in $protected) {
  if (-not $guard) { continue }
  if (Test-Within $profilePath $guard) { throw "テスト用のフォルダが普段の保存先の中にあります: $profilePath (普段の保存先: $guard)" }
  if (Test-Within $guard $profilePath) { throw "テスト用のフォルダが普段の保存先を含んでいます: $profilePath (普段の保存先: $guard)" }
}
if ([System.IO.Path]::GetPathRoot($profilePath).TrimEnd("\") -eq $profilePath.TrimEnd("\")) {
  throw "ドライブのルートはテスト用のフォルダに使えません: $profilePath"
}

$dataDir = Join-Path $profilePath $DataDirName
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$probe = Join-Path $profilePath ".life-launcher-write-probe"
try {
  Set-Content -LiteralPath $probe -Value "probe" -Encoding ASCII
} catch {
  throw "テスト用のフォルダに書けません: $profilePath : $($_.Exception.Message)"
} finally {
  Remove-Item -LiteralPath $probe -ErrorAction SilentlyContinue
}

if ($CopyCurrentData) {
  $source = Join-Path $roaming $DataDirName
  foreach ($name in $DataFiles) {
    $from = Join-Path $source $name
    if (Test-Path -LiteralPath $from) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $dataDir $name) -Force
    }
  }
  Write-Host "普段のデータをコピーしました（元のファイルは変更していません）: $source"
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $Exe
$startInfo.UseShellExecute = $false
$startInfo.EnvironmentVariables["LIFE_LAUNCHER_TEST_PROFILE"] = $profilePath
$process = [System.Diagnostics.Process]::Start($startInfo)

Write-Host "テスト用の起動を始めました"
Write-Host "  プロファイル: $profilePath"
Write-Host "  データ: $dataDir"
Write-Host "  EXE: $Exe"
Write-Host "  プロセス ID: $($process.Id)"
Write-Host ""
Write-Host "終了するときは、タスクトレイのアイコンを右クリックして「終了」を選びます。"
