import type { ProjectColorId } from "../types";
import { resolveProjectColorId } from "../projectIdentity";

type ProjectIdentityProps = {
  projectId: string;
  name: string;
  colorId?: ProjectColorId | null;
  compact?: boolean;
};

export function ProjectIdentity({
  projectId,
  name,
  colorId,
  compact = false,
}: ProjectIdentityProps) {
  const resolvedColor = resolveProjectColorId(projectId, colorId);
  return (
    <span
      className={compact ? "projectIdentity projectIdentity--compact" : "projectIdentity"}
      data-project-color={resolvedColor}
      title={`プロジェクト: ${name}`}
    >
      <span aria-hidden="true" className="projectIdentityDot" />
      <span className="projectIdentityName">{name}</span>
    </span>
  );
}
