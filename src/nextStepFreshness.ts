/**
 * P10-05 (D11): how old a Next Step is.
 *
 * Mirrors `project_is_stale_at` in `src-tauri/src/commands/config.rs`: the basis is the newer of
 * "reviewed" and "updated", a side that cannot be read is ignored, and when neither can be read
 * there is no basis at all.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type FreshnessStep = {
  reviewedAt?: string | null;
  updatedAt?: string | null;
};

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** The time the age is measured from, or null when neither date can be read. */
export function nextStepFreshnessBasis(step: FreshnessStep | null | undefined): number | null {
  if (!step) return null;
  const reviewed = parse(step.reviewedAt);
  const updated = parse(step.updatedAt);
  if (reviewed === null) return updated;
  if (updated === null) return reviewed;
  return Math.max(reviewed, updated);
}

/** Whole days since the basis (rounded down), or null when there is no basis. */
export function nextStepStaleDays(
  step: FreshnessStep | null | undefined,
  now: number,
): number | null {
  const basis = nextStepFreshnessBasis(step);
  if (basis === null) return null;
  const days = Math.floor((now - basis) / DAY_MS);
  return days < 0 ? null : days;
}
