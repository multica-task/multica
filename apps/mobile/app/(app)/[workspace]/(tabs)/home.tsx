/**
 * 首页 (Today dashboard) — M1-4 shell.
 *
 * 区块 (PRD §4.2): Header(问候+铃铛+搜索) → ① 快捷入口 → ② 数据报告(骨架) →
 * ③ 待办事项(真数据) → ④ 行业简报(骨架)。每块独立降级 — 一块失败不影响其他块
 * (PRD §4.7 区块级独立降级)。
 *
 * 首屏请求预算 (PRD §9.6): 待办 = 个人维度 (`myIssueListOptions(wsId,"assigned")`)
 * — 首屏 1 个网络请求; 在岗人数复用已全局预取的 `agents` (useWorkspacePresencePrefetch)
 * — 0 新增。报告卡 (工作区维度 `issueListOptions`, 挂 `issueKeys.list`) 与简报
 * (`briefs(mock)`, 本地) 在 M2 接入, 届时首屏 = 2 网络 + 1 本地, 仍不超
 * PRD §9.6「4 网络 + 1 本地」预算。
 */
import { useMemo } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  buildMyIssuesFilter,
  myIssueListOptions,
} from "@/data/queries/my-issues";
import { HomeHeader } from "@/components/home/home-header";
import { QuickActions } from "@/components/home/quick-actions";
import { ReportCard } from "@/components/home/report-card";
import { TodoList } from "@/components/home/todo-list";
import { BriefList } from "@/components/home/brief-list";

export default function HomeScreen() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { colorScheme } = useColorScheme();
  const isFocused = useIsFocused();

  // Todo block's query lives here so the pull-to-refresh can refetch it;
  // the list renders inside <TodoList>. Personal scope — see header comment.
  const todoFilter = useMemo(
    () => (userId ? buildMyIssuesFilter("assigned", userId) : { assignee_id: "" }),
    [userId],
  );
  const todoQuery = useQuery({
    ...myIssueListOptions(wsId, "assigned", todoFilter),
    enabled: !!wsId && !!userId,
  });

  return (
    <View className="flex-1 bg-background">
      <HomeHeader />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isFocused && todoQuery.isRefetching}
            onRefresh={() => {
              // PRD §4.7: 下拉刷新刷新 ②③④ 全部查询。M1 只有待办是真数据。
              void todoQuery.refetch();
            }}
            tintColor={THEME[colorScheme].mutedForeground}
          />
        }
      >
        <QuickActions />
        <ReportCard />
        <TodoList wsId={wsId} userId={userId} wsSlug={wsSlug} />
        <BriefList />
      </ScrollView>
    </View>
  );
}
