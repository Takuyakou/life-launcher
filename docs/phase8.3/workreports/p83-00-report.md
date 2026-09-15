# P83-00 Work Report

## Status

P83-00 audit is complete for `origin/main` commit `f2c0dd5c1475e16864beefe7bb0efae0a85cdf72`. Only audit documentation and its execution-state record changed; no product code, destructive reset command, schema, version, or release metadata changed. Review is tracked in [PR #78](https://github.com/Takuyakou/life-launcher/pull/78).

## Deliverables

- `docs/phase8.3/00-settings-maintenance-audit.md`
- `docs/phase8.3/00-reset-data-boundary.md`
- `docs/phase8.3/00-reset-transaction-strategy.md`
- `docs/phase8.3/00-main-button-inventory.md`
- `docs/phase8.3/workreports/p83-00-report.md`

## Major findings

1. Runtime ownership is split across `%APPDATA%\life-launcher`, WebView localStorage, Tauri `.window-state.json`, in-memory React/Rust state, and the OS autostart registration. Resetting `config.json` alone is not a software reset.
2. `initial_config()` is the authoritative fresh config and already gives an empty schema-v3 product state with default settings.
3. Quick/Dictionary/Project/NextStep/Wishlist/Today/source-completion registrations are app-owned, but every referenced instruction/app/file/folder/script/URL is external and must remain untouched.
4. Existing daily backup can supply archive primitives but cannot be used unchanged for `バックアップして続行`: an existing same-day ZIP is not refreshed.
5. Current restore creates a pre-restore copy but replaces four files sequentially and does not auto-roll back a partial failure. It is not a safe reset transaction coordinator.
6. A mandatory internal rollback snapshot plus journal/startup recovery is recommended. User backup remains optional and separate.
7. Running and paused Timers are React-owned in `activeTimerRef`; reset must reject both and never silently finalize a Session.
8. Notes have a 500 ms delayed writer, config uses optimistic `configRef`, and window-state writes cached state on process exit. Each can resurrect stale state unless reset freezes writers and controls restart.
9. Exact path selected: Tauri 2.11.5 `AppHandle::request_restart()`, preceded by runtime-resolved window-state deletion and `app.remove_plugin("window-state")`. Plugin 2.4.1 exposes no public cache-clear API.
10. Only explicit Main-body Action Buttons qualify for the common hover primitive. Top toolbar, sidebar, menus, disclosure headers, status/badges, drag surfaces, icons/ellipsis, disabled controls, and specialized Timer controls are excluded.

## Commands and results

| Command | Result |
| --- | --- |
| `git fetch origin --prune` | Success |
| `git status --short` | Clean before documentation work |
| `git branch --show-current` | `docs/p83-00-current-audit` |
| `git rev-parse HEAD` | `f2c0dd5c1475e16864beefe7bb0efae0a85cdf72` |
| `git rev-parse origin/main` | Same as HEAD |
| `git log -20 --oneline` | Reviewed; current tip is PR #77 merge |
| Code/spec/helpGuide searches and targeted reads | Completed across `src`, `src-tauri`, `tests/visual`, `docs/spec/current-spec.md`, and `src/content/helpGuide.ts` |
| Cargo.lock/local registry source audit | Confirmed Tauri 2.11.5 and window-state 2.4.1 exact APIs, path resolver, plugin removal, and exit behavior |
| `npm ci` | Success: 172 packages installed, 0 vulnerabilities |
| `npm run lint` | Success: 0 warnings |
| `npm run build` | Success |
| `npm run test:visual` | Success: 268 passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Success: 112 Rust unit tests + 2 capability tests; 0 failed |
| `npx playwright test tests/visual/phase81-entry-contracts.spec.ts --grep "reload and restore"` | Success: 1 passed |
| `npm run public:check` | Worktree-only blocker: the checker rejects the linked-worktree `.git` metadata file; no product-content finding |
| Pull request | [#78 `docs: audit Phase 8.3 reset boundaries`](https://github.com/Takuyakou/life-launcher/pull/78) |

## Existing coverage gaps handed to later stages

- P83-01: Settings footer placement/color, Maintenance grouping, keyboard/scroll/visual regression.
- P83-02: both confirmations, forced fresh backup, backup-failure abort, failure injection at every transaction step, exact rollback, Timer rejection, stale-writer prevention, autostart/window-state handling, restart/startup recovery.
- P83-03: positive scope and negative exclusion coverage for the hover primitive, plus frozen Timer/Measure/NextStep geometry.
- P83-04: clean-start end-to-end validation and external/backup non-deletion assertions.

## Open findings

- P83-02 spike prerequisite: packaged Windows relaunch and retained-journal manual recovery must pass. Human approval may select built-in `request_restart()` with conservative next-launch recovery. If immediate rollback after child-spawn failure is required, a two-process acknowledgement handshake must be designed and approved first.
- Reset should clear the audited `localStorage` key allowlist unless a supported backend API is proven; recursive WebView2 profile deletion is outside the approved boundary.
- Retention rules for future internal `pre-reset-*` snapshots are unspecified; preserve them until a human-approved policy exists.
- The forced user-backup filename/collision policy is unspecified; create a fresh archive and never reuse or overwrite an existing same-day ZIP.
## Human gate

Before destructive implementation, review and approve:

- the reset/non-reset table in `00-reset-data-boundary.md`;
- the forced user-backup requirement;
- the mandatory journaled rollback strategy;
- preservation of all internal/external backups;
- clean restart via `AppHandle::request_restart()`, runtime path resolution, and exit-save suppression via `remove_plugin("window-state")`;
- either approval of retained-journal next-launch recovery after an undetectable child-spawn failure, or approval to block P83-02 pending a two-process handshake.

P83-00 COMPLETE — STOPPED FOR HUMAN REVIEW
