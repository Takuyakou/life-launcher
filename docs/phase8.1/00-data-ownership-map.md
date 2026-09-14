# P81-00 Data Ownership Map

## Canonical and snapshot boundaries

| Data | Canonical owner | Stable identity | Snapshot/reference rule | Migration rule |
| --- | --- | --- | --- | --- |
| Project metadata | `config.projects[]` | `Project.id` | Today resolves current name/color by `projectId` | Preserve IDs and metadata |
| Current NextStep | v2 `Project` fields | `project:{Project.id}` | Today copies execution fields at adoption | Move fields together; do not mint a new identity |
| Wishlist | `config.inbox[]` | `wishlist:{InboxItem.id}` | Today copies execution fields at adoption | Preserve/generate stable item ID once |
| Today3 | `config.today.items[]` | `TodayItem.sourceKey` | Daily execution snapshot | Do not regenerate from sources |
| Builder exclusion | `config.today.candidateExcludedSourceKeys[]` | canonical source key | same-day control state | Preserve keys unchanged |
| Builder mutation token | `config.today.selectionMutationTokens` | source key map | Undo/concurrency guard | Preserve unchanged |
| Source completion | `config.sourceCompletions[]` | completion ID + source identity | immutable completion snapshot | Never rebuild from current source |
| Timer Session | daily Session file | optional Session ID | immutable execution snapshot | Do not migrate from config text |
| Launcher action | `config.buttons[]` | button ID | sources/Today reference IDs | Preserve references and definitions |
| Instruction file | filesystem | path and folder identity | config stores path/reference | Preserve path and open-on-start flag |
| Global timer defaults | `config.settings` | setting name | copied into Today at adoption | Keep existing defaults |

## v2 Project field disposition

| v2 field | Semantic owner | Proposed v3 location |
| --- | --- | --- |
| `id` | Project | `Project.id` |
| `name` | Project | `Project.name` |
| `northStar` | Project | `Project.northStar` |
| `weeklyFocus` | Project | `Project.weeklyFocus` |
| `colorId` | Project | `Project.colorId` |
| `nextStep` | NextStep | `Project.nextStep.text` when non-empty |
| `nextStepTrigger` | NextStep | `Project.nextStep.trigger` |
| `nextStepUpdatedAt` | NextStep | `Project.nextStep.updatedAt` |
| `nextStepReviewedAt` | NextStep | `Project.nextStep.reviewedAt` |
| `buttonIds` | NextStep execution | `Project.nextStep.buttonIds` or pending legacy settings |
| `defaultTimerMinutes` | NextStep execution | `Project.nextStep.defaultTimerMinutes` or pending legacy settings |
| `shortTimerMinutes` | NextStep execution | `Project.nextStep.shortTimerMinutes` or pending legacy settings |
| `startNoteTemplate` | NextStep execution | `Project.nextStep.startNoteTemplate` or pending legacy settings |
| `instructionPath` | NextStep execution | `Project.nextStep.instructionPath` or pending legacy settings |
| `instructionOpenOnStart` | NextStep execution | `Project.nextStep.instructionOpenOnStart` or pending legacy settings |

## Empty NextStep ownership

In v2, completing a Project NextStep removes content but leaves execution and instruction fields. Dropping those fields during migration would lose user configuration. Creating an empty v3 NextStep would incorrectly create a candidate.

The proposed owner is therefore optional `Project.legacyNextStepSettings`. It is a durable, Project-local pending object and not a global migration flag. On the first explicit creation of a new NextStep for that Project, the user can choose whether to inherit or discard it. Cancellation and save failure leave it pending.

## Reference integrity rules

1. A Project NextStep keeps `project:{id}`. Separating the data shape does not change identity.
2. Wishlist stable IDs remain unchanged. Legacy aliases may be accepted only as compatibility input, never written as the new canonical identity.
3. Today3 `sourceKey`, text, order, `done`, timer minutes, instruction path, and environment IDs are preserved as existing snapshots.
4. Editing a source and explicitly re-snapshotting Today3 remains one config save with rollback.
5. Replacing a completed NextStep is a distinct workflow from editing the source represented by an existing Today3 card. A replacement must not overwrite that old card snapshot.
6. Session labels/notes and source-completion snapshots are historical data. They are never rewritten when a Project, NextStep, or Wishlist changes.

## Write authorities

| Operation | May write | Must not write |
| --- | --- | --- |
| Project metadata edit | Project metadata | Today snapshot, Sessions, history |
| NextStep edit | current NextStep and explicit same-source Today re-snapshot | Sessions, completion history |
| New NextStep after completion | new NextStep, optional pending-setting consumption | old Today snapshot, Sessions, history |
| Wishlist edit | Wishlist and explicit same-source Today re-snapshot | Sessions, history |
| Today adoption/reorder/remove | Today state and Undo token/exclusion as specified | canonical source, Sessions, history |
| Timer completion | Session and applicable Today `done` | canonical source completion |
| Source completion | canonical source removal/clear, Today adoption removal, source-completion snapshot | Sessions |
| Migration | config version and structural equivalents | semantic values, Session files, source history |

## Known schema gap

The runtime TypeScript and Rust models own `candidateExcludedSourceKeys` and `selectionMutationTokens`, but the generated Rust JSON Schema does not currently describe them. P81 implementation must make the runtime model and validation schema agree before treating schema validation as authoritative.
