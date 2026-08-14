import type { ProjectColorId } from "./types";

export const PROJECT_COLOR_IDS: ProjectColorId[] = [
  "amber",
  "blue",
  "green",
  "violet",
  "rose",
  "cyan",
  "orange",
  "slate",
];

export const PROJECT_COLOR_LABELS: Record<ProjectColorId, string> = {
  amber: "アンバー",
  blue: "ブルー",
  green: "グリーン",
  violet: "バイオレット",
  rose: "ローズ",
  cyan: "シアン",
  orange: "オレンジ",
  slate: "スレート",
};

export function resolveProjectColorId(
  projectId: string,
  colorId?: ProjectColorId | null,
): ProjectColorId {
  if (colorId) return colorId;
  let hash = 0;
  for (const character of projectId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return PROJECT_COLOR_IDS[hash % PROJECT_COLOR_IDS.length];
}
