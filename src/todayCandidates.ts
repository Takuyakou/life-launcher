import type { AppConfig, InboxItem, LauncherProject } from "./types";

export type TodayCandidate = {
  key: string;
  text: string;
  source: "次の一手" | "やりたいこと";
  sourceKey: string;
  sourceGenerationId?: string;
  legacyOrderKeys?: string[];
  sourceAliases?: string[];
  trigger?: string;
  projectId?: string;
  buttonIds?: string[];
  instructionPath?: string;
  instructionOpenOnStart?: boolean;
  defaultTimerMinutes: number;
  shortTimerMinutes: number;
};

export function wishlistSourceKey(item: InboxItem, index: number): string {
  return `wishlist:${item.id?.trim() || `legacy-${index + 1}`}`;
}

export function legacyWishlistSourceKey(item: InboxItem): string {
  return `wishlist:${item.projectId ?? "none"}:${item.text.trim()}`;
}

export function projectTodayCandidate(
  project: LauncherProject,
  settings: AppConfig["settings"],
): TodayCandidate {
  const nextStep = project.nextStep;
  const text = nextStep?.text.trim() ?? "";
  return {
    key: `project:${project.id}`,
    text,
    source: "次の一手",
    sourceKey: `project:${project.id}`,
    ...(nextStep?.generationId ? { sourceGenerationId: nextStep.generationId } : {}),
    legacyOrderKeys: [`project:${project.id}:${text}`],
    projectId: project.id,
    ...(nextStep?.trigger?.trim() ? { trigger: nextStep.trigger.trim() } : {}),
    ...(nextStep?.buttonIds.length ? { buttonIds: [...nextStep.buttonIds] } : {}),
    ...(nextStep?.instructionPath
      ? {
          instructionPath: nextStep.instructionPath,
          instructionOpenOnStart: nextStep.instructionOpenOnStart !== false,
        }
      : {}),
    defaultTimerMinutes: nextStep?.defaultTimerMinutes ?? settings.defaultTimerMinutes,
    shortTimerMinutes: nextStep?.shortTimerMinutes ?? settings.shortTimerMinutes,
  };
}

export function wishlistTodayCandidate(
  item: InboxItem,
  index: number,
  project: LauncherProject | undefined,
  settings: AppConfig["settings"],
  includeLegacyAlias: boolean,
): TodayCandidate {
  const text = item.text.trim();
  return {
    key: wishlistSourceKey(item, index),
    text,
    source: "やりたいこと",
    sourceKey: wishlistSourceKey(item, index),
    legacyOrderKeys: [`inbox:${item.projectId ?? "none"}:${text}`],
    ...(includeLegacyAlias ? { sourceAliases: [legacyWishlistSourceKey(item)] } : {}),
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...(item.buttonIds?.length ? { buttonIds: [...item.buttonIds] } : {}),
    ...(item.instructionPath
      ? {
          instructionPath: item.instructionPath,
          instructionOpenOnStart: item.instructionOpenOnStart !== false,
        }
      : {}),
    defaultTimerMinutes: project?.nextStep?.defaultTimerMinutes ?? settings.defaultTimerMinutes,
    shortTimerMinutes: project?.nextStep?.shortTimerMinutes ?? settings.shortTimerMinutes,
  };
}

export function buildTodayCandidates(config: AppConfig): TodayCandidate[] {
  const projectsById = new Map(config.projects.map((project) => [project.id, project]));
  const legacyWishlistFirstIndexes = config.inbox.reduce<Map<string, number>>(
    (indexes, item, index) => {
      const key = legacyWishlistSourceKey(item);
      if (!indexes.has(key)) indexes.set(key, index);
      return indexes;
    },
    new Map(),
  );

  return [
    ...config.projects.flatMap((project) =>
      project.nextStep?.text.trim() ? [projectTodayCandidate(project, config.settings)] : [],
    ),
    ...config.inbox.flatMap((item, index) =>
      item.text.trim()
        ? [
            wishlistTodayCandidate(
              item,
              index,
              item.projectId ? projectsById.get(item.projectId) : undefined,
              config.settings,
              legacyWishlistFirstIndexes.get(legacyWishlistSourceKey(item)) === index,
            ),
          ]
        : [],
    ),
  ];
}

export function todayCandidateFromConfig(
  config: AppConfig,
  sourceKey: string,
): TodayCandidate | undefined {
  return buildTodayCandidates(config).find(
    (candidate) =>
      candidate.sourceKey === sourceKey || candidate.sourceAliases?.includes(sourceKey),
  );
}
