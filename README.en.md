# Life Launcher

[日本語](README.md) | **English**

**A Windows app that turns “What should I do?” into “I will do this now.”**

Life Launcher is a local-first Windows desktop app that presents one next step, opens the environment needed for it, and helps you move from deciding to starting.

[Download Life Launcher for Windows](https://github.com/Takuyakou/life-launcher/releases/latest)

![Life Launcher main dashboard](docs/screenshots/main-dashboard.png)

## Web Demo

Try the central Life Launcher flow in your browser without installing the Windows app.

[Open the Web Demo](https://life-launcher-web.takuyakou.workers.dev)

<img src="docs/screenshots/web-demo.png" alt="Life Launcher Web Demo" width="720">

The Web Demo uses synthetic data to demonstrate the central v1.1 flow, including choosing today's items, running timers, and removing an item from Today's Three. Changes are stored in your browser's localStorage. Launching apps, files, and URLs is simulated rather than performed.

Note: it is not a complete port of the Windows product.

## Highlights

- **Do Now**
  Presents one next step from this week's focus using fixed, explainable rules.

- **Daily Victory / Today's Three**
  Define one condition for a successful day and limit today's work to at most three items. Start from project-colored cards; an item is completed after its planned timer expires and you confirm the session. Once all three are complete, choose the next three yourself.

- **Choose today's work / Wishlist**
  Open the Picker from an empty Today's Three slot, then use “+ Add to Today” for Next Steps and Wishlist items. The third item confirms automatically, while Cancel restores the opening selection. Adoption preserves the source and snapshots its text, instruction, launch environment, and timer durations. A drag-only removal Drop Zone or the item menu removes only the Today adoption.

- **Remove from Today's Three**
  Use the card's lower-left button or context menu to remove only its adoption into today, without a confirmation dialog. The original source, candidate, and session records remain. Removal is blocked while that item's timer is running, paused, or awaiting expiry confirmation.

- **Quick Launcher / Dictionary**
  Register apps, folders, files, and URLs, then open them from the sidebar or `Ctrl+K` search. Navigate the dictionary with arrow keys; on multiple monitors, it opens on the same screen as the main app.

- **Timer / Session Records**
  Start a short or normal timer, or use Measure to count up from 0:00, and store sessions of at least one minute locally. Stopping early does not automatically complete today's item. Session completion is also separate from completing or deleting the source entry itself.

- **Instruction Viewer**
  Read Markdown, text, and sanitized HTML files from registered folders in a separate window.

## Screenshots

### Dictionary / Instruction Viewer

| Dictionary                                                | Instruction Viewer                                             |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| ![Searchable dictionary](docs/screenshots/dictionary.png) | ![Instruction Viewer](docs/screenshots/instruction-viewer.png) |

The screenshots are generated from synthetic data. They do not contain real user configuration, activity, paths, or notes.

## Download

Download Life Launcher from [GitHub Releases](https://github.com/Takuyakou/life-launcher/releases/latest). The current stable release is **v1.3.1**.

### Installer - Recommended

Use this for the standard installation flow.

`Life-Launcher-v1.3.1-windows-x64-setup.exe`

### Standalone EXE

Run the app directly without installing it.

`Life-Launcher-v1.3.1-windows-x64.exe`

### Portable ZIP

Extract the ZIP archive and run the app.

`Life-Launcher-v1.3.1-windows-x64-portable.zip`

The ZIP edition also stores user data in `%APPDATA%\life-launcher`. It does not carry your data alongside the executable on a USB drive.

> The current Windows binaries are not code-signed, so Windows SmartScreen may display a warning. Microsoft Edge WebView2 Runtime is required.

You can verify the release files with the included `SHA256SUMS.txt`.

## Updating

Fully exit Life Launcher and back up the `%APPDATA%\life-launcher` folder to another location before updating. There is no automatic updater.

The first launch after updating from v1.2 to v1.3 migrates config schema `2` to `3`. The app creates a raw pre-migration backup and leaves the original config unchanged if migration, validation, or backup fails. Session records are not deleted.

See the [v1.3.1 release notes](docs/releases/v1.3.1.md) and [changelog](CHANGELOG.md) for details. The [overview](docs/OVERVIEW.md) and [current specification](docs/spec/current-spec.md) cover the wider feature set. These detailed documents are currently in Japanese.

## Runtime Requirements

- Windows 10 or later (x64)
- Microsoft Edge WebView2 Runtime

## Development

### Requirements

- Node.js 24
- Rust stable with the MSVC toolchain

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run build
npm.cmd run test:visual
cargo check --manifest-path src-tauri/Cargo.toml
```

Run the Tauri development app:

```powershell
npm.cmd run tauri -- dev
```

Build local Windows packages:

```powershell
npm.cmd run package:windows
```

Public quality checks cover React / TypeScript lint and build, Playwright Visual QA, Rust check / test / clippy, and the public safety scan.

## Tech Stack

- Tauri 2 / Rust
- React 18 / TypeScript
- Vite 8
- Playwright for deterministic Visual QA
- Zod for frontend data validation

## Security

The public source includes bounded favicon retrieval, local and private destination rejection, redirect revalidation, response validation, and window-specific Tauri capabilities. Automated Rust tests cover the network and permission contracts.

## Local Data And Network Use

Life Launcher does not require an account or a Life Launcher server. Configuration, sessions, notes, backups, and icon cache data are stored locally under `%APPDATA%\life-launcher` or in a backup folder selected by the user.

The app has no telemetry, analytics, crash-reporting service, cloud synchronization, or automatic updater. When you register a URL, Life Launcher may fetch its favicon directly from the target origin. The fetch path rejects obvious local and private destinations and applies redirect, timeout, and response-size limits. Opening a registered URL launches your browser, whose network behavior is outside Life Launcher.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for details.

## Public Source

This repository starts at Life Launcher v1.0.0 with a clean public history. It does not include the original private development history or real user data. Specifications and verification records created for public development are maintained here; release binaries are hosted on GitHub Releases.

## License

No open-source license is granted. The source is visible for inspection, but use, modification, and redistribution are not permitted without the copyright holder's explicit permission. All rights reserved.
