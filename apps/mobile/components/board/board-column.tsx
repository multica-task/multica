/**
 * Single board column (PRD §5.2 视图 A): status header + FlashList of cards.
 *
 * Column header = StatusIcon + 中文状态名 + 计数. The page label ("‹ 2/6 ›")
 * is rendered only on the currently-visible page (passed down by
 * `BoardColumns`), matching the prototype layout.
 *
 * The "运行中" pulse dot is derived ONCE here from the workspace
 * `agent-task-snapshot` query (kept fresh by `usePresenceRealtime`) instead
 * of firing one `/api/issues/:id/active-task` fetch per card — the board can
 * show dozens of cards and per-card queries would hammer cellular.
 */
import { useMemo } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import type { AgentTask, Issue, IssueStatus, Project } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { StatusIcon } from "@/components/ui/status-icon";
import { BoardIssueCard } from "./board-issue-card";
import { agentTaskSnapshotOptions } from "@/data/queries/agent-task-snapshot";
import { findProject } from "@/data/queries/projects";
import { useWorkspaceStore } from "@/data/workspace-store";
import { STATUS_LABEL } from "@/lib/issue-status";

/** Task statuses that count as "an agent is actively working on this issue".
 *  Mirrors the active bucket used by presence (`use-presence-realtime.ts`). */
const ACTIVE_TASK_STATUSES = new Set([
  "queued",
  "dispatched",
  "waiting_local_directory",
  "running",
]);

interface Props {
  status: IssueStatus;
  issues: Issue[];
  projects: Project[];
  width: number;
  /** e.g. "‹ 2/6 ›" — rendered only on the currently-visible page. */
  pageLabel?: string;
  onPressIssue: (issue: Issue) => void;
  onReassignIssue: (issue: Issue) => void;
}

export function BoardColumn({
  status,
  issues,
  projects,
  width,
  pageLabel,
  onPressIssue,
  onReassignIssue,
}: Props) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: snapshot = [] } = useQuery(agentTaskSnapshotOptions(wsId));

  const activeIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of snapshot as AgentTask[]) {
      if (task.issue_id && ACTIVE_TASK_STATUSES.has(task.status)) {
        ids.add(task.issue_id);
      }
    }
    return ids;
  }, [snapshot]);

  return (
    <View style={{ width }}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center gap-2">
          <StatusIcon status={status} size={16} />
          <Text className="text-sm font-medium text-foreground">
            {STATUS_LABEL[status]}
          </Text>
          <Text className="text-sm text-muted-foreground tabular-nums">
            {issues.length}
          </Text>
        </View>
        {pageLabel ? (
          <Text className="text-xs text-muted-foreground tabular-nums">
            {pageLabel}
          </Text>
        ) : null}
      </View>
      <FlashList
        data={issues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-3 pb-2">
            <BoardIssueCard
              issue={item}
              active={activeIssueIds.has(item.id)}
              projectTitle={findProject(projects, item.project_id)?.title}
              onPress={() => onPressIssue(item)}
              onReassign={() => onReassignIssue(item)}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      />
    </View>
  );
}
