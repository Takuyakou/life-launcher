# Life Launcher

[日本語](README.md) | **English**

Life Launcher is a local-first Windows desktop launcher for turning a chosen next step into action. It combines a small Quick sidebar, a searchable command dictionary, daily focus, timers, session records, and a read-only instruction viewer.

![Life Launcher main dashboard](docs/screenshots/main-dashboard.png)

## Highlights

- Keep frequently used apps, folders, files, and links in the Quick sidebar.
- Search the larger dictionary with `Ctrl+K`.
- Choose a daily victory condition, up to three daily items, and one recommended next step.
- Start short or normal timers through the same session-recording path.
- Review local session history and project totals.
- Read Markdown, text, and sanitized HTML instructions from folders you select.

## Screenshots

| Dictionary | Instruction viewer |
| --- | --- |
| ![Searchable dictionary](docs/screenshots/dictionary.png) | ![Instruction viewer](docs/screenshots/instruction-viewer.png) |

The screenshots are generated deterministically from synthetic data. They do not contain real user configuration, activity, paths, or notes.

## Download

### Installer - Recommended

Use this for the normal installation flow: `Life-Launcher-v1.0.0-windows-x64-setup.exe`

### Standalone EXE

Run directly without installing: `Life-Launcher-v1.0.0-windows-x64.exe`

### Portable ZIP

Extract and run the portable package: `Life-Launcher-v1.0.0-windows-x64-portable.zip`

After the release is published, downloads will be available from [GitHub Releases](https://github.com/Takuyakou/life-launcher/releases). Verify release files with `SHA256SUMS.txt`.

The release binaries target Windows x64 and require Microsoft Edge WebView2 Runtime.

## Requirements

- Windows 10 or later
- Node.js 24
- Rust stable with the MSVC toolchain
- Microsoft Edge WebView2 Runtime

## Development

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run build
npm.cmd run test:visual
cargo check --manifest-path src-tauri/Cargo.toml
```

Run the Tauri development application:

```powershell
npm.cmd run tauri -- dev
```

Build a local Windows package:

```powershell
npm.cmd run package:windows
```

## Tech Stack

- Tauri 2 and Rust
- React 18 and TypeScript
- Vite 8
- Playwright for deterministic visual checks
- Zod for frontend data validation

## Security

The public source includes bounded favicon retrieval, local/private destination rejection, redirect revalidation, response validation, and window-specific Tauri capabilities. Automated Rust tests cover the network and permission contracts. These controls reduce known risks but are not a guarantee of security.

## Local Data And Network Use

Life Launcher does not require an account or a Life Launcher server. Configuration, sessions, notes, backups, and icon cache data are stored locally under `%APPDATA%\life-launcher` or in a backup folder selected by the user.

The application has no telemetry, analytics, crash-reporting service, cloud synchronization, or automatic updater. When a URL is registered, Life Launcher may fetch that site's favicon directly from the target origin. The fetch path rejects obvious local/private destinations and applies redirect, timeout, and response-size limits. Opening a registered URL launches the user's browser, whose network behavior is outside Life Launcher.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for details.

## Public Source

This repository starts at Life Launcher v1.0.0 with a clean public history. It intentionally excludes private development history, internal plans and reports, real runtime data, private screenshots, build outputs, and release binaries.

## License

No open-source license is granted. The source is visible for inspection, but use, modification, and redistribution are not permitted without the copyright holder's explicit permission. All rights reserved.