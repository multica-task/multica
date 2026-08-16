/**
 * 报告详情页 `/{slug}/reports`（PRD §3.2 新增路由 + §4.4「查看完整报告」落点，
 * M2-3 落地）。
 *
 * 与首页报告卡共用 `useHomeViewStore` 周期 + `issueListOptions` 缓存 + 客户端
 * 聚合（`computeReportStats`），因此从首页进入是 0 新增请求。`?period=` 参数
 * 来自首页「查看完整报告」，命中后写入 store（切走再回首页周期一致）。
 *
 * 比卡片多一段「状态分布」明细（§4.4 行内次指标之外的全量状态清单），仍走
 * workspace 当前快照。运行时长 / Tokens 等无数据源指标显示 `——` + 说明
 * （A 类数据，§0.4）。
 *
 * 6 态（§9.4）：Loading=骨架 / Error=单行 + 重试 / Empty=0 值正常渲染 /
 * Partial=`——` / Offline=缓存渲染 / Refreshing=下拉刷新（重拉 workspace issues）。
 */
import { useEffect, useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ReportMetrics } from "@/components/home/report-card";
import { issueListOptions } from "@/data/queries/issues";
import { useHomeViewStore } from "@/data/stores/home-view-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  computeReportStats,
  REPORT_PERIOD_LABEL,
  REPORT_PERIODS,
  type ReportPeriod,
} from "@/lib/report-stats";

export default function ReportsPage() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const period = useHomeViewStore((s) => s.reportPeriod);
  const setReportPeriod = useHomeViewStore((s) => s.setReportPeriod);
  const { period: periodParam } = useLocalSearchParams<{ period?: string }>();
  const isFocused = useIsFocused();

  const issuesQuery = useQuery(issueListOptions(wsId));

  // 首页「查看完整报告」带 ?period= 进入 → 同步到 store。
  useEffect(() => {
    if (periodParam && REPORT_PERIODS.includes(periodParam as ReportPeriod)) {
      setReportPeriod(periodParam as ReportPeriod);
    }
  }, [periodParam, setReportPeriod]);

  const stats = useMemo(
    () => computeReportStats(issuesQuery.data ?? [], period),
    [issuesQuery.data, period],
  );

  const degraded = stats.runtimeHours === null || stats.tokens === null;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={isFocused && issuesQuery.isRefetching}
          onRefresh={() => void issuesQuery.refetch()}
          tintColor={THEME[colorScheme].mutedForeground}
        />
      }
    >
      <Card>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-base font-semibold text-foreground">
            数据报告
          </Text>
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

        {issuesQuery.isLoading ? (
          <View className="flex-row justify-between mt-4">
            <Skeleton className="size-[65px] rounded-full" />
            <Skeleton className="size-[65px] rounded-full" />
            <Skeleton className="size-[65px] rounded-full" />
          </View>
        ) : issuesQuery.isError ? (
          <View className="flex-row items-center justify-between mt-4">
            <Text className="text-sm text-destructive">报告加载失败</Text>
            <Text
              className="text-sm text-brand"
              onPress={() => void issuesQuery.refetch()}
              accessibilityRole="button"
            >
              重试
            </Text>
          </View>
        ) : (
          <ReportMetrics stats={stats} />
        )}

        {degraded ? (
          <Text className="mt-3 text-xs text-muted-foreground/70">
            部分统计接口未上线，运行时长 / Tokens 暂缺
          </Text>
        ) : null}
      </Card>

      {/* 状态分布明细（workspace 当前快照，非周期）。 */}
      <Card className="gap-2">
        <Text className="text-sm font-semibold text-foreground">状态分布</Text>
        {issuesQuery.isLoading ? (
          <Skeleton className="h-4 w-full rounded-sm" />
        ) : (
          [
            { key: "in_progress", label: "进行中", count: stats.statusDistribution.inProgress },
            { key: "in_review", label: "待评审", count: stats.statusDistribution.inReview },
            { key: "blocked", label: "受阻", count: stats.statusDistribution.blocked },
            { key: "cancelled", label: "失败", count: stats.statusDistribution.failed },
          ].map((row) => (
            <View
              key={row.key}
              className="flex-row items-center justify-between py-1"
            >
              <Text className="text-sm text-muted-foreground">{row.label}</Text>
              <Text className="text-sm text-foreground tabular-nums">
                {row.count}
              </Text>
            </View>
          ))
        )}
        <Text className="mt-1 text-xs text-muted-foreground/70">
          当前工作区快照 · 不含已归档
        </Text>
      </Card>
    </ScrollView>
  );
}
