/**
 * Home ④ 行业简报 — B 类 mock 数据（PRD §4.6，M2 落地）。
 *
 * 必做范围：首页最多 3 条 + 「示例数据」徽标 + 点击进详情。列表页 / 分类
 * 筛选 / 已读持久化 / 实时全部后置（等 B-2 对接）。
 *
 * 行结构（§4.6 首页区块）：分类 chip + 标题（2 行截断）+ 来源 · 相对时间；
 * `relevance: "high"` 的条目标题左侧加品牌色竖条。已读态：点击后标题从加粗
 * 变常规（内存态，冷启动重置可接受）。
 *
 * 「更多 ›」入口本期隐藏（列表页后置）。空态（mock 数组为空）：「暂无简报」+
 * 副文案。徽标由 `USE_MOCK_BRIEFS` 同源驱动（`ExampleDataBadge`）。
 *
 * 6 态（§9.4）：Loading=2 行骨架 / Empty=空态 / Error=单行 + 重试 /
 * Offline=缓存渲染 / Refreshing=父级下拉刷新 / Partial 不适用。
 */
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ExampleDataBadge } from "@/components/home/example-data-badge";
import { briefListOptions } from "@/data/queries/briefs";
import { useWorkspaceStore } from "@/data/workspace-store";
import { timeAgo } from "@/lib/time-ago";

const MAX_ROWS = 3;

export function BriefList() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const { data, isLoading, error, refetch } = useQuery(briefListOptions(wsId));

  // 已读态：内存 Set<id>，冷启动重置可接受（§4.6）。点击详情后置位。
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => (data ?? []).slice(0, MAX_ROWS), [data]);

  if (isLoading) {
    return (
      <Card className="mx-4 mt-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">行业简报</Text>
          <ExampleDataBadge />
        </View>
        <Skeleton className="h-12 w-full rounded-sm" />
        <Skeleton className="h-12 w-full rounded-sm" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mx-4 mt-4 gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">行业简报</Text>
          <ExampleDataBadge />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-destructive">简报加载失败</Text>
          <Pressable
            onPress={() => void refetch()}
            className="px-3 py-1.5 rounded-md bg-secondary active:bg-secondary/70"
          >
            <Text className="text-sm text-foreground">重试</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  return (
    <Card className="mx-4 mt-4 gap-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">行业简报</Text>
        <ExampleDataBadge />
      </View>

      {rows.length === 0 ? (
        <View className="py-6 items-center gap-1">
          <Text className="text-sm text-muted-foreground">暂无简报</Text>
          <Text className="text-xs text-muted-foreground/70">
            接入后每日推送与你项目相关的行业动态
          </Text>
        </View>
      ) : (
        rows.map((brief) => {
          const isRead = readIds.has(brief.id);
          return (
            <Pressable
              key={brief.id}
              onPress={() => {
                setReadIds((prev) => new Set(prev).add(brief.id));
                if (wsSlug) {
                  router.push({
                    pathname: "/[workspace]/brief/[id]",
                    params: { workspace: wsSlug, id: brief.id },
                  });
                }
              }}
              className="py-2.5 active:bg-secondary"
              accessibilityRole="button"
              accessibilityLabel={brief.title}
            >
              <View className="flex-row gap-2">
                {brief.relevance === "high" ? (
                  <View className="w-[3px] rounded-full bg-brand" />
                ) : null}
                <View className="flex-1 gap-1">
                  <Text
                    className={
                      isRead
                        ? "text-sm text-foreground leading-5"
                        : "text-sm font-semibold text-foreground leading-5"
                    }
                    numberOfLines={2}
                  >
                    {brief.title}
                  </Text>
                  <Text className="text-xs text-muted-foreground/70">
                    {brief.category}
                    {brief.source_name ? ` · ${brief.source_name}` : ""} ·{" "}
                    {timeAgo(brief.published_at)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </Card>
  );
}
