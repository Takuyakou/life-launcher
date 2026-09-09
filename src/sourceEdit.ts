import type { AppConfig, TodayItem } from "./types";

export const SOURCE_EDIT_TIMER_REASON = "タイマーを停止してから編集してください";

export function canonicalSourceKey(config: AppConfig, key: string): string | null {
  const exact = [
    ...config.projects.filter(p => `project:${p.id}` === key).map(p => `project:${p.id}`),
    ...config.inbox.filter(i => i.id && `wishlist:${i.id}` === key).map(i => `wishlist:${i.id}`),
  ];
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const legacy = config.inbox.filter(i => i.id && `wishlist:${i.projectId ?? "none"}:${i.text.trim()}` === key);
  return legacy.length === 1 ? `wishlist:${legacy[0].id}` : null;
}

export function timerSourceKey(config: AppConfig, sourceId: string): string | null {
  return canonicalSourceKey(config, sourceId.startsWith("today:") ? sourceId.slice(6) : `project:${sourceId}`);
}

export function resnapshotSource(previous: AppConfig, next: AppConfig, key: string): AppConfig {
  const indices = previous.today.items.flatMap((item, index) =>
    item.sourceKey && canonicalSourceKey(previous, item.sourceKey) === key ? [index] : []);
  if (indices.length > 1) throw new Error("同じ登録に対応する今日の項目が複数あります");
  if (!indices.length) return next;
  const project = next.projects.find(p => `project:${p.id}` === key);
  const inbox = next.inbox.find(i => `wishlist:${i.id}` === key);
  if (!project && !inbox) throw new Error("元の登録が見つかりません");
  const linkedProject = project ?? next.projects.find(p => p.id === inbox?.projectId);
  const source = project ?? inbox!;
  const old = previous.today.items[indices[0]];
  const item: TodayItem = {
    sourceKey: old.sourceKey,
    done: old.done,
    text: (project ? project.nextStep : inbox!.text).trim(),
    ...(project?.nextStepTrigger?.trim() ? { trigger: project.nextStepTrigger.trim() } : {}),
    ...(project || inbox?.projectId ? { projectId: project?.id ?? inbox!.projectId } : {}),
    ...(source.buttonIds?.length ? { buttonIds: [...source.buttonIds] } : {}),
    ...(source.instructionPath ? {
      instructionPath: source.instructionPath,
      instructionOpenOnStart: source.instructionOpenOnStart !== false,
    } : {}),
    defaultTimerMinutes: linkedProject?.defaultTimerMinutes ?? next.settings.defaultTimerMinutes,
    shortTimerMinutes: linkedProject?.shortTimerMinutes ?? next.settings.shortTimerMinutes,
  };
  return { ...next, today: { ...next.today, items: next.today.items.map((entry, index) => index === indices[0] ? item : entry) } };
}
