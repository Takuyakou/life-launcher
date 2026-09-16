# P84-00 Work Report

## Status

P84-00 current Candidate / Builder / D&D / Do Now audit is complete on baseline `d180045`. Product code is unchanged. P84-01 and later stages are not started.

Review pull request: [#85](https://github.com/Takuyakou/life-launcher/pull/85)

## Deliverables

- [Today candidate audit](../00-today-candidate-audit.md)
- [Builder state audit](../00-builder-state-audit.md)
- [Today3 D&D audit](../00-today3-dnd-audit.md)
- [Do Now ranking audit](../00-do-now-ranking-audit.md)
- [Execution state](../execution-state.json)

## Major Findings

1. The current Today candidate set is correctly sourced only from NextStep and Wishlist, but candidate construction is embedded in `DashboardApp` and must be retained while permanent Builder UI is removed.
2. Stable source identity, max-three/duplicate guards, snapshot creation, atomic save, and rollback are reusable Picker contracts.
3. Builder exclusion, order, pagination, group collapse, and reverse-D&D are Builder-specific. Picker must not inherit stale exclusion/dismiss/order state.
4. `candidateExcludedSourceKeys` and mutation tokens remain schema-compatible data. No config migration or version bump is needed.
5. Today3 removal already preserves source data and supports conflict-safe Undo, but its drag target is incorrectly coupled to the permanent Builder surface.
6. Do Now currently filters out every weeklyFocus-OFF Project. Its ranking considers only today's latest start time; all-history latest Session is used only for the 14-day restart flag.
7. Frontend `他の一手` already cycles deterministically without persistence, so P84-03 should change the backend candidate list/ranking and empty-state copy, not the execution controls.

## Verification

| Check | Result |
| --- | --- |
| `npm run public:check` | PASS: 357 files, 0 blockers |
| `npm run lint` | PASS: 0 warnings |
| `npm run build` | PASS |
| Focused Playwright: Builder, Today3 D&D/removal, Do Now interaction | PASS: 66 tests |
| Focused Rust: Do Now candidates, Today Undo, candidate exclusions | PASS: 7 tests |
| `git diff --check` | PASS |
| PR #85 GitHub CI | PASS on `f07dc44` (attempt 2, 8m33s) |

P84-00 adds documentation only; no manual-only correctness claim is used. The preceding UI follow-up PR #84 passed its full GitHub CI before it was merged into this audit baseline. This audit PR's CI is checked separately and must not be inferred from local results.

The first CI attempt had one non-reproducing failure in the existing 860px Builder D&D geometry test. The exact test passed 5/5 locally, and the unchanged PR head passed the full workflow on attempt 2.

Visual QA in this audit means automated Chromium interaction/geometry regression on unchanged product code. No new Picker or Drop Zone exists yet, so P84-01/P84-02 must perform their own changed-UI Visual QA.

## Human Gate

P84-01 may begin only after this audit PR is reviewed, merged, and the user explicitly approves continuation.

`P84-00 COMPLETE — STOPPED FOR HUMAN REVIEW`
