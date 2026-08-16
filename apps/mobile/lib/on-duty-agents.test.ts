import { describe, expect, it } from "vitest";
import type { Agent } from "@multica/core/types";
import { countOnDutyAgents } from "./on-duty-agents";

function agent(over: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    workspace_id: "ws-1",
    runtime_id: "runtime-1",
    name: "数字员工",
    description: "",
    instructions: "",
    avatar_url: null,
    runtime_mode: "cloud",
    runtime_config: {},
    custom_args: [],
    visibility: "workspace",
    permission_mode: "public_to",
    invocation_targets: [{ target_type: "workspace", target_id: null }],
    status: "idle",
    max_concurrent_tasks: 1,
    model: "claude",
    owner_id: null,
    skills: [],
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    archived_at: null,
    archived_by: null,
    ...over,
  };
}

describe("countOnDutyAgents", () => {
  it("counts idle and working agents", () => {
    const agents = [
      agent({ id: "a", status: "idle" }),
      agent({ id: "b", status: "working" }),
    ];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(2);
  });

  it("excludes blocked / error / offline", () => {
    const agents = [
      agent({ id: "a", status: "blocked" }),
      agent({ id: "b", status: "error" }),
      agent({ id: "c", status: "offline" }),
    ];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(0);
  });

  it("excludes archived agents", () => {
    const agents = [agent({ id: "a", status: "idle", archived_at: "2026-08-02T00:00:00Z" })];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(0);
  });

  it("excludes agents the current user cannot assign to", () => {
    // private agent owned by someone else, member role → not visible
    const agents = [
      agent({
        id: "private-other",
        permission_mode: "private",
        owner_id: "someone-else",
        status: "idle",
      }),
    ];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(0);
  });

  it("counts private agents the user owns", () => {
    const agents = [
      agent({
        id: "private-mine",
        permission_mode: "private",
        owner_id: "user-1",
        status: "idle",
      }),
    ];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(1);
  });

  it("treats an unknown future status as not on duty (safe default)", () => {
    const agents = [
      agent({ id: "unknown", status: "paused" as Agent["status"] }),
    ];
    expect(countOnDutyAgents(agents, "user-1", "member")).toBe(0);
  });
});
