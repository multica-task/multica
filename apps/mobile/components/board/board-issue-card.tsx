/**
 * Board issue card — richer than `IssueRow` for the kanban context (PRD
 * §5.2):
 *
 *   MUL-42 重构鉴权中间件
 *   🅐 mika · 高 · Auth 重构 · ● 运行中
 *
 * The status is NOT drawn on the card — the column / swimlane section it
 * sits in already communicates status. Priority keeps the same left-edge
 * glyph as `IssueRow` for cross-surface recognition. The "运行中" pulse dot
 * reuses the `AgentHeaderBadge` / `PulseDot` visual language; the active
 * flag is derived ONCE per column from the workspace agent-task snapshot
 * (one query, not N per-issue fetches) — see `board-column.tsx`.
 *
 * Long-press opens the status-change ActionSheet (PRD §5.2: 长按改状态):
 * 「移到 待规划 / … / 已取消 / 改派员工 / 打开详情」。The status mutation is
 * owned here so `useUpdateIssue(issue.id)` is called unconditionally (a hook
 * call can't live inside a press callback in the parent). The mutation's
 * optimistic board-cache patch moves the card across columns ≤500ms without
 * a refetch bounce (data/mutations/issues.ts).
 */
import { useCallback } from "react";
import { ActionSheetIOS, Pressable, View } from "react-native";
import type { Issue, IssueStatus } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { PulseDot } from "@/components/ui/pulse-dot";
import { useActorLookup } from "@/data/use-actor-name";
import { useUpdateIssue } from "@/data/mutations/issues";
import { PRIORITY_LABEL } from "@/lib/issue-status";

/** 长按 ActionSheet 的「移到 <状态>」项 —— 含 cancelled（可移到已取消），
 *  尽管 cancelled 不作为列展示（PRD §5.2）。 */
const STATUS_ACTIONS: { label: string; status: IssueStatus }[] = [
  { label: "移到 待规划", status: "backlog" },
  { label: "移到 待处理", status: "todo" },
  { label: "移到 进行中", status: "in_progress" },
  { label: "移到 待评审", status: "in_review" },
  { label: "移到 已完成", status: "done" },
  { label: "移到 受阻", status: "blocked" },
  { label: "移到 已取消", status: "cancelled" },
];

interface Props {
  issue: Issue;
  /** True when an agent task is actively running on this issue. */
  active?: boolean;
  /** Project display title (resolved once by the parent). */
  projectTitle?: string;
  onPress: () => void;
  /** 「改派员工」→ issue assignee picker（原生搜索 formSheet）。 */
  onReassign: () => void;
}

export function BoardIssueCard({
  issue,
  active = false,
  projectTitle,
  onPress,
  onReassign,
}: Props) {
  const { getName } = useActorLookup();
  const updateIssue = useUpdateIssue(issue.id);
  const assigneeName =
    issue.assignee_type && issue.assignee_id
      ? getName(issue.assignee_type, issue.assignee_id)
      : "未指派";

  const handleLongPress = useCallback(() => {
    const options = [
      ...STATUS_ACTIONS.map((a) => a.label),
      "改派员工",
      "打开详情",
      "取消",
    ];
    const cancelButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `${issue.identifier} ${issue.title}`,
        message: "更改状态或查看",
        options,
        cancelButtonIndex,
      },
      (index) => {
        if (index != null && index < STATUS_ACTIONS.length) {
          updateIssue.mutate({ status: STATUS_ACTIONS[index]!.status });
        } else if (index === STATUS_ACTIONS.length) {
          onReassign();
        } else if (index === STATUS_ACTIONS.length + 1) {
          onPress();
        }
      },
    );
  }, [issue, updateIssue, onPress, onReassign]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      className="bg-card border border-border rounded-lg p-3 active:bg-secondary"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
    >
      <View className="flex-row items-center gap-1.5">
        <PriorityIcon priority={issue.priority} size={12} />
        <Text className="text-xs text-muted-foreground font-medium shrink-0">
          {issue.identifier}
        </Text>
        <Text className="flex-1 text-sm text-foreground" numberOfLines={2}>
          {issue.title}
        </Text>
      </View>

      <View className="flex-row items-center gap-1.5 mt-2">
        {issue.assignee_type && issue.assignee_id ? (
          <ActorAvatar
            type={issue.assignee_type}
            id={issue.assignee_id}
            size={18}
          />
        ) : (
          <View className="size-[18px]" />
        )}
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {assigneeName}
        </Text>
        <Text className="text-xs text-muted-foreground/70">
          {PRIORITY_LABEL[issue.priority]}
        </Text>
        {projectTitle ? (
          <Text
            className="text-xs text-muted-foreground/70"
            numberOfLines={1}
          >
            {projectTitle}
          </Text>
        ) : null}
        {active ? <PulseDot size={6} /> : null}
      </View>
    </Pressable>
  );
}
