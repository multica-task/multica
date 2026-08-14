import { describe, expect, it } from "vitest";
import { AgentSchema } from "@/data/schemas";
import {
  searchStaffAgents,
  visibleStaffAgents,
  type MemberRoleLike,
} from "./staff-picker-rows";

/**
 * Minimal valid Agent via AgentSchema.parse (same factory pattern as
 * agent-schema.test.ts). AgentSchema defaults make an agent workspace-visible,
 * unarchived, ownerless — the common case for a shared workspace agent.
 */
function agent(partial: Record<string, unknown> = {}) {
  return AgentSchema.parse({ id: "agent-1", ...partial });
}

function ids(agents: ReturnType<typeof visibleStaffAgents>) {
  return agents.map((a) => a.id);
}

describe("visibleStaffAgents", () => {
  const member: MemberRoleLike = "member";

  it("drops archived agents", () => {
    const agents = [
      agent({ id: "a1" }),
      agent({ id: "a2", archived_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  it("drops private agents the user cannot assign", () => {
    const agents = [
      agent({ id: "a1", visibility: "private", owner_id: "someone-else" }),
    ];
    expect(visibleStaffAgents(agents, "user-1", member)).toEqual([]);
  });

  it("keeps a workspace-visible agent for any member", () => {
    const agents = [agent({ id: "a1" })];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  it("keeps a private agent owned by the current user", () => {
    const agents = [
      agent({ id: "a1", visibility: "private", owner_id: "user-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  // NOTE: no admin-bypass case here. The current mobile mirror
  // (lib/can-assign-agent.ts) still grants admins access to private agents
  // (pre-MUL-3963 rule), but the authoritative core rule
  // (packages/core/permissions/rules.ts canAssignAgentToIssue) does not —
  // updating the mirror is a cross-cutting follow-up (chat + availability),
  // and we deliberately do not codify the stale admin-bypass behavior here.

  it("allows an owner to assign private agents regardless of role", () => {
    const agents = [
      agent({ id: "a1", visibility: "private", owner_id: "owner-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "owner-1", "owner"))).toEqual([
      "a1",
    ]);
  });
});

describe("searchStaffAgents", () => {
  it("returns all agents alphabetically when the query is empty", () => {
    const agents = [agent({ id: "a1", name: "zeta" }), agent({ id: "a2", name: "alpha" })];
    expect(ids(searchStaffAgents(agents, ""))).toEqual(["a2", "a1"]);
  });

  it("matches names case-insensitively and keeps alphabetical order", () => {
    const agents = [
      agent({ id: "a1", name: "Beta Marketing" }),
      agent({ id: "a2", name: "alpha marketing" }),
      agent({ id: "a3", name: "Developer" }),
    ];
    expect(ids(searchStaffAgents(agents, "MARKET"))).toEqual(["a2", "a1"]);
  });

  it("trims surrounding whitespace from the query", () => {
    const agents = [agent({ id: "a1", name: "Designer" })];
    expect(ids(searchStaffAgents(agents, "  designer  "))).toEqual(["a1"]);
  });

  it("returns an empty list when nothing matches", () => {
    const agents = [agent({ id: "a1", name: "Designer" })];
    expect(searchStaffAgents(agents, "nope")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const agents = [agent({ id: "a1", name: "zeta" }), agent({ id: "a2", name: "alpha" })];
    const snapshot = agents.map((a) => a.id);
    searchStaffAgents(agents, "");
    expect(agents.map((a) => a.id)).toEqual(snapshot);
  });
});
