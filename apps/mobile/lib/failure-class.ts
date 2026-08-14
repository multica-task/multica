/**
 * Mobile mirror of `packages/core/dashboard/failure-class.ts` — the
 * display grouping for `agent_task_queue.failure_reason`.
 *
 * Mirrored, not imported: mobile may only `import type` from
 * `@multica/core/types/*` and pure functions from `@multica/core/`; this
 * module is UI-facing (adds Chinese labels per PRD §9.5), so it lives in
 * mobile. Keep the class taxonomy + reason→class map in lockstep with the
 * core file — same-N parity applies to the dashboard's failure breakdown.
 *
 * The backend taxonomy (server/pkg/taskfailure) has 22 reasons, which is
 * far too many for a scannable breakdown list. These seven classes are the
 * granularity an operator actually acts on. Ordering below is the render
 * order everywhere: most-actionable first, catchall last.
 */
export const FAILURE_CLASSES = [
  "auth",
  "rate_limit",
  "timeout",
  "provider",
  "runtime",
  "agent",
  "other",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

/** Chinese display label — PRD §9.5 译法（web `errors.class` 中文同源）。 */
export const FAILURE_CLASS_LABEL: Record<FailureClass, string> = {
  auth: "认证",
  rate_limit: "限流",
  timeout: "超时",
  provider: "模型服务",
  runtime: "运行时",
  agent: "智能体",
  other: "其他",
};

// Reason → class. Keys are the wire values written by the backend: the 22
// canonical `taskfailure.Reason` strings, the `"unclassified"` sentinel the
// failure rollups substitute for a failed row with an empty column, and the
// pre-MUL-1949 coarse values that still sit in historical rows.
//
// Anything absent from this map falls through to "other" — including a new
// reason from a backend newer than this client, which is the case that makes
// a total-coverage exhaustive `Record<Reason, …>` the wrong shape here.
const REASON_CLASS: Record<string, FailureClass> = {
  // Credentials / access.
  "agent_error.provider_auth_or_access": "auth",
  "agent_error.missing_config": "auth",

  // Capacity the account ran out of — rate limits and billing quota share a
  // class because the operator response is the same: wait, or raise a cap.
  "agent_error.provider_capacity_or_rate_limit": "rate_limit",
  "agent_error.provider_quota_limit": "rate_limit",

  // Ran too long. Platform-side sweeper timeout and the agent's own hard
  // timeout land together — from the dashboard both read as "this run hung".
  timeout: "timeout",
  "agent_error.agent_timeout": "timeout",
  codex_semantic_inactivity: "timeout",

  // The upstream model API misbehaved or was asked for something it rejected.
  "agent_error.provider_server_error": "provider",
  "agent_error.provider_network": "provider",
  "agent_error.model_not_found_or_unavailable": "provider",
  api_invalid_request: "provider",

  // Multica-side execution substrate: daemon offline / restarted, task never
  // got picked up, runner binary missing or too old.
  runtime_offline: "runtime",
  runtime_recovery: "runtime",
  queued_expired: "runtime",
  "agent_error.runtime_missing_executable": "runtime",
  "agent_error.runtime_version_unsupported": "runtime",
  // The daemon could not fetch the agent's skills from the control plane, so
  // the run never started. Grouped with runtime rather than provider: the
  // operator response is "check the daemon's link to Multica", the same as a
  // daemon that went offline — the model provider is not involved.
  skill_bundle_unavailable: "runtime",

  // The agent process itself produced the failure.
  "agent_error.process_failure": "agent",
  // Codex could not hand its stored thread back within our transport limits.
  // "agent" rather than "runtime": the daemon is healthy and the provider is
  // fine — it is this backend's own resume path that could not complete.
  codex_resume_oversized: "agent",
  "agent_error.empty_or_unparseable_output": "agent",
  "agent_error.context_overflow": "agent",
  iteration_limit: "agent",
  agent_blocked: "agent",

  // Catchall + legacy coarse values.
  "agent_error.unknown": "other",
  agent_error: "other",
  manual: "other",
  unclassified: "other",
};

/**
 * Fold a raw `failure_reason` into its display class.
 *
 * Unknown reasons — including ones a newer backend introduced — resolve to
 * "other" rather than being dropped, so the class totals always reconcile
 * with the raw failure count.
 *
 * Callers must not pass the empty string: in the dashboard failure rollups
 * that value is the *succeeded* bucket, not a failure. It resolves to "other"
 * here so a caller that leaks one in inflates a visible bucket instead of
 * silently corrupting the error rate.
 */
export function failureClassOf(reason: string): FailureClass {
  return REASON_CLASS[reason] ?? "other";
}
