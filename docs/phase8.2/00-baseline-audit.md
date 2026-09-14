# Phase 8.2 Baseline Audit

## Audit basis

- Date: 2026-09-14
- Base branch: `origin/main`
- Base commit: `ee6814ec70ac9caf7ed331cd2cf9ebe08722586f`
- Phase 8.1 merge: PR #70 is included by merge commit `ee6814e`.
- Audit branch: `docs/p82-00-baseline-audit`
- Scope: documentation and verification, plus one exact public-safety artifact permission and its regression test. No product code, schema, version, release, or deployment change.

## Readiness verdict

`READY FOR P82-01 AFTER HUMAN REVIEW`

Phase 8.1 is integrated into the audited base. No prerequisite blocker was found.

## Phase 8.1 contract check

| Contract | Result | Evidence |
| --- | --- | --- |
| Config v3 | PASS | Rust `CONFIG_VERSION` is 3 in `src-tauri/src/models.rs`; TypeScript schema accepts the nested NextStep model. |
| Project / NextStep separation | PASS | `ProjectV3.next_step` is optional and owns execution settings; `legacy_next_step_settings` is mutually exclusive with an active NextStep. |
| Safe v2 to v3 migration | PASS | The production load path validates v2, creates an exact raw backup, writes atomically, rejects invalid/future roots, and does not migrate v3 again. |
| Wishlist stable identity | PASS | Wishlist items use optional legacy-compatible `id`; canonical current identity is `wishlist:{id}`. Legacy duplicate aliases resolve only when unambiguous. |
| NextStep generation boundary | PASS | Current NextStep can carry `generationId`; Today3 copies it as `sourceGenerationId`; new setting/replacement creates a marker while edit preserves it. |
| Today3 snapshot | PASS | Today items own copied text, trigger, Project, actions, instruction, and timer values. Source edits re-snapshot only the matching stable identity/generation while preserving done/order/date. |
| Source-aware completion | PASS | Completion resolves stable identity and generation, leaves stale snapshots isolated, and stores immutable source completion snapshots. |
| Session separation | PASS | Timer sessions are appended independently of config source completion history. Config save rollback cannot erase a durable Session append. |

Primary implementation references:

- `src/types.ts`: `NextStepSchema`, `ProjectSchema`, `TodayItemSchema`, `InboxItemSchema`, `SourceCompletionSchema`
- `src/sourceEdit.ts`: `canonicalSourceKey`, `timerSourceKey`, `resnapshotSource`
- `src/completionFollowup.ts`: source resolution and source-aware completion
- `src-tauri/src/models.rs`: config v3 Rust model
- `src-tauri/src/commands/config.rs`: migration, validation, backup, atomic save, and Today selection Undo

## Persistence and rollback baseline

- Frontend config writes flow through `persistConfig`: it updates the UI/ref optimistically, replaces them with the backend''s normalized response on success, and restores the previous config on failure if no newer state has superseded that write.
- Backend `save_config` serializes writes, validates v3 invariants and the existing on-disk config, creates a backup, then performs the configured atomic write.
- Today selection Undo applies a source-scoped inverse delta to the latest config and rejects stale operation tokens, changed sources, duplicate adoption, date changes, and a full Today3.
- The audited model already preserves stable source identity, NextStep generation, Today3 snapshots, Session history, and source completion history independently.

## Existing completed work kept out of Phase 8.2

- Timer hover and centered time treatment
- HTML instruction renderer fidelity
- Today3 to Builder reverse D&D and Undo
- Phase 8.1 Project/NextStep/Wishlist migration
- Completion reward feedback

These paths remain regression targets. They are not redesign targets for this phase.

## Coordination note

PR #71 (`fix/v13-restore-timer-labels`) was not part of `origin/main` when this audit branch was created and is not assumed by the audit. P82-03 must rebase on the then-current `main` before changing timer controls so copy-only work is neither lost nor duplicated.

## Baseline verification

| Command | Result |
| --- | --- |
| `npm.cmd run public:check` | PASS: 326 files, 0 blockers after adding the audit artifacts |
| `npm.cmd run lint` | PASS: 0 warnings |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS: 246 tests |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS: 112 unit + 2 capability tests |
| `npm.cmd audit` | PASS: 0 vulnerabilities |
| `npm.cmd audit --omit=dev` | PASS: 0 vulnerabilities |

The full browser suite also covers the Phase 8.1 migration boundary, same-text stable identities, generation isolation, rollback/reload, source completion, reverse D&D, Timer switch/pause/minimum behavior, and 1920/1440/1000/860/620 responsive layouts.
