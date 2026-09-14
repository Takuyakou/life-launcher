# Phase 8.2 P82-01 Work Report

## Result

P82-01 completed the NextStep replacement semantics and reorganized Wishlist into Project-owned groups without changing the config schema or creating additional NextSteps.

## Changes

- Updated the NextStep section copy to describe one restart point per Project.
- Replaced silent Wishlist promotion with explicit `やりたいことへ戻す` / `完了にする` / `キャンセル` choices.
- Returning an old NextStep creates a new stable Wishlist item containing only its text and Project ownership. Execution settings are intentionally discarded.
- Completing an old NextStep records the existing source-completion snapshot. Today3 snapshots and Session history are unchanged in either path.
- Added stale-source guards, save-failure rollback, reload persistence, and save-in-progress action guards.
- Grouped Wishlist by Project order, with manual order inside each group and `未分類` last.
- Added group collapse and per-group compact/paginated views.
- Removed the persistent Wishlist `今日へ` action. Today selection remains owned by Today Builder.
- Added `✓ 今日の3件` and `候補に戻す` row states.
- Restricted pointer and keyboard reordering to the same Project group; cross-Project drops are ignored.

## Verification

| Gate | Result |
| --- | --- |
| ESLint | PASS, 0 warnings |
| TypeScript/Vite build | PASS |
| P82-01 focused Playwright | PASS, 9 tests |
| Related Phase 7.2/8.1 Playwright | PASS, 35 tests |
| Full Playwright suite | PASS, 253 tests |
| `git diff --check` | PASS |

Visual QA passed at 1440px and 860px for Project headers, unassigned-last order, long row containment, Today3 state, excluded-state restore, and group collapse. Existing broader layout coverage also passed at 1920px, 1440px, 1000px, 860px, and 620px.

## Remaining Work

P82-02 through P82-04 remain. The user explicitly authorized continuing the stages sequentially, so P82-02 may start after this report and PR are recorded.

P82-01 COMPLETE — CONTINUING BY USER AUTHORIZATION
