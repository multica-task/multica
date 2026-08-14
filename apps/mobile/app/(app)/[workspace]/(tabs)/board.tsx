/**
 * 看板 Tab — M3（COD-40）。PRD §5：整盘项目任务的可视化管理（workspace 级）。
 * 三视图：列（默认，横向分页 + 长按改状态）/ 泳道（按项目分组）/ 进度（视图 C，
 * dashboard 端点未上线时单卡占位）。
 *
 * 数据：`/api/issues`（boardList，按 project/priority/assignee 过滤、status
 * 客户端分组）+ `/api/projects`（泳道分组头）。无新接口（PRD §5.4）。
 *
 * 长按卡片 → `ActionSheetIOS`「移到 <状态> / 改派员工 / 打开详情」，走
 * `useUpdateIssue` 乐观更新（≤500ms 无回弹，跨列 patch 见
 * `data/mutations/issues.ts`）。「改派员工」复用 issue assignee picker
 * formSheet（原生搜索）。
 */
import { useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Issue, IssuePriority, IssueStatus } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { IconButton } from "@/components/ui/icon-button";
import { StateView } from "@/components/ui/state-view";
import { BoardColumns } from "@/components/board/board-columns";
import { BoardSwimlanes } from "@/components/board/board-swimlanes";
import { BoardProgress } from "@/components/board/board-progress";
import { IssuesLoading } from "@/components/issue/issues-loading";
import {
  applyBoardFilters,
  boardListOptions,
  groupIssuesByStatus,
  visibleBoardStatuses,
  type BoardFilter,
} from "@/data/queries/board";
import { projectListOptions, findProject } from "@/data/queries/projects";
import { agentListOptions } from "@/data/queries/agents";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useBoardViewStore } from "@/data/stores/board-view-store";
import { useClearFiltersOnWorkspaceChange } from "@/lib/use-clear-filters-on-workspace-change";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/issue-status";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

const VIEW_LABEL = { columns: "列", swimlanes: "泳道", progress: "进度" } as const;

export default function BoardTab() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const { colorScheme } = useColorScheme();

  const view = useBoardViewStore((s) => s.view);
  const setView = useBoardViewStore((s) => s.setView);
  const projectId = useBoardViewStore((s) => s.projectId);
  const statusFilters = useBoardViewStore((s) => s.statusFilters);
  const priorityFilters = useBoardViewStore((s) => s.priorityFilters);
  const assigneeFilters = useBoardViewStore((s) => s.assigneeFilters);

  useClearFiltersOnWorkspaceChange(
    useBoardViewStore.getState().clearFilters,
    wsId,
  );

  const filter = useMemo<BoardFilter>(
    () => ({ projectId, priorityFilters, assigneeFilters }),
    [projectId, priorityFilters, assigneeFilters],
  );

  const { data: rawIssues = [], isLoading, error, refetch } = useQuery(
    boardListOptions(wsId, filter),
  );
  const { data: projects = [] } = useQuery(projectListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));

  const issues = useMemo(
    () => applyBoardFilters(rawIssues, filter),
    [rawIssues, filter],
  );

  const hasActiveFilters =
    projectId !== null ||
    statusFilters.length > 0 ||
    priorityFilters.length > 0 ||
    assigneeFilters.length > 0;

  const openBoardView = useCallback(() => {
    if (wsSlug) router.push({ pathname: "/[workspace]/board-view", params: { workspace: wsSlug } });
  }, [wsSlug]);

  const openSearch = useCallback(() => {
    if (wsSlug) router.push(`/${wsSlug}/search`);
  }, [wsSlug]);
  const openCreate = useCallback(() => {
    if (wsSlug) router.push(`/${wsSlug}/new-issue`);
  }, [wsSlug]);

  const openIssue = useCallback(
    (issue: Issue) => {
      if (wsSlug) router.push(`/${wsSlug}/issue/${issue.id}`);
    },
    [wsSlug],
  );

  const onReassignIssue = useCallback(
    (issue: Issue) => {
      // 改派员工 — 复用 issue assignee picker（原生搜索 formSheet）。
      if (wsSlug) {
        router.push({
          pathname: "/[workspace]/issue/[id]/picker/assignee",
          params: { workspace: wsSlug, id: issue.id },
        });
      }
    },
    [wsSlug],
  );

  const visibleStatuses = useMemo(
    () => visibleBoardStatuses(statusFilters),
    [statusFilters],
  );
  const sections = useMemo(
    () => groupIssuesByStatus(issues, visibleStatuses),
    [issues, visibleStatuses],
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {/* Header — 标题 + 筛选（红点）+ 搜索 + 新建（PRD §5.2）。 */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-2xl font-bold text-foreground">看板</Text>
        <View className="flex-row items-center gap-1">
          <FilterButton hasActiveFilters={hasActiveFilters} onPress={openBoardView} />
          <IconButton name="search" onPress={openSearch} accessibilityLabel="搜索" />
          <IconButton
            name="add"
            iconSize={24}
            onPress={openCreate}
            accessibilityLabel="新建事项"
          />
        </View>
      </View>

      {/* Toolbar — 项目 chip + 视图 segmented。 */}
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2">
        <Pressable
          onPress={openBoardView}
          className="flex-row items-center gap-1.5 px-3 h-8 rounded-full border border-border bg-secondary/40 active:bg-secondary"
          accessibilityLabel="筛选项目"
        >
          <Text className="text-sm text-foreground" numberOfLines={1}>
            {findProject(projects, projectId)?.title ?? "全部项目"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={THEME[colorScheme].mutedForeground}
          />
        </Pressable>
        <SegmentedControl
          values={Object.values(VIEW_LABEL)}
          selectedIndex={Object.keys(VIEW_LABEL).indexOf(view)}
          onValueChange={(v) => {
            if (v === "泳道") setView("swimlanes");
            else if (v === "进度") setView("progress");
            else setView("columns");
          }}
          tintColor={THEME[colorScheme].brand}
          backgroundColor={THEME[colorScheme].secondary}
          style={{ width: 150, height: 28 }}
        />
      </View>

      {hasActiveFilters ? (
        <ActiveFilterChips
          projectId={projectId}
          projectTitle={findProject(projects, projectId)?.title}
          statusFilters={statusFilters}
          priorityFilters={priorityFilters}
          assigneeCount={assigneeFilters.length}
          onClear={() => useBoardViewStore.getState().clearFilters()}
        />
      ) : null}

      {isLoading ? (
        <IssuesLoading />
      ) : error ? (
        <StateView kind="error" onAction={() => refetch()} />
      ) : view === "columns" ? (
        <BoardColumns
          sections={sections}
          projects={projects}
          onPressIssue={openIssue}
          onReassignIssue={onReassignIssue}
        />
      ) : view === "swimlanes" ? (
        <BoardSwimlanes
          issues={issues}
          projects={projects}
          wsSlug={wsSlug}
          onPressIssue={openIssue}
          onReassignIssue={onReassignIssue}
        />
      ) : (
        <BoardProgress issues={issues} agents={agents} />
      )}
    </SafeAreaView>
  );
}

function FilterButton({
  hasActiveFilters,
  onPress,
}: {
  hasActiveFilters: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ position: "relative" }}>
      <IconButton name="options-outline" onPress={onPress} accessibilityLabel="看板筛选" />
      {hasActiveFilters ? (
        <View
          pointerEvents="none"
          className="absolute top-1 right-1 size-1.5 rounded-full bg-brand"
        />
      ) : null}
    </View>
  );
}

function ActiveFilterChips({
  projectId,
  projectTitle,
  statusFilters,
  priorityFilters,
  assigneeCount,
  onClear,
}: {
  projectId: string | null;
  projectTitle?: string;
  statusFilters: IssueStatus[];
  priorityFilters: IssuePriority[];
  assigneeCount: number;
  onClear: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const chips: string[] = [];
  if (projectId !== null) chips.push(projectTitle ?? "已选项目");
  chips.push(...statusFilters.map((s) => STATUS_LABEL[s]));
  chips.push(...priorityFilters.map((p) => PRIORITY_LABEL[p]));
  if (assigneeCount > 0) chips.push(`负责人 ×${assigneeCount}`);
  if (chips.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5 px-4 pb-2">
      <Pressable
        onPress={onClear}
        className="flex-row items-center gap-1 pl-2.5 pr-2 py-1 rounded-full border border-border bg-secondary/40 active:bg-secondary"
        accessibilityLabel="清除全部筛选"
      >
        <Ionicons name="close" size={12} color={THEME[colorScheme].mutedForeground} />
      </Pressable>
      {chips.map((chip) => (
        <View
          key={chip}
          className="flex-row items-center gap-1 pl-2.5 pr-2 py-1 rounded-full border border-border bg-secondary/40"
        >
          <Text className="text-xs text-foreground">{chip}</Text>
        </View>
      ))}
    </View>
  );
}
