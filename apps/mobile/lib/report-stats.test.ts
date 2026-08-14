import { describe, expect, it } from "vitest";
import {
  computeReportStats,
  periodStart,
  type ReportIssue,
} from "./report-stats";

function iso(d: Date): string {
  return d.toISOString();
}

function issue(
  overrides: Partial<ReportIssue> & Pick<ReportIssue, "status">,
): ReportIssue {
  return {
    id: overrides.id ?? "i-1",
    assignee_id: overrides.assignee_id ?? null,
    created_at: overrides.created_at ?? "2026-08-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

// Fixed "now": 2026-08-15 12:00 UTC (whatever the test runner's TZ, the
// boundaries are device-local — so assertions build expected values with the
// same local-timezone Date constructors, not hardcoded UTC strings).
const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("periodStart", () => {
  it("day starts today at 00:00 (local)", () => {
    const expected = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    expect(periodStart("day", NOW).getTime()).toBe(expected.getTime());
  });

  it("week starts Monday 00:00 (local)", () => {
    // 2026-08-15 is a Saturday → week started the preceding Monday.
    const expected = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    expected.setDate(expected.getDate() - ((expected.getDay() + 6) % 7));
    expect(periodStart("week", NOW).getTime()).toBe(expected.getTime());
  });

  it("month starts on the 1st (local)", () => {
    const expected = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
    expect(periodStart("month", NOW).getTime()).toBe(expected.getTime());
  });
});

describe("computeReportStats", () => {
  const today = "2026-08-15T09:00:00.000Z";
  const yesterday = "2026-08-14T09:00:00.000Z";
  const lastMonth = "2026-07-20T09:00:00.000Z";

  it("counts created / done within the day period", () => {
    const issues: ReportIssue[] = [
      issue({
        id: "a",
        status: "done",
        created_at: today,
        updated_at: today,
      }),
      issue({ id: "b", status: "todo", created_at: today }),
      issue({ id: "c", status: "in_progress", created_at: yesterday }),
    ];
    const stats = computeReportStats(issues, "day", NOW);
    expect(stats.created).toBe(2); // a + b created today
    expect(stats.done).toBe(1); // a done today
    expect(stats.runtimeHours).toBeNull();
    expect(stats.tokens).toBeNull();
    expect(stats.statusDistribution).toEqual({
      inProgress: 1,
      inReview: 0,
      blocked: 0,
      failed: 0,
    });
  });

  it("excludes done issues updated outside the period", () => {
    const issues: ReportIssue[] = [
      issue({ id: "a", status: "done", updated_at: lastMonth }),
    ];
    const stats = computeReportStats(issues, "day", NOW);
    expect(stats.done).toBe(0);
  });

  it("builds a 7-day trend and week-over-week delta for week", () => {
    const issues: ReportIssue[] = [
      // Done this week (Mon 8/10 – Sat 8/15): 2
      issue({ id: "a", status: "done", updated_at: "2026-08-10T09:00:00.000Z" }),
      issue({ id: "b", status: "done", updated_at: "2026-08-12T09:00:00.000Z" }),
      // Done last week (Mon 8/3 – Sun 8/9): 1
      issue({ id: "c", status: "done", updated_at: "2026-08-04T09:00:00.000Z" }),
    ];
    const stats = computeReportStats(issues, "week", NOW);
    expect(stats.done).toBe(2);
    expect(stats.weeklyTrend).toHaveLength(7);
    const trendTotal = stats.weeklyTrend.reduce((s, d) => s + d.count, 0);
    expect(trendTotal).toBe(2);
    // (2 - 1) / 1 = +100%
    expect(stats.weekOverWeekPercent).toBe(100);
  });

  it("returns null delta when last week has no baseline", () => {
    const issues: ReportIssue[] = [
      issue({ id: "a", status: "done", updated_at: "2026-08-12T09:00:00.000Z" }),
    ];
    const stats = computeReportStats(issues, "week", NOW);
    expect(stats.weekOverWeekPercent).toBeNull();
  });

  it("computes top contributors and fail rate for month", () => {
    const issues: ReportIssue[] = [
      issue({
        id: "a",
        status: "done",
        assignee_id: "agent-1",
        updated_at: "2026-08-02T09:00:00.000Z",
      }),
      issue({
        id: "b",
        status: "done",
        assignee_id: "agent-1",
        updated_at: "2026-08-03T09:00:00.000Z",
      }),
      issue({
        id: "c",
        status: "done",
        assignee_id: "agent-2",
        updated_at: "2026-08-04T09:00:00.000Z",
      }),
      issue({ id: "d", status: "cancelled", updated_at: "2026-08-05T09:00:00.000Z" }),
      issue({ id: "e", status: "cancelled", updated_at: "2026-08-06T09:00:00.000Z" }),
      issue({ id: "f", status: "todo", updated_at: "2026-08-07T09:00:00.000Z" }),
    ];
    const stats = computeReportStats(issues, "month", NOW);
    expect(stats.topContributors).toEqual([
      { assigneeId: "agent-1", count: 2 },
      { assigneeId: "agent-2", count: 1 },
    ]);
    // failRate = 2 / 6 = 33.3%
    expect(stats.failRate).toBe(33.3);
    expect(stats.failDenominator).toBe(6);
  });

  it("suppresses fail rate when denominator < 5 (§13.1 sample guard)", () => {
    const issues: ReportIssue[] = [
      issue({ id: "a", status: "cancelled", updated_at: "2026-08-05T09:00:00.000Z" }),
      issue({ id: "b", status: "todo", updated_at: "2026-08-07T09:00:00.000Z" }),
    ];
    const stats = computeReportStats(issues, "month", NOW);
    expect(stats.failRate).toBeNull();
    expect(stats.failDenominator).toBe(2);
  });
});
