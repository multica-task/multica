import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "@multica/core/types";
import type { WSClient } from "@/data/realtime/ws-client";
import { staffRealtimeSubscriptions } from "./agent-ws-updaters";

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

type AnyHandler = (payload: unknown) => void;

/** Minimal WSClient fake — captures the registered handlers so the test can
 *  fire `agent:*` payloads and reconnect callbacks exactly like the server
 *  would, without touching the real WebSocket layer. */
function fakeWs() {
  const handlers = new Map<string, AnyHandler>();
  const reconnectCbs: (() => void)[] = [];
  const ws = {
    on: vi.fn((event: string, handler: AnyHandler) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    }),
    onReconnect: vi.fn((cb: () => void) => {
      reconnectCbs.push(cb);
      return () => {};
    }),
  };
  return {
    ws: ws as unknown as WSClient,
    handlers,
    reconnectCbs,
  };
}

describe("staffRealtimeSubscriptions", () => {
  it("registers the four agent:* events and one reconnect handler", () => {
    const qc = new QueryClient();
    const { ws, handlers, reconnectCbs } = fakeWs();

    staffRealtimeSubscriptions(qc, ws, "ws-1");

    expect(ws.on).toHaveBeenCalledTimes(4);
    for (const event of [
      "agent:status",
      "agent:created",
      "agent:archived",
      "agent:restored",
    ]) {
      expect(ws.on).toHaveBeenCalledWith(event, expect.any(Function));
      expect(handlers.has(event)).toBe(true);
    }
    expect(ws.onReconnect).toHaveBeenCalledTimes(1);
    expect(reconnectCbs).toHaveLength(1);
  });

  it("patches the agents list on agent:status (upsert)", () => {
    const qc = new QueryClient();
    qc.setQueryData(agentsKey("ws-1"), [makeAgent({ id: "a-1", status: "idle" })]);
    const { ws, handlers } = fakeWs();

    staffRealtimeSubscriptions(qc, ws, "ws-1");
    handlers.get("agent:status")!({ agent: makeAgent({ id: "a-1", status: "working" }) });

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual([
      makeAgent({ id: "a-1", status: "working" }),
    ]);
  });

  it("drops the agent on agent:archived", () => {
    const qc = new QueryClient();
    qc.setQueryData(agentsKey("ws-1"), [
      makeAgent({ id: "a-1" }),
      makeAgent({ id: "a-2" }),
    ]);
    const { ws, handlers } = fakeWs();

    staffRealtimeSubscriptions(qc, ws, "ws-1");
    handlers.get("agent:archived")!({
      agent: makeAgent({ id: "a-1", archived_at: "2026-05-01T00:00:00Z" }),
    });

    expect(qc.getQueryData(agentsKey("ws-1"))).toEqual([
      makeAgent({ id: "a-2" }),
    ]);
  });

  it("invalidates the agents list on reconnect (missed-events safety net)", () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { ws, reconnectCbs } = fakeWs();

    staffRealtimeSubscriptions(qc, ws, "ws-1");
    reconnectCbs[0]!();

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      agentsKey("ws-1"),
    ]);
  });
});
