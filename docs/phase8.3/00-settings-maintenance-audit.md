# P83-00 Settings / Maintenance Audit

## Baseline

- Audited branch: `docs/p83-00-current-audit`
- Audited commit: `f2c0dd5c1475e16864beefe7bb0efae0a85cdf72`
- `HEAD` and `origin/main` matched after `git fetch origin --prune`.
- Source priority used: current code, automated tests, current spec/help guide, then Phase 8.3 instructions.
- This document records the current implementation only. No reset command or product-code change is part of P83-00.

## Settings component hierarchy

Settings is implemented inside `DashboardApp` rather than as a separate component.

| Layer | Current implementation | Audit finding |
| --- | --- | --- |
| Open | `openSettingsCenter` in `src/App.tsx:3330` | Copies config values and weekly-focus project IDs into one `SettingsCenterDraft`; always opens the `basic` tab. |
| Dialog | Settings JSX in `src/App.tsx:11378` | One modal with title row, five tabs, one scrollable section at a time, and one shared footer. |
| Tabs | `basic`, `shortcuts`, `instructions`, `backup`, `maintenance` in `src/App.tsx:11409` | Switching tabs only changes `settingsSection`; all draft values survive tab changes. There is no per-tab save. |
| Dirty state | `settingsHaveUnsavedChanges` in `src/App.tsx:3359` | Compares every draft field, instruction-folder order, and weekly-focus order against current config. |
| Close | `requestCloseSettings` in `src/App.tsx:3385` | Dirty close uses the shared `ConfirmDialog`; clean close drops the draft immediately. Escape and backdrop use the same route. |
| Save | `saveSettingsCenter` in `src/App.tsx:3859` | Validates shortcuts, applies autostart, persists config, reapplies dashboard settings, and attempts config rollback if reapply fails. |
| Footer | `src/App.tsx:11877`, `.dialogActions` in `src/styles.css:6882` | Current order is **Cancel left / Save right**, two equal columns. P83-01 must reverse semantic placement to **Save left / Cancel right** without changing unrelated dialogs. |

The dialog shell is fixed at `min(760px, 100%)`, up to `88vh`, with a fixed header/tabs/footer and scrollable active section (`src/styles.css:6224-6274`). This is a good shell to preserve.

## Draft, save, and side-effect risks

1. `persistConfig` optimistically replaces `configRef` and React state, calls Rust `save_config`, rolls React state back on failure, then calls `reapplyDashboardSettings` (`src/App.tsx:2877`).
2. `saveSettingsCenter` changes the OS autostart registration **before** config persistence (`src/App.tsx:3881`). If config save fails, the catch path does not explicitly restore the prior OS autostart state. P83-01 should avoid broad refactoring, but P83-02 must not assume config rollback alone restores OS-owned registration.
3. Shortcut capture temporarily unregisters shortcuts; closing Settings calls `finishShortcutRecording`. This state is in `AppState.registered_shortcuts`, not on disk (`src-tauri/src/state.rs:16`).
4. The settings draft itself is in memory and must be discarded before software reset. It must never be saved after reset starts.

## Current Maintenance inventory

The current Maintenance tab is a single wrapping `.settingsButtonRow` (`src/App.tsx:11815`). It mixes immediate actions and confirmed maintenance actions.

| Current control | Handler / backend | Confirmation | Result feedback | Persistent effect |
| --- | --- | --- | --- | --- |
| 今日の活動ログをコピー | `copyTodayActivityLog`, `src/App.tsx:3242` | None | Success/error Toast | Clipboard only; reads sessions. |
| configフォルダを開く | `openRuntimeDataFolder` -> `open_data_folder`, `src/App.tsx:3232`, `src-tauri/src/commands/config.rs:431` | None | Success/error Toast | Creates `%APPDATA%\life-launcher` if absent, then opens it. |
| バックアップフォルダを開く | `openBackupFolder` -> `open_config_backups`, `src/App.tsx:3201`, `src-tauri/src/commands/config.rs:419` | None | Success/error Toast | Creates `%APPDATA%\life-launcher\backups` if absent, then opens it. This is the internal config/pre-edit backup location, not the configured daily-ZIP destination. |
| アイコンキャッシュ再生成 | `requestIconCacheRegeneration`, `src/App.tsx:3182` | Warning confirm | Success/warn/error Toast | Deletes/recreates applicable `icons/*.png` through existing icon handlers. |
| ミニウィンドウ位置をリセット | `requestMiniWindowPositionReset`, `src/App.tsx:3171` | Warning confirm | Success/error Toast | Clears `settings.miniWindowPosition` and `life-launcher-mini-position`, then repositions an open mini window. |
| 手順書ウィンドウ位置をリセット | `requestInstructionWindowPositionReset`, `src/App.tsx:3829` | Warning confirm | Success/error Toast | Repositions the window and explicitly saves window-state. |
| 手順書一覧を再読み込み | `reloadInstructionList`, `src/App.tsx:3824` | None | Success Toast | Emits an in-process reload event only. |

P83-01 grouping should map these controls exactly as follows:

- **データ・フォルダ**: activity copy, config folder, backup folder.
- **表示・キャッシュ**: icon regeneration, mini position reset, instruction position reset.
- **手順書**: instruction list reload.
- **初期化**: a new isolated destructive section at the bottom; no reset implementation in P83-01.

## Toast and confirmation contracts

- Toast ownership is in `DashboardApp`; success/warn/error messages are stacked and timed (`src/App.tsx:2446`). Existing maintenance actions already use this route.
- `ConfirmDialog` defaults focus to Cancel, traps Tab, blocks Escape while processing, keeps the dialog open when `onConfirm` returns `false`, and renders thrown errors inline (`src/components/ConfirmDialog.tsx:20-207`).
- Backdrop dismissal defaults to false. This is suitable for both reset confirmation stages.
- Existing danger/warning dialogs must not be mechanically recolored by P83-01/P83-03. Software reset needs its own two-stage copy and destructive tone.

## Backup audit

### Automatic backup

- `load_config_from_disk` calls private `daily_backup` after a successful initial or existing config load (`src-tauri/src/commands/config.rs:545`, `946`).
- It runs only when `settings.backupFolder` is configured.
- The archive name is `lifelauncher-backup-YYYYMMDD.zip`, using the configured day boundary.
- If today's archive already exists, it is not rewritten. Therefore calling this function cannot guarantee a fresh pre-reset snapshot.
- Failures are returned as `backupError`; `refreshConfig` surfaces each distinct failure as a warning Toast (`src/App.tsx:2745`). The config load itself remains usable.

### Archive contents and destination

`RUNTIME_BACKUP_FILES` in `src-tauri/src/commands/config.rs:46` contains exactly:

1. `config.json`
2. `sessions.jsonl`
3. `notes.json`
4. `config.schema.json`

The ZIP is written to the user-selected external backup folder. Missing runtime files become empty ZIP entries. `icons/`, localStorage, `.window-state.json`, and OS autostart registration are not included.

### Restore

- The user selects a ZIP and confirms in Settings (`src/App.tsx:3947`).
- Rust validates the archive structure, stored compression method, names, entry sizes, CRC, and the presence/JSON syntax of `config.json` (`src-tauri/src/commands/config.rs:1001`, `1235`).
- Current copies of the four runtime files are placed in `%APPDATA%\life-launcher\backups\pre-restore-*` before overwrite.
- The four files are then replaced one at a time. If a later write fails, earlier files remain replaced; the pre-restore copy exists but is **not automatically rolled back**.
- After a successful restore the UI reloads config, clears the active timer/completion prompt, reapplies settings, and refreshes session views (`src/App.tsx:3967`). It does not restart the process or clear localStorage/window-state.

### Reuse decision for software reset

| Existing primitive | Reuse? | Reason |
| --- | --- | --- |
| Runtime file list and ZIP serializer/validator | Yes, after extracting a callable forced snapshot primitive | The format is tested and bounded. |
| `daily_backup` as-is | No | It is private and skips creation when today's ZIP already exists, so it cannot prove the backup represents the immediately pre-reset state. |
| `backup_existing_config` | Partial | It preserves exact config bytes but omits sessions, notes, icons, localStorage, window-state, and OS registration. |
| `restore_backup_from_path` as reset transaction | No | Multi-file writes are not atomic and have no automatic rollback. |
| `write_config` / Windows `ReplaceFileW` | Yes | Appropriate for a single file, already tested for locked-destination failure. |

## Current test coverage and gaps

Covered now:

- Rust tests cover initial config, exact v2 backup, one-time migration, five config-backup generations, daily ZIP creation/pruning, ZIP restore into clean APPDATA, pre-restore retreat, malformed archive cases, and locked atomic config replacement.
- Playwright covers recovery from `saveBlocked` and successful restore refreshing the Settings state (`tests/visual/phase81-entry-contracts.spec.ts:381`).

Not covered now and required in later P83 stages:

- Settings footer order/color and Maintenance grouping.
- Both reset confirmation stages and safe initial focus.
- Forced fresh backup before reset and backup-failure abort.
- Cross-file rollback after failure at each commit step.
- localStorage/window-state/autostart reset and rollback.
- running and paused Timer rejection.
- restart failure and startup recovery from an interrupted reset marker.
- prevention of stale React/debounced writes after reset begins.

## P83-01/P83-02 constraints from this audit

- Preserve the current Settings shell, tabs, draft comparison, close confirmation, Toast, and shared `ConfirmDialog`.
- P83-01 may reorganize JSX and styles but must not add destructive backend behavior.
- P83-02 needs a dedicated backend reset command and transaction protocol; composing the existing public commands in React is insufficient.
- The user-facing backup choice and the internal rollback snapshot are separate obligations.
