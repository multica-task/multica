/**
 * Board queries + pure helpers — PRD §5.
 *
 * The board is workspace-level (NOT "my issues"): it visualises every
 * project's tasks. Main data source is `/api/issues` (workspace full list,
 * narrowed by the non-status filters the backend supports) + `/api/projects`
 * for the swimlane grouping. No new endpoints this milestone.
 *
 * Cache shape: one flat `Issue[]` per `issueKeys.boardList(wsId, filterHash)`.
 * Status is deliberately NOT part of the filter hash — the cache carries all
 * statuses for the current project/priority/assignee scope, columns are
 * grouped client-side, and a status change only moves the object between
 * column arrays in memory (cross-column patch, PRD §5.4). Status visibility
 * is a render-time concern (`visibleBoardStatuses`).
 *
 * The client re-applies the same filters to the fetched list (`applyBoardFilters`)
 * as a defensive double-check: the server may not honour every param on
 * `/api/issues` (PRD §5.4 "服务端支持部分、客户端补齐"), and an `issue:updated`
 * WS patch can push an object that no longer matches the scope into the cache —
 * filtering on render keeps parity with web's `applyIssueFilters` without the
 * updater needing to know each cache's filter.
 */
import { queryOptions } from "@tanstack/react-query";
import type {
  Issue,
  IssueActorRef,
  IssuePriority,
  IssueStatus,
  ListIssuesParams,
} from "@multica/core/types";
import { api } from "@/data/api";
import { issueKeys } from "./issue-keys";
import { BOARD_STATUSES } from "@/lib/issue-status";

export interface BoardFilter {
  /** null = 全部项目. */
  projectId: string | null;
  /** Empty = 全部. */
  priorityFilters: IssuePriority[];
  /** Empty = 全部. `IssueActorRef` = { type: "member" | "agent" | "squad", id }. */
  assigneeFilters: IssueActorRef[];
}

export type BoardView = "columns" | "swimlanes" | "progress";

/** Canonical key discriminator — sort the arrays so equivalent filters hash
 *  identically regardless of the order the user toggled them in. */
export function boardFilterHash(filter: BoardFilter): string {
  return JSON.stringify({
    project_id: filter.projectId,
    priorities: [...filter.priorityFilters].sort(),
    assignees: [...filter.assigneeFilters]
      .sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id))
      .map((f) => `${f.type}:${f.id}`),
  });
}

/** Server-side narrowing for `/api/issues`. Status stays out of the request
 *  on purpose (see module doc). */
export function boardServerParams(filter: BoardFilter): ListIssuesParams {
  return {
    ...(filter.projectId ? { project_id: filter.projectId } : {}),
    ...(filter.priorityFilters.length > 0
      ? { priorities: filter.priorityFilters }
      : {}),
    ...(filter.assigneeFilters.length > 0
      ? { assignee_filters: filter.assigneeFilters }
      : {}),
  };
}

/**
 * Client-side re-application of the non-status filters. Mirrors web's
 * `applyIssueFilters` positive-selection semantics (empty array = show all,
 * `packages/views/issues/utils/filter.ts:99-175`).
 */
export function applyBoardFilters(
  issues: Issue[],
  filter: BoardFilter,
): Issue[] {
  return issues.filter((issue) => {
    if (filter.projectId && issue.project_id !== filter.projectId) {
      return false;
    }
    if (
      filter.priorityFilters.length > 0 &&
      !filter.priorityFilters.includes(issue.priority)
    ) {
      return false;
    }
    if (filter.assigneeFilters.length > 0) {
      if (!issue.assignee_type || !issue.assignee_id) return false;
      if (
        !filter.assigneeFilters.some(
          (f) => f.type === issue.assignee_type && f.id === issue.assignee_id,
        )
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Which status columns are visible given the status filter. `BOARD_STATUSES`
 * order preserved; `cancelled` is never a column (PRD §5.2 — the issue's
 * acceptance criteria: "无 cancelled 列"). Empty status filter = show all.
 */
export function visibleBoardStatuses(statusFilters: IssueStatus[]): IssueStatus[] {
  return statusFilters.length > 0
    ? BOARD_STATUSES.filter((s) => statusFilters.includes(s))
    : BOARD_STATUSES;
}

export interface BoardStatusSection {
  status: IssueStatus;
  data: Issue[];
}

/**
 * Group a filtered issue list into BOARD_STATUSES-ordered columns. Every
 * status in `statuses` becomes a column — including empty ones (count 0) —
 * so the horizontal pager keeps a stable page count / dot indicator
 * (prototype 03-board shows "‹ 2/6 ›" + 6 dots with empty columns present).
 * The swimlane view builds its own per-project sections from the same data.
 */
export function groupIssuesByStatus(
  issues: Issue[],
  statuses: IssueStatus[],
): BoardStatusSection[] {
  const byStatus = new Map<IssueStatus, Issue[]>();
  for (const issue of issues) {
    const list = byStatus.get(issue.status);
    if (list) list.push(issue);
    else byStatus.set(issue.status, [issue]);
  }
  return statuses.map((status) => ({
    status,
    data: byStatus.get(status) ?? [],
  }));
}

export const boardListOptions = (
  wsId: string | null,
  filter: BoardFilter,
) =>
  queryOptions({
    queryKey: issueKeys.boardList(wsId, boardFilterHash(filter)),
    queryFn: async ({ signal }) => {
      const res = await api.listIssues(boardServerParams(filter), { signal });
      return res.issues;
    },
    enabled: !!wsId,
  });
