/**
 * Home ③ 待办事项 — real data, **个人维度** (assigned scope).
 *
 * PRD §4.5:
 *   - 数据源 `myIssueListOptions(wsId, "assigned")` — 个人维度, 与报告卡
 *     (工作区维度) 不共用 query key。
 *   - 排序: 逾期 → 今天到期 → 优先级 desc → position (mirror 规则见
 *     `lib/sort-todo.ts`)。
 *   - 最多 5 条; 行内: 状态图标 + identifier + 标题(1 行截断) + 优先级图标 +
 *     到期日 chip (逾期红色)。
 *   - 行点击 → issue/[id]; 「全部 (N)」→ /{slug}/my-issues, N = assigned 未完成
 *     计数 (与我的事项页同 scope 计数一致)。
 *   - 空态: 「今天没有待办」+ 新建事项按钮。
 *   - 实时: 复用 `useMyIssuesRealtime` (listing-level, 已在
 *     `<RealtimeSubscriptions />` 内挂载), 本组件不额外订阅。
 *
 * 6 态 (PRD §9.4): Loading=3 行骨架 / Empty / Error(单行+重试) / Offline=
 * Query 缓存渲染 (弱网不白屏) / Refreshing=父级下拉刷新。
 */
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Issue } from "@multica/core/types";
import {
  formatDateOnly,
  isPastDateOnly,
  todayDateOnly,
} from "@multica/core/issues/date";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIcon } from "@/components/ui/status-icon";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  buildMyIssuesFilter,
  myIssueListOptions,
} from "@/data/queries/my-issues";
import {
  filterTodoIssues,
  sortTodoIssues,
} from "@/lib/sort-todo";

interface Props {
  wsId: string | null;
  userId: string | null;
  wsSlug: string | null;
}

const MAX_ROWS = 5;

export function TodoList({ wsId, userId, wsSlug }: Props) {
  const filter = useMemo(
    () => (userId ? buildMyIssuesFilter("assigned", userId) : { assignee_id: "" }),
    [userId],
  );

  const { data, isLoading, error, refetch } = useQuery({
    ...myIssueListOptions(wsId, "assigned", filter),
    enabled: !!wsId && !!userId,
  });

  const hasData = data !== undefined;

  const today = todayDateOnly();
  const todo = useMemo(
    () => sortTodoIssues(data ?? [], today).slice(0, MAX_ROWS),
    [data, today],
  );
  const totalCount = useMemo(
    () => filterTodoIssues(data ?? []).length,
    [data],
  );

  const openAll = () => {
    if (wsSlug) router.push(`/${wsSlug}/my-issues`);
  };
  const openNewIssue = () => {
    if (wsSlug) router.push(`/${wsSlug}/new-issue`);
  };

  return (
    <Card className="mx-4 mt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">待办事项</Text>
        <Pressable
          onPress={openAll}
          accessibilityRole="button"
          accessibilityLabel="查看全部待办"
          hitSlop={8}
          className="flex-row items-center gap-0.5 py-1"
        >
          <Text className="text-sm text-muted-foreground">
            全部 ({totalCount})
          </Text>
          <Text className="text-sm text-muted-foreground">›</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <TodoSkeleton />
      ) : error && !hasData ? (
        <TodoError onRetry={refetch} />
      ) : todo.length === 0 ? (
        <TodoEmpty onCreate={openNewIssue} />
      ) : (
        <View className="mt-1">
          {todo.map((issue, index) => (
            <View key={issue.id}>
              {index > 0 ? <View className="h-px bg-border ml-4" /> : null}
              <TodoRow
                issue={issue}
                onPress={() => {
                  if (wsSlug) router.push(`/${wsSlug}/issue/${issue.id}`);
                }}
              />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function TodoRow({ issue, onPress }: { issue: Issue; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={issue.identifier}
      className="flex-row items-center gap-3 py-3 active:bg-secondary"
    >
      <StatusIcon status={issue.status} size={14} />
      <Text className="text-xs text-muted-foreground shrink-0 w-16" numberOfLines={1}>
        {issue.identifier}
      </Text>
      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
        {issue.title}
      </Text>
      <PriorityIcon priority={issue.priority} size={14} />
      <DueChip dueDate={issue.due_date} />
    </Pressable>
  );
}

function DueChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const today = todayDateOnly();
  let label: string;
  let overdue: boolean;
  if (isPastDateOnly(dueDate)) {
    label = "逾期";
    overdue = true;
  } else if (dueDate === today) {
    label = "今天";
    overdue = false;
  } else {
    label = formatDateOnly(dueDate);
    overdue = false;
  }
  return (
    <View
      className={`px-1.5 py-0.5 rounded ${
        overdue ? "bg-destructive/10" : "bg-secondary"
      }`}
    >
      <Text
        className={`text-xs ${
          overdue ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function TodoSkeleton() {
  return (
    <View className="mt-1 gap-3 py-3">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 flex-1 rounded" />
          <Skeleton className="h-3.5 w-8 rounded" />
        </View>
      ))}
    </View>
  );
}

function TodoError({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="py-3 gap-2">
      <Text className="text-sm text-muted-foreground">
        待办加载失败，请检查网络
      </Text>
      <Button variant="outline" size="sm" onPress={onRetry} className="self-start">
        <Text>重试</Text>
      </Button>
    </View>
  );
}

function TodoEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="py-4 items-center gap-2">
      <Text className="text-sm text-muted-foreground">今天没有待办</Text>
      <Button variant="outline" size="sm" onPress={onCreate}>
        <Text>新建事项</Text>
      </Button>
    </View>
  );
}
