/**
 * Presence realtime — Layer 3 of the realtime stack. Listing-level (always
 * on while the user is inside a workspace).
 *
 * Invalidates the queries that back the presence dot:
 *   - runtimeListOptions      ← daemon:register, runtime sweeper transitions
 *   - agentTaskSnapshotOptions← task:queued / dispatch / completed / failed /
 *                               cancelled
 *
 * agent:* events are intentionally NOT subscribed here (评审修复 MEDIUM-4):
 * `useStaffRealtime` already patches the agents list cache with the full
 * payload (`agent-ws-updaters.ts`), so an additional invalidate on the same
 * event would discard the patch and force a refetch — the cellular-data rule
 * violation the dedup fixes. Presence dots read the agents cache, which the
 * staff realtime keeps fresh.
 *
 * Deliberately NOT subscribed (cellular-data rule, apps/mobile/CLAUDE.md):
 *   - daemon:heartbeat — every 15s × in-online runtime; web also skips it
 *     (packages/core/realtime/use-realtime-sync.ts:147). An invalidate per
 *     heartbeat would refetch runtimes+snapshot 4× a minute per online
 *     runtime — guaranteed to wedge the user on cellular.
 *   - task:progress / task:message — fire many times per active task. The
 *     presence cache only needs lifecycle transitions, not per-step updates.
 *
 * Reconnect: re-invalidate runtimes + snapshot (agents handled by
 * `useStaffRealtime`'s own reconnect invalidate).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useWSSubscriptions } from "@/lib/use-ws-subscriptions";

export function usePresenceRealtime() {
  const queryClient = useQueryClient();

  useWSSubscriptions(
    (ws, wsId) => {
      const runtimesKey = ["runtimes", wsId];
      const snapshotKey = ["agent-task-snapshot", wsId];

      const invalidateRuntimes = () =>
        queryClient.invalidateQueries({ queryKey: runtimesKey });
      const invalidateSnapshot = () =>
        queryClient.invalidateQueries({ queryKey: snapshotKey });

      return [
        // Daemon lifecycle — register events mean a runtime came online or
        // re-registered; the sweeper's offline transitions are NOT pushed as
        // a WS event, but the next task:* event will pull a fresh runtime
        // list anyway, and the 30s wall-clock tick masks the gap.
        // Heartbeats deliberately omitted.
        ws.on("daemon:register", invalidateRuntimes),

        // Task lifecycle — drives the workload dimension of presence and the
        // reserved-for-P1 peek sheet. progress / message intentionally absent.
        ws.on("task:queued", invalidateSnapshot),
        ws.on("task:dispatch", invalidateSnapshot),
        ws.on("task:completed", invalidateSnapshot),
        ws.on("task:failed", invalidateSnapshot),
        ws.on("task:cancelled", invalidateSnapshot),

        // We may have missed sweeper-driven runtime offline transitions
        // while disconnected — refetch runtimes + snapshot.
        ws.onReconnect(() => {
          invalidateRuntimes();
          invalidateSnapshot();
        }),
      ];
    },
    [queryClient],
  );
}
