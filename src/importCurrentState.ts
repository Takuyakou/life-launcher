import type { AppConfig } from "./types";

/** The text that goes into the 2nd-and-later prompt's {CURRENT_STATE}. */
export function buildImportCurrentState(config: AppConfig | null): string {
  if (!config) return "(まだ何もありません)";
  const lines: string[] = [];
  for (const project of config.projects) {
    lines.push(project.colorId ? `${project.name}(色: ${project.colorId})` : project.name);
    const goal = project.northStar?.trim();
    if (goal) lines.push(`目標: ${goal}`);
    const nextStep = project.nextStep?.text.trim();
    if (nextStep) lines.push(`次の一手: ${nextStep}`);
    const wishes = config.inbox
      .filter((item) => item.projectId === project.id)
      .map((item) => item.text.trim())
      .filter(Boolean);
    if (wishes.length > 0) lines.push(`やりたいこと: ${wishes.join(" / ")}`);
  }
  const unassigned = config.inbox
    .filter((item) => !item.projectId)
    .map((item) => item.text.trim())
    .filter(Boolean);
  if (unassigned.length > 0) {
    lines.push(`プロジェクトなしのやりたいこと: ${unassigned.join(" / ")}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(まだ何もありません)";
}
