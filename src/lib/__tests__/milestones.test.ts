import { describe, it, expect } from "vitest";
import {
  FUNDING_GRACE_DAYS,
  FUNDING_GRACE_MS,
  getFundingWaitStartMs,
  sortMilestones,
} from "../milestones";

describe("milestones helpers", () => {
  it("keeps milestones in 1, 2, 3 order by sort_order regardless of funding status", () => {
    const sameCreatedAt = "2026-11-01T10:00:00.000Z";
    const unordered = [
      { id: "m2", status: "pending", created_at: sameCreatedAt, sort_order: 2 },
      { id: "m3", status: "pending", created_at: sameCreatedAt, sort_order: 3 },
      { id: "m1", status: "funded", created_at: sameCreatedAt, sort_order: 1 },
    ];

    expect(sortMilestones(unordered).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("tracks the 7-day funding grace window only on the active next-to-fund milestone", () => {
    expect(FUNDING_GRACE_DAYS).toBe(7);
    expect(FUNDING_GRACE_MS).toBe(7 * 86_400_000);

    const list = sortMilestones([
      { id: "m1", status: "approved", created_at: "2026-11-01T00:00:00.000Z", sort_order: 1, approved_at: "2026-11-04T00:00:00.000Z" },
      { id: "m2", status: "pending", created_at: "2026-11-01T00:00:00.000Z", sort_order: 2 },
      { id: "m3", status: "pending", created_at: "2026-11-01T00:00:00.000Z", sort_order: 3 },
    ]);

    expect(getFundingWaitStartMs(list, "m2")).toBe(Date.parse("2026-11-04T00:00:00.000Z"));
    expect(getFundingWaitStartMs(list, "m3")).toBeNull();
  });
});

