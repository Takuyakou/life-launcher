# P81-00 Schema Strategy

## Recommendation

Adopt **Strategy A: config version 3 with an optional Project-owned NextStep object**.

This is a proposal for human approval. P81-00 does not implement it.

```ts
type NextStepV3 = {
  generationId?: string;
  text: string;
  trigger?: string;
  updatedAt?: string;
  reviewedAt?: string;
  buttonIds: string[];
  defaultTimerMinutes?: number;
  shortTimerMinutes?: number;
  startNoteTemplate?: string;
  instructionPath?: string;
  instructionOpenOnStart?: boolean;
};

type LegacyNextStepSettingsV3 = Omit<
  NextStepV3,
  "generationId" | "text" | "trigger" | "updatedAt" | "reviewedAt"
>;

type ProjectV3 = {
  id: string;
  name: string;
  northStar?: string;
  weeklyFocus?: boolean;
  colorId?: ProjectColorId;
  nextStep?: NextStepV3;
  legacyNextStepSettings?: LegacyNextStepSettingsV3;
};

type TodayItemV3 = {
  sourceKey?: string;
  sourceGenerationId?: string;
  // existing Today snapshot fields remain unchanged
};
```

Exact schema syntax may change during implementation, but the ownership and migration rules below are normative.

## Final review amendment: NextStep generation boundary

Final review found that `project:{Project.id}` identifies the canonical NextStep family but cannot distinguish two successive NextSteps in the same Project, especially when their text is identical. Phase 8.1 therefore adds the smallest compatible boundary inside unreleased config v3:

- optional `NextStep.generationId`;
- optional `TodayItem.sourceGenerationId`;
- no config version change;
- no `sourceKey` format change.

Missing values mean the legacy generation. Migrated v2 NextSteps and existing Today3 snapshots remain absent rather than receiving generated values. A new NextStep created by set, replacement, or Wishlist promotion receives a stable generation marker. Editing preserves it, and Today3 adoption copies it.

## Why this strategy

1. It separates Project metadata from the current executable step without creating a new top-level collection.
2. It keeps the proven stable source family `project:{Project.id}` and avoids migration of Today3 source keys, while an optional generation marker separates successive NextSteps.
3. It represents “Project exists but has no current NextStep” directly.
4. It lets the combined editor remain an implementation choice while making data ownership explicit.
5. It can preserve settings left behind by v2 completion without manufacturing an empty candidate.

## Strategy comparison

| Criterion | A. Project内optional object | B. flat fields維持/UI分離 | C. 別NextStep entity |
| --- | --- | --- | --- |
| Migration risk | medium; dedicated v2 decoder required | low initially, ambiguity remains | high; identity/reference migration required |
| Today3 identity | `project:{id}`を維持 | 維持 | mapping layer or key migrationが必要 |
| Current code/test impact | bounded to Project access and editors | smallest now, repeated future cost | broad across Builder/Today/Timer/history |
| Wishlist promotion | Projectへ明示的にstepを作れる | ownership ambiguity persists | flexible but excessive for one current step |
| Rollback safety | one config transform with backup | no schema transform | multiple collections/references must agree |
| Config compatibility | version dispatchで明確 | v2互換だが意味が曖昧 | version dispatch + referential validation |
| Public release safety | gated migration testsで管理可能 | latent data-ownership bugs remain | blast radiusが大きい |

Strategy A is the smallest structural change that resolves ownership without changing source identity.

## Alternatives rejected

### B. Keep the flat v2 Project forever

This avoids migration now but preserves ambiguous ownership. Future replace/edit/promotion flows would continue to infer whether Project-level settings belong to metadata, an old completed step, or a new step.

### C. Create a top-level NextStep collection with new IDs

This adds identity migration and referential complexity without a current need for multiple simultaneous NextSteps per Project. Today3 keys, completion history, and every editor path would need additional mapping.

### Put retained settings into global defaults

The values are Project-specific user choices. Promoting them to global settings would change other sources and is semantically destructive.

## Migration algorithm

1. Read raw config bytes and inspect `version` before current-model parsing.
2. Reject unsupported future versions without writing.
3. Decode version 2 through a dedicated complete v2 schema/model.
4. Create a raw pre-migration backup before any target write.
5. Transform with a pure function:
   - non-empty NextStep: move content and all owned settings into `Project.nextStep`;
   - leave `generationId` absent so migrated data remains in the legacy generation;
   - empty NextStep with retained settings: put settings in `legacyNextStepSettings`;
   - empty NextStep without settings: omit both objects;
   - preserve all unrelated collections and ordering.
6. Validate the full v3 object in Rust and TypeScript-compatible schema terms.
7. Persist using the existing serialized write path.
8. Consider the load migration successful only after full in-memory v3 validation, raw backup creation, and successful atomic replacement. Serialize/decode round trips are covered by migration tests.
9. On subsequent loads, validate v3 directly and never run the v2 transform again.

## Invariants

- No top-level NextStep entity or new source identity is minted; source identity remains Project-based.
- The optional generation marker is not a new source key. `project:{id}` remains canonical for Builder membership and source lookup.
- v2 migration does not mint generation markers or rewrite existing Today3. Missing NextStep and Today generation fields form the legacy generation.
- New set/replacement/promotion mints one stable marker; edit preserves it; adoption copies it.
- Completion, source re-snapshot, and direct Do Now-to-Today mapping may affect a Today snapshot only when its generation matches the current NextStep, including absent-to-absent legacy matching.
- Today3 is not rebuilt, reordered, completed, or re-snapshotted by migration.
- Wishlist IDs and source keys remain stable.
- Session files and source completion history are not edited.
- Missing optional values remain missing; migration does not freeze current global defaults into every source.
- Failed decode or validation never substitutes an empty/default Project collection.
- `legacyNextStepSettings` is mutually exclusive with an active `nextStep` after successful writes.
- Pending settings are removed only in the same successful save that explicitly inherits or discards them.
- Ordinary v3 NextStep completion does not create `legacyNextStepSettings`; it is a migration-only compatibility state.

## Edit and replacement semantics

An editor opened from Builder or Today3 edits the canonical source represented by that item. If current behavior explicitly re-snapshots matching Today3, it may continue to do so in one rollback-capable save.

Creating a new NextStep after the previous source was completed is replacement, not editing the historical snapshot. It receives a new `generationId`. Existing Today3 cards keep their previous `sourceGenerationId` and Sessions remain unchanged. Handlers must compare generations rather than infer the current incarnation from Project ID or matching text.

## Validation/schema alignment required before migration

Before v3 is written, implementation must align:

- TypeScript Zod config schema;
- Rust serde models and version dispatch;
- generated JSON Schema, including Today exclusion keys and mutation tokens;
- backup/restore parsing;
- Undo config parsing;
- fixtures for both v2 and v3.

The app must retain a readable error and recovery path if the original file is invalid. A migration must not be reported as successful before validation, backup, and replacement succeed.

## Approval questions for later stages

The structural recommendation can be approved now. These behavior choices remain gated in their designated stages:

- Wishlist promotion consume/retain behavior;
- unassigned Wishlist Project-selection UI;
- timer ownership for new unlinked Wishlist items;
- final pending-settings inheritance copy and placement.

No production migration should begin until Strategy A and the invariants above are approved.
