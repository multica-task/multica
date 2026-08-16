/**
 * formatActivity — Chinese activity-line copy (PRD §9.5). Unknown actions
 * fall through to the raw action string (API Response Compatibility), never
 * throw.
 */
import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@multica/core/types";
import { formatActivity } from "./format-activity";

const resolve = (_type: string | null | undefined, id: string | null | undefined) =>
  id ? `员工-${id}` : "?";

function entry(action: string, details?: Record<string, string>): TimelineEntry {
  return {
    type: "activity",
    id: "e1",
    action: action as TimelineEntry["action"],
    actor_type: "member",
    actor_id: "u1",
    details: (details ?? {}) as TimelineEntry["details"],
    created_at: "2026-08-15T00:00:00Z",
    coalesced_count: 1,
  };
}

describe("formatActivity", () => {
  it("renders core actions in Chinese", () => {
    expect(formatActivity(entry("created"), resolve)).toBe("创建了事项");
    expect(
      formatActivity(entry("status_changed", { from: "todo", to: "done" }), resolve),
    ).toBe("状态变更：待处理 → 已完成");
    expect(
      formatActivity(
        entry("priority_changed", { from: "low", to: "urgent" }),
        resolve,
      ),
    ).toBe("优先级变更：低 → 紧急");
  });

  it("renders assignee changes in Chinese", () => {
    expect(
      formatActivity(
        entry("assignee_changed", { from_id: "u1", to_id: "a1", to_type: "agent" }),
        resolve,
      ),
    ).toBe("指派给 员工-a1");
    expect(
      formatActivity(
        entry("assignee_changed", { from_id: "u1", to_id: "", to_type: "agent" }),
        resolve,
      ),
    ).toBe("移除了负责人");
  });

  it("renders task outcomes in Chinese", () => {
    expect(formatActivity(entry("task_completed"), resolve)).toBe(
      "完成了一次任务运行",
    );
    expect(
      formatActivity(
        { ...entry("task_completed"), coalesced_count: 3 },
        resolve,
      ),
    ).toBe("完成了 3 个任务运行");
    expect(formatActivity(entry("task_failed"), resolve)).toBe("一次任务运行失败");
  });

  it("falls through for unknown actions instead of throwing", () => {
    expect(formatActivity(entry("some_future_action"), resolve)).toBe(
      "some_future_action",
    );
  });
});
