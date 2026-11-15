import type { ProjectColorId } from "./types";

/**
 * The eight colors that existed before v1.4.3. Projects without an explicit color keep
 * using only these, so adding colors does not change their automatic color.
 */
export const AUTO_PROJECT_COLOR_IDS: ProjectColorId[] = [
  "amber",
  "blue",
  "green",
  "violet",
  "rose",
  "cyan",
  "orange",
  "slate",
];

export const PROJECT_COLOR_IDS: ProjectColorId[] = [
  ...AUTO_PROJECT_COLOR_IDS,
  "lime",
  "magenta",
  "sand",
  "coral",
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
  lime: "ライム",
  magenta: "マゼンタ",
  sand: "サンド",
  coral: "コーラル",
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
  return AUTO_PROJECT_COLOR_IDS[hash % AUTO_PROJECT_COLOR_IDS.length];
}

/** P10-14e (6): the placeholder glyphs that only mean "no picture". */
const PLACEHOLDER_BUTTON_GLYPHS = new Set(["□", "▣", "↗", ">", "♻", "◇"]);

/**
 * P10-14e (6): the sidebar and the search rows show a picture when the button has one,
 * otherwise the first letter of its name. A placeholder box glyph is not a picture.
 */
export function buttonGlyph(button: { label: string; icon?: string | null }): string {
  const icon = button.icon?.trim();
  if (icon && !PLACEHOLDER_BUTTON_GLYPHS.has(icon)) return icon;
  const first = Array.from(button.label?.trim() || "?")[0] ?? "?";
  return /[a-z]/.test(first) ? first.toUpperCase() : first;
}
