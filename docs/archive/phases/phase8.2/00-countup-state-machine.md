# Phase 8.2 Count-up State Machine Audit

## Existing countdown engine

The current Timer is one in-memory `ActiveTimer` mirrored by React state and `activeTimerRef`. It contains an instance ID, source identity/generation, Project, label/note snapshots, start timestamps, target minutes, and pause accounting.

Shared engine points:

- `timerMetrics`: excludes active and accumulated pause time, then returns elapsed and remaining seconds.
- `sessionMinutes`: floors effective elapsed seconds to whole minutes.
- `startTimer`: finalizes the previous Timer with reason `switch`, checks the start request ID, then starts the clicked Timer automatically.
- `finishTimer`: validates instance/stale-operation guards, handles expiration and early-completion eligibility, then delegates Session persistence.
- `recordTimerSession`: applies the one-minute minimum and appends the Session once.
- `togglePause`: freezes and resumes effective elapsed time.
- `continueCompletedTimer` / `finishCompletedTimer`: countdown-only expiration flow, extension, planned completion, reward, and source follow-up.
- Mini mode receives a snapshot from this same state and sends pause/finish commands back to the same handlers.

There is no count-up engine and no persisted active Timer schema to migrate.

## Current states and transitions

```text
idle
  └─ start countdown ─> running

running
  ├─ pause ─> paused
  ├─ manual end ─> early-completion decision or finalize ─> idle
  ├─ target reached ─> completion prompt
  └─ start another timer ─> finalize(reason=switch) ─> new running

paused
  ├─ resume ─> running
  ├─ manual end ─> early-completion decision or finalize ─> idle
  └─ start another timer ─> finalize(reason=switch) ─> new running

completion prompt
  ├─ continue +15m ─> running
  └─ complete ─> Session, optional Today completion/reward/follow-up ─> idle
```

Guards already shared by the engine:

- `instanceId` rejects stale stop callbacks.
- `timerStartRequestRef` rejects stale starts after asynchronous switch finalization.
- `finishingTimerRef`, `earlyStopRef`, and `plannedCommitRef` prevent overlapping writes and double completion.
- `activeTimerRef` makes handlers check the latest Timer rather than a stale render.
- Source edits use canonical stable identity and reject the active or paused source.

## Count-up extension design for P82-02

Add a mode discriminator to the existing Timer state, not a second hook or component engine:

```text
mode = countdown | measure
```

Keep the shared source, note, action, instruction, pause, instance, switch, and Session fields. Countdown keeps `targetMinutes`; measure displays effective `elapsedSeconds` from the same pause-aware clock.

Recommended metric contract:

| Mode | Display clock | Expiration | Progress |
| --- | --- | --- | --- |
| countdown | `max(remaining, 0)` | target at zero | bounded elapsed/target |
| measure | elapsed from `0:00` | none | no fabricated target; UI hides or uses neutral non-percent treatment |

The mode branch belongs in metrics/presentation and the countdown expiration effect. It must not fork source execution, pause, Session append, switch, or stale-operation guards.

## Measure transitions

| From | Event | Required result |
| --- | --- | --- |
| idle | start measure | Start at `0:00`; run current start actions and instruction behavior |
| measure running | tick | Increase pause-excluded elapsed clock; never open expiration prompt or send OS completion notification |
| measure running | pause | Use current pause transition |
| measure paused | resume | Use current resume transition; paused wall time stays excluded |
| measure | manual end under 1 minute | Clear Timer, show existing no-record feedback, and do not create Session, Today completion, reward, follow-up, or source mutation |
| measure | manual end at least 1 minute but below Today early threshold | Save Session through the current path; do not mark Today complete |
| measure | manual end meeting Today early threshold | Reuse the current explicit early-completion decision; measure has no upper target boundary |
| measure | start countdown/measure | Finalize old Timer with `switch`; after success automatically start the originally clicked new Timer |
| countdown | start measure | Finalize countdown with the same `switch` contract, then start measure automatically |
| any active | duplicate/stale finish | Existing instance and in-flight guards reject it |

Switch remains non-interactive: it never opens the early-completion dialog because the existing dialog is manual-end-only.

## Session minimum

The current minimum is behaviorally centralized in `recordTimerSession` as `minutes < 1`, but it is not a named domain constant. P82-02 should expose one shared `SessionMinimum`/helper and route countdown and measure through it. The change must preserve floor-to-whole-minute behavior and the current `1分未満なので記録しませんでした` feedback for manual and switch endings.

## Mini and UI handoff

The current mini snapshot contains a remaining clock and percentage progress only. P82-02/P82-03 must add enough mode information for mini to display elapsed time without inventing a target, while keeping the same pause/resume/end command grammar.

Do Now and Today3 must call the same start entry with `measure`; they must not duplicate action execution or instruction opening. P82-03 then adds the compact neutral controls and reuses the existing hover/focus animation contract.

## Risks to cover before implementation is accepted

- A measure Timer accidentally entering countdown expiration, notification, extension, or planned-completion paths.
- A sub-minute measure Timer triggering Today3 completion/reward/follow-up before the Session minimum gate.
- Async switch completing the wrong instance or requiring a second click.
- Mini showing countdown semantics for measure or issuing commands to stale state.
- Today3 direct source and Do Now Project source resolving to the wrong generation.
- Save failure clearing the active Timer or causing a duplicate Session append on retry.

Required automated matrix: 0 start, tick, pause/resume, under/at one minute, below/at early threshold, manual end, measure-to-countdown, countdown-to-measure, measure-to-measure, stale/double stop, Session failure/retry, Today3 source/generation, mini synchronization, and single-active enforcement.
