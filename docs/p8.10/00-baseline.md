# P8.10-00 Baseline (v1.3.2)

## Repository state

- Public repository: `Takuyakou/life-launcher`.
- Baseline: `bab9c94` (`origin/main`), clean P8.10 worktree.
- No open pull requests at baseline. The ordinary local `main` checkout has unrelated unpushed test-audit commits; this phase uses isolated branches from `origin/main` and leaves that checkout untouched.
- Product version: 1.3.2. Config schema version: 3. Published `v1.3.2` release has standalone EXE, portable ZIP, setup EXE, and checksums. Those assets are immutable for this phase.

## Pre-existing fixes

- PRE-01: PR #88 (`51aa4c4`) is on main. `src/App.tsx` resolves linked Today3 normal/short durations from current global settings when the source has no override, keeps explicit overrides, and retains orphaned snapshots. `tests/visual/today-global-timer.spec.ts` covers settings changes, timer-dock changes, reload/start, and orphaned items.
- PRE-02: PR #87 (`64dcc39`) is on main. `src/App.tsx` avoids shortcut reapplication for unrelated Settings saves; `src-tauri/src/startup.rs` skips registering unchanged, already registered shortcuts. `tests/visual/phase89-main-display.spec.ts` covers the display-size path and actual shortcut changes.
- Both fixes were reviewed and merged before P8.10; neither is reimplemented here.

## Baseline verification

- PR #88 CI on the identical source tree: `npm ci`, public check, lint, build, full visual suite, Rust fmt/check/clippy/test, and npm audits all passed.
- Local `npm ci`: passed, zero npm vulnerabilities.
- Local `npm run public:check`: passed, 400 files scanned, zero blockers.
- Local `cargo audit --file src-tauri/Cargo.lock --json`: passed, zero vulnerabilities. Advisory database reports informational unmaintained/unsound warnings for transitive crates; no vulnerability blocker.
- `git diff --check`: passed.
- The PRE-01 focused visual tests and PRE-02 display-size tests passed before their respective merges; the subsequent full CI includes both.

## Remaining validation in this phase

Active-timer target stability, native shortcut foreground/minimized/tray behavior, and the P8.10 UI changes require new focused tests and native smoke before the review EXE. No real user data is used as a test fixture.
