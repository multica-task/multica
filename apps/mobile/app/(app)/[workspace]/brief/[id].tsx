/**
 * 简报详情页 `/{slug}/brief/[id]`（PRD §3.2 新增路由 + §4.6 必做，M2-5 落地）。
 *
 * 只读阅读：分类 chip + 来源徽标（「每日更新」/「示例数据」）+ 标题 +
 * 来源 · 相对时间 + Markdown 正文（复用 `lib/markdown` 现有混合渲染管线，
 * 不新写渲染器）+ 来源链接。
 *
 * - 「分享」走 `Share.share`（§4.6）。
 * - 「让数字员工深挖这条」（可选增强，M2-7）：→ `/{slug}/staff-picker?intent=dispatch`
 *   选员工 → `new-issue` 预填标题 `调研：{简报标题}`、描述（摘要 + 来源 +
 *   `> 来自行业简报` 引用块）、assignee 为所选员工 —— 创建的是真实 issue。
 *
 * 数据：每日 JSON 链路（COD-55，`briefDetailOptions` 单条查询，`BriefDetailResult`）。
 * 找不到（id 不在当前简报列表）→ 空态。
 *
 * 6 态（§9.4）：Loading=骨架 / Empty=「简报不存在」+ 返回 / Error=单行 + 重试 /
 * Offline=缓存渲染 / Refreshing 不适用（详情页）/ Partial 不适用。
 */
import { useMemo } from "react";
import { Linking, Pressable, ScrollView, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/data/workspace-store";
import { briefDetailOptions } from "@/data/queries/briefs";
import { Markdown } from "@/lib/markdown";
import { timeAgo } from "@/lib/time-ago";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ExampleDataBadge } from "@/components/home/example-data-badge";

export default function BriefDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);

  const { data, isLoading, error, refetch } = useQuery(
    briefDetailOptions(wsId, id ?? ""),
  );

  const brief = useMemo(
    () => (data?.brief && data.brief.id ? data.brief : null),
    [data],
  );

  const onShare = () => {
    if (!brief) return;
    void Share.share({
      title: brief.title,
      message: brief.title,
      url: brief.source_url ?? undefined,
    }).catch(() => {
      // 用户取消分享，无需处理。
    });
  };

  const openSource = () => {
    if (!brief?.source_url) return;
    Linking.openURL(brief.source_url).catch(() => {
      // 无应用可处理时静默。
    });
  };

  const deepDive = () => {
    if (!brief || !wsSlug) return;
    const description = [
      brief.summary,
      "",
      brief.source_url ? `来源：[${brief.source_name ?? "原文"}](${brief.source_url})` : "",
      "",
      "> 来自行业简报",
    ]
      .filter(Boolean)
      .join("\n");
    // title/description 会一路带到 new-issue（staff-picker → new-issue）。
    router.push({
      pathname: "/[workspace]/staff-picker",
      params: {
        workspace: wsSlug,
        intent: "dispatch",
        title: `调研：${brief.title}`,
        description,
      },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 py-4 gap-4">
        <Skeleton className="h-6 w-24 rounded-sm" />
        <Skeleton className="h-8 w-full rounded-sm" />
        <Skeleton className="h-24 w-full rounded-sm" />
        <Skeleton className="h-40 w-full rounded-sm" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8 gap-3">
        <Text className="text-sm text-muted-foreground">简报加载失败</Text>
        <Pressable onPress={() => void refetch()} className="px-4 py-2 rounded-md bg-secondary">
          <Text className="text-sm text-foreground">重试</Text>
        </Pressable>
      </View>
    );
  }

  if (!brief) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8 gap-2">
        <Text className="text-base text-muted-foreground">简报不存在</Text>
        <Text className="text-xs text-muted-foreground/70">
          可能已下线，返回首页查看其他简报
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 pb-8"
    >
      {/* 分类 + 来源徽标 */}
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-medium text-brand">{brief.category}</Text>
        <ExampleDataBadge source={data?.source ?? "daily"} />
      </View>

      <Text className="mt-2 text-2xl font-semibold leading-8 text-foreground">
        {brief.title}
      </Text>

      <View className="mt-2 flex-row items-center gap-2">
        {brief.source_name ? (
          <Text className="text-xs text-muted-foreground">{brief.source_name}</Text>
        ) : null}
        <Text className="text-xs text-muted-foreground/70">
          {timeAgo(brief.published_at)}
        </Text>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="分享"
          className="ml-auto px-2 py-1 rounded-md bg-secondary active:bg-secondary/70"
        >
          <Text className="text-xs text-foreground">分享</Text>
        </Pressable>
      </View>

      <View className="mt-4">
        <Markdown content={brief.content} />
      </View>

      {brief.source_url ? (
        <Pressable
          onPress={openSource}
          className="mt-4 flex-row items-center justify-between rounded-md border border-border bg-card px-4 py-3 active:bg-secondary"
          accessibilityRole="link"
        >
          <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
            来源链接
          </Text>
          <Text className="text-brand text-sm ml-2">↗</Text>
        </Pressable>
      ) : null}

      {/* 让员工深挖 —— 真建 issue、真派单（PRD §11 边界表）。 */}
      <Card className="mt-4 gap-1">
        <Text className="text-sm font-medium text-foreground">
          🔍 让数字员工深挖这条
        </Text>
        <Text className="text-xs text-muted-foreground/70">
          预填调研事项并派给所选员工，创建的是真实任务
        </Text>
        <View className="mt-2">
          <Button variant="outline" onPress={deepDive}>
            <Text className="text-brand">选择员工去深挖</Text>
          </Button>
        </View>
      </Card>
    </ScrollView>
  );
}
