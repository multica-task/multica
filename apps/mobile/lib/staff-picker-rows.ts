/**
 * Pure row-building helpers for the staff-picker body — extracted from the
 * component so the search / visibility rules are unit-testable without
 * rendering RN views (same pattern as lib/inbox-display.ts).
 *
 * Visibility parity: `/api/agents` is already server-filtered to what the
 * user can see; client-side we drop archived agents and apply `canAssignAgent`
 * (mobile mirror of packages/core/permissions/rules.ts
 * `canAssignAgentToIssue`). See that file for the permission rule.
 */
import type { Agent } from "@multica/core/types";
import { canAssignAgent } from "./can-assign-agent";

export type MemberRoleLike = "owner" | "admin" | "member" | null | undefined;

/** Non-archived agents the current user is allowed to dispatch work to. */
export function visibleStaffAgents(
  agents: Agent[],
  userId: string | null | undefined,
  memberRole: MemberRoleLike,
): Agent[] {
  return agents.filter(
    (a) => !a.archived_at && canAssignAgent(a, userId, memberRole),
  );
}

/** Case-insensitive name search + alphabetical sort. Empty query = all. */
export function searchStaffAgents(
  agents: Agent[],
  query: string,
): Agent[] {
  const q = query.trim().toLowerCase();
  return [...agents]
    .filter((a) => !q || a.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}
