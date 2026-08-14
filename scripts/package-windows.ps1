param(
  [switch]$SkipBuild,
  [string]$CandidateRoot
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Package = Get-Content -Raw (Join-Path $RepoRoot "package.json") | ConvertFrom-Json
$Version = $Package.version
if (-not $CandidateRoot) {
  $CandidateRoot = Join-Path $RepoRoot "release-candidate\v$Version"
}
$CandidateRoot = [System.IO.Path]::GetFullPath($CandidateRoot)
$ExeSource = Join-Path $RepoRoot "src-tauri\target\release\life-launcher.exe"
$ExeTarget = Join-Path $CandidateRoot "Life-Launcher-v$Version-windows-x64.exe"
$ZipPath = Join-Path $CandidateRoot "Life-Launcher-v$Version-windows-x64-portable.zip"
$PortableStage = Join-Path $CandidateRoot ".portable-stage"

function Assert-PathInsideRepo([string]$Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $repo = [System.IO.Path]::GetFullPath($RepoRoot)
  if (-not $fullPath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch path outside repo: $fullPath"
  }
}

Assert-PathInsideRepo $CandidateRoot
Assert-PathInsideRepo $ExeTarget
Assert-PathInsideRepo $ZipPath
Assert-PathInsideRepo $PortableStage

Set-Location $RepoRoot

$ReleaseRustFlags = @(
  "--remap-path-prefix=$env:USERPROFILE=<USERPROFILE>",
  "--remap-path-prefix=$RepoRoot=<SOURCE_ROOT>"
) -join " "
$env:RUSTFLAGS = (@($env:RUSTFLAGS, $ReleaseRustFlags) |
  Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join " "

$CargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path (Join-Path $CargoBin "cargo.exe")) {
  $env:Path = "$CargoBin;$env:Path"
}

if (-not $SkipBuild) {
  npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri standalone build failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $ExeSource)) {
  throw "Built exe not found: $ExeSource"
}

New-Item -ItemType Directory -Force -Path $CandidateRoot | Out-Null
if (Test-Path $ExeTarget) {
  Remove-Item -LiteralPath $ExeTarget -Force
}
if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
if (Test-Path $PortableStage) {
  Remove-Item -LiteralPath $PortableStage -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $PortableStage | Out-Null
Copy-Item -LiteralPath $ExeSource -Destination $ExeTarget -Force
Copy-Item -LiteralPath $ExeTarget -Destination (Join-Path $PortableStage (Split-Path $ExeTarget -Leaf)) -Force

$PortableReadme = @"
Life Launcher v$Version - Portable ZIP

1. Extract this ZIP to a folder.
2. Run Life-Launcher-v$Version-windows-x64.exe.

Microsoft Edge WebView2 Runtime is required. User data is stored outside this folder
under %APPDATA%\life-launcher. This package does not contain user data.
"@
Set-Content -LiteralPath (Join-Path $PortableStage "README.txt") -Value $PortableReadme -Encoding UTF8
Compress-Archive -Path (Join-Path $PortableStage "*") -DestinationPath $ZipPath -Force
Remove-Item -LiteralPath $PortableStage -Recurse -Force

Write-Host "Created standalone executable:"
Write-Host $ExeTarget
Write-Host "Created portable ZIP:"
Write-Host $ZipPath
