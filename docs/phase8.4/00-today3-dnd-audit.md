# P84-00 Today3 D&D Audit

## Baseline

Baseline commit: `d180045`.

## Current Reorder Flow

- Pointer-down starts only with the primary button and ignores nested interactive controls.
- Drag begins after the shared 6px threshold.
- `todayDropTargetFromPoint` uses actual card rectangles. It chooses left/right placement when cards share a row and top/bottom placement when they do not.
- The preview keeps the source card dimensions and renders a yellow insertion indicator.
- Drop calls `moveTodayItem`; keyboard/context commands call `moveTodayItemByOffset` with the horizontal labels `左へ移動` / `右へ移動`.
- Both routes save through `persistConfig`, so a failed save restores the exact prior item order.

This entire Today3-internal reorder contract remains unchanged in P8.4.

## Current Removal By D&D

Today3 removal currently treats the permanent `.todayBuilderBand` as the target:

1. Once the 6px threshold is crossed, the handler checks whether the dragged Today item is not the active/paused Timer source.
2. The Builder band displays `ここにドロップして今日の3件から外す`.
3. Dropping inside the Builder band calls `removeTodayItem`.

This is the coupling P84-02 must replace. It is not a move to NextStep or Wishlist; the Builder only acts as a geometric removal target.

## `removeTodayItem` Contract

The handler:

- resolves the exact Today item by stable source identity;
- rejects the operation when that Today Timer is running or paused;
- assigns stable fallback keys to legacy Today items before changing order;
- removes only the Today snapshot;
- leaves NextStep, Wishlist, completion history, and Sessions unchanged;
- records a mutation token;
- saves atomically with optimistic rollback;
- shows `今日の3件から外しました` with an eight-second Undo action.

Undo calls the Rust `undo_today_selection` command with the removed snapshot, neighboring source keys, source snapshot, day key, and operation token. It rejects stale/conflicting operations and active Timer conflicts.

Completed items have no special removal prohibition. A completed Today snapshot can be removed without altering its source or replaying completion feedback.

## Non-D&D Fallback

Every Today card exposes the same context menu from right-click, Shift+F10, and the visible ellipsis. It contains `今日の3件から外す`, disabled with the same active-Timer reason. This fallback already matches P8.4 and must remain.

## P84-02 Delta

Replace only the Builder target surface:

- normal state: no remove zone;
- after the Today drag crosses 6px: show a dedicated zone directly below Today3;
- label: `↓ ここにドロップして今日の3件から外す`;
- valid hover: visual active state;
- drop: call the existing `removeTodayItem` contract;
- invalid/active Timer: no mutation and no silent Timer stop;
- pointercancel, Escape, blur, and drop elsewhere: clear transient state;
- Today3 card size, internal layout, Timer controls, and reorder geometry stay unchanged.

The dedicated zone must never call NextStep/Wishlist promotion, demotion, deletion, or candidate-exclusion handlers.

## Existing Regression Coverage

- `phase6-main.spec.ts`: Today3 reorder, insertion feedback, save-failure rollback.
- `phase72-followup-five.spec.ts`: full-card drag surface, 6px threshold, active Timer guard.
- `phase72-cross-dnd.spec.ts`: current Builder removal target, Undo, active Timer rejection, date guard, failed-save rollback.
- `today3-remove.spec.ts`: source/session preservation, exact rollback, completed removal, legacy identity stability.
- `phase72-toast-undo.spec.ts`: conflict-safe Undo, queue/lifetime, double-click protection.
- `dashboard-disclosure-context.spec.ts`: visible ellipsis and horizontal move labels.

P84-02 should replace assertions tied to `.todayBuilderBand` with dedicated-zone assertions while retaining all source, Timer, Undo, and rollback checks.
