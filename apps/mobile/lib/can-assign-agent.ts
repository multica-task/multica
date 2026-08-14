/**
 * Mobile-owned mirror of the boolean shim
 * `packages/views/issues/components/pickers/assignee-picker.tsx:canAssignAgent`
 * — which in turn forwards to `packages/core/permissions/rules.ts:canAssignAgentToIssue`.
 *
 * We mirror (not import) per the apps/mobile/CLAUDE.md sharing rule: only
 * `import type` from @multica/core; logic is duplicated to keep mobile
 * independent. Any rule change must be applied here too.
 *
 * Rule (mirrors `packages/core/permissions/rules.ts:canAssignAgentToIssue`,
 * which mirrors the backend `canInvokeAgent` / `validateAssigneePair` gate,
 * MUL-3963):
 *   - The agent owner may always invoke their own agent, regardless of mode.
 *   - `permission_mode "private"` → ONLY the owner. Workspace admins do NOT
 *     bypass a private agent (the key behavior change vs the pre-MUL-3963
 *     `visibility` model).
 *   - `permission_mode "public_to"` + a workspace target → any workspace
 *     member.
 *   - `permission_mode "public_to"` + a member target → only the matching
 *     user (a targeted employee must not be filtered out).
 *   - Team targets are reserved and INERT in v1 — they never grant.
 *
 * Used by the chat agent picker to filter "agents I can talk to", the
 * staff-picker dispatch list, and the workspace-agent availability banner.
 */
import type { Agent } from "@multica/core/types";

type MemberRoleLike = "owner" | "admin" | "member" | null | undefined;

export function canAssignAgent(
  agent: Agent,
  userId: string | undefined | null,
  memberRole: MemberRoleLike,
): boolean {
  if (!userId) return false;

  const role: MemberRoleLike =
    memberRole === "owner" || memberRole === "admin" || memberRole === "member"
      ? memberRole
      : null;

  // The owner may always invoke their own agent, regardless of mode.
  if (agent.owner_id !== null && agent.owner_id === userId) {
    return true;
  }

  // Private agents are owner-only — no admin bypass.
  if (agent.permission_mode === "private") {
    return false;
  }

  // permission_mode === "public_to": resolve the invocation grants. A
  // workspace grant opens invocation to any workspace member. The `?? []`
  // guards against legacy self-host backends / stale caches that omit the
  // field even though the type says required-array (GH #4915, same guard as
  // rules.ts).
  const targets = agent.invocation_targets ?? [];
  if (targets.some((t) => t.target_type === "workspace")) {
    // role is null when the member list hasn't loaded yet or the user isn't
    // a workspace member — a workspace grant requires an actual member.
    return role !== null;
  }

  // A member grant opens invocation to exactly the targeted user. Team
  // targets are reserved and INERT in v1 — they never grant.
  return targets.some(
    (t) => t.target_type === "member" && t.target_id === userId,
  );
}
