# P71-03: Guide, regression and readiness

## Scope and baseline

- Baseline: `d2b52739c82e3934174f54aafa29f6f9e30b27ac`.
- User authorized implementation through P71-03 without intermediate stops.
- Audit PR #33 -> implementation PR #34 -> layout PR #35 -> this documentation/regression PR.
- No main merge, version change, EXE build, tag, Release, or Web Demo deployment.

## Implementation contract

Canonical source is the stable Project ID or Wishlist ID, never display text. Today3 editing opens that source editor. Saving from either the source or Today3 updates the source and resnapshots its adopted Today3 item through one config save.

| Snapshot field | Explicit edit behavior |
| --- | --- |
| text | Copy current source text |
| trigger | Copy Project trigger; clear when absent |
| projectId | Copy current association; clear when removed |
| buttonIds | Copy current selection, preserving order; clear when empty |
| instructionPath / instructionOpenOnStart | Copy current instruction settings; clear absent values |
| short / normal minutes | Resolve edited source's Project settings or global defaults |
| sourceKey / done / array position | Preserve exactly |

This is explicit resnapshotting, not a live binding. Sessions, source completions, Today date and unrelated items remain unchanged. Completed adopted items keep their done flag. Duplicate/ambiguous matches reject saving instead of guessing.

Running and paused timers prevent editing their own canonical source. The check exists at editor entry, save handler, and timer-start boundary while a source save is pending. Other-source timer activity does not prohibit editing an unrelated source. Tests dispatch React handlers directly to exercise the guard.

One config payload carries source and Today3 changes. Optimistic save failure rolls back and retains the editor draft for retry; success closes it. This is logical application-level atomicity, not a new filesystem transaction or cross-window conflict protocol.

Editing short minutes while stopped changes the next timer's Today3 snapshot and early-completion threshold. Editing the running source is blocked, so the active threshold does not change. Existing dynamic threshold, pause exclusion, next batch, removal and Session behavior remain covered.

## UI and documentation

- Project and Wishlist: Save on the left, Cancel on the right.
- Start Environment: Apply on the left, Cancel on the right; initial focus on Cancel, verified with Tab/Shift+Tab.
- Existing Project/Wishlist text-field initial focus is retained.
- Project and Settings timer controls: short before normal in DOM order.
- Project timer controls stack short above normal at widths up to 900px, including the 860px app minimum.
- Guide and current-spec describe explicit synchronization, guard, history preservation and early completion.

## Verification

| Gate | Result |
| --- | --- |
| npm ci | PASS |
| public:check | PASS: 228 files, 0 blockers |
| lint | PASS |
| build | PASS |
| test:visual | PASS: 160 tests on final implementation |
| Rust fmt | PASS |
| Rust check | PASS |
| Rust clippy, all targets, deny warnings | PASS |
| Rust tests | PASS: 100 unit + 2 capability tests |
| npm audit, all dependencies | PASS: 0 vulnerabilities |
| npm audit, production only | PASS: 0 vulnerabilities |
| git diff --check, including staged changes | PASS |

P71 adds 11 tests across audit, edit-sync and layout suites. Coverage includes field clearing, relinking, same-text identity, both edit directions, running/paused and direct-handler guards, failed save/retry/reload, immutable history, edited threshold and narrow layout. Existing regression includes Today3 remove/order/rollback, Builder, next batch, lifecycle, Quick/Dictionary, positioning, Explorer backend, picker, Guide and disclosure bars.

Visual QA uses synthetic fixtures at 1440px and 860px. Screenshots cover Today3 editing, Project timers/footer, Wishlist footer and picker focus. Automated checks cover disabled editing and layout bounds; final 860px timer and 1440px picker screenshots were also visually inspected. Native Tauri interaction smoke has not been run in this phase.

An earlier picker test expected the old search focus and was updated to the new Cancel contract. One intermediate full run failed an existing Quick keyboard assertion; subsequent full runs, including the final run, passed all 160 tests. Do not interpret that as proof of zero timing flakiness.

## Remaining limitations and integration

- Legacy text-based adopted Wishlist keys are not rewritten. Editing such an adopted item fails safely with guidance to remove it from Today3 and adopt it again. Timer identity can still resolve a unique legacy alias. This prevents orphaning an adoption when its source text changes.
- Existing filesystem save fallback is not crash-atomic; cross-window concurrent stale saves remain an existing limitation.
- Existing action snapshots retain button IDs, not independent copies of all external action payloads.
- PR #32 contains earlier overlapping Guide/spec work. Review overlap during integration; it was not merged or closed here.
- Generated screenshots from the full suite and the unrelated existing follow-up report are excluded from this PR.
- Native EXE validation and release-source gates remain separate release-preparation work.

Final: **READY FOR v1.2 RELEASE PREP**, subject to review/integration and native release validation. This is not release approval.
