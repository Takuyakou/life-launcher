param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReleaseRoot = Join-Path $RepoRoot "release"
$PackageDir = Join-Path $ReleaseRoot "LifeLauncher-v1.0.0"
$ZipPath = Join-Path $ReleaseRoot "LifeLauncher-v1.0.0-windows.zip"
$ExeSource = Join-Path $RepoRoot "src-tauri\target\release\life-launcher.exe"
$ExeTarget = Join-Path $PackageDir "Life Launcher.exe"

function Assert-PathInsideRepo([string]$Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $repo = [System.IO.Path]::GetFullPath($RepoRoot)
  if (-not $fullPath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch path outside repo: $fullPath"
  }
}

Assert-PathInsideRepo $ReleaseRoot
Assert-PathInsideRepo $PackageDir
Assert-PathInsideRepo $ZipPath

Set-Location $RepoRoot

$CargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path (Join-Path $CargoBin "cargo.exe")) {
  $env:Path = "$CargoBin;$env:Path"
}

if (-not $SkipBuild) {
  npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri portable build failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $ExeSource)) {
  throw "Built exe not found: $ExeSource"
}

New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
if (Test-Path $PackageDir) {
  Assert-PathInsideRepo $PackageDir
  Remove-Item -LiteralPath $PackageDir -Recurse -Force
}
if (Test-Path $ZipPath) {
  Assert-PathInsideRepo $ZipPath
  Remove-Item -LiteralPath $ZipPath -Force
}

New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null
Copy-Item -LiteralPath $ExeSource -Destination $ExeTarget -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "README.md") -Destination (Join-Path $PackageDir "README.md") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "START-HERE.txt") -Destination (Join-Path $PackageDir "START-HERE.txt") -Force

Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath -Force

Write-Host "Created package:"
Write-Host $ZipPath
Write-Host ""
Write-Host "Zip contents are ready to run after extraction:"
Write-Host $ExeTarget
