import type { TodayItem } from "./types";

export function earlyCompletionThresholdSeconds(snapshot: unknown): number {
  const minutes =
    typeof snapshot === "number" && Number.isInteger(snapshot) && snapshot >= 1 && snapshot <= 240
      ? snapshot
      : 5;
  return Math.min(5, minutes) * 60;
}

export function earlyCompletionItem(
  items: TodayItem[],
  timer: { sourceId: string; projectId: string | null; targetMinutes: number },
  elapsedSeconds: number,
): TodayItem | undefined {
  if (elapsedSeconds >= timer.targetMinutes * 60) return;
  // Direct Today identity must not also complete a different Project adoption.
  const key = timer.sourceId.startsWith("today:")
    ? timer.sourceId.slice("today:".length)
    : timer.projectId && timer.sourceId === timer.projectId
      ? `project:${timer.projectId}`
      : null;
  const matches = items.filter((item) => item.sourceKey?.trim() === key);
  const item = matches.length === 1 ? matches[0] : undefined;
  return item &&
    !item.done &&
    elapsedSeconds >= earlyCompletionThresholdSeconds(item.shortTimerMinutes)
    ? item
    : undefined;
}
