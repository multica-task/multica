/**
 * Board 视图 C — 员工用量 Top-N（PRD §5.2）。数据源：
 * `/api/dashboard/usage/by-agent`（6 个统计端点之一，未上线 → 本卡由
 * 上层占位逻辑接管，不单独报错）。
 *
 * 聚合口径与 web `packages/views/dashboard/utils.ts:aggregateAgentTokens`
 * 一致：按 `agent_id` 折叠各 (agent, model) 行，Tokens = input + output +
 * cache_read + cache_write，按 Tokens 降序取 Top-10。进度条宽度按全体行
 * 的最大值归一（与 web leaderboard 一致）。
 */
import { useMemo } from "react";
import { View } from "react-native";
import type { Agent, DashboardUsageByAgent } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { StatPlaceholder } from "@/components/ui/stat-placeholder";
import { formatCompactNumber } from "@/lib/format";

const LEADERBOARD_LIMIT = 10;

interface AgentUsageRow {
  agentId: string;
  tokens: number;
}

function aggregateByAgent(rows: DashboardUsageByAgent[]): AgentUsageRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(
      r.agent_id,
      (map.get(r.agent_id) ?? 0) +
        r.input_tokens +
        r.output_tokens +
        r.cache_read_tokens +
        r.cache_write_tokens,
    );
  }
  return Array.from(map.entries())
    .map(([agentId, tokens]) => ({ agentId, tokens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, LEADERBOARD_LIMIT);
}

interface Props {
  rows: DashboardUsageByAgent[];
  agents: Agent[];
}

export function AgentUsage({ rows, agents }: Props) {
  const leaderboard = useMemo(() => aggregateByAgent(rows), [rows]);
  const agentById = useMemo(
    () => new Map(agents.map((a) => [a.id, a] as const)),
    [agents],
  );

  if (leaderboard.length === 0) {
    return (
      <Card>
        <Text className="text-sm font-medium text-foreground">员工用量 Top-N</Text>
        <StatPlaceholder note="统计接口未上线" compact />
      </Card>
    );
  }

  const maxTokens = leaderboard[0]?.tokens ?? 0;

  return (
    <Card>
      <Text className="text-sm font-medium text-foreground">员工用量 Top-N</Text>
      <View className="gap-2.5 mt-3">
        {leaderboard.map((row) => {
          const agent = agentById.get(row.agentId);
          const name = agent?.name ?? (row.agentId ? "未知员工" : "已删除员工");
          const pct = maxTokens > 0 ? (row.tokens / maxTokens) * 100 : 0;
          return (
            <View key={row.agentId} className="flex-row items-center gap-2.5">
              <ActorAvatar
                type={agent ? "agent" : "member"}
                id={row.agentId}
                size={28}
              />
              <View className="flex-1 gap-1">
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {name}
                </Text>
                <View className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <View
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(pct)}%` }}
                  />
                </View>
              </View>
              <Text className="text-sm text-muted-foreground tabular-nums shrink-0">
                {formatCompactNumber(row.tokens)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
