param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Package = Get-Content -Raw (Join-Path $RepoRoot "package.json") | ConvertFrom-Json
$Version = $Package.version
$CandidateRoot = Join-Path $RepoRoot "release-candidate\v$Version"
$InstallerName = "Life-Launcher-v$Version-windows-x64-setup.exe"
$StandaloneName = "Life-Launcher-v$Version-windows-x64.exe"
$PortableName = "Life-Launcher-v$Version-windows-x64-portable.zip"
$ChecksumName = "SHA256SUMS.txt"
$ReleaseNotesSource = Join-Path $RepoRoot "docs\releases\v$Version.md"

function Assert-PathInsideRepo([string]$Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $repo = [System.IO.Path]::GetFullPath($RepoRoot)
  if (-not $fullPath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch path outside repo: $fullPath"
  }
}

function Get-Sha256Hex([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "")
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

Assert-PathInsideRepo $CandidateRoot
Set-Location $RepoRoot

if (Test-Path $CandidateRoot) {
  Remove-Item -LiteralPath $CandidateRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $CandidateRoot | Out-Null

if ($SkipBuild) {
  & (Join-Path $PSScriptRoot "package-windows-installer.ps1") -SkipBuild -CandidateRoot $CandidateRoot
} else {
  & (Join-Path $PSScriptRoot "package-windows-installer.ps1") -CandidateRoot $CandidateRoot
}
if (-not $?) {
  throw "Installer packaging failed"
}

& (Join-Path $PSScriptRoot "package-windows.ps1") -SkipBuild -CandidateRoot $CandidateRoot
if (-not $?) {
  throw "Standalone packaging failed"
}

if (-not (Test-Path $ReleaseNotesSource)) {
  throw "Release notes not found: $ReleaseNotesSource"
}
Copy-Item -LiteralPath $ReleaseNotesSource -Destination (Join-Path $CandidateRoot "release-notes.md") -Force

$ArtifactNames = @($InstallerName, $StandaloneName, $PortableName)
foreach ($name in $ArtifactNames) {
  $path = Join-Path $CandidateRoot $name
  if (-not (Test-Path $path)) {
    throw "Release artifact not found: $path"
  }
}

$ChecksumLines = foreach ($name in $ArtifactNames) {
  $hash = Get-Sha256Hex (Join-Path $CandidateRoot $name)
  "$hash  $name"
}
Set-Content -LiteralPath (Join-Path $CandidateRoot $ChecksumName) -Value $ChecksumLines -Encoding ASCII

Write-Host "Release candidate prepared:"
Write-Host $CandidateRoot
Get-ChildItem -LiteralPath $CandidateRoot -File | Sort-Object Name | ForEach-Object {
  Write-Host ("{0} ({1} bytes)" -f $_.Name, $_.Length)
}
