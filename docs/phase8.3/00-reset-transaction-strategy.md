# P83-00 Reset Transaction Strategy

## Decision

Implement software reset as a **backend-owned journaled multi-resource transaction with an internal rollback snapshot and clean process restart**. Do not implement it as a sequence of existing React invokes or as recursive deletion of the data directory.

The user-selected backup and the internal rollback snapshot are distinct:

- user backup is optional and retained for the user;
- rollback snapshot is mandatory, internal, and exists to make the destructive transaction recoverable.

## Candidate evaluation

| Candidate | Strength | Fatal weakness | Decision |
| --- | --- | --- | --- |
| Delete/recreate each file | Simple | Partial deletion/write leaves mixed generations; current restore has this weakness | Reject alone |
| Write fresh defaults only | Avoids deletion | Does not clear sessions, notes, icons, localStorage, window-state, or OS registration | Reject |
| Per-file temp + atomic replace | Strong for one file | No atomicity across config/sessions/notes/schema/icons/OS/UI state | Use inside a journaled transaction |
| Replace whole `%APPDATA%\life-launcher` directory | Strong namespace switch | Would move/delete nested `backups/`; watcher/locks and cross-volume behavior complicate Windows; does not cover WebView/window-state/autostart | Reject |
| Rollback snapshot + transaction marker + staged replacements | Preserves exact bytes and supports failure/crash recovery | More implementation and tests | **Recommended** |
| Restart without transaction marker | Clears React memory | New process cannot distinguish success from an interrupted half-reset | Reject |

## Existing primitives to reuse

- `initial_config()` and config validators (`src-tauri/src/models.rs:807`).
- `write_config` and Windows `ReplaceFileW` for config/schema replacement (`src-tauri/src/commands/config.rs:860,899`).
- ZIP writer/reader, CRC, size/name validation, and the four-file archive list from `src-tauri/src/commands/config.rs:46,1117,1235`.
- Internal `backups_path()` for the mandatory `pre-reset-*` snapshot.
- Existing autostart manager and dashboard settings application (`src-tauri/src/startup.rs:62,233`).
- Shared `ConfirmDialog` for both user-facing confirmation stages.

Do not reuse `daily_backup` unchanged: it skips a same-day archive and therefore cannot guarantee a current snapshot. Do not reuse `restore_backup_from_path` as the transaction coordinator: it replaces four files sequentially and never auto-restores `pre-restore-*` on failure.

## Required command boundary

P83-02 should expose one reset transaction command, not a public delete primitive. The backend owns staging, commit, validation, rollback marker, OS-side effects, and restart request. The frontend owns the two confirmation dialogs, active-Timer gate, UI write freeze, logical localStorage snapshot/clear, and communication of success/failure.

A reset-specific mutex/state flag should be added to `AppState`. All app-owned mutating commands that can race with reset (config, sessions, notes, icon generation/deletion) must reject or serialize while reset is committing. `config_write_lock` alone does not protect session, note, or icon writers.

## Recommended protocol

### 1. Frontend preflight

1. Read `activeTimerRef.current` immediately before opening reset flow and again immediately before invoking reset.
2. Reject any active Timer, including `paused: true`, completion prompt, or early-stop confirmation, with exactly: `実行中のタイマーを終了してからリセットしてください`.
3. Never call `finishTimer`, never append a Session, and never mark Today complete as part of reset.
4. On final confirmation, set a `resetInProgress` gate before awaiting backend work. Disable all mutating Main/Settings actions.
5. Increment/invalidate timer start request IDs, cancel pending notes debounce timers, close edit drafts, and prevent `persistConfig`/notes callbacks from accepting new work.
6. Capture the allowlisted localStorage key/value/existence map so it can be restored if reset fails.

### 2. Optional user backup

For `バックアップして続行`, call a forced fresh backup primitive before reset mutation:

- snapshot the current `config.json`, `sessions.jsonl`, `notes.json`, and `config.schema.json`;
- use a collision-safe timestamped name or another explicitly fresh naming rule;
- write temp, `sync_all`, rename, and validate the completed archive;
- return the final path;
- any failure aborts reset with no state changes.

`バックアップせず続行` skips only this user-owned archive. It does not skip the mandatory rollback snapshot.

### 3. Mandatory rollback snapshot and journal

Create `%APPDATA%\life-launcher\backups\pre-reset-<timestamp>-<nonce>/` containing:

- exact bytes and existence metadata for config, sessions, notes, schema;
- recursive copy/manifest for `icons/`;
- a copy of `.window-state.json` if present;
- localStorage snapshot supplied by the frontend;
- prior autostart state;
- transaction manifest with version, phase, paths, hashes, and `PREPARED` status.

The snapshot must be fully written and verified before the first destructive operation. If snapshot creation fails, delete only incomplete staging artifacts when safe and leave live data unchanged.

Store a small transaction marker in an app-owned path that startup can inspect before ordinary config load. The marker must identify the rollback directory and the last completed commit step. It should survive process termination.

### 4. Stage fresh state

In a staging directory, create and validate:

- schema-v3 `initial_config()` using a single reset date calculation;
- empty `sessions.jsonl`;
- `{}` for `notes.json`;
- generated current `config.schema.json`;
- an empty icon-cache directory/manifest.

Read each staged file back through the same parsers used at startup. No live file changes occur in this phase.

### 5. Commit with rollback on every error

1. Mark journal `COMMITTING`.
2. Replace named runtime files through the strongest available atomic primitive.
3. Remove/recreate only the exact app-owned `icons/` cache after its snapshot is verified.
4. Disable OS autostart and verify the result.
5. Ask the frontend to clear only reviewed Life Launcher localStorage keys; acknowledge completion back to Rust.
6. Resolve window-state with `app.path().app_config_dir()?.join(app.filename())`, delete that exact file, and verify absence. Do not use `save_window_state(StateFlags::empty())`; it does not clear the private cache.
7. Validate fresh config, sessions, notes, empty registrations, autostart, and reset-state acknowledgements.

On any error, restore exact prior bytes/existence, icons, localStorage, window-state, and autostart from the rollback snapshot. Validate the restored state before returning failure. If rollback itself has errors, keep the marker/snapshot and report every failed resource; do not claim success.

### 6. Restart contract

Current code has no restart command. For locked Tauri 2.11.5, use `AppHandle::request_restart()`, not main-thread `restart()`: the former requests `RESTART_EXIT_CODE` and reliably drives `RunEvent::Exit`; the latter may skip exit events on the main thread.

Before restart:

- destroy/close auxiliary mini, dictionary, and instruction WebViews;
- stop accepting frontend writes and ignore config-watcher reloads from this transaction;
- delete/verify the resolved window-state file and unregister plugin name `window-state`;
- keep the transaction marker until the new process validates fresh startup.

Fixed call order:

1. Complete and validate every fallible reset step.
2. Persist and sync journal phase `COMMITTED_AWAITING_RESTART_VALIDATION`.
3. Delete and verify the resolved window-state file; failure triggers full rollback.
4. Require `app.remove_plugin("window-state") == true`; `false` triggers full rollback and no restart.
5. Perform no further fallible work; immediately call `app.request_restart()`.

Tauri 2.11.5 dispatches plugin events only to the registered plugin store, so removal suppresses window-state 2.4.1's exit save. However, `request_restart()` returns `()`; its internal child-spawn failure is only logged and the old process exits. Therefore all detectable failures roll back before this terminal call. The conservative fallback is to retain the journal/snapshot so the next manual launch validates and finalizes or rolls back before normal startup.

P83-02 spike prerequisite: prove the packaged Windows relaunch and retained-journal manual recovery. The human gate may approve the built-in API with that fallback. If immediate rollback after child-spawn failure is mandatory, reject the built-in API and first design/test a two-process acknowledgement handshake.

On new startup, inspect the marker **before** normal `load_config`/watcher setup:

- `COMMITTING` or invalid fresh state -> restore rollback snapshot, then start normally and report recovery;
- `COMMITTED_AWAITING_RESTART_VALIDATION` with valid fresh state -> finalize, retain the user/internal backup, remove only the marker/staging data allowed by policy;
- unknown/corrupt marker -> preserve evidence and fail safe rather than guessing.

## Stale in-memory write hazards

| Hazard | Current source | Required guard |
| --- | --- | --- |
| Optimistic config write after reset | `configRef.current` and `persistConfig`, `src/App.tsx:1929,2877` | Global `resetInProgress` rejection plus generation token; set refs to fresh/null before restart. |
| Delayed notes rewrite | 500 ms timers in `scheduleNotesSave`, `src/App.tsx:6775` | Cancel timers and make callback check reset generation. |
| Timer completion/early stop | `finishTimer`, completion promises, `src/App.tsx:5859` | Reject reset while any active/pending Timer state exists; invalidate handlers. |
| Config watcher reload | `start_config_watcher`, `src-tauri/src/startup.rs:90` | Suppress reset-originated events for the full transaction/restart interval. |
| Window-state resurrection | plugin writes cache on `RunEvent::Exit` | Delete/verify its resolved file, then require `app.remove_plugin("window-state") == true` before restart. |
| Autostart mismatch | OS registration is changed independently of config | Snapshot, verify, and rollback OS state. |
| Auxiliary WebView writes | Instruction/Dictionary share app state/origin | Close them before localStorage commit and restart. |

## Failure matrix

| Failure | Required result |
| --- | --- |
| User backup creation/validation fails | Abort before reset; live state unchanged. |
| Rollback snapshot or manifest fails | Abort before reset; live state unchanged. |
| Permission denied / locked destination | Restore any prior commit steps; keep snapshot/marker if rollback is incomplete. |
| Partial file replace or icon delete fails | Automatic exact rollback; no success Toast. |
| Autostart disable fails | Roll back files/UI state and prior OS setting. |
| localStorage/window-state clear fails | Roll back all reset resources. |
| Fresh validation fails | Roll back and return validation error. |
| Detectable pre-restart failure, including window-state delete or plugin removal | Roll back while the old process is authoritative. |
| Child spawn fails after `request_restart()` | Immediate rollback is unavailable; retain journal/snapshot and recover on next manual launch. |
| Process crash/power loss during commit | Next startup uses marker to roll back or finalize deterministically. |
| Rollback fails | Leave recovery assets intact, block normal saves where necessary, report actionable paths; never delete evidence. |

## Automated tests required for P83-02/P83-04

- Isolated APPDATA/app-config/WebView fixtures; never use real user data.
- Success with and without user backup.
- User backup failure leaves byte-identical state.
- Snapshot failure before mutation.
- Failure injection after every runtime file, icon, localStorage, window-state, and autostart step.
- Locked file and permission-denied cases.
- Startup recovery for every journal phase.
- Running and paused Timer reject with no Session finalization and zero reset calls.
- Pending notes callback cannot recreate old data.
- Pre-restart failure rollback, packaged relaunch validation, and retained-journal recovery on next manual launch.
- Existing internal backups, external ZIPs, instruction files, and launcher targets remain untouched.
