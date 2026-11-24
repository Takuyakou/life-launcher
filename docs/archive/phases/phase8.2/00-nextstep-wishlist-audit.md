# Phase 8.2 NextStep and Wishlist Audit

## Current ownership model

```text
AppConfig
├─ projects[]
│  └─ nextStep?: one Project-owned execution package
├─ inbox[]: Wishlist items in one global manual-order array
└─ today.items[]: at most three adopted snapshots
```

- A Project owns zero or one NextStep. No multiple-NextStep structure exists.
- A Wishlist item owns text, stable ID, optional Project ownership, and legacy-compatible optional action/instruction fields.
- Today Builder derives candidates from current Project NextSteps followed by Wishlist items.
- Today3 keeps an adoption snapshot; choosing a Wishlist task does not remove or complete the Project NextStep.

## Current UI and behavior

### NextStep

- The section renders in canonical `config.projects` order, including Projects without a NextStep.
- Project and NextStep have separate pointer, keyboard, and context targets.
- Existing actions are set/edit, Today adoption through context menu, and clear.
- Current copy still describes the older operational model and does not yet say that NextStep is a restart point.

### Wishlist

- The section is one flat list in `config.inbox` order.
- D&D and up/down actions reorder the entire inbox array and save on drop/action.
- Display state is global: 0-5 shows all, 6-19 can expand from five, and 20+ uses one global page.
- Rows show Project identity, text, and an ellipsis menu. There is no Project-group disclosure state.
- A persistent `今日へ` row button is already absent. The current context menu still exposes `今日へ`; it must not be described as a newly removed persistent control in Phase 8.2.
- `次の一手にする` is already in the ellipsis/context menu and is not a persistent row button.
- Builder exclusion and `候補に戻す` already use stable source identity and the existing rollback/Undo contract.

## Gap: safe NextStep replacement

Current Wishlist promotion opens the NextStep editor with reset execution settings. If the target Project already has a NextStep, saving is blocked until a replacement checkbox is selected. A successful save then installs the new generation and removes the promoted Wishlist item in one config write.

This prevents accidental overwrite, but it does not implement the locked Phase 8.2 decision:

1. `やりたいことへ戻す`
2. `完了にする`
3. `キャンセル`

P82-01 must replace the checkbox gate with one shared decision flow. Until the final save succeeds, the old NextStep and promoted Wishlist item must both remain unchanged.

### Required result of each decision

| Decision | Old NextStep | New/promoted item | History and snapshots |
| --- | --- | --- | --- |
| やりたいことへ戻す | Add a new stable Wishlist item containing only text and Project ownership | Install as new NextStep generation | Preserve Today3 and Sessions; discard old NextStep execution settings rather than hiding them in Wishlist |
| 完了にする | Add immutable NextStep completion snapshot and clear current slot as part of replacement transaction | Install as new NextStep generation | Preserve adopted Today3 snapshots and Sessions |
| キャンセル | Unchanged | Unchanged | No write |

The transaction must not introduce a `保留` state, a second NextStep, or a hidden Wishlist execution payload.

## Gap: Project-grouped Wishlist

The existing data model can support the requested organization without a schema change:

- Group order derives from canonical `config.projects` order.
- Items within each group retain their relative order from `config.inbox`.
- Items without a valid Project render in `未分類` last.
- Same-group D&D can reorder the relevant inbox entries while preserving all other groups.
- Cross-Project D&D remains unsupported in Phase 8.2.
- Collapse state is presentation state and should not mutate config unless a later explicit contract says otherwise.

Pagination/compact-list behavior must become group-aware or be intentionally removed per the P82-01 layout, while stable focus continues to follow `item.id` after edit, delete, complete, promotion, and reorder.

## P82-01 handoff constraints

- Keep source identities `project:{Project.id}` and `wishlist:{InboxItem.id}`.
- Create a fresh NextStep `generationId` only for a new setting/replacement/promotion; preserve it for edit.
- Keep Today3 adoption snapshots and Session/source-completion history untouched by replacement unless the user explicitly chooses completion for the old NextStep.
- Reuse existing config persistence, source edit guard, confirmation ordering, Toast, and failure rollback paths.
- Do not reintroduce a persistent Wishlist `今日へ` action. Keep Today Builder as the canonical selection surface; reconcile the existing context action with P82-01's `existing relevant actions` requirement rather than silently expanding the removal scope.
- Add subtle `✓ 今日の3件` and existing `候補に戻す` state without turning status into a duplicate adoption action.

## Required P82-01 regression coverage

- Same-text Wishlist items remain distinct by stable ID.
- Return/complete/cancel replacement outcomes and failure rollback.
- No hidden old execution settings after return to Wishlist or later re-promotion.
- Group order, within-group manual order, no cross-group D&D, unassigned-last, and collapse behavior.
- Today3/Builder/excluded statuses, reload, keyboard context menu, focus recovery, long text, and 860-1440 layouts.
