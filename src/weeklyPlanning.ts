import { localDayKey } from "./localDay";
import type {
  AppConfig,
  LauncherProject,
  SourceCompletion,
  WeeklyReviewProjectSummary,
  WeeklyReviewResponse,
} from "./types";

export type WeeklyProjectFact = {
  key: string;
  label: string;
  colorId?: string;
  project?: LauncherProject;
  sessionCount: number;
  totalMinutes: number;
};

/** 4-1: 8月3日〜9日 / 10月26日〜11月1日 / 2026年12月28日〜2027年1月3日 */
export function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return `${start}〜${end}`;
  }
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  if (startYear !== endYear) {
    return `${startYear}年${startMonth}月${startDay}日〜${endYear}年${endMonth}月${endDay}日`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth}月${startDay}日〜${endMonth}月${endDay}日`;
  }
  return `${startMonth}月${startDay}日〜${endDay}日`;
}

/** 4-2: 0分 / 55分 / 2時間 / 2時間5分 / 4時間10分 */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  if (safe < 60) return `${safe}分`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

function summarySort(
  a: WeeklyReviewProjectSummary,
  b: WeeklyReviewProjectSummary,
): number {
  if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
  if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
  return a.label.localeCompare(b.label, "ja");
}

/** 4-3: the Project name/color is the current one; a deleted Project keeps its snapshot. */
export function weeklyProjectFacts(
  config: AppConfig,
  weeklyReview: WeeklyReviewResponse | null,
): WeeklyProjectFact[] {
  if (!weeklyReview) return [];
  const projectsById = new Map(config.projects.map((project) => [project.id, project]));
  return [...weeklyReview.projects].sort(summarySort).map((summary) => {
    const project = summary.projectId ? projectsById.get(summary.projectId) : undefined;
    return {
      key: summary.projectId ?? `label:${summary.label}`,
      label: project?.name ?? summary.label,
      colorId: project?.colorId,
      project,
      sessionCount: summary.sessionCount,
      totalMinutes: summary.totalMinutes,
    };
  });
}

/** 4-4: completed in the previous week, oldest first. */
export function weeklyCompletedItems(
  config: AppConfig,
  weeklyReview: WeeklyReviewResponse | null,
): SourceCompletion[] {
  if (!weeklyReview) return [];
  const start = weeklyReview.previousWeekStart;
  const end = weeklyReview.previousWeekEnd;
  return config.sourceCompletions
    .filter((item) => {
      const day = localDayKey(new Date(item.completedAt), config.settings.dayStartHour);
      return day >= start && day <= end;
    })
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export type WeeklyStaleFact = {
  project: LauncherProject;
  days: number;
};

/** 5-4: the plain-text facts pasted into the AI prompt. */
export function buildWeeklyFacts(
  config: AppConfig,
  weeklyReview: WeeklyReviewResponse | null,
  stale: WeeklyStaleFact[],
): string {
  const projects = weeklyProjectFacts(config, weeklyReview);
  const completed = weeklyCompletedItems(config, weeklyReview);
  const totalMinutes = weeklyReview?.totalMinutes ?? 0;
  const activeDays = weeklyReview?.activeDays ?? 0;
  const sessionCount = weeklyReview?.projects.reduce(
    (sum, project) => sum + project.sessionCount,
    0,
  ) ?? 0;
  const lines = [
    `合計: ${formatDuration(totalMinutes)} / 動いた日: ${activeDays}日 / 始めた回数: ${sessionCount}回`,
  ];
  if (projects.length === 0) {
    lines.push("プロジェクトごと: (先週の実行記録はありません)");
  } else {
    for (const project of projects) {
      lines.push(
        `${project.label}: ${project.sessionCount}回・${formatDuration(project.totalMinutes)}`,
      );
    }
  }
  lines.push(
    completed.length > 0
      ? `完了にした項目: ${completed.map((item) => item.textSnapshot).join(" / ")}`
      : "完了にした項目: (ありません)",
  );
  const focus = config.projects
    .filter((project) => project.weeklyFocus === true)
    .map((project) => project.name);
  lines.push(
    focus.length > 0 ? `今週の重点: ${focus.join("、")}` : "今週の重点: (まだ選んでいません)",
  );
  if (stale.length > 0) {
    lines.push(
      `しばらく動いていないもの: ${stale
        .map(
          ({ project, days }) =>
            `${project.name}(「${project.nextStep?.text ?? ""}」のまま${days}日)`,
        )
        .join(" / ")}`,
    );
  }
  return lines.join("\n");
}
