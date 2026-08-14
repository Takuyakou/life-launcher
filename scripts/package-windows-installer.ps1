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
$BundleDir = Join-Path $RepoRoot "src-tauri\target\release\bundle\nsis"
$InstallerTarget = Join-Path $CandidateRoot "Life-Launcher-v$Version-windows-x64-setup.exe"

function Assert-PathInsideRepo([string]$Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $repo = [System.IO.Path]::GetFullPath($RepoRoot)
  if (-not $fullPath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch path outside repo: $fullPath"
  }
}

Assert-PathInsideRepo $CandidateRoot
Assert-PathInsideRepo $InstallerTarget

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
  npm.cmd run tauri -- build --bundles nsis
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri NSIS build failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $BundleDir)) {
  throw "NSIS bundle directory not found: $BundleDir"
}

$Installers = Get-ChildItem -LiteralPath $BundleDir -Filter "*.exe" -File |
  Sort-Object LastWriteTime -Descending

if ($Installers.Count -eq 0) {
  throw "NSIS installer not found in: $BundleDir"
}

Write-Host "Created installer:"
Write-Host $Installers[0].FullName

New-Item -ItemType Directory -Force -Path $CandidateRoot | Out-Null
Copy-Item -LiteralPath $Installers[0].FullName -Destination $InstallerTarget -Force
Write-Host "Copied installer to:"
Write-Host $InstallerTarget
