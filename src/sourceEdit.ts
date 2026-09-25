import type { AppConfig, TodayItem } from "./types";

export const SOURCE_EDIT_TIMER_REASON = "タイマーを停止してから編集してください";
export const SOURCE_LOCK_REASON =
  "未完了の「今日の3件」に入っているため、完了または外すまで元の登録は変更できません";

export function canonicalSourceKey(config: AppConfig, key: string): string | null {
  const exact = [
    ...config.projects.filter((p) => `project:${p.id}` === key).map((p) => `project:${p.id}`),
    ...config.inbox
      .filter((i) => i.id && `wishlist:${i.id}` === key)
      .map((i) => `wishlist:${i.id}`),
  ];
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const legacy = config.inbox.filter(
    (i) => i.id && `wishlist:${i.projectId ?? "none"}:${i.text.trim()}` === key,
  );
  return legacy.length === 1 ? `wishlist:${legacy[0].id}` : null;
}

export function unfinishedTodayUsesSource(
  config: AppConfig,
  sourceKey: string,
  sourceGenerationId?: string,
): boolean {
  const canonicalKey = canonicalSourceKey(config, sourceKey);
  if (!canonicalKey) return false;

  return config.today.items.some((item) => {
    if (
      item.done ||
      !item.sourceKey ||
      canonicalSourceKey(config, item.sourceKey) !== canonicalKey
    ) {
      return false;
    }

    return sourceGenerationId === undefined
      ? item.sourceGenerationId === undefined
      : item.sourceGenerationId === sourceGenerationId;
  });
}

export function sourceLockedByUnfinishedToday(config: AppConfig, sourceKey: string): boolean {
  const canonicalKey = canonicalSourceKey(config, sourceKey);
  if (!canonicalKey) return false;
  const project = config.projects.find((candidate) => `project:${candidate.id}` === canonicalKey);
  if (project && !project.nextStep?.text.trim()) return false;
  return unfinishedTodayUsesSource(config, canonicalKey, project?.nextStep?.generationId);
}

export function timerSourceKey(config: AppConfig, sourceId: string): string | null {
  return canonicalSourceKey(
    config,
    sourceId.startsWith("today:") ? sourceId.slice(6) : `project:${sourceId}`,
  );
}

export function resnapshotSource(previous: AppConfig, next: AppConfig, key: string): AppConfig {
  const previousProject = previous.projects.find((p) => `project:${p.id}` === key);
  const nextProject = next.projects.find((p) => `project:${p.id}` === key);
  const sourceGenerationId = previousProject?.nextStep?.generationId;
  if (
    previousProject &&
    (!previousProject.nextStep || nextProject?.nextStep?.generationId !== sourceGenerationId)
  ) {
    return next;
  }
  const indices = previous.today.items.flatMap((item, index) => {
    if (!item.sourceKey || canonicalSourceKey(previous, item.sourceKey) !== key) return [];
    return previousProject && item.sourceGenerationId !== sourceGenerationId ? [] : [index];
  });
  if (indices.length > 1) throw new Error("同じ登録に対応する今日の項目が複数あります");
  if (!indices.length) return next;
  if (previous.today.items[indices[0]].sourceKey !== key) {
    throw new Error("旧形式の採用項目です。今日の3件から外して再度選んでください");
  }
  const project = nextProject;
  const inbox = next.inbox.find((i) => `wishlist:${i.id}` === key);
  if (!project && !inbox) throw new Error("元の登録が見つかりません");
  const linkedProject = project ?? next.projects.find((p) => p.id === inbox?.projectId);
  const source = project?.nextStep ?? inbox!;
  const old = previous.today.items[indices[0]];
  const item: TodayItem = {
    sourceKey: old.sourceKey,
    ...(project?.nextStep?.generationId
      ? { sourceGenerationId: project.nextStep.generationId }
      : {}),
    done: old.done,
    text: (project ? (project.nextStep?.text ?? "") : inbox!.text).trim(),
    ...(project?.nextStep?.trigger?.trim() ? { trigger: project.nextStep.trigger.trim() } : {}),
    ...(project || inbox?.projectId ? { projectId: project?.id ?? inbox!.projectId } : {}),
    ...(source.buttonIds?.length ? { buttonIds: [...source.buttonIds] } : {}),
    ...(project?.nextStep?.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
    ...(source.instructionPath
      ? {
          instructionPath: source.instructionPath,
          instructionOpenOnStart: source.instructionOpenOnStart !== false,
        }
      : {}),
    defaultTimerMinutes:
      linkedProject?.nextStep?.defaultTimerMinutes ?? next.settings.defaultTimerMinutes,
    shortTimerMinutes:
      linkedProject?.nextStep?.shortTimerMinutes ?? next.settings.shortTimerMinutes,
  };
  return {
    ...next,
    today: {
      ...next.today,
      items: next.today.items.map((entry, index) => (index === indices[0] ? item : entry)),
    },
  };
}
