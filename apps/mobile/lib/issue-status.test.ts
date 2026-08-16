/**
 * Locks the Chinese display values for issue status / priority labels
 * (PRD §9.5). Enum KEYS and BOARD_STATUSES order/members are behavior
 * semantics and must never change (Behavioral parity with web); only display
 * values may be edited here.
 */
import { describe, expect, it } from "vitest";
import {
  BOARD_STATUSES,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "./issue-status";

describe("issue-status", () => {
  it("maps every board status to a Chinese label", () => {
    expect(STATUS_LABEL).toEqual({
      backlog: "待规划",
      todo: "待处理",
      in_progress: "进行中",
      in_review: "待评审",
      done: "已完成",
      blocked: "受阻",
      cancelled: "已取消",
    });
  });

  it("maps every priority to a Chinese label", () => {
    expect(PRIORITY_LABEL).toEqual({
      none: "无优先级",
      low: "低",
      medium: "中",
      high: "高",
      urgent: "紧急",
    });
  });

  it("keeps the board status order/members stable (matches web)", () => {
    expect(BOARD_STATUSES).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "blocked",
    ]);
  });
});
