import { expect, test } from "@playwright/test";
import { earlyCompletionItem } from "../../src/earlyCompletion";
import {
  SESSION_MINIMUM_MINUTES,
  isSessionRecordable,
  sessionMinutes,
  timerHasExpired,
  timerMetrics,
  type TimerTimingState,
} from "../../src/timerRuntime";
import type { TodayItem } from "../../src/types";

function timer(overrides: Partial<TimerTimingState> = {}): TimerTimingState {
  return {
    mode: "measure",
    startedAtMs: 1_000,
    targetMinutes: null,
    paused: false,
    pausedStartedAtMs: null,
    pausedTotalMs: 0,
    ...overrides,
  };
}

test("P82-02 measure starts at zero and counts elapsed without an expiration", () => {
  expect(timerMetrics(timer(), 1_000)).toEqual({ elapsedSeconds: 0, remainingSeconds: null });
  expect(timerMetrics(timer(), 91_999)).toEqual({ elapsedSeconds: 90, remainingSeconds: null });
  expect(timerHasExpired(timer(), 86_401_000)).toBe(false);
});

test("P82-02 pause is excluded and resume continues from the frozen elapsed value", () => {
  const paused = timer({ paused: true, pausedStartedAtMs: 31_000 });
  expect(timerMetrics(paused, 91_000).elapsedSeconds).toBe(30);
  const resumed = timer({ pausedTotalMs: 60_000 });
  expect(timerMetrics(resumed, 121_000).elapsedSeconds).toBe(60);
});

test("P82-02 SessionMinimum is shared at the exact one-minute boundary", () => {
  expect(SESSION_MINIMUM_MINUTES).toBe(1);
  expect(sessionMinutes(timer(), 60_999)).toBe(0);
  expect(isSessionRecordable(timer(), 60_999)).toBe(false);
  expect(sessionMinutes(timer(), 61_000)).toBe(1);
  expect(isSessionRecordable(timer(), 61_000)).toBe(true);
});

test("P82-02 countdown keeps its remaining and expiration behavior", () => {
  const countdown = timer({ mode: "countdown", targetMinutes: 5 });
  expect(timerMetrics(countdown, 1_000)).toEqual({
    elapsedSeconds: 0,
    remainingSeconds: 300,
  });
  expect(timerHasExpired(countdown, 300_999)).toBe(false);
  expect(timerHasExpired(countdown, 301_000)).toBe(true);
});

test("P82-02 measure uses the Today snapshot threshold without an upper target", () => {
  const item: TodayItem = {
    text: "計測対象",
    done: false,
    sourceKey: "project:sample",
    sourceGenerationId: "generation-a",
    shortTimerMinutes: 5,
  };
  const measure = {
    sourceId: "sample",
    sourceGenerationId: "generation-a",
    projectId: "sample",
    targetMinutes: null,
  };
  expect(earlyCompletionItem([item], measure, 299)).toBeUndefined();
  expect(earlyCompletionItem([item], measure, 300)).toBe(item);
  expect(earlyCompletionItem([item], measure, 60 * 240)).toBe(item);
});
