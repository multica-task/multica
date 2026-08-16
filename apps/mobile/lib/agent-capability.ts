/**
 * Agent capability counts — the three numbers behind the roster card's
 * 能力计数条 and the profile header's chip row (PRD §7.5 / §7.6).
 *
 * Pure helpers, no React. Mirror the web-side semantics exactly
 * (apps/mobile/CLAUDE.md "counts must agree"): skills + tools come from the
 * agent record, in-hand from the workspace task snapshot.
 *
 * Redaction rules (PRD §7.5 约定):
 *   - `mcp_config_redacted` / `composio_toolkit_allowlist_redacted` — the
 *     backend strips secrets for non-owner callers. When either is `true`
 *     the tool count MUST NOT be shown (no list, no number, definitely not
 *     a fake 0); render「已配置」or `——` instead.
 *   - `undefined` on a legacy backend = "unknown — assume none", NOT a real
 *     zero. `0` is only legitimately shown when the fields are present and
 *     parseable and genuinely empty.
 */
import type { Agent, AgentTask } from "@multica/core/types";

/** Active task statuses — "what's on the plate right now" (PRD §7.5 在手).
 *  Same set as deriveWorkloadDetail in packages/core/agents/derive-presence.ts. */
const ACTIVE_TASK_STATUSES = new Set<AgentTask["status"]>([
  "queued",
  "dispatched",
  "waiting_local_directory",
  "running",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mcpTransport(config: Record<string, unknown>): string {
  const type = typeof config.type === "string" ? config.type.toLowerCase() : "";
  if (config.command || type === "local" || type === "stdio") return "stdio";
  if (type === "sse") return "sse";
  if (
    config.url ||
    type === "remote" ||
    type === "http" ||
    type === "streamable-http"
  ) {
    return "http";
  }
  return "unknown";
}

export interface ManagedMcpServer {
  name: string;
  config: Record<string, unknown>;
  container: "mcpServers" | "mcp";
  transport: string;
  enabled: boolean;
}

/**
 * List MCP servers from an agent's `mcp_config` document. Mirrors
 * packages/views/agents/components/tabs/mcp-config-model.ts:listManagedMcpServers
 * so the count matches web exactly. `mcpServers` and `mcp` are both accepted
 * containers; the first occurrence of a name wins (server-side dedupe).
 */
export function listManagedMcpServers(value: unknown): ManagedMcpServer[] {
  if (!isRecord(value)) return [];

  const out: ManagedMcpServer[] = [];
  const seen = new Set<string>();
  for (const container of ["mcpServers", "mcp"] as const) {
    const raw = value[container];
    if (!isRecord(raw)) continue;
    for (const [name, entry] of Object.entries(raw)) {
      if (seen.has(name) || !isRecord(entry)) continue;
      seen.add(name);
      out.push({
        name,
        config: entry,
        container,
        transport: mcpTransport(entry),
        enabled: entry.enabled !== false && entry.disabled !== true,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Skill count — A 类数据，直读 `agent.skills.length`（永远不许 mock）。 */
export function countAgentSkills(agent: Agent): number {
  return (agent.skills ?? []).length;
}

/**
 * 工具格的三态结果：
 *   - `{ state: "configured" }`      — 已配置但脱敏，只可显示「已配置」
 *   - `{ state: "unknown" }`         — 旧后端未返回工具字段，按「未知」处理
 *   - `{ state: "count", count }`    — 有权查看时的真实计数（MCP 服务器 + Composio 工具包）
 */
export type AgentToolCount =
  | { state: "configured" }
  | { state: "unknown" }
  | { state: "count"; count: number };

export function countAgentTools(agent: Agent): AgentToolCount {
  const mcpRedacted = agent.mcp_config_redacted === true;
  const composioRedacted = agent.composio_toolkit_allowlist_redacted === true;
  // 任一脱敏即视为「已配置但不可见」——禁止计数，尤其禁止显示 0。
  if (mcpRedacted || composioRedacted) return { state: "configured" };

  const hasMcpField = agent.mcp_config !== undefined;
  const hasComposioField = agent.composio_toolkit_allowlist !== undefined;
  // 两个字段都缺失 = 旧后端根本没返回工具数据，不是「零配置」。
  if (!hasMcpField && !hasComposioField) return { state: "unknown" };

  const mcpCount = hasMcpField ? listManagedMcpServers(agent.mcp_config).length : 0;
  const composioCount = hasComposioField
    ? (agent.composio_toolkit_allowlist ?? []).length
    : 0;
  return { state: "count", count: mcpCount + composioCount };
}

/** 在手任务数 — snapshot 中该员工全部活跃任务（queued/dispatched/waiting/running）。 */
export function countAgentInHand(
  agent: Agent,
  tasks: readonly AgentTask[] | undefined,
): number {
  if (!tasks) return 0;
  return tasks.filter(
    (t) => t.agent_id === agent.id && ACTIVE_TASK_STATUSES.has(t.status),
  ).length;
}
