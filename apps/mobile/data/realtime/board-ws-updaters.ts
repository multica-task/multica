/**
 * Mobile-owned WS cache patchers for the board — PRD §5.4.
 *
 * Board caches are flat `Issue[]` keyed by `issueKeys.boardList(wsId, filterHash)`
 * (one per non-status filter combo). A status change is a cross-column move
 * in the UI, but in cache terms it is just an object update: the board groups
 * columns client-side, so `{ ...issue, status }` lands it in the new column's
 * array on the next render (PRD §5.4 "跨列移动 = 从旧列数组移除 + 插入新列").
 *
 * These patchers update EVERY board list under `boardAll(wsId)` via
 * setQueriesData — like `patchMyIssuesList`, we don't know which filter
 * combo an event's issue belongs to. Membership (does this issue still match
 * this list's project/priority/assignee scope?) is re-derived on render by
 * `applyBoardFilters` (data/queries/board.ts), so an issue that moved out of
 * scope disappears without the patcher needing to know each list's filter.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { Issue } from "@multica/core/types";
import { issueKeys } from "@/data/queries/issue-keys";

export function patchBoardLists(
  qc: QueryClient,
  wsId: string,
  partial: Partial<Issue> & { id: string },
) {
  qc.setQueriesData<Issue[]>({ queryKey: issueKeys.boardAll(wsId) }, (old) =>
    old ? old.map((i) => (i.id === partial.id ? { ...i, ...partial } : i)) : old,
  );
}

export function removeFromBoardLists(
  qc: QueryClient,
  wsId: string,
  issueId: string,
) {
  qc.setQueriesData<Issue[]>({ queryKey: issueKeys.boardAll(wsId) }, (old) =>
    old ? old.filter((i) => i.id !== issueId) : old,
  );
}

/** Reconnect / create fallback — we may have missed a create while offline,
 *  or the new issue's filter membership is unknown. A fresh fetch is the
 *  cheapest correct answer. */
export function invalidateBoardLists(qc: QueryClient, wsId: string) {
  qc.invalidateQueries({ queryKey: issueKeys.boardAll(wsId) });
}
