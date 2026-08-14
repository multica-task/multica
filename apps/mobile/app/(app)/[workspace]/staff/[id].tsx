/**
 * 员工档案 `/{slug}/staff/[id]`（PRD §7.6，M4-6/7/8）。
 *
 * 固定页头 + 三 Tab：
 *   Tab 1 · 工作记录（默认）—— KPI 四格 + 在手任务 + 最近运行
 *   Tab 2 · 能力           —— 工位 / 模型与参数 / 技能 / 工具 / 权限 / 治理占位
 *   Tab 3 · 会话           —— 该员工名下会话列表（复用 chat-sessions 行形态）
 *
 * 页头（固定，不随 Tab 滚动）：头像 + 名称 + 岗位 + 状态 + 归属 + 描述 +
 * 能力计数 chip 行（技能/工具/在手/定时——）+ 两个主动作（与他对话 / 派单给他）。
 *
 * KPI 口径（§7.6「KPI 口径改版」）：
 *   - 今日终态 / 近 30 天运行 / 近 30 天失败 / 近 30 天失败率。
 *   - 唯一数据源是 B-9 两条 30 天统计端点（agent-activity-30d / agent-run-counts）。
 *   - 未镜像 / 404 / 权限不足 / 数据不完整 → 对应格显示 `——` +「统计接口待接入」。
 *   - 禁止从 agent-task-snapshot 补算累计绩效；失败率分母 < 5 显示「样本不足」。
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Agent, AgentTask } from "@multica/core/types";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { agentListOptions } from "@/data/queries/agents";
import { runtimeListOptions } from "@/data/queries/runtimes";
import { agentTaskSnapshotOptions } from "@/data/queries/agent-task-snapshot";
import { chatSessionsOptions } from "@/data/queries/chat";
import {
  agentActivity30dOptions,
  agentRunCountsOptions,
} from "@/data/queries/agent-stats";
import { memberListOptions } from "@/data/queries/members";
import { canAssignAgent } from "@/lib/can-assign-agent";
import { isAgentRuntimeBound } from "@/lib/is-agent-runtime-bound";
import { countAgentTools } from "@/lib/agent-capability";
import { formatPercent } from "@/lib/format-percent";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { Text } from "@/components/ui/text";
import { StatPlaceholder } from "@/components/ui/stat-placeholder";
import { CapabilityCountBar } from "@/components/staff/capability-count-bar";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

type TabKey = "records" | "capability" | "sessions";

const ACTIVE_STATUSES: readonly AgentTask["status"][] = [
  "queued",
  "dispatched",
  "waiting_local_directory",
  "running",
];

export default function StaffProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: runtimes = [] } = useQuery(runtimeListOptions(wsId));
  const { data: snapshot = [] } = useQuery(agentTaskSnapshotOptions(wsId));
  const { data: sessions = [] } = useQuery(chatSessionsOptions(wsId));
  // B-9 · 30 天统计。未镜像时 api 落到空数组 → KPI 格显示 `——`。
  const { data: activity = [] } = useQuery(agentActivity30dOptions(wsId));
  const { data: runCounts = [] } = useQuery(agentRunCountsOptions(wsId));

  const [tab, setTab] = useState<TabKey>("records");

  const agent = useMemo(
    () => agents.find((a) => a.id === id) ?? null,
    [agents, id],
  );

  const memberRole = useMemo(
    () => members.find((m) => m.user_id === userId)?.role,
    [members, userId],
  );

  const runtime = useMemo(
    () => (agent ? runtimes.find((r) => r.id === agent.runtime_id) ?? null : null),
    [agent, runtimes],
  );

  const agentTasks = useMemo(
    () => snapshot.filter((t) => t.agent_id === id),
    [snapshot, id],
  );

  const agentSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.agent_id === id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [sessions, id],
  );

  if (!id) return null;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: "员工档案", headerBackTitle: "Back" }} />
      {!agent ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-muted-foreground">
            未找到该数字员工
          </Text>
        </View>
      ) : (
        <>
          <ProfileHeader
            agent={agent}
            memberRole={memberRole}
            runtimeLabel={runtimeLabel(agent, runtime?.name, runtime?.runtime_mode)}
            inHandTasks={agentTasks}
            canChat={canAssignAgent(agent, userId, memberRole)}
            onChat={() => {
              if (wsSlug) router.push(`/${wsSlug}/workbench`);
            }}
            onDispatch={() => {
              if (wsSlug) {
                router.push({
                  pathname: "/[workspace]/new-issue",
                  params: {
                    workspace: wsSlug,
                    assignee_type: "agent",
                    assignee_id: agent.id,
                  },
                });
              }
            }}
          />
          <TabBar tab={tab} onChange={setTab} />
          <ScrollView className="flex-1" contentContainerClassName="pb-8">
            {tab === "records" ? (
              <RecordsTab
                activity={activity}
                runCounts={runCounts}
                agentId={id}
                tasks={agentTasks}
                wsSlug={wsSlug}
              />
            ) : tab === "capability" ? (
              <CapabilityTab agent={agent} runtimeName={runtime?.name} />
            ) : (
              <SessionsTab sessions={agentSessions} wsSlug={wsSlug} />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ── 页头（固定） ─────────────────────────────────────────────────────────

function ProfileHeader({
  agent,
  memberRole,
  runtimeLabel,
  inHandTasks,
  canChat,
  onChat,
  onDispatch,
}: {
  agent: Agent;
  memberRole: string | undefined;
  runtimeLabel: string;
  inHandTasks: readonly AgentTask[];
  canChat: boolean;
  onChat: () => void;
  onDispatch: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const status = agent.status ?? "idle";
  return (
    <View className="border-b border-border px-4 pt-3 pb-2">
      <View className="flex-row items-center gap-3">
        <ActorAvatar type="agent" id={agent.id} size={64} showPresence />
        <View className="flex-1 min-w-0">
          <Text className="text-xl font-semibold text-foreground" numberOfLines={1}>
            {agent.name}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {positionLabel(agent)} · {statusLabel(status)} · 归属 @{memberRole ?? "—"}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            入职 {shortDate(agent.created_at)}
          </Text>
        </View>
      </View>
      <Text className="mt-2 text-sm text-foreground/90" numberOfLines={2}>
        {agent.description || "未设置岗位描述"}
      </Text>
      <View className="mt-1 border-t border-border pt-1">
        <CapabilityCountBar agent={agent} tasks={inHandTasks} showScheduleSlot />
      </View>
      <View className="mt-2 flex-row gap-2">
        <ActionButton
          label="与他对话"
          disabled={!canChat}
          onPress={onChat}
          tint={t.brand}
        />
        <ActionButton
          label="派单给他"
          disabled={!canChat}
          onPress={onDispatch}
          tint={t.mutedForeground}
          outline
        />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  tint,
  outline = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  tint: string;
  outline?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-1 items-center justify-center rounded-md border py-2 active:opacity-70 ${
        outline ? "border-border" : "border-transparent"
      } ${disabled ? "opacity-40" : ""}`}
      style={outline ? { borderColor: tint } : { backgroundColor: tint }}
    >
      <Text className="text-sm font-medium" style={{ color: outline ? tint : "hsl(0 0% 100%)" }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Tab bar ─────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "records", label: "工作记录" },
  { key: "capability", label: "能力" },
  { key: "sessions", label: "会话" },
];

function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  return (
    <View className="flex-row border-b border-border">
      {TABS.map((item) => {
        const active = tab === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center py-2"
            style={active ? { borderBottomWidth: 2, borderBottomColor: t.brand } : undefined}
          >
            <Text
              className={`text-sm ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Tab 1 · 工作记录 ────────────────────────────────────────────────────

function RecordsTab({
  activity,
  runCounts,
  agentId,
  tasks,
  wsSlug,
}: {
  activity: readonly { agent_id: string; bucket_at: string; task_count: number; failed_count: number }[];
  runCounts: readonly { agent_id: string; run_count: number }[];
  agentId: string;
  tasks: readonly AgentTask[];
  wsSlug: string | null;
}) {
  const kpi = useMemo(() => deriveKpi(activity, runCounts, agentId), [activity, runCounts, agentId]);
  const inHand = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const recent = tasks.filter((t) => !ACTIVE_STATUSES.includes(t.status));
  const recentSorted = [...recent].sort((a, b) =>
    (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at),
  );

  return (
    <View className="gap-4 px-4 pt-3">
      <Section title="近 30 天绩效">
        <KpiGrid kpi={kpi} />
      </Section>

      <Section title={`在手任务 (${inHand.length})`}>
        {inHand.length === 0 ? (
          <Text className="py-2 text-sm text-muted-foreground">暂无在手任务</Text>
        ) : (
          inHand.map((task) => (
            <TaskRow key={task.id} task={task} wsSlug={wsSlug} />
          ))
        )}
      </Section>

      <Section title="最近运行">
        {recentSorted.length === 0 ? (
          <Text className="py-2 text-sm text-muted-foreground">暂无运行记录</Text>
        ) : (
          recentSorted.slice(0, 10).map((task) => (
            <TaskRow key={task.id} task={task} wsSlug={wsSlug} />
          ))
        )}
      </Section>
    </View>
  );
}

interface KpiValue {
  label: string;
  value: number | null;
  note?: string;
  alert?: boolean;
}

function deriveKpi(
  activity: readonly { agent_id: string; bucket_at: string; task_count: number; failed_count: number }[],
  runCounts: readonly { agent_id: string; run_count: number }[],
  agentId: string,
): KpiValue[] {
  const myActivity = activity.filter((a) => a.agent_id === agentId);
  const myRuns = runCounts.find((r) => r.agent_id === agentId);

  // 今日终态 = 今日 bucket 的 task_count。
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const todayBucket = myActivity.find((a) => a.bucket_at.startsWith(todayKey));
  const totalTasks = myActivity.reduce((s, a) => s + a.task_count, 0);
  const totalFailed = myActivity.reduce((s, a) => s + a.failed_count, 0);

  return [
    { label: "今日终态", value: todayBucket?.task_count ?? null },
    { label: "近 30 天运行", value: myRuns?.run_count ?? null },
    { label: "近 30 天失败", value: myActivity.length > 0 ? totalFailed : null },
    {
      label: "近 30 天失败率",
      value: totalTasks > 0 ? totalFailed : null,
      note:
        totalTasks > 0 && totalTasks < 5
          ? `样本不足（${totalTasks} 次）`
          : totalTasks >= 5
            ? formatPercent(totalFailed, totalTasks) ?? "——"
            : undefined,
      alert: totalTasks >= 5 && totalTasks > 0 && totalFailed > 0,
    },
  ];
}

function KpiGrid({ kpi }: { kpi: KpiValue[] }) {
  return (
    <View className="flex-row flex-wrap">
      {kpi.map((item) => (
        <View key={item.label} className="w-1/2 px-1 py-1">
          <View className="rounded-md border border-border bg-card px-3 py-2">
            <Text className="text-xs text-muted-foreground">{item.label}</Text>
            {item.value === null ? (
              <StatPlaceholder compact note="统计接口待接入" />
            ) : (
              <Text
                className={`mt-1 text-2xl font-semibold leading-8 ${
                  item.alert ? "text-destructive" : "text-foreground"
                }`}
              >
                {item.note ?? item.value}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function TaskRow({ task, wsSlug }: { task: AgentTask; wsSlug: string | null }) {
  const isActive = ACTIVE_STATUSES.includes(task.status);
  const summary = task.trigger_summary?.trim() || "运行任务";
  return (
    <Pressable
      onPress={() => {
        if (task.issue_id && wsSlug) router.push(`/${wsSlug}/issue/${task.issue_id}`);
      }}
      className="flex-row items-center gap-2 py-2 active:bg-secondary/50"
      accessibilityRole="button"
      accessibilityLabel={`${summary}，点击查看运行记录`}
    >
      <View
        className={`h-2 w-2 rounded-full ${isActive ? "bg-brand" : "bg-muted-foreground/40"}`}
      />
      <View className="flex-1 min-w-0">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {summary}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {taskStatusLabel(task)}
        </Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        {shortDate(task.completed_at || task.created_at)}
      </Text>
    </Pressable>
  );
}

// ── Tab 2 · 能力 ────────────────────────────────────────────────────────

function CapabilityTab({ agent, runtimeName }: { agent: Agent; runtimeName?: string }) {
  const tools = countAgentTools(agent);
  const skills = (agent.skills ?? []) as { name?: string; label?: string; id?: string }[];
  return (
    <View className="gap-4 px-4 pt-3">
      <Section title="工位">
        <InfoRow label="运行环境" value={runtimeName || "未绑定 ⚠"} />
        <InfoRow
          label="模式"
          value={agent.runtime_mode === "cloud" ? "云端" : agent.runtime_mode === "local" ? "本地" : "——"}
        />
        <InfoRow
          label="在线状态"
          value={isAgentRuntimeBound(agent) ? (runtimeName ? "在线" : "未绑定") : "未绑定"}
        />
      </Section>

      <Section title="模型与参数">
        <InfoRow label="模型" value={agent.model || "——"} />
        <InfoRow label="Thinking" value="——" />
        <InfoRow label="最大并发" value={String(agent.max_concurrent_tasks ?? 1)} />
      </Section>

      <Section title="技能">
        {skills.length === 0 ? (
          <Text className="py-1 text-sm text-muted-foreground">暂无技能</Text>
        ) : (
          <View className="flex-row flex-wrap gap-1.5">
            {skills.map((s, i) => (
              <View key={s.id ?? i} className="rounded-full bg-secondary px-2.5 py-1">
                <Text className="text-xs text-foreground">
                  {(s.name ?? s.label ?? "技能")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="工具">
        {tools.state === "configured" ? (
          <Text className="py-1 text-sm text-muted-foreground">
            已配置，无权限查看详情
          </Text>
        ) : tools.state === "unknown" ? (
          <StatPlaceholder compact note="未知" />
        ) : tools.count === 0 ? (
          <Text className="py-1 text-sm text-muted-foreground">未配置工具</Text>
        ) : (
          <Text className="py-1 text-sm text-foreground">
            已配置 {tools.count} 个工具（MCP 服务器 + Composio 工具包）
          </Text>
        )}
      </Section>

      <Section title="权限">
        <InfoRow label="可见性" value={visibilityLabel(agent)} />
        <InfoRow label="触发方式" value={permissionLabel(agent)} />
      </Section>

      <Section title="治理">
        <UnsupportedCard
          title="知识库"
          body="暂不支持。员工目前无法挂接知识库，回答仅基于当前对话与可见上下文。"
        />
        <UnsupportedCard
          title="长期记忆"
          body="暂不支持。员工不会跨会话记住你的偏好，每次对话都是独立上下文。"
        />
        <UnsupportedCard
          title="定时任务"
          body="暂不支持。本期移动端不提供定时 / 周期任务能力。"
        />
        <UnsupportedCard
          title="SOP"
          body="暂不支持。标准作业流程需在 Web 端配置，本期移动端只读。"
        />
      </Section>
    </View>
  );
}

function UnsupportedCard({ title, body }: { title: string; body: string }) {
  return (
    <View className="mb-2 rounded-md border border-border bg-card px-3 py-2.5">
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="mt-0.5 text-xs text-muted-foreground">{body}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ── Tab 3 · 会话 ────────────────────────────────────────────────────────

function SessionsTab({
  sessions,
  wsSlug,
}: {
  sessions: readonly import("@multica/core/types").ChatSession[];
  wsSlug: string | null;
}) {
  return (
    <View className="px-4 pt-3">
      {sessions.length === 0 ? (
        <Text className="py-4 text-sm text-muted-foreground text-center">
          该员工还没有会话
        </Text>
      ) : (
        sessions.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => {
              if (wsSlug) router.push(`/${wsSlug}/workbench`);
            }}
            className="flex-row items-center gap-3 py-3 active:bg-secondary/50"
          >
            <View
              className={`h-2 w-2 rounded-full ${s.has_unread ? "bg-primary" : "bg-transparent"}`}
            />
            <View className="flex-1 min-w-0">
              <Text
                className={`text-sm text-foreground ${s.has_unread ? "font-semibold" : ""}`}
                numberOfLines={1}
              >
                {s.title || "Untitled chat"}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {shortDate(s.updated_at)}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

// ── 小组件 ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1 text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {title}
      </Text>
      <View className="rounded-md border border-border bg-card px-3 py-1.5">
        {children}
      </View>
    </View>
  );
}

// ── 纯 helper ───────────────────────────────────────────────────────────

function runtimeLabel(
  agent: Agent,
  runtimeName: string | undefined,
  runtimeMode: string | undefined,
): string {
  if (!isAgentRuntimeBound(agent)) return "工位未绑定 ⚠";
  const mode = runtimeMode === "cloud" ? "云端" : runtimeMode === "local" ? "本地" : "云端";
  return `${runtimeName || "工位"} · ${mode}`;
}

function positionLabel(agent: Agent): string {
  return agent.model ? `模型 ${agent.model}` : "未设置岗位";
}

function statusLabel(status: Agent["status"]): string {
  const map: Record<Agent["status"], string> = {
    idle: "在岗",
    working: "工作中",
    blocked: "受阻",
    error: "异常",
    offline: "离线",
  };
  return map[status] ?? "在岗";
}

function visibilityLabel(agent: Agent): string {
  return agent.visibility === "workspace" ? "工作区可见" : "私有";
}

function permissionLabel(agent: Agent): string {
  if (agent.permission_mode === "public_to") return "指定范围可触发";
  return "仅所有者";
}

function taskStatusLabel(task: AgentTask): string {
  const map: Record<AgentTask["status"], string> = {
    queued: "排队中",
    dispatched: "已派发",
    waiting_local_directory: "等待目录",
    running: "运行中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return map[task.status] ?? task.status;
}

function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
}
