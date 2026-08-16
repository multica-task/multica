/**
 * BlockingNoticeBar — 阻断提示条（PRD §7.2，M4-3）。
 *
 * 首页 / 看板 / 工作台三屏复用。解决的问题：现有 NoAgentBanner /
 * OfflineBanner / RuntimeRequiredBanner 只挂在工作台 composer 上方，用户停在
 * 首页或看板时根本不知道员工已不可用，派单出去才发现。
 *
 * 触发条件与优先级（从上到下，同时只显示 1 条，PRD §7.2 表格顺序）：
 *   1. 无任何数字员工       — /api/agents 空                      「还没有数字员工，请先在 Web 端创建」
 *   2. 当前员工未绑定工位  — agent.runtime_id 为空               「工位未绑定…」[去绑定]
 *   3. 当前员工工位离线    — /api/runtimes 该 runtime offline    「工位离线…」[查看工位]
 *   4. 网络离线            — useNetworkStatus                    「网络已断开，正在重连」
 *
 * 约定：
 *   - 可折叠但不可永久关闭：阻断条件消失自动消失，条件仍在则每次进入重新展开。
 *   - 底栏对应 Tab 不加数字 badge（badge 语义已被未读数占用），改用图标旁小圆点
 *     （在 tabs/_layout.tsx 由调用方处理）。
 *   - 数据全部来自已订阅的 query（agents / runtimes / network），零新增请求。
 *
 * `agentId` 语义：工作台传入当前选中员工的 id（rail 选中态联动）；首页/看板不传，
 * 组件按「第一个可用员工」（与中央按钮回退链同源：非归档 + 当前用户可指派）判定。
 * 三屏的判定口径一致 —— 判定规则本身相同，只是引用员工不同。
 */
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@multica/core/types";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { agentListOptions } from "@/data/queries/agents";
import { runtimeListOptions } from "@/data/queries/runtimes";
import { memberListOptions } from "@/data/queries/members";
import { canAssignAgent } from "@/lib/can-assign-agent";
import { isAgentRuntimeBound } from "@/lib/is-agent-runtime-bound";
import { useNetworkStatus } from "@/lib/use-network-status";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

type NoticeRow =
  | { kind: "offline"; copy: string }
  | { kind: "no-agents"; copy: string }
  | { kind: "unbound"; agent: Agent; copy: string }
  | { kind: "runtime-offline"; agent: Agent; copy: string };

/** 无数字员工文案（§7.2）。 */
const NO_AGENTS_COPY = "还没有数字员工，请先在 Web 端创建";
const OFFLINE_COPY = "网络已断开，正在重连";

function useBlockingNotice(agentId?: string): NoticeRow | null {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const userId = useAuthStore((s) => s.user?.id);
  const isConnected = useNetworkStatus();

  const { data: agents = [], isFetched: agentsFetched } = useQuery(
    agentListOptions(wsId),
  );
  const { data: members = [], isFetched: membersFetched } = useQuery(
    memberListOptions(wsId),
  );
  const { data: runtimes = [] } = useQuery(runtimeListOptions(wsId));

  return useMemo<NoticeRow | null>(() => {
    // 评审修复（MEDIUM）：agents/members 未拉取前返回 null —— 否则首帧
    // agents=[] 会让三屏闪现「还没有数字员工」。
    if (!agentsFetched || !membersFetched) return null;
    const role = members.find((m) => m.user_id === userId)?.role;
    const visible = agents.filter(
      (a) => !a.archived_at && canAssignAgent(a, userId, role),
    );

    // 1. 无任何数字员工（PRD §7.2 优先级最高）。
    if (visible.length === 0) {
      return { kind: "no-agents", copy: NO_AGENTS_COPY };
    }

    // 参考员工：工作台传入 active agent；首页/看板用第一个可用员工。
    const agent =
      (agentId && visible.find((a) => a.id === agentId)) ?? visible[0];
    if (!agent) return null;

    // 2. 当前员工未绑定工位。
    if (!isAgentRuntimeBound(agent)) {
      return { kind: "unbound", agent, copy: "工位未绑定，员工暂时无法执行任务" };
    }

    // 3. 当前员工工位离线。
    const runtime = runtimes.find((r) => r.id === agent.runtime_id);
    if (runtime && runtime.status === "offline") {
      return { kind: "runtime-offline", agent, copy: "工位离线，任务会排队等待" };
    }

    // 4. 网络离线。null（首个快照未解析）视为在线，避免冷启动误报。
    if (isConnected === false) return { kind: "offline", copy: OFFLINE_COPY };

    return null;
  }, [
    agentId,
    agents,
    agentsFetched,
    members,
    membersFetched,
    runtimes,
    userId,
    isConnected,
  ]);
}

/**
 * 展开 / 折叠状态。PRD §7.2：「可折叠但不可永久关闭」——每次挂载默认展开。
 */
export function BlockingNoticeBar({
  agentId,
  collapsible = true,
}: {
  /** 工作台当前选中员工 id；首页/看板不传则用第一个可用员工。 */
  agentId?: string;
  collapsible?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const [collapsed, setCollapsed] = useState(false);

  const notice = useBlockingNotice(agentId);
  if (!notice || collapsed) return null;

  const hasAction =
    notice.kind === "unbound" || notice.kind === "runtime-offline";

  const goProfile = () => {
    if (!slug) return;
    if (notice.kind === "unbound" || notice.kind === "runtime-offline") {
      router.push({
        pathname: "/[workspace]/staff/[id]",
        params: { workspace: slug, id: notice.agent.id },
      });
    }
  };

  const icon =
    notice.kind === "offline"
      ? "cloud-offline-outline"
      : notice.kind === "no-agents"
        ? "people-outline"
        : notice.kind === "runtime-offline"
          ? "cloud-offline-outline"
          : "link-outline";

  return (
    <View className="mx-3 mt-1.5 overflow-hidden rounded-md border border-border bg-warning/10">
      <View className="flex-row items-center gap-2 px-2.5 py-1.5">
        <Ionicons name={icon} size={14} color={t.warning} accessible={false} />
        <Text
          className="flex-1 text-xs text-foreground"
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {notice.copy}
        </Text>
        {hasAction ? (
          <Pressable
            onPress={goProfile}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              notice.kind === "unbound" ? "去绑定" : "查看工位"
            }
            className="rounded bg-warning/15 px-2 py-1 active:opacity-70"
          >
            <Text className="text-xs font-medium text-warning">
              {notice.kind === "unbound" ? "去绑定" : "查看工位"}
            </Text>
          </Pressable>
        ) : null}
        {collapsible ? (
          <Pressable
            onPress={() => setCollapsed(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="收起提示"
            className="pl-1"
          >
            <Ionicons
              name="chevron-up"
              size={14}
              color={t.mutedForeground}
              accessible={false}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
