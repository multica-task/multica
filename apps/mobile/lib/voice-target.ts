/**
 * Voice central-button target selection — the "who do I send this to"
 * question answered once, as a pure function so the record button and the
 * send hook agree and so the fallback chain is unit-testable.
 *
 * Fallback chain (PRD §6.4; M1 has no user-set default yet — that lands in
 * M2 as `utter_default_agent_id`):
 *   1. `defaultAgentId` (M2) — used only when it still resolves to an
 *      available agent.
 *   2. First available agent in `agents` order.
 *   3. `agent: null` → the caller shows the no-employee path (Toast on
 *      release, overlay still animates).
 *
 * "Available" is the parity-mandated union of the same three helpers web /
 * the chat screen use (PRD §6.4): not archived, assignable by this user
 * (`canAssignAgent`), and runtime-bound (`isAgentRuntimeBound`). Do NOT
 * inline `archived_at` / `visibility` checks here — drift risk is exactly
 * what these shared helpers exist to prevent.
 */
import type { Agent, ChatSession } from "@multica/core/types";
import { canAssignAgent } from "./can-assign-agent";
import { isAgentRuntimeBound } from "./is-agent-runtime-bound";

export type VoiceMemberRole = "owner" | "admin" | "member" | null | undefined;

export interface VoiceTarget {
  /** The employee a long-press release will message, or null when none. */
  agent: Agent | null;
  /**
   * The existing non-archived session for that agent, or null when the
   * caller must create one before sending.
   */
  sessionId: string | null;
}

export interface PickVoiceTargetInput {
  agents: Agent[];
  sessions: ChatSession[];
  userId: string | null;
  memberRole: VoiceMemberRole;
  /** M2 default-agent override; M1 passes null. */
  defaultAgentId?: string | null;
}

export function pickVoiceTarget({
  agents,
  sessions,
  userId,
  memberRole,
  defaultAgentId = null,
}: PickVoiceTargetInput): VoiceTarget {
  const available = agents.filter(
    (a) =>
      !a.archived_at &&
      canAssignAgent(a, userId, memberRole) &&
      isAgentRuntimeBound(a),
  );

  const agent =
    (defaultAgentId
      ? available.find((a) => a.id === defaultAgentId)
      : undefined) ??
    available[0] ??
    null;

  if (!agent) return { agent: null, sessionId: null };

  const session = sessions.find(
    (s) => s.agent_id === agent.id && s.status !== "archived",
  );

  return { agent, sessionId: session?.id ?? null };
}
