/**
 * Home ① 快捷入口 — fixed 4-grid, rounded tiles (icon + Chinese label).
 *
 * PRD §4.3:
 *   1 新建事项 → /{slug}/new-issue
 *   2 派单     → /{slug}/staff-picker?intent=dispatch   (路由由子任务 5 / COD-33
 *               提供; 选中员工后预填 new-issue assignee)
 *   3 项目     → /{slug}/more/projects
 *   4 收件箱   → /{slug}/inbox, 未读数角标 = useInboxUnreadCount (与 Tab badge 同源)
 *
 * 格位 4 角标 parity (M1 验收关口): 与 Tab badge / 铃铛同用
 * `useInboxUnreadCount(wsId)` — 不允许各算一遍。
 */
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useInboxUnreadCount } from "@/lib/unread-counts";
import { Text } from "@/components/ui/text";

interface Tile {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function formatBadgeCount(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? "99+" : String(n);
}

export function QuickActions() {
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const inboxUnread = useInboxUnreadCount(
    useWorkspaceStore((s) => s.currentWorkspaceId),
  );

  if (!wsSlug) return null;

  const tiles: Tile[] = [
    {
      key: "new-issue",
      label: "新建事项",
      icon: "create-outline",
      onPress: () => router.push(`/${wsSlug}/new-issue`),
    },
    {
      key: "dispatch",
      label: "派单",
      icon: "people-outline",
      onPress: () =>
        router.push({
          pathname: "/[workspace]/staff-picker",
          params: { workspace: wsSlug, intent: "dispatch" },
        }),
    },
    {
      key: "projects",
      label: "项目",
      icon: "folder-outline",
      onPress: () => router.push(`/${wsSlug}/more/projects`),
    },
    {
      key: "inbox",
      label: "收件箱",
      icon: "mail-outline",
      onPress: () => router.push(`/${wsSlug}/inbox`),
    },
  ];

  return (
    <View className="flex-row gap-3 px-4 pt-2">
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          onPress={tile.onPress}
          accessibilityRole="button"
          accessibilityLabel={tile.label}
          className="flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3.5 active:bg-secondary"
        >
          <View className="relative">
            <Ionicons name={tile.icon} size={24} />
            {tile.key === "inbox" ? (
              <InboxBadge count={formatBadgeCount(inboxUnread)} />
            ) : null}
          </View>
          <Text className="text-xs text-foreground">{tile.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InboxBadge({ count }: { count: string | undefined }) {
  if (!count) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-brand items-center justify-center"
    >
      <Text className="text-[10px] font-semibold text-brand-foreground leading-4">
        {count}
      </Text>
    </View>
  );
}
