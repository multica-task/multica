/**
 * Locks Chinese display values for project status / priority + the enum
 * order mirrors (web parity). Only display values change; keys/order stay.
 */
import { describe, expect, it } from "vitest";
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  projectPriorityBars,
  projectPriorityLabel,
  projectStatusLabel,
} from "./project-status";

describe("project-status", () => {
  it("maps every project status to a Chinese label", () => {
    expect(PROJECT_STATUS_LABEL).toEqual({
      planned: "计划中",
      in_progress: "进行中",
      paused: "已暂停",
      completed: "已完成",
      cancelled: "已取消",
    });
  });

  it("maps every project priority to a Chinese label", () => {
    expect(PROJECT_PRIORITY_LABEL).toEqual({
      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低",
      none: "无优先级",
    });
  });

  it("keeps status/priority enum order stable (matches web)", () => {
    expect(PROJECT_STATUSES).toEqual([
      "planned",
      "in_progress",
      "paused",
      "completed",
      "cancelled",
    ]);
    expect(PROJECT_PRIORITIES).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
      "none",
    ]);
  });

  it("falls back to the raw value for unknown status/priority", () => {
    expect(projectStatusLabel("some_future_status")).toBe("some_future_status");
    expect(projectPriorityLabel("some_future_priority")).toBe(
      "some_future_priority",
    );
  });

  it("returns 0 bars for unknown priority", () => {
    expect(projectPriorityBars("some_future_priority")).toBe(0);
  });
});
