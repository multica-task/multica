/**
 * 员工 Rail（PRD §7.3）— 工作台顶部横向常驻员工条。
 *
 * 员工即上下文：点员工 = 切到与该员工的会话；长按 = 打开员工档案。选中态是
 * 「切整个工作台的上下文」，不只是切会话 —— 与 StaffDeck 侧边栏「当前员工」
 * 同构（§7.1）。
 *
 * 元素规格（§7.3）：
 *   - 项：40px 头像（ActorAvatar）+ 状态点 + 名字（10px，1 行截断）
 *   - 状态点色：在岗 success / 工作中 品牌蓝 + PulseDot 脉冲 / 受阻 warning /
 *     异常 destructive / 离线 mutedForeground —— 映射 `agent.status`
 *     （AgentStatus，服务端 ReconcileAgentStatus 维护）
 *   - 未读：该员工名下会话 `has_unread` → 头像右上角小红点
 *   - 在手任务：`/api/agent-task-snapshot` 活跃任务数 → 头像右下角数字角标
 *   - 选中态：品牌色 2px 环 + 名字加粗
 *   - 点击：切到该员工最近会话；无会话则创建（POST /api/chat/sessions）
 *   - 长按：ActionSheetIOS —— 查看档案 / 设为默认员工 / 新建会话 / 会话历史
 *   - 末位：「全部 ›」→ push /{slug}/staff
 *
 * Parity 点（§7.3）：员工可见性/可触发性判定走 `canAssignAgent`（与 web agent
 * 选择器同源），rail 里不出现当前用户无权触发的员工。
 */
import { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@multica/core/types";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { agentListOptions } from "@/data/queries/agents";
import { agentTaskSnapshotOptions } from "@/data/queries/agent-task-snapshot";
import { chatSessionsOptions } from "@/data/queries/chat";
import { memberListOptions } from "@/data/queries/members";
import { canAssignAgent } from "@/lib/can-assign-agent";
import { countAgentInHand } from "@/lib/agent-capability";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { PulseDot } from "@/components/ui/pulse-dot";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

type AgentStatus = Agent["status"];

/** 状态点色：在岗 success / 工作中 brand+PulseDot / 受阻 warning / 异常 destructive / 离线 muted。 */
const STATUS_DOT: Record<AgentStatus, { bg: "success" | "warning" | "destructive" | "muted" | "brand" }> = {
  idle: { bg: "success" },
  working: { bg: "brand" },
  blocked: { bg: "warning" },
  error: { bg: "destructive" },
  offline: { bg: "muted" },
};

const DOT_CLASS: Record<"success" | "warning" | "destructive" | "muted" | "brand", string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
  brand: "bg-brand",
};

interface Props {
  activeAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  onLongPressAgent: (agent: Agent) => void;
}

export function StaffRail({ activeAgentId, onSelectAgent, onLongPressAgent }: Props) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: sessions = [] } = useQuery(chatSessionsOptions(wsId));
  const { data: snapshot = [] } = useQuery(agentTaskSnapshotOptions(wsId));

  const visible = useMemo(() => {
    const role = members.find((m) => m.user_id === userId)?.role;
    return agents
      .filter((a) => !a.archived_at && canAssignAgent(a, userId, role))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, members, userId]);

  // 每个员工名下的未读会话数（用于头像右上角红点）与最近会话（点击切到它）。
  const byAgent = useMemo(() => {
    const map = new Map<
      string,
      { hasUnread: boolean; latestSessionId: string | null }
    >();
    const sorted = [...sessions].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
    for (const s of sorted) {
      const cur = map.get(s.agent_id) ?? { hasUnread: false, latestSessionId: null };
      if (cur.latestSessionId === null) cur.latestSessionId = s.id;
      if (s.has_unread) cur.hasUnread = true;
      map.set(s.agent_id, cur);
    }
    return map;
  }, [sessions]);

  const goAll = () => {
    if (wsSlug) router.push(`/${wsSlug}/staff`);
  };

  return (
    <FlatList
      horizontal
      data={visible}
      keyExtractor={(a) => a.id}
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-3 py-2 gap-3"
      className="border-b border-border"
      renderItem={({ item }) => {
        const selected = item.id === activeAgentId;
        const meta = byAgent.get(item.id);
        const inHand = countAgentInHand(item, snapshot);
        const status = item.status ?? "idle";
        const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;

        return (
          <Pressable
            onPress={() => onSelectAgent(item)}
            onLongPress={() => onLongPressAgent(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}${meta?.hasUnread ? "，有未读" : ""}`}
            className="items-center gap-1"
          >
            <View
              className="relative"
              style={
                selected
                  ? {
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: t.brand,
                      padding: 1,
                    }
                  : { padding: 3 }
              }
            >
              <ActorAvatar type="agent" id={item.id} size={36} />
              {/* 未读小红点 —— 头像右上角。 */}
              {meta?.hasUnread ? (
                <View
                  pointerEvents="none"
                  className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive"
                />
              ) : null}
              {/* 在手任务角标 —— 头像右下角数字。 */}
              {inHand > 0 ? (
                <View
                  pointerEvents="none"
                  className="absolute bottom-0 right-0 min-w-[16px] h-4 items-center justify-center rounded-full px-1"
                  style={{ backgroundColor: t.brand }}
                >
                  <Text className="text-[10px] font-semibold leading-none" style={{ color: t.brandForeground }}>
                    {inHand > 99 ? "99+" : inHand}
                  </Text>
                </View>
              ) : null}
              {/* 状态点 —— 头像右下（未读点之上）。 */}
              <View
                pointerEvents="none"
                className="absolute bottom-0 left-0"
              >
                {status === "working" ? (
                  <PulseDot size={9} />
                ) : (
                  <View
                    className={`h-[9px] w-[9px] rounded-full border-2 border-background ${DOT_CLASS[dot.bg]}`}
                  />
                )}
              </View>
            </View>
            <Text
              className={selected ? "text-[10px] font-semibold text-foreground" : "text-[10px] text-muted-foreground"}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <Pressable
          onPress={goAll}
          accessibilityRole="button"
          accessibilityLabel="全部数字员工"
          className="items-center justify-center gap-1 px-1"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary/40">
            <Text className="text-[10px] text-muted-foreground">全部</Text>
          </View>
          <Text className="text-[10px] text-muted-foreground">›</Text>
        </Pressable>
      }
    />
  );
}
