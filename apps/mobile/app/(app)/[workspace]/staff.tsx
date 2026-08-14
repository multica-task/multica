/**
 * 数字员工名册 `/{slug}/staff`（PRD §7.5，M4-5）。
 *
 * 替换 `more/agents.tsx` 的 "Agents coming soon." 占位。移动端只读（创建 /
 * 编辑仍在 Web 端），本期不提供筛选表单（§7.5 筛选为后置，卡片形态先行）。
 *
 * 结构：
 *   - 分组：在岗/工作中 → 受阻/异常 → 离线 → 已归档（折叠）。
 *   - 卡片：头像 + 名称 + 状态点 + 工号/岗位 + 描述 2 行截断 + 工位行 +
 *     能力计数条（技能/工具/在手，脱敏规则见 CapabilityCountBar）。
 *   - 空态：「还没有数字员工」+「请在 Web 端创建」。
 *
 * 数据（全部已订阅，零新增请求）：/api/agents + /api/runtimes +
 * /api/agent-task-snapshot + /api/squads。实时走 useStaffRealtime（agent:*
 * patch）与 usePresenceRealtime（runtimes/snapshot）。
 */
import { useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Agent, AgentStatus } from "@multica/core/types";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { agentListOptions } from "@/data/queries/agents";
import { runtimeListOptions } from "@/data/queries/runtimes";
import { agentTaskSnapshotOptions } from "@/data/queries/agent-task-snapshot";
import { squadListOptions } from "@/data/queries/squads";
import { memberListOptions } from "@/data/queries/members";
import { canAssignAgent } from "@/lib/can-assign-agent";
import { isAgentRuntimeBound } from "@/lib/is-agent-runtime-bound";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { Text } from "@/components/ui/text";
import { CapabilityCountBar } from "@/components/staff/capability-count-bar";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

type GroupId = "active" | "stalled" | "offline" | "archived";

interface Group {
  id: GroupId;
  title: string;
  statuses: AgentStatus[];
}

const GROUPS: Group[] = [
  { id: "active", title: "在岗 / 工作中", statuses: ["idle", "working"] },
  { id: "stalled", title: "受阻 / 异常", statuses: ["blocked", "error"] },
  { id: "offline", title: "离线", statuses: ["offline"] },
];

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: "bg-success",
  working: "bg-brand",
  blocked: "bg-warning",
  error: "bg-destructive",
  offline: "bg-muted-foreground/40",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "在岗",
  working: "工作中",
  blocked: "受阻",
  error: "异常",
  offline: "离线",
};

export default function StaffPage() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: runtimes = [] } = useQuery(runtimeListOptions(wsId));
  const { data: snapshot = [] } = useQuery(agentTaskSnapshotOptions(wsId));
  const { data: squads = [] } = useQuery(squadListOptions(wsId));
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const visible = useMemo(() => {
    const role = members.find((m) => m.user_id === userId)?.role;
    return agents
      .filter((a) => !a.archived_at && canAssignAgent(a, userId, role))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents, members, userId]);

  const archived = useMemo(
    () => agents.filter((a) => a.archived_at).sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  const runtimeById = useMemo(
    () => new Map(runtimes.map((r) => [r.id, r])),
    [runtimes],
  );

  const sections = useMemo(() => {
    const rows: { id: GroupId; title: string; data: Agent[] }[] = [];
    for (const g of GROUPS) {
      const data = visible.filter((a) => g.statuses.includes(a.status ?? "idle"));
      if (data.length > 0) rows.push({ id: g.id, title: g.title, data });
    }
    // 离线组（不在 active/stalled 状态中的剩余可见员工）——PRD §7.5 分组顺序：
    // 在岗/工作中 → 受阻/异常 → 离线。`offline` 状态已在上面的 offline 组；
    // 未匹配任何已知状态的员工兜底进离线组。
    const known = new Set(
      rows.flatMap((r) => r.data.map((a) => a.id)),
    );
    const remaining = visible.filter((a) => !known.has(a.id));
    if (remaining.length > 0) {
      rows.push({ id: "offline", title: "离线", data: remaining });
    }
    if (archived.length > 0) {
      rows.push({
        id: "archived",
        title: `已归档 (${archived.length})`,
        data: archivedExpanded ? archived : [],
      });
    }
    return rows;
  }, [visible, archived, archivedExpanded]);

  const goProfile = (agent: Agent) => {
    if (!wsSlug) return;
    router.push({
      pathname: "/[workspace]/staff/[id]",
      params: { workspace: wsSlug, id: agent.id },
    });
  };

  const goChat = (agent: Agent) => {
    if (!wsSlug) return;
    // 切到工作台该员工会话：跳到工作台 Tab。会话切换由 rail 的选中态处理，
    // 这里只做跳转（用户落地后点 rail 员工）。
    router.push(`/${wsSlug}/workbench`);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "数字员工",
          headerBackTitle: "Back",
        }}
      />
      {visible.length === 0 && archived.length === 0 ? (
        <EmptyRoster />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="pb-8"
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={
                section.id === "archived"
                  ? () => setArchivedExpanded((v) => !v)
                  : undefined
              }
              className="flex-row items-center gap-2 bg-background px-4 pb-1 pt-3"
            >
              <Text className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {section.title}
              </Text>
              {section.id === "archived" ? (
                <Text className="text-xs text-muted-foreground/60">
                  {archivedExpanded ? "收起" : "展开"}
                </Text>
              ) : null}
            </Pressable>
          )}
          renderItem={({ item }) => (
            <StaffCard
              agent={item}
              runtimeLabel={runtimeLabel(item, runtimeById)}
              inHandTasks={snapshot}
              onPress={() => goProfile(item)}
              onChat={() => goChat(item)}
            />
          )}
          ListFooterComponent={
            squads.length > 0 ? (
              <View className="px-4 pt-4">
                <Text className="text-xs uppercase tracking-wider text-muted-foreground font-medium pb-1">
                  战队 ({squads.length})
                </Text>
                {squads.map((s) => (
                  <View
                    key={s.id}
                    className="rounded-md border border-border bg-card px-4 py-3 mb-2 flex-row items-center gap-3"
                  >
                    <ActorAvatar type="squad" id={s.id} size={32} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        队长 {s.leader_id ? "· " + s.leader_id : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function runtimeLabel(
  agent: Agent,
  runtimeById: Map<string, { name: string; runtime_mode: string }>,
): string {
  if (!isAgentRuntimeBound(agent)) return "工位未绑定 ⚠";
  const r = runtimeById.get(agent.runtime_id);
  if (!r) return "工位 · 云端";
  const mode = r.runtime_mode === "cloud" ? "云端" : "本地";
  return `工位 ${r.name} · ${mode}`;
}

function StaffCard({
  agent,
  runtimeLabel: runtime,
  inHandTasks,
  onPress,
  onChat,
}: {
  agent: Agent;
  runtimeLabel: string;
  inHandTasks: readonly import("@multica/core/types").AgentTask[];
  onPress: () => void;
  onChat: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const status = agent.status ?? "idle";
  return (
    <View className="mx-4 mb-2 overflow-hidden rounded-md border border-border bg-card">
      <Pressable onPress={onPress} className="active:bg-secondary/50">
        <View className="flex-row items-start gap-3 px-4 pt-3">
          <ActorAvatar type="agent" id={agent.id} size={40} />
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {agent.name}
              </Text>
              <View
                className="flex-row items-center gap-1 rounded-full bg-secondary px-2 py-0.5"
              >
                <View className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
                <Text className="text-[10px] text-muted-foreground">
                  {STATUS_LABEL[status]}
                </Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
              工号 {employeeNo(agent)} · 岗位 {position(agent)}
            </Text>
          </View>
        </View>
        {/* 描述 2 行截断（PRD §7.5：现在完全没展示，本期读出来）。 */}
        {agent.description ? (
          <Text className="px-4 pt-2 text-sm text-foreground/90" numberOfLines={2}>
            {agent.description}
          </Text>
        ) : (
          <Text className="px-4 pt-2 text-sm text-muted-foreground/70" numberOfLines={2}>
            未设置岗位描述
          </Text>
        )}
        <View className="px-4 pt-2">
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {runtime}
          </Text>
        </View>
      </Pressable>
      <View className="mt-2 border-t border-border px-2 py-1">
        <CapabilityCountBar agent={agent} tasks={inHandTasks} />
      </View>
      <Pressable
        onPress={onChat}
        accessibilityRole="button"
        accessibilityLabel={`与 ${agent.name} 对话`}
        className="border-t border-border px-4 py-2.5 active:bg-secondary"
      >
        <Text className="text-sm font-medium text-center" style={{ color: t.brand }}>
          与他对话
        </Text>
      </Pressable>
    </View>
  );
}

/** 工号：后端尚无 employee_no 字段（B-3 待评估），用 id 前缀派生展示。 */
function employeeNo(agent: Agent): string {
  return (agent.id ?? "").slice(0, 4).toUpperCase() || "----";
}

/** 岗位：后端无 position 字段（B-3），派生兜底。 */
function position(agent: Agent): string {
  return agent.model ? `模型 ${agent.model}` : "未设置岗位";
}

function EmptyRoster() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-base font-medium text-foreground">
        还没有数字员工
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground text-center">
        请在 Web 端创建数字员工后，在此查看能力与工作记录。
      </Text>
    </View>
  );
}
