# P84-00 Do Now Ranking Audit

## Baseline

Baseline commit: `d180045`.

## Current Backend Algorithm

`load_do_now_candidates` loads current config and Session entries, resolves the current day with the configured day-start boundary, and calls `build_do_now_candidates`.

Current eligibility is:

```text
weeklyFocus == true AND non-empty NextStep
```

For each eligible Project it calculates:

- latest `startedAt` among Sessions whose `date` is today;
- latest Session date across all history, used only for the 14-day restart flag;
- Project array index as manual order.

Current sort order is:

1. no Session today;
2. among Projects used today, earlier latest `startedAt` first;
3. Project/config order.

Reasons are `noToday`, `oldestToday`, or `manualOrder`. `restartEligible` is true only when an existing latest Session date is at least 14 days before today; a Project with no Session is not a restart case.

## Current Frontend Behavior

- Candidate IDs from Rust are joined back to current config Projects.
- Index 0 is shown by default.
- `他の一手` appears only for two or more candidates and cycles modulo the backend order.
- Cycling changes React state only; it does not save config or mutate a source.
- Timer, Measure, launcher actions, trigger, and instruction behavior all come from the selected Project's current NextStep.
- Config changes and successful Session recording refresh candidates.

Current empty state depends on `focusedProjects`:

- focused Project exists but none has a valid candidate: prompt to set its NextStep;
- no focused Project: prompt to choose weekly focus.

That empty-state contract becomes incorrect once weeklyFocus stops being an eligibility filter.

## Required P84-03 Algorithm

Eligibility becomes:

```text
non-empty NextStep on any Project
```

Deterministic ranking keys, in order:

1. weeklyFocus ON before OFF;
2. no Session today before already used today;
3. older latest Session before newer latest Session; no Session history sorts as oldest;
4. Project/config array index.

The all-history latest Session used by key 3 must use the app's stored date and start-time data consistently. The 14-day restart calculation remains independent and unchanged in meaning.

`他の一手` must cycle through every eligible NextStep in that sorted order, including weeklyFocus-OFF Projects. It must remain non-persistent.

The Do Now empty state should appear only when no Project has a non-empty NextStep. A weeklyFocus count of zero is no longer an empty-state reason. A focused Project without a NextStep is not eligible, but an unfocused Project with a NextStep is.

## Explicit Non-Changes

- Do not reuse Today Picker candidate generation.
- Do not include Wishlist items in Do Now.
- Do not change Timer, Measure, action launch, trigger, instruction, early-completion, or 14-day UI behavior.
- Do not mutate weeklyFocus, Project order, NextStep, Today3, or config while cycling.

## Existing Tests And Required Additions

Existing Rust tests cover today's no-session/oldest/manual-order rules, exclusion of non-focus Projects, exclusion of empty NextSteps, and the 14-day boundary. Existing Playwright tests cover `他の一手`, context-menu parity, single-candidate hiding, Timer linkage, and completion behavior.

P84-03 must revise the old non-focus exclusion test and add table-driven Rust cases for:

- weeklyFocus ON outranks OFF even when the OFF Project is older;
- weeklyFocus zero with valid NextSteps still returns candidates;
- focused without NextStep is excluded while unfocused with NextStep remains;
- today-not-run outranks today-run inside each focus tier;
- all-history oldest and never-run ordering;
- manual-order tie break;
- every eligible candidate appears exactly once;
- 14-day restart remains correct.

Playwright must verify the revised empty state and that `他の一手` reaches an unfocused eligible Project without persisting config.
