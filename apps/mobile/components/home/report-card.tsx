/**
 * Home ② 数据分析报告 — 日/周/月 segmented + 环形指标 + 行内次指标
 * （PRD §4.4，M2 落地）。
 *
 * 口径（v1.5）：报告卡 = **工作区维度**（`issueListOptions` → workspace 全量
 * issues 客户端聚合），待办 = 个人维度，二者不共用 query key。首屏预算内
 * 新增 1 网络（workspace issues），agents/members 复用 home-header 已挂载的
 * 查询（0 新增）。
 *
 * 降级（PRD §4.4 数据源表 + §0.4 A 类数据）：完成/新建/状态分布走客户端
 * 聚合 ✅；运行时长 / Tokens 无数据源 → 环形显示 `——` + 卡片底部 12px 弱色
 * 「部分统计接口未上线」，绝不显示 0。探测与 dashboard 数据层由 M3 看板
 * （#12 的 `data/queries/dashboard.ts`）承接，M2 本卡只依赖 `/api/issues` 聚合。
 *
 * 交互：周期切换记忆到 `useHomeViewStore`（内存，切工作区清空）；切换 220ms
 * 淡入（对齐 meet-think 手感），内容区固定高度防跳动；「查看完整报告」→
 * `/{slug}/reports?period=day|week|month`。
 *
 * 6 态（§9.4）：Loading=3 圆环骨架 / Error=单行 + 重试 / Empty=0 值正常渲染 /
 * Partial=缺失环 `——` / Offline=Query 缓存渲染 / Refreshing=父级下拉刷新。
 */
import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { issueListOptions } from "@/data/queries/issues";
import { agentListOptions } from "@/data/queries/agents";
import { useHomeViewStore } from "@/data/stores/home-view-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  computeReportStats,
  REPORT_PERIOD_LABEL,
  REPORT_PERIODS,
  type ReportStats,
} from "@/lib/report-stats";
import { MetricRing } from "@/components/home/metric-ring";

const ANIM_MS = 220;

/** 三个环形中的最大值（缺失环按 0 参与，仅供进度相对比较）。 */
function maxOf(...values: (number | null)[]): number {
  return Math.max(1, ...values.map((v) => (v ?? 0)));
}

/** 日视图行内：进行中 · 待评审 · 受阻 · 失败。 */
function DayInline({ stats }: { stats: ReportStats }) {
  const { inProgress, inReview, blocked, failed } = stats.statusDistribution;
  return (
    <Text className="text-xs text-muted-foreground">
      进行中 {inProgress} · 待评审 {inReview} · 受阻 {blocked} · 失败 {failed}
    </Text>
  );
}

/** 周视图行内：近 7 日完成趋势迷你条 + 环比箭头。 */
function WeekInline({ stats }: { stats: ReportStats }) {
  const max = Math.max(1, ...stats.weeklyTrend.map((d) => d.count));
  const delta = stats.weekOverWeekPercent;
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-end gap-[3px] h-7">
        {stats.weeklyTrend.map((d, i) => (
          <View
            key={i}
            className="bg-brand/60 rounded-sm"
            style={{
              width: 10,
              height: Math.max(3, Math.round((d.count / max) * 24)),
            }}
          />
        ))}
      </View>
      {delta !== null ? (
        <View className="flex-row items-center gap-1">
          <Text
            className={
              delta >= 0 ? "text-xs text-success" : "text-xs text-destructive"
            }
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </Text>
          <Text className="text-xs text-muted-foreground">环比</Text>
        </View>
      ) : (
        <Text className="text-xs text-muted-foreground/70">无环比基期</Text>
      )}
    </View>
  );
}

/** 月视图行内：Top 3 员工贡献条 + 失败率（样本约束 §13.1）。 */
function MonthInline({ stats }: { stats: ReportStats }) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const maxCount = Math.max(1, ...stats.topContributors.map((c) => c.count));

  return (
    <View className="gap-2">
      {stats.topContributors.length === 0 ? (
        <Text className="text-xs text-muted-foreground/70">本月暂无完成</Text>
      ) : (
        stats.topContributors.map((c) => {
          const name =
            agents.find((a) => a.id === c.assigneeId)?.name ??
            (c.assigneeId ? `成员 ${c.assigneeId.slice(0, 4)}` : "未指派");
          return (
            <View key={c.assigneeId ?? "none"} className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-20" numberOfLines={1}>
                {name}
              </Text>
              <View className="flex-1 h-2 bg-secondary rounded-sm overflow-hidden">
                <View
                  className="h-full bg-brand/70 rounded-sm"
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                />
              </View>
              <Text className="text-xs text-muted-foreground tabular-nums">
                {c.count}
              </Text>
            </View>
          );
        })
      )}
      <Text className="text-xs text-muted-foreground">
        {stats.failRate !== null
          ? `失败率 ${stats.failRate}%`
          : stats.failDenominator > 0
            ? `失败率样本不足（n=${stats.failDenominator}）`
            : "失败率 —"}
      </Text>
    </View>
  );
}

function RingRow({ stats }: { stats: ReportStats }) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  // 三个环形：日=新建/完成/运行时长；周、月=完成/运行时长/Tokens。
  const isDay = stats.period === "day";
  const ringData = isDay
    ? [
        { value: stats.created, label: "新建事项", suffix: "" },
        { value: stats.done, label: "已完成", suffix: "" },
        { value: stats.runtimeHours, label: "员工运行", suffix: "h", note: "统计接口未上线" },
      ]
    : [
        { value: stats.done, label: "完成", suffix: "" },
        { value: stats.runtimeHours, label: "运行时长", suffix: "h", note: "统计接口未上线" },
        { value: stats.tokens, label: "Tokens", suffix: "", note: "统计接口未上线" },
      ];
  const max = maxOf(...ringData.map((r) => r.value));

  return (
    <View className="flex-row mt-3">
      {ringData.map((r) => (
        <MetricRing
          key={r.label}
          value={r.value}
          label={r.label}
          suffix={r.suffix}
          note={r.note}
          color={t.brand}
          progress={(r.value ?? 0) / max}
        />
      ))}
    </View>
  );
}

/**
 * 报告内容区（环形 + 行内次指标），首页卡片与 `/{slug}/reports` 详情页共用。
 */
export function ReportMetrics({ stats }: { stats: ReportStats }) {
  return (
    <>
      <RingRow stats={stats} />
      {/* 固定 minHeight 防切换跳动（PRD §4.4 交互）。 */}
      <View className="mt-3 pt-3 border-t border-border min-h-[52px] justify-center">
        {stats.period === "day" ? (
          <DayInline stats={stats} />
        ) : stats.period === "week" ? (
          <WeekInline stats={stats} />
        ) : (
          <MonthInline stats={stats} />
        )}
      </View>
    </>
  );
}

export function ReportCard() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const period = useHomeViewStore((s) => s.reportPeriod);
  const setReportPeriod = useHomeViewStore((s) => s.setReportPeriod);

  const issuesQuery = useQuery(issueListOptions(wsId));
  const fade = useSharedValue(1);

  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [period, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const stats = useMemo(
    () => computeReportStats(issuesQuery.data ?? [], period),
    [issuesQuery.data, period],
  );

  // 任一环形缺失（运行时长 / Tokens）→ 卡片底部说明（与探测结果无关，
  // 纯由聚合结果判定）。
  const degraded = stats.runtimeHours === null || stats.tokens === null;

  if (issuesQuery.isLoading) {
    return (
      <Card className="mx-4 mt-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">数据报告</Text>
          <Skeleton className="h-6 w-28 rounded-md" />
        </View>
        <View className="flex-row justify-between mt-2">
          <Skeleton className="size-[65px] rounded-full" />
          <Skeleton className="size-[65px] rounded-full" />
          <Skeleton className="size-[65px] rounded-full" />
        </View>
      </Card>
    );
  }

  if (issuesQuery.isError) {
    return (
      <Card className="mx-4 mt-4 gap-2">
        <Text className="text-base font-semibold text-foreground">数据报告</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-destructive">报告加载失败</Text>
          <Pressable
            onPress={() => void issuesQuery.refetch()}
            className="px-3 py-1.5 rounded-md bg-secondary active:bg-secondary/70"
          >
            <Text className="text-sm text-foreground">重试</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Card className="mx-4 mt-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-base font-semibold text-foreground">数据报告</Text>
        <SegmentedControl
          values={REPORT_PERIODS.map((p) => REPORT_PERIOD_LABEL[p])}
          selectedIndex={REPORT_PERIODS.indexOf(period)}
          onValueChange={(v) => {
            const next = REPORT_PERIODS.find((p) => REPORT_PERIOD_LABEL[p] === v);
            if (next) setReportPeriod(next);
          }}
          tintColor={t.brand}
          backgroundColor={t.secondary}
          style={{ width: 132, height: 28 }}
        />
      </View>

      <Animated.View style={fadeStyle}>
        <ReportMetrics stats={stats} />
      </Animated.View>

      {degraded ? (
        <Text className="mt-2 text-xs text-muted-foreground/70">
          部分统计接口未上线
        </Text>
      ) : null}

      <Pressable
        onPress={() =>
          wsSlug &&
          router.push({
            pathname: "/[workspace]/reports",
            params: { workspace: wsSlug, period },
          })
        }
        className="mt-3 flex-row items-center justify-end pt-2 border-t border-border"
        accessibilityRole="button"
        accessibilityLabel="查看完整报告"
      >
        <Text className="text-sm text-brand">查看完整报告</Text>
        <Text className="text-brand text-sm ml-0.5">›</Text>
      </Pressable>
    </Card>
  );
}
