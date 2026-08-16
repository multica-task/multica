/**
 * Board 视图 C — 进度度量（PRD §5.2）。时间窗 selector（7 / 30 / 90 天）+
 * 2×2 Hero（任务总数 / 运行时长 / Tokens / 失败次数）+ 任务进度 +
 * 员工用量 Top-N + 失败分类。
 *
 * 端点未上线（`useDashboardAvailability() === false`，即本次会话内探测
 * 首个 `/api/dashboard/*` 返回 404）→ **整个视图渲染单张占位卡**，不逐块
 * 报错（PRD §5.2 / §9.4）。探测进行中（null）同样先渲染占位，避免闪假数字。
 * 上线后开关自动翻转，无需改 UI。
 *
 * Hero 聚合口径与 web 一致：
 *   任务总数 = Σ dashboardRunTimeDaily.task_count
 *   运行时长 = Σ dashboardRunTimeDaily.total_seconds
 *   Tokens   = Σ dashboardUsageDaily(input+output+cache_read+cache_write)
 *   失败次数 = Σ dashboardFailuresDaily（failure_reason !== "" 的行）
 */
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useQuery } from "@tanstack/react-query";
import type { Agent, DashboardFailureByAgent, Issue } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { StatPlaceholder } from "@/components/ui/stat-placeholder";
import { TaskProgress } from "./task-progress";
import { AgentUsage } from "./agent-usage";
import { useWorkspaceStore } from "@/data/workspace-store";
import {
  DASHBOARD_WINDOWS,
  dashboardFailuresByAgentOptions,
  dashboardFailuresDailyOptions,
  dashboardRunTimeDailyOptions,
  dashboardUsageByAgentOptions,
  dashboardUsageDailyOptions,
  localTimezone,
  useDashboardAvailability,
  type DashboardWindow,
} from "@/data/queries/dashboard";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { formatCompactNumber, formatDuration } from "@/lib/format";
import { FAILURE_CLASSES, FAILURE_CLASS_LABEL, failureClassOf } from "@/lib/failure-class";
import { cn } from "@/lib/utils";

const WINDOW_LABEL: Record<DashboardWindow, string> = {
  7: "7 天",
  30: "30 天",
  90: "90 天",
};

interface Props {
  issues: Issue[];
  agents: Agent[];
}

export function BoardProgress({ issues, agents }: Props) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const availability = useDashboardAvailability();
  const [window, setWindow] = useState<DashboardWindow>(7);
  const tz = localTimezone();

  const enabled = availability === true;

  const usageDaily = useQuery(dashboardUsageDailyOptions(wsId, window, tz, enabled));
  const runTimeDaily = useQuery(dashboardRunTimeDailyOptions(wsId, window, tz, enabled));
  const failuresDaily = useQuery(dashboardFailuresDailyOptions(wsId, window, tz, enabled));
  const usageByAgent = useQuery(dashboardUsageByAgentOptions(wsId, window, tz, enabled));
  const failuresByAgent = useQuery(
    dashboardFailuresByAgentOptions(wsId, window, tz, enabled),
  );

  const hero = useMemo(() => {
    const usage = usageDaily.data ?? [];
    const runTime = runTimeDaily.data ?? [];
    const failures = failuresDaily.data ?? [];
    let tokens = 0;
    for (const u of usage) {
      tokens += u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens;
    }
    let seconds = 0;
    let tasks = 0;
    for (const r of runTime) {
      seconds += r.total_seconds;
      tasks += r.task_count;
    }
    let failed = 0;
    for (const r of failures) {
      if (r.failure_reason !== "") failed += r.task_count;
    }
    return { tokens, seconds, tasks, failed };
  }, [usageDaily.data, runTimeDaily.data, failuresDaily.data]);

  // 未就绪（含探测中）→ 单张占位卡。
  if (availability !== true) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
        <Card>
          <Text className="text-sm font-medium text-foreground">进度度量</Text>
          <StatPlaceholder note="统计接口未上线" />
          <Text className="text-xs text-muted-foreground/70">
            该视图依赖的统计接口尚未上线，上线后此处将自动显示数据。
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-6">
      <View className="px-4 pt-3 items-start">
        <SegmentedControl
          values={DASHBOARD_WINDOWS.map((w) => WINDOW_LABEL[w])}
          selectedIndex={DASHBOARD_WINDOWS.indexOf(window)}
          onValueChange={(v) => {
            const next = DASHBOARD_WINDOWS.find((w) => WINDOW_LABEL[w] === v);
            if (next) setWindow(next);
          }}
          tintColor={t.brand}
          backgroundColor={t.secondary}
          style={{ width: 210, height: 30 }}
        />
      </View>

      <View className="flex-row flex-wrap px-4 pt-3 gap-2.5">
        <HeroCard label="任务总数" value={formatCompactNumber(hero.tasks)} />
        <HeroCard label="运行时长" value={formatDuration(hero.seconds)} />
        <HeroCard label="Tokens" value={formatCompactNumber(hero.tokens)} />
        <HeroCard label="失败次数" value={formatCompactNumber(hero.failed)} />
      </View>

      <View className="px-4 pt-2.5">
        <TaskProgress issues={issues} />
      </View>
      <View className="px-4 pt-2.5">
        <AgentUsage rows={usageByAgent.data ?? []} agents={agents} />
      </View>
      <View className="px-4 pt-2.5">
        <FailureClassBreakdown rows={failuresByAgent.data ?? []} />
      </View>
    </ScrollView>
  );
}

function HeroCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ width: "48%" }} className="p-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-1 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </Text>
    </Card>
  );
}

/**
 * 失败分类 —— 按 `lib/failure-class.ts` 的七个类聚合，展示中文类名 + 计数 +
 * 相对条。`failure_reason === ""` 是「成功」桶，不计入失败（PRD §10.2 B-1 /
 * web foldFailureRow 同口径）。空数据（或端点未上线）渲染 `——` 占位。
 */
function FailureClassBreakdown({ rows }: { rows: DashboardFailureByAgent[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.failure_reason === "") continue;
      const cls = failureClassOf(r.failure_reason);
      map.set(cls, (map.get(cls) ?? 0) + r.task_count);
    }
    return map;
  }, [rows]);

  const total = FAILURE_CLASSES.reduce((sum, c) => sum + (counts.get(c) ?? 0), 0);

  return (
    <Card>
      <Text className="text-sm font-medium text-foreground">失败分类</Text>
      {total === 0 ? (
        <StatPlaceholder note="统计接口未上线" compact />
      ) : (
        <View className="gap-2 mt-3">
          {FAILURE_CLASSES.map((cls) => {
            const count = counts.get(cls) ?? 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            return (
              <View key={cls} className="flex-row items-center gap-2.5">
                <Text className="w-14 text-xs text-muted-foreground">
                  {FAILURE_CLASS_LABEL[cls]}
                </Text>
                <View className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <View
                    className={cn("h-full rounded-full bg-destructive/70")}
                    style={{ width: `${Math.round(pct)}%` }}
                  />
                </View>
                <Text className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
