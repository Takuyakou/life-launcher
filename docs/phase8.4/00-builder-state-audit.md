# P84-00 Builder State Audit

## Baseline

Baseline commit: `d180045`.

## State Inventory

| State | Storage | Current responsibility | P8.4 disposition |
| --- | --- | --- | --- |
| `todayBuilderOpen` | React state | permanent disclosure open/closed | remove with permanent Builder |
| `todayBuilderPage` | React state | five-row pagination | remove; Picker owns fresh transient view state |
| `todayBuilderWishlistCollapsed` | React state | per-Project Wishlist group collapse | do not carry automatically; Picker may use local dialog state only if needed |
| Builder pointer drag/preview | React state/ref | reorder, Today adoption, source exclusion | remove after Picker and dedicated Today remove zone replace callers |
| Builder auto-open timer | ref/timer | opens a closed Builder after 500ms during restore D&D | remove with restore-to-Builder D&D |
| `life-launcher-today-builder-order` | localStorage | candidate display order | retain stored value, stop applying it to Picker |
| `life-launcher-today-builder-dismissed` | legacy localStorage | no current visibility effect | retain untouched; software reset may clear it |
| `today.candidateExcludedSourceKeys` | config v3 | same-day candidate exclusion | retain schema/data, stop filtering Picker candidates |
| `today.selectionMutationTokens` | config v3 | conflict-safe Today removal/exclusion Undo | retain; Today removal still uses it |

## Current Dismiss And Restore Behavior

`今日の候補から外す` currently performs one atomic config save that:

- removes a matching Today adoption if present;
- appends the canonical candidate key to `candidateExcludedSourceKeys`;
- writes a mutation token;
- leaves the Project/Wishlist source and Session history intact.

The success Toast offers Undo. Rust validates the operation token, day, neighboring Today identities, and source snapshot before applying only the target delta. Save failure restores the optimistic frontend state.

Source-section menus and reverse D&D can remove a key from `candidateExcludedSourceKeys` and restore Builder visibility without adopting it to Today3.

The older `life-launcher-today-builder-dismissed` value is explicitly ignored by candidate generation and is preserved unchanged. Existing tests lock that behavior.

## Compatibility Decision

P84-01 must not delete, migrate, or rewrite old exclusion/dismiss/order values. It must also not reuse them as Picker visibility filters. The result is:

- no hidden stale state can permanently remove a valid Picker candidate;
- existing config v3 remains valid;
- no version bump or migration is required;
- an already rendered legacy Undo action can still be handled safely;
- Today removal Undo continues to use mutation tokens independently of Builder dismissal.

No dismiss, restore, candidate-order persistence, or Builder pagination UI is carried into the Picker. A newly opened Picker derives its candidates from current canonical sources and current Today selections.

## Keyboard And Context Behavior

The permanent Builder currently supports:

- disclosure button and `aria-expanded`;
- header right-click/Shift+F10 source navigation;
- focusable candidate rows;
- row right-click/Shift+F10 edit, move, and exclude commands;
- explicit previous/next page buttons;
- Escape/pointercancel/window-blur cancellation for drag state.

P84-01 must replace only the necessary accessibility contract with the existing dialog primitive: labelled dialog, initial focus, Tab containment, Escape/cancel, and focus return. Builder-specific move/exclude/context operations are not Picker requirements.

## Removal Checklist For P84-01

1. Introduce a UI-independent candidate selector and focused tests.
2. Open a modal/overlay Picker from every Today3 empty-slot/add surface.
3. Reuse adoption and rollback contracts.
4. Verify stale exclusion/order/dismiss state does not hide Picker rows.
5. Remove permanent Builder JSX and then remove only unreferenced Builder state/handlers/styles.
6. Keep schema fields and legacy storage untouched.
