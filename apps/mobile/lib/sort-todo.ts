/**
 * Home "待办事项" (todo) block derivation.
 *
 * PRD §4.5 ordering rule (mirror, don't invent):
 *   逾期 → 今天到期 → 优先级 desc → position.
 * `due_date` is a date-only "YYYY-MM-DD" string — string comparison is
 * chronologically correct for that shape (same rationale as the
 * @multica/core/issues/date helpers).
 *
 * The "全部 (N)" count is the same as the 未完成 count shown on the
 * my-issues page for the assigned scope: assigned issues that are neither
 * done nor cancelled.
 */
import type { Issue, IssuePriority, IssueStatus } from "@multica/core/types";

const PRIORITY_RANK: Record<IssuePriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const EXCLUDED_STATUSES: ReadonlySet<IssueStatus> = new Set([
  "done",
  "cancelled",
]);

/** Keep issues that still need attention (not done / cancelled). */
export function filterTodoIssues(issues: Issue[]): Issue[] {
  return issues.filter((issue) => !EXCLUDED_STATUSES.has(issue.status));
}

/**
 * 0 = overdue, 1 = due today, 2 = future or no due date.
 * date-only strings compare lexicographically like real dates.
 */
function dueRank(dueDate: string | null, today: string): number {
  if (!dueDate) return 2;
  if (dueDate < today) return 0;
  if (dueDate === today) return 1;
  return 2;
}

/** Sort todo issues: 逾期 → 今天到期 → 优先级 desc → position asc. */
export function sortTodoIssues(issues: Issue[], today: string): Issue[] {
  return filterTodoIssues(issues).sort((a, b) => {
    const da = dueRank(a.due_date, today);
    const db = dueRank(b.due_date, today);
    if (da !== db) return da - db;

    const pa = PRIORITY_RANK[a.priority];
    const pb = PRIORITY_RANK[b.priority];
    if (pa !== pb) return pb - pa;

    return a.position - b.position;
  });
}
