import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Agent, AgentArchivedPayload } from "@multica/core/types";
import {
  dropArchivedAgentFromList,
  invalidateAgentLists,
  upsertAgentInList,
} from "./agent-ws-updaters";

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

const agentsKey = (wsId: string | null) => ["agents", wsId] as const;

describe("upsertAgentInList", () => {
  it("appends a new agent when it is not in the cached list", () => {
    const qc = new QueryClient();
    qc.setQueryData(agentsKey("ws-1"), [makeAgent({ id: "a-1" })]);
    const next = makeAgent({ id: "a-2", status: "working" });

    upsertAgentInList(qc, "ws-1", { agent: next });

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual([
      makeAgent({ id: "a-1" }),
      next,
    ]);
  });

  it("replaces the existing entry in place when the id matches", () => {
    const qc = new QueryClient();
    qc.setQueryData(agentsKey("ws-1"), [makeAgent({ id: "a-1", status: "idle" })]);
    const updated = makeAgent({ id: "a-1", status: "working" });

    upsertAgentInList(qc, "ws-1", { agent: updated });

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual([updated]);
    expect(qc.getQueryData(agentsKey("ws-1"))).toHaveLength(1);
  });

  it("is a no-op when no list is cached yet", () => {
    const qc = new QueryClient();

    upsertAgentInList(qc, "ws-1", { agent: makeAgent() });

    expect(qc.getQueryData(agentsKey("ws-1"))).toBeUndefined();
  });
});

describe("dropArchivedAgentFromList", () => {
  it("removes the archived agent from the cached list", () => {
    const qc = new QueryClient();
    qc.setQueryData(agentsKey("ws-1"), [
      makeAgent({ id: "a-1" }),
      makeAgent({ id: "a-2" }),
    ]);
    const payload: AgentArchivedPayload = {
      agent: makeAgent({ id: "a-1", archived_at: "2026-05-01T00:00:00Z" }),
    };

    dropArchivedAgentFromList(qc, "ws-1", payload);

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual([
      makeAgent({ id: "a-2" }),
    ]);
  });

  it("keeps the list unchanged when the id is not present", () => {
    const qc = new QueryClient();
    const list = [makeAgent({ id: "a-1" })];
    qc.setQueryData(agentsKey("ws-1"), list);

    dropArchivedAgentFromList(qc, "ws-1", { agent: makeAgent({ id: "nope" }) });

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual(list);
  });
});

describe("invalidateAgentLists", () => {
  it("invalidates the workspace agents query (reconnect safety net)", () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    invalidateAgentLists(qc, "ws-1");

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      agentsKey("ws-1"),
    ]);
  });
});
