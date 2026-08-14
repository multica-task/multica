/**
 * Mirror of `packages/views/agents/components/tabs/task-failure.ts:REASON_LABEL`.
 *
 * Why mirror: mobile cannot import from packages/views per the apps/mobile
 * CLAUDE.md sharing rule. Only the human copy is mobile-owned.
 *
 * Keyed by the raw wire value rather than a closed enum, same as the web map:
 * `failure_reason` is an open string that grows as classifier rules land, and
 * an installed build will meet reasons it predates. Before MUL-5370 this was a
 * `Record<TaskFailureReason, string>` holding only the six pre-MUL-1949 coarse
 * values, so every refined `agent_error.*` the backend has written since
 * missed the lookup and rendered a bare "Failed".
 *
 * Divergence from web, deliberate: the web helper falls back to the raw wire
 * value, which is machine-y but searchable — right for an operator reading the
 * execution log. This one backs a chat bubble read by the person who just sent
 * a message, so an unrecognised reason degrades to a plain "Failed" instead of
 * leaking an enum string at them.
 */
// Display copy is Chinese per PRD §9.5 / §2.3 glossary (agent → 数字员工).
const LABELS: Record<string, string> = {
  // Platform / scheduler side.
  queued_expired: "排队超时",
  runtime_offline: "守护进程离线",
  runtime_recovery: "守护进程重启",
  timeout: "任务超时",
  iteration_limit: "达到迭代上限",
  agent_blocked: "等待人工输入",
  api_invalid_request: "被模型 API 拒绝",
  skill_bundle_unavailable: "无法下载数字员工的技能",

  // Agent process side — provider.
  "agent_error.provider_auth_or_access": "模型账号登录失效",
  "agent_error.provider_quota_limit": "模型账号额度用尽",
  "agent_error.provider_capacity_or_rate_limit": "被模型服务限流",
  "agent_error.provider_server_error": "模型服务错误",
  "agent_error.provider_network": "连接模型服务出错",

  // Agent process side — agent / runner.
  "agent_error.process_failure": "数字员工进程崩溃",
  "agent_error.empty_or_unparseable_output": "数字员工未返回有效输出",
  "agent_error.agent_timeout": "数字员工执行超时",
  "agent_error.context_overflow": "超出上下文长度",
  "agent_error.missing_config": "缺少 API key 或配置",
  "agent_error.model_not_found_or_unavailable": "模型不可用",
  "agent_error.runtime_version_unsupported": "运行时 CLI 版本不支持",
  "agent_error.runtime_missing_executable": "运行时 CLI 未安装",
  "agent_error.unknown": "数字员工执行错误",

  // Pre-MUL-1949 coarse values, still present on historical rows.
  agent_error: "数字员工执行错误",
  codex_semantic_inactivity: "长时间无响应已超时",
  manual: "已取消",
};

export function failureReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "失败";
  return LABELS[reason] ?? "失败";
}
