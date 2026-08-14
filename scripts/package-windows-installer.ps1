param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BundleDir = Join-Path $RepoRoot "src-tauri\target\release\bundle\nsis"
$ReleaseRoot = Join-Path $RepoRoot "release"
$PackageDir = Join-Path $ReleaseRoot "LifeLauncher-v1.0.0"
$InstallerTarget = Join-Path $PackageDir "Life Launcher_1.0.0_x64-setup.exe"

Set-Location $RepoRoot

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

New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null
Copy-Item -LiteralPath $Installers[0].FullName -Destination $InstallerTarget -Force
Write-Host "Copied installer to:"
Write-Host $InstallerTarget
