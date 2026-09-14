import type { AppConfig, SourceCompletion, TodayItem } from "./types";
import { canonicalSourceKey } from "./sourceEdit";

export type TodayCompletionSource =
  | {
      kind: "nextStep";
      projectId: string;
      projectName: string;
      sourceKey: string;
      isCurrentSnapshot: boolean;
    }
  | {
      kind: "wishlist";
      itemId: string;
      projectId?: string;
      projectName?: string;
      sourceKey: string;
    };

function isCurrentNextStepSnapshot(
  item: TodayItem,
  project: AppConfig["projects"][number],
): boolean {
  const nextStep = project.nextStep;
  if (!nextStep) return false;

  return (
    item.sourceGenerationId === nextStep.generationId &&
    (item.projectId === undefined || item.projectId === project.id)
  );
}

export function resolveTodayCompletionSource(
  config: AppConfig,
  item: TodayItem,
): TodayCompletionSource | null {
  if (!item.sourceKey) return null;
  const sourceKey = canonicalSourceKey(config, item.sourceKey);
  if (!sourceKey) return null;

  if (sourceKey.startsWith("project:")) {
    const projectId = sourceKey.slice("project:".length);
    const project = config.projects.find(
      (candidate) => candidate.id === projectId && candidate.nextStep?.text.trim(),
    );
    return project
      ? {
          kind: "nextStep",
          projectId,
          projectName: project.name,
          sourceKey,
          isCurrentSnapshot: isCurrentNextStepSnapshot(item, project),
        }
      : null;
  }

  const itemId = sourceKey.slice("wishlist:".length);
  const wishlist = config.inbox.find((candidate) => candidate.id === itemId);
  if (!wishlist) return null;
  const project = wishlist.projectId
    ? config.projects.find((candidate) => candidate.id === wishlist.projectId)
    : undefined;
  return {
    kind: "wishlist",
    itemId,
    sourceKey,
    ...(wishlist.projectId ? { projectId: wishlist.projectId } : {}),
    ...(project ? { projectName: project.name } : {}),
  };
}

export function completeTodayItemAndPrepareSource(
  config: AppConfig,
  sourceKey: string,
  completedAt: string,
  completionId: string,
): {
  config: AppConfig;
  source: TodayCompletionSource | null;
} {
  const index = config.today.items.findIndex((item, itemIndex) => {
    if (item.done) return false;
    const candidateKey = item.sourceKey ?? `manual:${itemIndex}`;
    return candidateKey === sourceKey;
  });
  if (index < 0) return { config, source: null };

  const item = config.today.items[index];
  const source = resolveTodayCompletionSource(config, item);
  const today = {
    ...config.today,
    items: config.today.items.map((candidate, itemIndex) =>
      itemIndex === index ? { ...candidate, done: true } : candidate,
    ),
  };
  if (!source || source.kind === "wishlist" || !source.isCurrentSnapshot) {
    return { config: { ...config, today }, source };
  }

  const completion: SourceCompletion = {
    id: completionId,
    sourceType: "nextStep",
    sourceIdentity: source.sourceKey,
    textSnapshot: item.text,
    projectId: source.projectId,
    projectNameSnapshot: source.projectName,
    completedAt,
  };
  return {
    source,
    config: {
      ...config,
      today,
      projects: config.projects.map((project) =>
        project.id === source.projectId ? { ...project, nextStep: undefined } : project,
      ),
      sourceCompletions: [...config.sourceCompletions, completion],
    },
  };
}

export function completeWishlistAfterToday(
  config: AppConfig,
  source: Extract<TodayCompletionSource, { kind: "wishlist" }>,
  textSnapshot: string,
  completedAt: string,
  completionId: string,
): AppConfig | null {
  const wishlist = config.inbox.find((item) => item.id === source.itemId);
  if (!wishlist) return null;
  const completion: SourceCompletion = {
    id: completionId,
    sourceType: "wishlist",
    sourceIdentity: source.sourceKey,
    textSnapshot,
    ...(source.projectId ? { projectId: source.projectId } : {}),
    ...(source.projectName ? { projectNameSnapshot: source.projectName } : {}),
    completedAt,
  };
  return {
    ...config,
    inbox: config.inbox.filter((item) => item.id !== source.itemId),
    sourceCompletions: [...config.sourceCompletions, completion],
  };
}
