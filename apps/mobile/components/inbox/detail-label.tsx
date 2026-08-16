/**
 * Mobile InboxDetailLabel — type-aware second-line for inbox rows.
 *
 * Mirrors packages/views/inbox/components/inbox-detail-label.tsx exactly:
 * for each InboxItemType the user sees the same label they would see on
 * web/desktop. This is a Behavioral parity concern — if web shows "状态设为
 * ✓ 已完成", mobile must show the same (rendered with mobile primitives,
 * not the literal HTML).
 *
 * Web is i18n-driven (useT). Mobile v1 keeps display copy in Chinese per
 * PRD §9.5 with no i18n framework — display values are inline Chinese
 * constants.
 */
import { View } from "react-native";
import type {
  InboxItem,
  InboxItemType,
  IssueStatus,
  IssuePriority,
} from "@multica/core/types";
import { formatDateOnly } from "@multica/core/issues/date";
import { Text } from "@/components/ui/text";
import { StatusIcon } from "@/components/ui/status-icon";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { useActorLookup } from "@/data/use-actor-name";
import { cn } from "@/lib/utils";

// Display copy is Chinese per PRD §9.5; only display values change, enum keys stay.
const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "待规划",
  todo: "待处理",
  in_progress: "进行中",
  in_review: "待评审",
  done: "已完成",
  blocked: "受阻",
  cancelled: "已取消",
};

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
  none: "无优先级",
};

// Mirrors useTypeLabels in packages/views/inbox/components/inbox-detail-label.tsx
const TYPE_LABEL: Record<InboxItemType, string> = {
  issue_assigned: "已分配给你",
  issue_subscribed: "已订阅",
  unassigned: "已取消分配",
  assignee_changed: "负责人已更改",
  status_changed: "状态已更改",
  priority_changed: "优先级已更改",
  start_date_changed: "开始日期已更改",
  due_date_changed: "截止日期已更改",
  new_comment: "新评论",
  mentioned: "提及了你",
  review_requested: "请求审阅",
  task_completed: "任务已完成",
  task_failed: "任务失败",
  agent_blocked: "数字员工被阻塞",
  agent_completed: "数字员工已完成",
  reaction_added: "添加了表情反应",
  quick_create_done: "已通过数字员工创建",
  quick_create_failed: "通过数字员工创建失败",
  quick_create_unconfirmed: "通过数字员工创建，结果待确认",
};

// due_date is a calendar day — format timezone-safely (no offset day shift).
function shortDate(dateStr: string): string {
  return formatDateOnly(dateStr, { month: "short", day: "numeric" }, "zh-CN");
}

function singleLine(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function InboxDetailLabel({
  item,
  className,
}: {
  item: InboxItem;
  className?: string;
}) {
  const { getName } = useActorLookup();
  const details = item.details ?? {};

  // Cases with inline icons → Row layout.
  if (item.type === "status_changed" && details.to) {
    const status = details.to as IssueStatus;
    return (
      <View className={cn("flex-row items-center gap-1", className)}>
        <Text className="text-xs text-muted-foreground">状态设为</Text>
        <StatusIcon status={status} size={12} />
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {STATUS_LABEL[status] ?? status}
        </Text>
      </View>
    );
  }

  if (item.type === "priority_changed" && details.to) {
    const priority = details.to as IssuePriority;
    return (
      <View className={cn("flex-row items-center gap-1", className)}>
        <Text className="text-xs text-muted-foreground">优先级设为</Text>
        <PriorityIcon priority={priority} size={12} />
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {PRIORITY_LABEL[priority] ?? priority}
        </Text>
      </View>
    );
  }

  // Single-string cases.
  const text = (() => {
    switch (item.type) {
      case "issue_assigned":
      case "assignee_changed":
        if (details.new_assignee_id) {
          const name = getName(
            (details.new_assignee_type ?? "member") as "member" | "agent",
            details.new_assignee_id,
          );
          return `分配给 ${name}`;
        }
        return TYPE_LABEL[item.type];
      case "unassigned":
        return "移除了负责人";
      case "due_date_changed":
        return details.to
          ? `截止日期设为 ${shortDate(details.to)}`
          : "移除了截止日期";
      case "new_comment":
        return singleLine(item.body) || TYPE_LABEL[item.type];
      case "reaction_added":
        return details.emoji
          ? `用 ${details.emoji} 回应`
          : TYPE_LABEL[item.type];
      case "quick_create_done":
        return details.identifier
          ? `通过数字员工创建：${details.identifier}`
          : TYPE_LABEL[item.type];
      case "quick_create_failed": {
        const detail = singleLine(details.error) || singleLine(item.body);
        return detail ? `失败：${detail}` : TYPE_LABEL[item.type];
      }
      // Mirrors packages/views/inbox/components/inbox-detail-label.tsx: the
      // unconfirmed outcome deliberately drops the "Failed:" prefix, because
      // the issue may actually have been created.
      case "quick_create_unconfirmed": {
        const detail = singleLine(details.error) || singleLine(item.body);
        return detail || TYPE_LABEL[item.type];
      }
      default:
        return TYPE_LABEL[item.type] ?? item.type;
    }
  })();

  return (
    <Text
      className={cn("text-xs text-muted-foreground", className)}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}
