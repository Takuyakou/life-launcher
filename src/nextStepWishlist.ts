import type {
  AppConfig,
  InboxItem,
  LauncherNextStep,
  SourceCompletion,
} from "./types";

export type NextStepReplacementChoice = "return" | "complete";

export type WishlistGroup = {
  key: string;
  projectId?: string;
  name: string;
  items: Array<{ item: InboxItem; index: number }>;
};

export function wishlistGroupKey(item: InboxItem, projectIds: ReadonlySet<string>): string {
  return item.projectId && projectIds.has(item.projectId)
    ? `project:${item.projectId}`
    : "unassigned";
}

export function groupWishlist(config: AppConfig): WishlistGroup[] {
  const projectIds = new Set(config.projects.map((project) => project.id));
  const groups = new Map<string, WishlistGroup>();
  config.projects.forEach((project) => {
    groups.set(`project:${project.id}`, {
      key: `project:${project.id}`,
      projectId: project.id,
      name: project.name,
      items: [],
    });
  });
  const unassigned: WishlistGroup = { key: "unassigned", name: "未分類", items: [] };
  config.inbox.forEach((item, index) => {
    const key = wishlistGroupKey(item, projectIds);
    (key === "unassigned" ? unassigned : groups.get(key))?.items.push({ item, index });
  });
  return [
    ...config.projects.flatMap((project) => {
      const group = groups.get(`project:${project.id}`);
      return group?.items.length ? [group] : [];
    }),
    ...(unassigned.items.length ? [unassigned] : []),
  ];
}

export function sameNextStepSnapshot(
  current: LauncherNextStep | undefined,
  expected: LauncherNextStep | undefined,
): boolean {
  return JSON.stringify(current) === JSON.stringify(expected);
}

export function prepareNextStepReplacement(
  config: AppConfig,
  input: {
    projectId: string;
    nextStep: LauncherNextStep;
    expectedCurrent: LauncherNextStep;
    choice: NextStepReplacementChoice;
    promotedWishlistId?: string;
    completedAt: string;
    createId: () => string;
  },
): AppConfig {
  const project = config.projects.find((candidate) => candidate.id === input.projectId);
  if (!project?.nextStep || !sameNextStepSnapshot(project.nextStep, input.expectedCurrent)) {
    throw new Error("現在の次の一手が変更されたため、内容を確認し直してください");
  }
  if (
    input.promotedWishlistId &&
    !config.inbox.some((item) => item.id === input.promotedWishlistId)
  ) {
    throw new Error("元のやりたいことが見つかりません");
  }

  const retainedInbox = input.promotedWishlistId
    ? config.inbox.filter((item) => item.id !== input.promotedWishlistId)
    : config.inbox;
  const inbox =
    input.choice === "return"
      ? [
          ...retainedInbox,
          {
            id: input.createId(),
            text: project.nextStep.text,
            projectId: project.id,
          },
        ]
      : retainedInbox;
  const completion: SourceCompletion | null =
    input.choice === "complete"
      ? {
          id: input.createId(),
          sourceType: "nextStep",
          sourceIdentity: `project:${project.id}`,
          textSnapshot: project.nextStep.text,
          projectId: project.id,
          projectNameSnapshot: project.name,
          completedAt: input.completedAt,
        }
      : null;

  return {
    ...config,
    projects: config.projects.map((candidate) =>
      candidate.id === project.id
        ? { ...candidate, nextStep: input.nextStep, legacyNextStepSettings: undefined }
        : candidate,
    ),
    inbox,
    sourceCompletions: completion
      ? [...config.sourceCompletions, completion]
      : config.sourceCompletions,
  };
}
