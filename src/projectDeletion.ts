import { canonicalSourceKey } from "./sourceEdit";
import { legacyWishlistSourceKey, wishlistSourceKey } from "./todayCandidates";
import type { AppConfig, LauncherProject, SourceCompletion, TodayItem } from "./types";

export type ProjectDeletionMode = "delete" | "complete";

export type ProjectDeletionSummary = {
  project: LauncherProject;
  nextStepCount: number;
  wishlistCount: number;
};

function projectOwnsSource(config: AppConfig, projectId: string, sourceKey?: string): boolean {
  if (!sourceKey) return false;
  const canonicalKey = canonicalSourceKey(config, sourceKey);
  if (canonicalKey === `project:${projectId}`) return true;
  return config.inbox.some(
    (item, index) =>
      item.projectId === projectId &&
      [wishlistSourceKey(item, index), legacyWishlistSourceKey(item)].includes(
        canonicalKey ?? sourceKey,
      ),
  );
}

function todayItemBelongsToProject(
  config: AppConfig,
  projectId: string,
  item: TodayItem,
): boolean {
  return item.projectId === projectId || projectOwnsSource(config, projectId, item.sourceKey);
}

export function projectDeletionSummary(
  config: AppConfig,
  projectId: string,
): ProjectDeletionSummary | null {
  const project = config.projects.find((candidate) => candidate.id === projectId);
  if (!project) return null;
  return {
    project,
    nextStepCount: project.nextStep?.text.trim() ? 1 : 0,
    wishlistCount: config.inbox.filter((item) => item.projectId === projectId).length,
  };
}

export function projectDeletionBlockReason(
  config: AppConfig,
  projectId: string,
  activeTimerSourceId?: string | null,
): string | null {
  if (!config.projects.some((project) => project.id === projectId)) {
    return "削除するプロジェクトが見つかりません";
  }

  if (
    config.today.items.some(
      (item) => !item.done && todayItemBelongsToProject(config, projectId, item),
    )
  ) {
    return "このプロジェクトは「今日の3件」で使用中です。完了するか、今日の3件から外してから削除してください。";
  }

  if (activeTimerSourceId) {
    const timerSourceKey = activeTimerSourceId.startsWith("today:")
      ? activeTimerSourceId.slice("today:".length)
      : `project:${activeTimerSourceId}`;
    if (activeTimerSourceId === projectId || projectOwnsSource(config, projectId, timerSourceKey)) {
      return "実行中のタイマーを終了してから削除してください。";
    }
  }

  return null;
}

function completionExists(config: AppConfig, completion: SourceCompletion): boolean {
  return config.sourceCompletions.some(
    (candidate) =>
      candidate.sourceType === completion.sourceType &&
      candidate.sourceIdentity === completion.sourceIdentity &&
      candidate.textSnapshot === completion.textSnapshot &&
      candidate.projectId === completion.projectId,
  );
}

export function prepareProjectDeletion(
  config: AppConfig,
  projectId: string,
  mode: ProjectDeletionMode,
  input: { completedAt: string; createId: () => string },
): AppConfig | null {
  const summary = projectDeletionSummary(config, projectId);
  if (!summary) return null;

  const projectWishlist = config.inbox.flatMap((item, index) =>
    item.projectId === projectId ? [{ item, index }] : [],
  );
  const sourceKeys = new Set<string>([
    `project:${projectId}`,
    ...projectWishlist.flatMap(({ item, index }) => [
      wishlistSourceKey(item, index),
      legacyWishlistSourceKey(item),
    ]),
  ]);
  const sourceCompletions = [...config.sourceCompletions];

  if (mode === "complete") {
    const completions: SourceCompletion[] = [];
    if (summary.project.nextStep?.text.trim()) {
      completions.push({
        id: input.createId(),
        sourceType: "nextStep",
        sourceIdentity: `project:${projectId}`,
        textSnapshot: summary.project.nextStep.text.trim(),
        projectId,
        projectNameSnapshot: summary.project.name,
        completedAt: input.completedAt,
      });
    }
    projectWishlist.forEach(({ item, index }) => {
      const text = item.text.trim();
      if (!text) return;
      completions.push({
        id: input.createId(),
        sourceType: "wishlist",
        sourceIdentity: wishlistSourceKey(item, index),
        textSnapshot: text,
        projectId,
        projectNameSnapshot: summary.project.name,
        completedAt: input.completedAt,
      });
    });
    completions.forEach((completion) => {
      if (!completionExists(config, completion)) sourceCompletions.push(completion);
    });
  }

  const selectionMutationTokens = { ...config.today.selectionMutationTokens };
  sourceKeys.forEach((sourceKey) => delete selectionMutationTokens[sourceKey]);

  return {
    ...config,
    projects: config.projects.filter((project) => project.id !== projectId),
    inbox: config.inbox.filter((item) => item.projectId !== projectId),
    sourceCompletions,
    today: {
      ...config.today,
      candidateExcludedSourceKeys: config.today.candidateExcludedSourceKeys.filter(
        (sourceKey) => !sourceKeys.has(sourceKey),
      ),
      selectionMutationTokens,
    },
  };
}
