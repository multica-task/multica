/**
 * Home header "N 位员工在岗" count.
 *
 * PRD §4.2 口径 (v1.5): count non-archived agents visible to the current
 * user whose `agent.status` is online-available. The PRD phrase is
 * `idle / running`; the server enum is `idle | working | blocked | error |
 * offline` — `RefreshAgentStatusFromTasks` writes `"working"` whenever the
 * agent has dispatched/running tasks, so the PRD's "running" maps to the
 * `working` enum value. `blocked` / `error` / `offline` never count.
 *
 * Visibility uses the same predicate as chat / issue assignment
 * (`canAssignAgent`) — matches "当前用户可见" in the 口径 and keeps counts
 * aligned with the staff lists.
 */
import type { Agent, AgentStatus } from "@multica/core/types";
import { canAssignAgent } from "./can-assign-agent";

type MemberRoleLike = "owner" | "admin" | "member" | null | undefined;

const ON_DUTY_STATUSES: ReadonlySet<AgentStatus> = new Set(["idle", "working"]);

export function countOnDutyAgents(
  agents: readonly Agent[],
  userId: string | null | undefined,
  memberRole: MemberRoleLike,
): number {
  let count = 0;
  for (const agent of agents) {
    if (agent.archived_at) continue;
    if (!canAssignAgent(agent, userId, memberRole)) continue;
    if (ON_DUTY_STATUSES.has(agent.status)) count += 1;
  }
  return count;
}
