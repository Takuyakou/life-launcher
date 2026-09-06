# P6.1-00 Work Report

## Status

`WAITING_HUMAN_APPROVAL`

## Source

- Base branch: `docs/p6-00-audit-baseline`
- Work branch: `feature/p6-01-main-decision-reduction`
- Pull request: [#7](https://github.com/Takuyakou/life-launcher/pull/7)
- Version change: none

## Main order

`Victory -> Do Now -> Today3 -> Today Builder -> NextStep -> Wishlist -> Today Activity`

## Today3 completion

- Manual checkbox completion was removed and replaced with a non-interactive status.
- A linked Today item completes only when its planned Timer duration is reached and the existing completion dialog is confirmed.
- Starting the same Project action from Do Now or its Today card resolves to the same stable source identity.
- Manual stop records the existing Session result but leaves Today incomplete.
- Legacy persisted `done=true` values without a stable source key normalize to neutral instead of being presented as Timer completion.

## Today3 grid

- Wide desktop: 3 equal columns.
- Medium: 2 columns.
- Narrow: 1 column.
- Action text is constrained without moving the bottom Timer controls.

## Next batch

`次の3件を選ぶ` appears only when the active set contains exactly three Timer-completed items.
It clears only the active Today slots, preserves Session history and Today Activity, then expands and focuses Today Builder without automatic selection.

## Today Builder >5

The derivation cap was removed. All Projects, Wishlist entries, and recent Session notes can remain candidates, with exact-text deduplication.

## Pagination

Five candidates are shown per page. Previous/next controls, count, reload persistence, and page-boundary clamping are covered by Playwright.

## Delete

Right-click delete dismisses only the Builder candidate, preserving its Project, Wishlist, or Session source. Dismissed identity persists locally and the current page clamps after deleting the final item on the last page.

## NextStep timers removed

Project cards were replaced by compact accordion rows. Timer controls, checkboxes, and visible edit controls were removed; edit/move/delete remain in the keyboard-accessible context menu.

## NextStep today

`今日へ` copies the Project next step into Today3 and keeps the source. Duplicate and 3-item limit rejections show feedback.

## Wishlist today

`今日へ` copies the Wishlist entry into Today3 and keeps the source. Duplicate and full-state guards use the same feedback grammar.

## Shared add UX

Today3, Today Builder, NextStep, and Wishlist use compact inline forms with explicit confirm/cancel controls, Enter confirmation, Escape cancellation, and visible keyboard focus.

## Persistence safety

Optimistic config changes roll the displayed order/state back if `save_config` fails. The visual Tauri mock persists successful saves across reloads and exposes a deterministic failure mode for rollback coverage.

## Tests

- `npm.cmd run public:check`: PASS (127 files, 0 blockers)
- `npm.cmd run lint`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd run test:visual`: PASS (22/22)
- P6.1 focused Playwright: PASS (10/10)
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `cargo check --manifest-path src-tauri/Cargo.toml`: PASS
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: PASS
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS (87 unit + 2 capability contract)
- `git diff --check`: PASS

## Visual QA

[P6.1 Main Visual QA](../01-main-visual-qa.md) records the wide, medium, narrow, 1/2/3 Today-item, completed batch, Builder pagination, NextStep, Wishlist, and Activity states.

## Scope gate

Dictionary, Quick sidebar, Explorer reveal, global Settings, release version, Web Demo, merge, tag, and release were not changed.

## Stop gate

P6.2 has not started. This branch is waiting for human review of P6.1.
