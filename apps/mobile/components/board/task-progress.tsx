/**
 * Board 视图 C — 任务进度卡（PRD §5.2）。数据源：`/api/issues`（workspace
 * 全量，客户端按 status 聚合）+ `/api/dashboard/usage/daily`（端点上线后
 * 的补充维度，未上线不影响本卡）。
 *
 * 渲染：总事项 / 已完成 / 未完成三格 + 完成进度条 + 各状态分布条
 * （`BOARD_STATUSES` 顺序，cancelled 不计入完成口径 —— 与 web 看板一致）。
 *
 * 无 dashboard 依赖：即使 6 个统计端点全部 404，本卡仍能基于 `/api/issues`
 * 显示真实数字（PRD §5.2 视图 C 占位只覆盖依赖 dashboard 的区块；本卡是
 * 视图 C 里唯一不依赖 dashboard 的）。
 */
import { useMemo } from "react";
import { View } from "react-native";
import type { Issue } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { StatusIcon } from "@/components/ui/status-icon";
import { BOARD_STATUSES, STATUS_LABEL } from "@/lib/issue-status";
import { cn } from "@/lib/utils";

interface Props {
  issues: Issue[];
}

export function TaskProgress({ issues }: Props) {
  const stats = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const issue of issues) {
      byStatus.set(issue.status, (byStatus.get(issue.status) ?? 0) + 1);
    }
    const done = byStatus.get("done") ?? 0;
    const total = issues.length;
    const open = total - done;
    const pct = total > 0 ? done / total : 0;
    return { byStatus, done, open, total, pct };
  }, [issues]);

  if (issues.length === 0) {
    return (
      <Card>
        <Text className="text-sm font-medium text-foreground">任务进度</Text>
        <Text className="mt-1 text-xs text-muted-foreground">暂无事项</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text className="text-sm font-medium text-foreground">任务进度</Text>
      <View className="flex-row gap-2 mt-3">
        <Stat value={stats.total} label="总事项" />
        <Stat value={stats.done} label="已完成" accent />
        <Stat value={stats.open} label="未完成" />
      </View>
      <View className="h-1.5 rounded-full bg-secondary overflow-hidden mt-3">
        <View
          className={cn(
            "h-full rounded-full",
            stats.pct >= 1 ? "bg-success" : "bg-info",
          )}
          style={{ width: `${Math.min(100, Math.round(stats.pct * 100))}%` }}
        />
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {BOARD_STATUSES.map((status) => {
          const count = stats.byStatus.get(status) ?? 0;
          return (
            <View key={status} className="flex-row items-center gap-1.5">
              <StatusIcon status={status} size={12} />
              <Text className="text-xs text-muted-foreground">
                {STATUS_LABEL[status]} {count}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 rounded-md bg-secondary/60 px-3 py-2">
      <Text
        className={cn(
          "text-lg font-semibold tabular-nums",
          accent ? "text-info" : "text-foreground",
        )}
      >
        {value}
      </Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
