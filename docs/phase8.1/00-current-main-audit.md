# P81-00 Current Main Audit

## Scope

- Baseline: `07904dd1c34b5f9bbc101a6dcae58a71a6bb4fd9`
- Audit date: 2026-09-14
- This stage changes documentation only. No schema, migration, UI, version, or release code is changed.
- The existing completion reward animation is already implemented and covered by regression tests. Phase 8.1 must reuse it rather than implement another animation path.
- The existing Timer hover/time presentation and HTML instruction rendering are also treated as completed behavior.

## Current ownership

### Project and NextStep

`Project` is one flat persisted object. It owns project metadata and every current NextStep field:

- project: `id`, `name`, `northStar`, `weeklyFocus`, `colorId`
- NextStep content: `nextStep`, `nextStepTrigger`, freshness timestamps
- execution settings: `buttonIds`, timer overrides, `startNoteTemplate`
- instruction settings: `instructionPath`, `instructionOpenOnStart`

There is no separate NextStep entity or NextStep ID. Its stable source identity is `project:{Project.id}`. Completing a NextStep clears its text, trigger, and freshness fields, but intentionally leaves its execution and instruction settings on Project. An empty NextStep with retained settings is therefore valid legacy state.

### Wishlist

Wishlist is persisted as `inbox`. Each item has an optional stable `id`; current normalization supplies one for old entries. It owns text, optional Project relation, execution button IDs, and instruction settings. It does not own timer overrides. A Wishlist candidate resolves timer minutes from its linked Project and then global settings.

### Today3

Today3 is a daily execution snapshot. A Today item owns `sourceKey`, action text, trigger, Project ID, button IDs, instruction settings, timer minutes, and `done`. Array order is the persisted display order. Project name/color and concrete launcher action definitions are resolved by reference.

Editing a canonical source may deliberately re-snapshot its active Today item, but ordinary source changes must not rewrite Today3 silently. Removing a Today3 adoption is non-destructive and preserves the canonical source, Builder candidacy, Sessions, and completion history.

### Sessions and completion history

Session entries contain date, Project ID, label snapshot, start time, minutes, note, and manual flag. They do not contain a canonical `sourceKey`, Wishlist ID, or Today completion relation. Past Session labels and notes must never be reconstructed from the current source.

`sourceCompletions` is a separate immutable history for explicitly completed NextStep/Wishlist sources. Today3 `done`, Timer Sessions, and source completion are distinct facts.

## Existing edit surfaces

| Surface | Current path | Ownership implication |
| --- | --- | --- |
| Project add/edit | combined Project + NextStep dialog | one save currently updates the flat Project object |
| NextStep edit | same Project editor | not an independent persisted entity |
| Wishlist add | compact text registration | creates a Wishlist source only |
| Wishlist edit | Wishlist editor | may set Project, environment, and instruction |
| Today3/Builder edit | routes to canonical Project/Wishlist editor | source is canonical; Today3 is a snapshot |
| Weekly review | Project editor | shares Project persistence contract |
| Do Now | candidate switch only | no direct canonical edit action today |

## Save and rollback contract

Frontend `persistConfig` applies optimistic state, calls the Tauri save command, and rolls back only if the attempted object remains current. Rust serializes sanitized config under a write mutex, keeps backups, writes a temporary file, and renames it into place.

On Windows, the fallback path may remove the destination before the second rename. Backups provide recovery, but this fallback has a crash window and is not strict transactional storage. Phase 8.1 migration must therefore create a raw pre-migration backup before modifying the config and must not combine migration with unrelated writes.

## Migration hazards

1. The current config is version 2 in both Zod and Rust.
2. Rust loads collections through field-level parsing. Changing the Project shape without a dedicated v2 decoder can cause the complete Project array to fall back instead of migrating each valid Project.
3. Zod parsing is used at load, save, restore, and Undo boundaries. Unknown migration markers are stripped unless modeled explicitly.
4. Today3 source keys, order, `done`, and snapshots must remain byte-for-byte equivalent in meaning across migration.
5. Session files and `sourceCompletions` must not be backfilled from current Project/Wishlist text.
6. Generated Rust JSON Schema currently omits `today.candidateExcludedSourceKeys` and `today.selectionMutationTokens` despite runtime ownership and `additionalProperties: false`. The schema must be reconciled before it is used as a migration validator.
7. Future config versions must be rejected explicitly; interpreting them as v2 risks destructive downgrade.

## Existing behavior to preserve

- stable source identity: `project:{id}` and `wishlist:{stable-id}`
- Today3 maximum, duplicate prevention, order, D&D, adoption removal, Undo, and save rollback
- active/paused Timer guards
- immutable Session and source-completion snapshots
- completion feedback for Today3, Do Now, 3/3, victory repeat, and reduced motion
- instruction paths, launcher environments, timer snapshots, and per-source settings

## Audit conclusion

A structural migration is feasible only with a dedicated v2 decoder, pure v2-to-v3 transform, pre-migration backup, complete validation, and idempotence tests. The recommended destination is documented in [00-schema-strategy.md](./00-schema-strategy.md). It requires human approval before implementation.
