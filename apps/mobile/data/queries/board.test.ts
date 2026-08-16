import { describe, expect, it, vi } from "vitest";
import type { Issue } from "@multica/core/types";
import {
  applyBoardFilters,
  boardFilterHash,
  boardServerParams,
  groupIssuesByStatus,
  visibleBoardStatuses,
  type BoardFilter,
} from "./board";

// board.ts imports the native fetch client transitively; mock it so the Node
// test never loads RN modules (same pattern as chat-ws-updaters.test.ts).
vi.mock("@/data/api", () => ({ api: {} }));

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: "i1",
    workspace_id: "ws-1",
    number: 1,
    identifier: "MUL-1",
    title: "t",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_type: "member",
    assignee_id: "m1",
    creator_type: "member",
    creator_id: "m2",
    parent_issue_id: null,
    project_id: "p1",
    position: 0,
    stage: null,
    start_date: null,
    due_date: null,
    metadata: {},
    properties: {},
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("boardFilterHash", () => {
  it("is canonical regardless of toggle order", () => {
    const a = boardFilterHash({
      projectId: "p1",
      priorityFilters: ["high", "low"],
      assigneeFilters: [
        { type: "agent", id: "a1" },
        { type: "member", id: "m1" },
      ],
    });
    const b = boardFilterHash({
      projectId: "p1",
      priorityFilters: ["low", "high"],
      assigneeFilters: [
        { type: "member", id: "m1" },
        { type: "agent", id: "a1" },
      ],
    });
    expect(a).toBe(b);
  });

  it("differs when a filter value changes", () => {
    const a = boardFilterHash({ projectId: "p1", priorityFilters: [], assigneeFilters: [] });
    const b = boardFilterHash({ projectId: "p2", priorityFilters: [], assigneeFilters: [] });
    expect(a).not.toBe(b);
  });
});

describe("applyBoardFilters", () => {
  it("keeps every issue when no filter is active (positive selection)", () => {
    const items = [issue(), issue({ project_id: null, priority: "none" })];
    expect(
      applyBoardFilters(items, { projectId: null, priorityFilters: [], assigneeFilters: [] }),
    ).toHaveLength(2);
  });

  it("filters by single project", () => {
    const items = [issue({ project_id: "p1" }), issue({ project_id: "p2" })];
    expect(
      applyBoardFilters(items, { projectId: "p1", priorityFilters: [], assigneeFilters: [] }),
    ).toHaveLength(1);
  });

  it("filters by priority OR-within-selection", () => {
    const items = [issue({ priority: "high" }), issue({ priority: "low" })];
    expect(
      applyBoardFilters(items, {
        projectId: null,
        priorityFilters: ["high", "urgent"],
        assigneeFilters: [],
      }),
    ).toHaveLength(1);
  });

  it("drops unassigned issues when an assignee filter is active", () => {
    const items = [
      issue({ assignee_type: null, assignee_id: null }),
      issue({ assignee_type: "agent", assignee_id: "a1" }),
      issue({ assignee_type: "member", assignee_id: "m9" }),
    ];
    const filter: BoardFilter = {
      projectId: null,
      priorityFilters: [],
      assigneeFilters: [{ type: "agent", id: "a1" }],
    };
    expect(applyBoardFilters(items, filter)).toHaveLength(1);
  });
});

describe("visibleBoardStatuses", () => {
  it("returns the six BOARD_STATUSES (cancelled excluded) when no filter", () => {
    expect(visibleBoardStatuses([])).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "blocked",
    ]);
  });

  it("intersects with the active status filter, preserving column order", () => {
    expect(visibleBoardStatuses(["done", "todo"])).toEqual(["todo", "done"]);
  });
});

describe("groupIssuesByStatus", () => {
  it("keeps empty columns so the pager page count is stable", () => {
    const sections = groupIssuesByStatus([issue({ status: "todo" })], [
      "backlog",
      "todo",
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.data).toHaveLength(0);
    expect(sections[1]!.data).toHaveLength(1);
  });

  it("drops statuses not in the requested order", () => {
    const sections = groupIssuesByStatus(
      [issue({ status: "blocked" }), issue({ status: "done" })],
      ["done"],
    );
    expect(sections).toHaveLength(1);
    expect(sections[0]!.status).toBe("done");
  });
});

describe("boardServerParams", () => {
  it("omits every key when no non-status filter is active", () => {
    expect(
      boardServerParams({
        projectId: null,
        priorityFilters: [],
        assigneeFilters: [],
      }),
    ).toEqual({});
  });

  it("maps projectId to project_id when set", () => {
    expect(
      boardServerParams({
        projectId: "p1",
        priorityFilters: [],
        assigneeFilters: [],
      }),
    ).toEqual({ project_id: "p1" });
  });

  it("passes priorities through as an array", () => {
    expect(
      boardServerParams({
        projectId: null,
        priorityFilters: ["high", "urgent"],
        assigneeFilters: [],
      }),
    ).toEqual({ priorities: ["high", "urgent"] });
  });

  it("passes assignee_filters through as refs", () => {
    expect(
      boardServerParams({
        projectId: null,
        priorityFilters: [],
        assigneeFilters: [
          { type: "member", id: "m1" },
          { type: "agent", id: "a1" },
        ],
      }),
    ).toEqual({
      assignee_filters: [
        { type: "member", id: "m1" },
        { type: "agent", id: "a1" },
      ],
    });
  });

  it("combines project + priorities + assignees", () => {
    expect(
      boardServerParams({
        projectId: "p1",
        priorityFilters: ["high"],
        assigneeFilters: [{ type: "agent", id: "a1" }],
      }),
    ).toEqual({
      project_id: "p1",
      priorities: ["high"],
      assignee_filters: [{ type: "agent", id: "a1" }],
    });
  });

  it("never serializes status (columns are a render-time concern)", () => {
    const params = boardServerParams({
      projectId: "p1",
      priorityFilters: [],
      assigneeFilters: [],
    });
    expect("status" in params).toBe(false);
  });
});
