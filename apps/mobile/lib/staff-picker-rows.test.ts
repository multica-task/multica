import { describe, expect, it } from "vitest";
import { AgentSchema } from "@/data/schemas";
import {
  searchStaffAgents,
  visibleStaffAgents,
  type MemberRoleLike,
} from "./staff-picker-rows";

/**
 * Minimal valid Agent via AgentSchema.parse (same factory pattern as
 * agent-schema.test.ts). AgentSchema defaults make an agent private-mode /
 * unarchived / ownerless — the safe default for a personal agent. Use
 * `permission_mode: "public_to"` + a workspace target for a shared
 * workspace agent.
 */
function agent(partial: Record<string, unknown> = {}) {
  return AgentSchema.parse({ id: "agent-1", ...partial });
}

/** A public_to agent with a workspace-wide invocation grant. */
function workspaceAgent(partial: Record<string, unknown> = {}) {
  return agent({
    permission_mode: "public_to",
    invocation_targets: [{ target_type: "workspace", target_id: null }],
    ...partial,
  });
}

/** A public_to agent with a single-member invocation grant. */
function memberTargetAgent(targetUserId: string, partial: Record<string, unknown> = {}) {
  return agent({
    permission_mode: "public_to",
    invocation_targets: [{ target_type: "member", target_id: targetUserId }],
    ...partial,
  });
}

function ids(agents: ReturnType<typeof visibleStaffAgents>) {
  return agents.map((a) => a.id);
}

describe("visibleStaffAgents", () => {
  const member: MemberRoleLike = "member";

  it("drops archived agents", () => {
    const agents = [
      workspaceAgent({ id: "a1" }),
      workspaceAgent({ id: "a2", archived_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  it("drops private agents the user cannot assign", () => {
    const agents = [
      agent({ id: "a1", permission_mode: "private", owner_id: "someone-else" }),
    ];
    expect(visibleStaffAgents(agents, "user-1", member)).toEqual([]);
  });

  it("keeps a workspace-granted agent for any member", () => {
    const agents = [workspaceAgent({ id: "a1" })];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  it("keeps a private agent owned by the current user", () => {
    const agents = [
      agent({ id: "a1", permission_mode: "private", owner_id: "user-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "user-1", member))).toEqual(["a1"]);
  });

  it("does NOT grant workspace admins an admin-bypass on private agents (MUL-3963 alignment)", () => {
    // Regression test tracking the admin-bypass divergence: the pre-MUL-3963
    // mobile mirror granted workspace admins access to private agents, but
    // the authoritative rule (packages/core/permissions/rules.ts
    // canAssignAgentToIssue) and the server canInvokeAgent gate do NOT. An
    // admin dispatching to someone else's private agent would get a 403.
    const agents = [
      agent({ id: "a1", permission_mode: "private", owner_id: "owner-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "admin-1", "admin"))).toEqual([]);
  });

  it("lets the owner of a private agent assign it regardless of role", () => {
    const agents = [
      agent({ id: "a1", permission_mode: "private", owner_id: "owner-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "owner-1", "owner"))).toEqual([
      "a1",
    ]);
  });

  it("keeps a member-targeted public_to agent for the targeted user only", () => {
    const agents = [memberTargetAgent("target-1", { id: "a1" })];
    expect(ids(visibleStaffAgents(agents, "target-1", "member"))).toEqual(["a1"]);
    expect(visibleStaffAgents(agents, "someone-else", "member")).toEqual([]);
  });

  it("treats team-target grants as inert in v1", () => {
    const agents = [
      agent({
        id: "a1",
        permission_mode: "public_to",
        invocation_targets: [{ target_type: "team", target_id: "team-1" }],
      }),
    ];
    expect(visibleStaffAgents(agents, "user-1", "member")).toEqual([]);
  });

  it("drops workspace agents when memberRole is not loaded (undefined/null)", () => {
    // Member list not yet fetched → memberRole is undefined → role is null.
    // A workspace grant must not render as available before the caller is
    // known to be a member (would otherwise over-grant on a slow fetch).
    const agents = [workspaceAgent({ id: "a1" })];
    expect(visibleStaffAgents(agents, "user-1", undefined)).toEqual([]);
    expect(visibleStaffAgents(agents, "user-1", null)).toEqual([]);
  });

  it("still lets the owner through even before the member list loads", () => {
    const agents = [
      agent({ id: "a1", permission_mode: "private", owner_id: "owner-1" }),
    ];
    expect(ids(visibleStaffAgents(agents, "owner-1", undefined))).toEqual([
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

  it("sorts CJK / non-ASCII names with localeCompare (pinyin collation)", () => {
    const agents = [
      agent({ id: "a1", name: "张三" }),
      agent({ id: "a2", name: "李四" }),
      agent({ id: "a3", name: "Alice" }),
    ];
    const sorted = searchStaffAgents(agents, "").map((a) => a.name);
    // localeCompare sorts by locale collation — the important assertions are
    // that CJK names survive the sort and ASCII sorts ahead in most locales.
    expect(sorted).toHaveLength(3);
    expect(sorted[0]).toBe("Alice");
    expect(sorted).toContain("张三");
    expect(sorted).toContain("李四");
  });

  it("matches CJK names by substring", () => {
    const agents = [agent({ id: "a1", name: "数据工程师" })];
    expect(ids(searchStaffAgents(agents, "数据"))).toEqual(["a1"]);
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
