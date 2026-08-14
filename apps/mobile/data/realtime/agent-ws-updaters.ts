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
