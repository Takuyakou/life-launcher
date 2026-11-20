export const SESSION_MINIMUM_MINUTES = 1;

export type TimerMode = "countdown" | "measure";

export type TimerTimingState = {
  mode: TimerMode;
  startedAtMs: number;
  targetMinutes: number | null;
  paused: boolean;
  pausedStartedAtMs: number | null;
  pausedTotalMs: number;
  // V151-S7: the moment the planned time ran out, while the 「予定時間になりました」 prompt waits.
  // Time after it is not counted until 続ける(+15分) moves it into pausedTotalMs.
  expiredAtMs?: number | null;
};

export type TimerMetrics = {
  elapsedSeconds: number;
  remainingSeconds: number | null;
};

export function timerMetrics(timer: TimerTimingState, now: number): TimerMetrics {
  const at = timer.expiredAtMs != null ? Math.min(now, timer.expiredAtMs) : now;
  const currentPauseMs =
    timer.paused && timer.pausedStartedAtMs ? at - timer.pausedStartedAtMs : 0;
  const elapsedMs = Math.max(0, at - timer.startedAtMs - timer.pausedTotalMs - currentPauseMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remainingSeconds =
    timer.mode === "countdown" && timer.targetMinutes !== null
      ? timer.targetMinutes * 60 - elapsedSeconds
      : null;
  return { elapsedSeconds, remainingSeconds };
}

export function sessionMinutes(timer: TimerTimingState, now: number): number {
  return Math.floor(timerMetrics(timer, now).elapsedSeconds / 60);
}

export function isSessionRecordable(timer: TimerTimingState, now: number): boolean {
  return sessionMinutes(timer, now) >= SESSION_MINIMUM_MINUTES;
}

export function timerHasExpired(timer: TimerTimingState, now: number): boolean {
  const remaining = timerMetrics(timer, now).remainingSeconds;
  return remaining !== null && remaining <= 0;
}

/** V151-S7: the exact moment a running countdown reached its planned time. */
export function plannedEndAtMs(timer: TimerTimingState): number | null {
  if (timer.mode !== "countdown" || timer.targetMinutes === null || timer.paused) return null;
  return timer.startedAtMs + timer.pausedTotalMs + timer.targetMinutes * 60_000;
}
