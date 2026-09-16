# P84-00 Today Candidate Audit

## Baseline

- Source of truth: `origin/main`
- Baseline commit: `d180045`
- Audited code: `src/App.tsx`, `src/types.ts`, `src/tauri.ts`, `src-tauri/src/commands/config.rs`
- This document records current behavior only. P84-00 does not remove the Builder or change product code.

## Current Candidate Pipeline

`DashboardApp` constructs `rawTodayBuilderCandidates` from exactly two sources:

| Source | Eligibility | Stable identity | Snapshot fields |
| --- | --- | --- | --- |
| Project NextStep | `project.nextStep.text.trim()` is non-empty | `project:<projectId>` | text, generationId, trigger, projectId, buttonIds, instruction path/open flag, normal/short minutes |
| Wishlist | `inbox.text.trim()` is non-empty | `wishlist:<item.id>`; an ID-less legacy item falls back to its list index | text, projectId, buttonIds, instruction path/open flag, normal/short minutes |

Wishlist candidates keep the first matching legacy alias, `wishlist:<projectId-or-none>:<text>`, so an old Today snapshot can still match its canonical source. Identical Wishlist text with different stable IDs remains distinct.

Candidate generation does not use the victory condition, Session history, Do Now ranking, completion history, or `weeklyFocus`. It must remain separate from Do Now.

## Current Filtering And Ordering

The permanent Builder currently:

1. Removes candidates whose canonical key or alias is in `today.candidateExcludedSourceKeys`.
2. Sorts NextStep candidates before Wishlist candidates.
3. Applies `life-launcher-today-builder-order` within that source ordering.
4. Regroups Wishlist candidates by Project or `unassigned`.
5. Shows five candidates per page.

The saved Builder order is local UI state. It is not config data and does not change Project or Wishlist order.

## Selection And Duplicate Detection

Selected state is derived by comparing a candidate's canonical key and aliases with every Today item's stable `sourceKey`. `addCandidateToToday` repeats that duplicate check immediately before saving and rejects a fourth Today item.

The current row action behaves as follows:

- unselected: `今日へ` calls `addCandidateToToday`;
- selected: `✓ 選択済み` is currently a button that calls `removeTodayItem`;
- full Today3: unselected `今日へ` is disabled.

The current specification text still describes selected state as non-toggle status. P84-01 should use the Phase 8.4 Picker decision: selected entries are status-only (`✓ 今日の3件` or equivalent), while removal remains a Today3 responsibility.

## Adoption Contract

`addCandidateToToday`:

- preserves the NextStep/Wishlist source;
- snapshots candidate text and execution fields into a new `TodayItem`;
- preserves `sourceGenerationId` when present;
- inserts at the requested index or appends;
- clears an obsolete mutation token for that source;
- preserves the Main scroll position;
- saves through `persistConfig`.

`persistConfig` applies the optimistic state first, calls the atomic Rust save command, and restores the exact previous config on failure when no newer write superseded it. The Picker must reuse this contract instead of creating a separate save path.

Button adoption currently relies on `addCandidateToToday` for empty-text, max-three, and duplicate guards. Builder D&D adds same-day and active-Timer checks before calling it. P84-01 should put the final Picker action guard in one reusable adoption boundary so button and keyboard activation cannot diverge.

## Classification

### A. Required By Today Picker

- `TodayBuilderCandidate` data shape or a narrowly renamed UI-independent equivalent.
- Project and Wishlist candidate constructors.
- canonical source identity, aliases, and generation identity.
- raw NextStep + Wishlist candidate generation.
- selected/duplicate derivation against Today3.
- max-three guard.
- Today snapshot creation.
- atomic save, optimistic rollback, and scroll stability.
- source preservation.

### B. Permanent Builder UI Only

- `todayBuilderOpen`, disclosure header/body, and auto-open behavior.
- Builder pagination and page clamping.
- Builder Wishlist group collapse state.
- Builder candidate reordering and its localStorage order.
- Builder candidate drag preview, auto-scroll, insertion indicator, and cross-section guidance.
- Builder bar context menu and source navigation.
- Builder row edit/menu presentation.
- Builder candidate exclusion/restore controls and Undo entry point.

### C. Retain For Backward Compatibility

- `today.candidateExcludedSourceKeys` in schema/config normalization.
- `today.selectionMutationTokens`; Today removal Undo still requires it.
- canonical and legacy source aliases.
- `life-launcher-today-builder-order` and `life-launcher-today-builder-dismissed` localStorage keys; leave stored values intact until an explicit migration/reset policy changes them.
- Rust Undo support for an old candidate-exclusion toast already in flight.

### D. Removable After P84-01 Replacements Exist

- permanent Main Builder JSX and Builder-only CSS.
- Builder-only state, pointer types, geometry helpers, handlers, pagination, grouping, and context-menu branches with no remaining callers.
- candidate exclusion/restore UI.

Removal must be reference-driven. Candidate construction, identity, adoption, rollback, and schema compatibility are not deletion targets.

## P84-01 Decision

The Picker must start from the raw current NextStep + Wishlist candidate set and must not hide entries using stale `candidateExcludedSourceKeys`, old dismiss data, old Builder order, old pagination, or old collapse state. Those values remain readable and serializable for compatibility but become inert for Picker visibility. This avoids permanently missing candidates without a destructive migration.
