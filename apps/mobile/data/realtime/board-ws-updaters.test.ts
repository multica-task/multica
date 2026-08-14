import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "@multica/core/types";

import { issueKeys } from "@/data/queries/issue-keys";
import {
  invalidateBoardLists,
  patchBoardLists,
  removeFromBoardLists,
} from "./board-ws-updaters";

// board-ws-updaters imports issueKeys from data/queries/issue-keys, which is
// a pure key factory (no fetch client transitively). Same pattern as
// issue-ws-updaters.test.ts — no api mock needed, and QueryClient works
// headless in the node test environment.

const WS = "workspace-1";

function issue(id: string, over: Partial<Issue> = {}): Issue {
  return {
    id,
    workspace_id: WS,
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

/** Seed two board list caches (different filter hashes) plus a non-board
 *  list, so we can assert the patchers touch every board list but nothing
 *  outside the `boardAll` prefix. */
function seedBoardCaches(qc: QueryClient) {
  const listA = issueKeys.boardList(WS, "hash-a");
  const listB = issueKeys.boardList(WS, "hash-b");
  const unrelated = issueKeys.list(WS);

  qc.setQueryData<Issue[]>(listA, [
    issue("i1", { status: "todo" }),
    issue("i2", { status: "in_progress" }),
  ]);
  qc.setQueryData<Issue[]>(listB, [issue("i1", { status: "todo" })]);
  qc.setQueryData<Issue[]>(unrelated, [issue("i1", { status: "todo" })]);

  return { listA, listB, unrelated };
}

describe("patchBoardLists", () => {
  it("applies the partial to the matching issue in every board list", () => {
    const qc = new QueryClient();
    const { listA, listB, unrelated } = seedBoardCaches(qc);

    patchBoardLists(qc, WS, { id: "i1", status: "done" });

    // Both board caches reflect the cross-column move.
    expect(qc.getQueryData<Issue[]>(listA)).toEqual([
      issue("i1", { status: "done" }),
      issue("i2", { status: "in_progress" }),
    ]);
    expect(qc.getQueryData<Issue[]>(listB)).toEqual([
      issue("i1", { status: "done" }),
    ]);

    // Non-board list under the same ws is untouched.
    expect(qc.getQueryData<Issue[]>(unrelated)).toEqual([
      issue("i1", { status: "todo" }),
    ]);
  });

  it("leaves other issues in the same list untouched", () => {
    const qc = new QueryClient();
    const { listA } = seedBoardCaches(qc);

    patchBoardLists(qc, WS, { id: "i2", status: "blocked" });

    expect(qc.getQueryData<Issue[]>(listA)).toEqual([
      issue("i1", { status: "todo" }),
      issue("i2", { status: "blocked" }),
    ]);
  });

  it("is a no-op when the issue is absent (membership is render-time)", () => {
    const qc = new QueryClient();
    const { listA } = seedBoardCaches(qc);

    patchBoardLists(qc, WS, { id: "ghost", status: "done" });

    expect(qc.getQueryData<Issue[]>(listA)).toEqual([
      issue("i1", { status: "todo" }),
      issue("i2", { status: "in_progress" }),
    ]);
  });

  it("does nothing when no board caches exist yet", () => {
    const qc = new QueryClient();

    expect(() => patchBoardLists(qc, WS, { id: "i1", status: "done" })).not.toThrow();
  });
});

describe("removeFromBoardLists", () => {
  it("strips the issue from every board list", () => {
    const qc = new QueryClient();
    const { listA, listB, unrelated } = seedBoardCaches(qc);

    removeFromBoardLists(qc, WS, "i1");

    expect(qc.getQueryData<Issue[]>(listA)).toEqual([
      issue("i2", { status: "in_progress" }),
    ]);
    expect(qc.getQueryData<Issue[]>(listB)).toEqual([]);

    // Non-board list keeps the issue.
    expect(qc.getQueryData<Issue[]>(unrelated)).toEqual([
      issue("i1", { status: "todo" }),
    ]);
  });

  it("leaves lists without the issue unchanged", () => {
    const qc = new QueryClient();
    const { listA } = seedBoardCaches(qc);

    removeFromBoardLists(qc, WS, "ghost");

    expect(qc.getQueryData<Issue[]>(listA)).toEqual([
      issue("i1", { status: "todo" }),
      issue("i2", { status: "in_progress" }),
    ]);
  });
});

describe("invalidateBoardLists", () => {
  it("invalidates every cache under the boardAll prefix", () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    invalidateBoardLists(qc, WS);

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: issueKeys.boardAll(WS),
    });
  });
});
