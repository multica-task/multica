/**
 * Board realtime — listing-level subscription (PRD §5.4). Mounted globally
 * in `<RealtimeSubscriptions />` so the board stays fresh regardless of
 * which tab is foregrounded.
 *
 *   issue:created     — invalidate boardAll(wsId). We don't try to predict
 *                       whether the new issue matches the current
 *                       project/priority/assignee filter; a fresh fetch is
 *                       the cheapest correct answer.
 *   issue:updated     — patch every board list in place. The full payload
 *                       carries the new status, so a cross-column move is
 *                       just an object replace — the client-side column
 *                       grouping re-buckets on render.
 *   issue:deleted     — strip from every board list.
 *   project:updated   — NOT subscribed here. The swimlane reads the projects
 *                       cache, which `useProjectsRealtime` already patches;
 *                       a project rename does not change any issue's data in
 *                       the board caches, so a duplicate listener would be
 *                       pure CPU (apps/mobile/CLAUDE.md: no listener with no
 *                       consumer).
 *   onReconnect       — invalidate boardAll since we may have missed a
 *                       create/delete while disconnected.
 */
import { useQueryClient } from "@tanstack/react-query";
import { issueKeys } from "@/data/queries/issue-keys";
import { useWSSubscriptions } from "@/lib/use-ws-subscriptions";
import {
  invalidateBoardLists,
  patchBoardLists,
  removeFromBoardLists,
} from "./board-ws-updaters";

export function useBoardRealtime() {
  const qc = useQueryClient();

  useWSSubscriptions(
    (ws, wsId) => {
      const invalidateBoard = () => invalidateBoardLists(qc, wsId);

      return [
        ws.on("issue:created", () => invalidateBoard()),
        ws.on("issue:updated", (payload) => {
          patchBoardLists(qc, wsId, payload.issue);
        }),
        ws.on("issue:deleted", (payload) => {
          removeFromBoardLists(qc, wsId, payload.issue_id);
        }),
        ws.onReconnect(invalidateBoard),
      ];
    },
    [qc],
  );
}
