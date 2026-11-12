export const FUNDING_GRACE_DAYS = 7;
export const FUNDING_GRACE_MS = FUNDING_GRACE_DAYS * 86_400_000;

export interface OrderableMilestone {
  id: string;
  status: string;
  created_at: string;
  sort_order?: number | null;
  approved_at?: string | null;
}

/** Sort contract milestones deterministically in 1, 2, 3 order. */
export function sortMilestones<T extends OrderableMilestone>(milestones: readonly T[]): T[] {
  return [...milestones].sort((a, b) => {
    const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });
}

/**
 * Return the epoch ms when the 7-day funding wait clock started for `targetId`,
 * or `null` if the milestone is locked behind an earlier incomplete/unfunded milestone.
 */
export function getFundingWaitStartMs<T extends OrderableMilestone>(
  orderedMilestones: readonly T[],
  targetId: string,
): number | null {
  const nonCancelled = orderedMilestones.filter((m) => m.status !== "cancelled");
  const idx = nonCancelled.findIndex((m) => m.id === targetId);
  if (idx === -1) return null;

  const target = nonCancelled[idx];
  if (target.status !== "pending") return null;

  const firstPendingIdx = nonCancelled.findIndex((m) => m.status === "pending");
  if (idx !== firstPendingIdx) return null;

  const createdMs = new Date(target.created_at).getTime();
  if (idx === 0) return createdMs;

  const prev = nonCancelled[idx - 1];
  if (prev.status !== "approved" && prev.status !== "paid") return null;

  const prevDoneMs = prev.approved_at
    ? new Date(prev.approved_at).getTime()
    : new Date(prev.created_at).getTime();

  return Math.max(createdMs, prevDoneMs);
}

