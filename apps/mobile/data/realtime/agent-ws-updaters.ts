/**
 * Mobile-owned WS cache patchers for the agent domain.
 *
 * Pure functions over QueryClient — no React, no WS plumbing. Used by
 * `use-staff-realtime.ts` to apply `agent:*` events to the agents list
 * cache in place (≤500ms, zero network), mirroring the presence realtime's
 * invalidate-driven refresh but cheaper for the staff rail.
 *
 * Why mobile-owned: mirrors `packages/core/realtime/use-realtime-sync.ts`
 * agent handlers but binds to mobile's `["agents", wsId]` cache key (same
 * reason chat-ws-updaters.ts doesn't import web's updaters — key-factory
 * drift).
 *
 * Cache shapes:
 *   - `["agents", wsId]` → Agent[]
 *
 * The `agent:*` payloads carry the FULL Agent object (packages/core/types/
 * events.ts AgentStatusPayload / AgentCreatedPayload / AgentArchivedPayload /
 * AgentRestoredPayload), so a `setQueryData` upsert is always possible.
 */
import type { QueryClient } from "@tanstack/react-query";
import type {
  AgentArchivedPayload,
  AgentCreatedPayload,
  AgentRestoredPayload,
  AgentStatusPayload,
} from "@multica/core/types";
import type { WSClient } from "@/data/realtime/ws-client";

const agentsKey = (wsId: string | null) => ["agents", wsId] as const;

/** Upsert an agent into the cached list (status / created / restored). */
export function upsertAgentInList(
  qc: QueryClient,
  wsId: string | null,
  payload: AgentStatusPayload | AgentCreatedPayload | AgentRestoredPayload,
) {
  qc.setQueryData(agentsKey(wsId), (old?: unknown[]) => {
    if (!old) return old;
    const next = payload.agent;
    const idx = old.findIndex((a) => (a as { id: string }).id === next.id);
    if (idx === -1) return [...old, next];
    const copy = [...old];
    copy[idx] = next;
    return copy;
  });
}

/** Remove an archived agent from the cached list. */
export function dropArchivedAgentFromList(
  qc: QueryClient,
  wsId: string | null,
  payload: AgentArchivedPayload,
) {
  qc.setQueryData(agentsKey(wsId), (old?: unknown[]) =>
    old?.filter((a) => (a as { id: string }).id !== payload.agent.id),
  );
}

/** Reconnect safety net for the agents list — may have missed create/archived
 *  while disconnected (评审修复 MEDIUM-4：staff realtime 自己持有重连
 *  invalidate，不再依赖 presence realtime）。 */
export function invalidateAgentLists(qc: QueryClient, wsId: string | null) {
  qc.invalidateQueries({ queryKey: agentsKey(wsId) });
}

/**
 * Pure subscription setup for `useStaffRealtime` — extracted so the event →
 * cache-mutation wiring is unit-testable without rendering React (vitest
 * lane is Node-only, apps/mobile/vitest.config.ts).
 *
 * `agent:*` payloads carry the FULL Agent object, so all four events patch
 * the agents list in place (≤500ms, zero network); reconnect invalidates as
 * the missed-events safety net.
 */
export function staffRealtimeSubscriptions(
  qc: QueryClient,
  ws: WSClient,
  wsId: string,
): (() => void)[] {
  return [
    ws.on("agent:status", (payload) => upsertAgentInList(qc, wsId, payload)),
    ws.on("agent:created", (payload) => upsertAgentInList(qc, wsId, payload)),
    ws.on("agent:archived", (payload) =>
      dropArchivedAgentFromList(qc, wsId, payload),
    ),
    ws.on("agent:restored", (payload) =>
      upsertAgentInList(qc, wsId, payload),
    ),
    ws.onReconnect(() => invalidateAgentLists(qc, wsId)),
  ];
}
