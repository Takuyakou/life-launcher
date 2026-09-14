# P81-00 Migration Matrix

## Required cases

| Case | v2 input | Expected v3 result | Must remain unchanged | Required test |
| --- | --- | --- | --- | --- |
| Active NextStep | non-empty `nextStep` with settings | one optional NextStep object containing content and settings | Project ID, source identity | exact field mapping |
| Active minimal NextStep | text only | NextStep object with defaults represented as absent | semantic defaults | round trip |
| Empty NextStep, no retained settings | empty text and no optional execution values | `nextStep` absent; no pending settings | Project metadata | no phantom candidate |
| Empty NextStep, retained settings | empty text with buttons/timers/note/instruction | `nextStep` absent; one pending legacy settings object | all retained values | no data loss |
| Whitespace NextStep | whitespace-only content | treat as empty using current candidate semantics | raw recovery backup | deterministic normalization |
| Multiple Projects | mixed active/empty Projects | migrate each independently | array order and IDs | no collection fallback |
| Same text, different sources | matching text on two Projects/Wishlist items | identities remain distinct | source keys and Today relation | no text-based merge |
| Wishlist with stable ID | current item | structurally unchanged | ID and candidate key | identity equality |
| Legacy Wishlist without ID | old item | normalize one stable ID using existing compatibility path | text/relation/settings | reload keeps same ID |
| Today3 active | source snapshots and order | structurally unchanged | every Today value | deep equality |
| Today3 completed | `done: true` | completed snapshot unchanged | completion state and animation non-trigger on load | reload regression |
| Today candidate exclusion | current key list | unchanged | day and keys | Builder regression |
| Today mutation tokens | current token map | unchanged | all tokens | Undo regression |
| Source completions | existing history | unchanged | all snapshots | deep equality |
| Session files | existing daily files | no migration write | all entries | file hash/no-write test |
| Launcher actions | existing buttons | unchanged | IDs/actions/order | reference integrity |
| Future version | `version > 3` | reject with recoverable error | original file | no downgrade |
| Invalid v2 Project | malformed required field | reject migration; retain original and backup | all source data | no default-array replacement |
| Interrupted migration | backup exists, target invalid/missing | deterministic recovery path | original bytes | recovery test |
| Re-run migrated config | valid v3 input | no transform and no second prompt marker | complete config | idempotence |

## Pending legacy settings behavior

| User action | Result | Persistence rule |
| --- | --- | --- |
| Opens new NextStep dialog | offer `引き継ぐ` / `使わない` when pending exists | do not mutate yet |
| Cancels dialog | no new NextStep | pending remains |
| Selects inherit and save succeeds | values copied to new NextStep | pending cleared in same save |
| Selects discard and save succeeds | new NextStep uses explicit/default values | pending cleared in same save |
| Save fails | optimistic UI rolls back; draft remains | pending remains |
| Completes a v3 NextStep later | NextStep removed/cleared per approved design | must not create migration-pending state |

## Source lifecycle matrix

| Operation | Canonical source | Existing Today3 snapshot | Builder | Session/history |
| --- | --- | --- | --- | --- |
| Edit active NextStep | update | explicit same-source re-snapshot only | reflects canonical source | unchanged |
| Replace completed NextStep | create replacement | old adopted snapshot unchanged | replacement becomes candidate | unchanged |
| Remove Today3 adoption | unchanged | remove selected card | source remains candidate | unchanged |
| Complete NextStep source | clear/remove current NextStep | remove matching adoption | no current candidate | append source completion only |
| Delete Project | delete Project/source | remove matching adoption | remove candidate | existing history retained by snapshot |
| Promote linked Wishlist | P81-05 decision | no implicit overwrite | depends on approved flow | unchanged |
| Promote unassigned Wishlist | require explicit Project selection | no implicit Project creation | depends on approved flow | unchanged |

## Validation gates

Migration implementation is not complete unless all of the following pass:

1. Pure transform fixture tests for every required case above.
2. v2 load, migrate, save, reload, and second reload are semantically identical.
3. A failed validation never replaces `projects`, `today`, `inbox`, or history with defaults.
4. Raw pre-migration backup is created before the first v3 write.
5. Rollback/recovery is exercised at backup, temp-write, and replace boundaries where testable.
6. TypeScript schema, Rust model, and generated JSON Schema accept the same owned fields.
7. Existing Today3 D&D/Undo, Timer, completion reward, source completion, and Session regressions pass.
8. The standard public repository check reports no private paths or packaged internal artifacts.

## Decisions intentionally deferred

- Whether Wishlist promotion consumes or retains the Wishlist item belongs to P81-05.
- Whether a new Wishlist without a linked Project uses only global timer defaults or receives an explicit timer owner needs approval with the later UI contract.
- Final copy and exact UI placement for pending-setting inheritance belongs to its implementation stage.

These deferred decisions do not block approval of the structural migration strategy, but production code must not guess them.
