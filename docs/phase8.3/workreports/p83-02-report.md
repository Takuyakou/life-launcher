# P83-02 Work Report

## Result

Settings > Maintenance now provides a two-stage software reset flow with a Timer guard, optional verified user backup, safe default focus, and an explicit destructive confirmation. The reset transaction creates and verifies an internal rollback snapshot, writes canonical first-launch state, clears app-owned UI storage, disables autostart, resets window state and icon cache, then requests a clean restart.

The reset journal is append-only and synced so startup can recover from a truncated final record. Runtime files, icon-tree contents, window state, autostart, and app-owned localStorage are restored on failure. Recovery storage is retained until the frontend applies it and sends an acknowledgement. Existing backup ZIPs and external instruction/launcher targets are not reset.

## Verification

- `npm run lint`: passed, 0 warnings
- `npm run build`: passed
- `npm run test:visual`: 285 passed
- New P83-02 targeted suite: 12 passed, including both backup choices, Timer rejection, duplicate dispatch, localStorage failure rollback, startup recovery acknowledgement, focus return, and stale-write freeze
- `cargo fmt --check`: passed
- `cargo check`: passed
- `cargo clippy --all-targets --all-features -- -D warnings`: passed
- `cargo test`: 120 unit + 2 capability tests passed
- `git diff --check`: passed
- `npm run public:check`: expected worktree-only `.git` metadata finding; no source-content finding

## Restart And Recovery

The window-state plugin is registered only after startup recovery. A successful transaction removes the runtime plugin and directly requests restart with no later fallible application work. If the process is interrupted or restart does not complete, the durable marker remains; the next manual launch validates the staged fresh state or rolls back before window-state initialization.

## Handoff

P83-03 can change Main action hover/color semantics without altering reset behavior, Timer controls, the top-right toolbar, sidebar, context menus, section headers, status badges, drag handles, or ellipsis motion.
