/**
 * Notification preferences subscreen. 6 inbox groups + system_notifications
 * toggle, each backed by an optimistic PATCH /api/notification-preferences.
 *
 * Display copy is Chinese per PRD §9.5 with no i18n framework — display
 * values are inline Chinese constants.
 * The group labels MUST stay in sync with web — they describe the same
 * server-side semantics, and divergent labels would violate behavioral
 * parity (apps/mobile/CLAUDE.md).
 */
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type {
  NotificationGroupKey,
  NotificationPreferences,
} from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceStore } from "@/data/workspace-store";
import { notificationPreferenceOptions } from "@/data/queries/notification-preferences";
import { useUpdateNotificationPreferences } from "@/data/mutations/notification-preferences";

// Display copy is Chinese per PRD §9.5. Group labels keep the same server-side semantics.
const INBOX_GROUPS: Array<{
  key: Exclude<NotificationGroupKey, "system_notifications">;
  label: string;
  description: string;
}> = [
  {
    key: "assignments",
    label: "事项指派",
    description: "当你被指派或移除为事项负责人时。",
  },
  {
    key: "status_changes",
    label: "状态变更",
    description: "事项状态发生变化时。",
  },
  {
    key: "comments",
    label: "评论",
    description: "你订阅的事项有新评论时。",
  },
  {
    key: "mentions",
    label: "提及",
    description: "当有人 @提及你（包括 @all 和 @战队）时。",
  },
  {
    key: "updates",
    label: "事项更新",
    description: "标题、描述、标签、优先级或截止日期被修改时。",
  },
  {
    key: "agent_activity",
    label: "数字员工动态",
    description: "当数字员工领取、执行或完成任务时。",
  },
];

export default function NotificationsSettingsScreen() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data, isLoading, error } = useQuery(
    notificationPreferenceOptions(wsId),
  );
  const mutation = useUpdateNotificationPreferences();

  const preferences: NotificationPreferences = data?.preferences ?? {};

  const onToggle = (key: NotificationGroupKey, enabled: boolean) => {
    const next: NotificationPreferences = { ...preferences };
    if (enabled) {
      // Default is "all" — omitting the key keeps the object clean.
      delete next[key];
    } else {
      next[key] = "muted";
    }
    mutation.mutate(next);
  };

  const systemEnabled = preferences.system_notifications !== "muted";

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-sm text-destructive text-center">
          无法加载通知偏好设置。
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-4 gap-6"
    >
      <Section
        title="收件箱通知"
        description="选择哪些事件会出现在你的收件箱中。"
      >
        {INBOX_GROUPS.map((group, idx) => {
          const enabled = preferences[group.key] !== "muted";
          const isLast = idx === INBOX_GROUPS.length - 1;
          return (
            <View key={group.key}>
              <View className="flex-row items-center px-4 py-3 gap-3">
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    {group.label}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {group.description}
                  </Text>
                </View>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => onToggle(group.key, checked)}
                />
              </View>
              {!isLast ? <Separator /> : null}
            </View>
          );
        })}
      </Section>

      <Section
        title="系统"
        description="Multica 全站公告与重要账户事件。"
      >
        <View className="flex-row items-center px-4 py-3 gap-3">
          <View className="flex-1">
            <Text className="text-base font-medium text-foreground">
              系统通知
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              账户变更、安全提醒、产品更新。
            </Text>
          </View>
          <Switch
            checked={systemEnabled}
            onCheckedChange={(checked) =>
              onToggle("system_notifications", checked)
            }
          />
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="px-1">
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </Text>
        {description ? (
          <Text className="text-xs text-muted-foreground mt-1">
            {description}
          </Text>
        ) : null}
      </View>
      <View className="rounded-md border border-border bg-card overflow-hidden">
        {children}
      </View>
    </View>
  );
}
