/**
 * timeAgo — locks the Chinese display values (PRD §9.5). Values must stay in
 * sync with web's zh-Hans relative-time strings; any drift back to English is
 * a copy regression (see copy-sweep.test.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { timeAgo } from "./time-ago";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

describe("timeAgo", () => {
  it("renders 刚刚 within the first minute", () => {
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe("刚刚");
  });

  it("renders N 分钟前 within the hour", () => {
    expect(timeAgo(new Date(Date.now() - 5 * MIN).toISOString())).toBe("5 分钟前");
  });

  it("renders N 小时前 within the day", () => {
    expect(timeAgo(new Date(Date.now() - 3 * HOUR).toISOString())).toBe("3 小时前");
  });

  it("renders N 天前 within the week", () => {
    expect(timeAgo(new Date(Date.now() - 2 * DAY).toISOString())).toBe("2 天前");
  });

  it("renders N 周前 within five weeks", () => {
    expect(timeAgo(new Date(Date.now() - 3 * WEEK).toISOString())).toBe("3 周前");
  });

  it("falls back to a localized date beyond five weeks", () => {
    const old = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-08-15T00:00:00Z").getTime());
    try {
      const out = timeAgo(new Date("2026-01-01T00:00:00Z").toISOString());
      expect(out).not.toMatch(/minute|hour|day|week/);
      expect(out).not.toBe("");
    } finally {
      vi.restoreAllMocks();
      Date.now = old;
    }
  });
});
