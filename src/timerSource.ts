import type { TodayItem } from "./types";

type TimerSourceRef = {
  sourceId: string;
  sourceGenerationId?: string;
  projectId: string | null;
};

type TodayEntry = { item: TodayItem; sourceKey: string };

/** Strict generation match: both missing is a match (legacy data), only one present is not. */
export function sameSourceGeneration(a: string | undefined, b: string | undefined): boolean {
  return a === b;
}

/** The Today source key a running Timer belongs to, or null (sidebar, wishlist, manual start). */
export function timerTodaySourceKey(timer: Pick<TimerSourceRef, "sourceId" | "projectId">) {
  if (timer.sourceId.startsWith("today:")) return timer.sourceId.slice("today:".length);
  return timer.projectId && timer.sourceId === timer.projectId ? `project:${timer.projectId}` : null;
}

/**
 * The unfinished Today item the Timer counts for. Completion, the early-completion check and the
 * running display all use this, so "the same action" has one definition.
 */
export function findTodayEntryForTimer<T extends TodayEntry>(
  entries: T[],
  timer: TimerSourceRef,
): T | undefined {
  const key = timerTodaySourceKey(timer);
  return entries.find(
    ({ item, sourceKey }) =>
      !item.done &&
      key !== null &&
      sourceKey === key &&
      sameSourceGeneration(item.sourceGenerationId, timer.sourceGenerationId),
  );
}

/**
 * Whether the Timer is running the Project's current Next Step: started from the Project itself,
 * or from the Today item adopted from this very Next Step generation.
 */
export function timerMatchesProjectNextStep(
  timer: TimerSourceRef,
  projectId: string,
  nextStepGenerationId: string | undefined,
): boolean {
  if (timer.sourceId === projectId) return true;
  return (
    timer.sourceId.startsWith("today:") &&
    timerTodaySourceKey(timer) === `project:${projectId}` &&
    sameSourceGeneration(nextStepGenerationId, timer.sourceGenerationId)
  );
}

/** Whether the Timer counts for this Today item: its own Timer, or the same action started elsewhere. */
export function timerRunsTodayItem(
  entries: TodayEntry[],
  timer: TimerSourceRef | null,
  ownTimerSourceId: string,
  sourceKey: string,
): boolean {
  if (!timer) return false;
  return (
    timer.sourceId === ownTimerSourceId ||
    findTodayEntryForTimer(entries, timer)?.sourceKey === sourceKey
  );
}
