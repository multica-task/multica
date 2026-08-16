import { describe, expect, it } from "vitest";
import type { Agent, ChatSession } from "@multica/core/types";
import { pickVoiceTarget } from "./voice-target";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    workspace_id: "ws-1",
    runtime_id: "rt-1",
    name: "Test Agent",
    description: "",
    instructions: "",
    avatar_url: null,
    runtime_mode: "local",
    runtime_config: {},
    custom_args: [],
    visibility: "workspace",
    permission_mode: "public_to",
    invocation_targets: [{ target_type: "workspace", target_id: null }],
    status: "idle",
    max_concurrent_tasks: 6,
    model: "",
    owner_id: null,
    skills: [],
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    archived_at: null,
    archived_by: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "session-1",
    workspace_id: "ws-1",
    agent_id: "agent-1",
    creator_id: "user-1",
    title: "Test Session",
    status: "active",
    has_unread: false,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

const USER_ID = "user-1";
const MEMBER_ROLE = "member" as const;

describe("pickVoiceTarget", () => {
  it("picks the first available agent when no default is set", () => {
    const agents = [
      makeAgent({ id: "a-1", name: "Alpha" }),
      makeAgent({ id: "a-2", name: "Beta" }),
    ];
    const target = pickVoiceTarget({
      agents,
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
    });
    expect(target.agent?.id).toBe("a-1");
  });

  it("skips archived, non-assignable, and unbound agents", () => {
    const agents = [
      makeAgent({ id: "archived", archived_at: "2026-05-01T00:00:00Z" }),
      // private agent owned by someone else → not assignable for a member
      makeAgent({ id: "private", permission_mode: "private", owner_id: "other" }),
      makeAgent({ id: "unbound", runtime_id: "", runtime_bound: false }),
      makeAgent({ id: "ok" }),
    ];
    const target = pickVoiceTarget({
      agents,
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
    });
    expect(target.agent?.id).toBe("ok");
  });

  it("returns null when no agent is available", () => {
    const target = pickVoiceTarget({
      agents: [],
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
    });
    expect(target.agent).toBeNull();
    expect(target.sessionId).toBeNull();
  });

  it("prefers the default agent when it is available", () => {
    const agents = [
      makeAgent({ id: "a-1", name: "Alpha" }),
      makeAgent({ id: "a-2", name: "Beta" }),
    ];
    const target = pickVoiceTarget({
      agents,
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
      defaultAgentId: "a-2",
    });
    expect(target.agent?.id).toBe("a-2");
  });

  it("falls back to the first available agent when the default is unavailable", () => {
    const agents = [
      makeAgent({ id: "a-1", name: "Alpha" }),
      makeAgent({ id: "default", archived_at: "2026-05-01T00:00:00Z" }),
    ];
    const target = pickVoiceTarget({
      agents,
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
      defaultAgentId: "default",
    });
    expect(target.agent?.id).toBe("a-1");
  });

  it("resolves the existing non-archived session for the target agent", () => {
    const agents = [makeAgent({ id: "a-1" })];
    const sessions = [
      makeSession({ id: "archived-session", agent_id: "a-1", status: "archived" }),
      makeSession({ id: "active-session", agent_id: "a-1", status: "active" }),
    ];
    const target = pickVoiceTarget({
      agents,
      sessions,
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
    });
    expect(target.agent?.id).toBe("a-1");
    expect(target.sessionId).toBe("active-session");
  });

  it("returns null session id when the target agent has no session yet", () => {
    const agents = [makeAgent({ id: "a-1" })];
    const target = pickVoiceTarget({
      agents,
      sessions: [],
      userId: USER_ID,
      memberRole: MEMBER_ROLE,
    });
    expect(target.agent?.id).toBe("a-1");
    expect(target.sessionId).toBeNull();
  });
});
