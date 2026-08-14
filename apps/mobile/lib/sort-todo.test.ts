import { describe, expect, it } from "vitest";
import type { Issue } from "@multica/core/types";
import { filterTodoIssues, sortTodoIssues } from "./sort-todo";

function issue(over: Partial<Issue>): Issue {
  return {
    id: "iss-1",
    workspace_id: "ws-1",
    number: 1,
    identifier: "MUL-1",
    title: "Test issue",
    description: null,
    status: "todo",
    priority: "none",
    assignee_type: null,
    assignee_id: null,
    creator_type: "member",
    creator_id: "member-1",
    parent_issue_id: null,
    project_id: null,
    position: 0,
    stage: null,
    start_date: null,
    due_date: null,
    metadata: {},
    properties: {},
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("filterTodoIssues", () => {
  it("drops done and cancelled issues", () => {
    const list = [
      issue({ id: "a", status: "done" }),
      issue({ id: "b", status: "cancelled" }),
      issue({ id: "c", status: "in_progress" }),
    ];
    expect(filterTodoIssues(list).map((i) => i.id)).toEqual(["c"]);
  });
});

describe("sortTodoIssues", () => {
  it("ranks overdue before due-today before future/no-due", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "future", due_date: "2026-08-20" }),
      issue({ id: "overdue", due_date: "2026-08-10" }),
      issue({ id: "today", due_date: "2026-08-15" }),
      issue({ id: "none", due_date: null }),
    ];
    expect(sortTodoIssues(list, today).map((i) => i.id)).toEqual([
      "overdue",
      "today",
      "future",
      "none",
    ]);
  });

  it("breaks ties by priority desc", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "low", priority: "low" }),
      issue({ id: "urgent", priority: "urgent" }),
      issue({ id: "medium", priority: "medium" }),
    ];
    expect(sortTodoIssues(list, today).map((i) => i.id)).toEqual([
      "urgent",
      "medium",
      "low",
    ]);
  });

  it("breaks priority ties by position asc", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "pos2", priority: "high", position: 2 }),
      issue({ id: "pos0", priority: "high", position: 0 }),
      issue({ id: "pos1", priority: "high", position: 1 }),
    ];
    expect(sortTodoIssues(list, today).map((i) => i.id)).toEqual([
      "pos0",
      "pos1",
      "pos2",
    ]);
  });

  it("sorts across all three keys in one pass", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "a", due_date: "2026-08-20", priority: "urgent", position: 0 }),
      issue({ id: "b", due_date: "2026-08-14", priority: "low", position: 5 }),
      issue({ id: "c", due_date: "2026-08-15", priority: "medium", position: 1 }),
      issue({ id: "d", due_date: "2026-08-15", priority: "urgent", position: 0 }),
    ];
    expect(sortTodoIssues(list, today).map((i) => i.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
    ]);
  });

  it("excludes done/cancelled from the sorted result", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "done-urgent", status: "done", priority: "urgent" }),
      issue({ id: "todo", priority: "low" }),
    ];
    expect(sortTodoIssues(list, today).map((i) => i.id)).toEqual(["todo"]);
  });

  it("does not mutate the input array", () => {
    const today = "2026-08-15";
    const list = [
      issue({ id: "a", priority: "low", position: 1 }),
      issue({ id: "b", priority: "high", position: 0 }),
    ];
    const original = list.map((i) => i.id);
    sortTodoIssues(list, today);
    expect(list.map((i) => i.id)).toEqual(original);
  });
});
