/**
 * Home screen header — greeting + workspace·在岗 subtitle + bell (unread
 * badge) + search.
 *
 * PRD §4.2 layout:
 *   早上好，Sun
 *   Utter Office · 3 位员工在岗        🔔(3)  🔍
 *
 * Badge parity (M1 验收关口): the bell badge and the quick-entry inbox tile
 * badge BOTH read `useInboxUnreadCount(wsId)` — the exact same source as the
 * bottom Tab badge, so all three numbers can never drift apart.
 *
 * 在岗口径 (PRD §4.2 v1.5): non-archived, user-visible agents whose status is
 * online-available — derived by `countOnDutyAgents`.
 */
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { workspaceListOptions } from "@/data/queries/workspaces";
import { agentListOptions } from "@/data/queries/agents";
import { memberListOptions } from "@/data/queries/members";
import { useInboxUnreadCount } from "@/lib/unread-counts";
import { countOnDutyAgents } from "@/lib/on-duty-agents";
import { getGreeting } from "@/lib/greeting";
import { Text } from "@/components/ui/text";

/** Truncation aligned with the Tab badge: >99 renders "99+". */
function formatBadgeCount(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? "99+" : String(n);
}

export function HomeHeader() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspaceSlug);

  const { data: workspaces } = useQuery(workspaceListOptions());
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));

  const inboxUnread = useInboxUnreadCount(wsId);
  const badgeText = formatBadgeCount(inboxUnread);

  const workspaceName = useMemo(
    () => workspaces?.find((w) => w.id === wsId)?.name,
    [workspaces, wsId],
  );

  const onDuty = useMemo(
    () =>
      countOnDutyAgents(
        agents,
        userId,
        members.find((m) => m.user_id === userId)?.role,
      ),
    [agents, members, userId],
  );

  const greeting = getGreeting(new Date().getHours());
  const greetingName = user?.name?.trim();

  const openInbox = () => {
    if (wsSlug) router.push(`/${wsSlug}/inbox`);
  };
  const openSearch = () => {
    if (wsSlug) router.push(`/${wsSlug}/search`);
  };

  return (
    <SafeAreaView edges={["top"]} className="bg-background">
      <View className="flex-row items-center px-4 pt-3 pb-2 gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-2xl font-bold text-foreground" numberOfLines={1}>
            {greetingName ? `${greeting}，${greetingName}` : greeting}
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5" numberOfLines={1}>
            {workspaceName ? `${workspaceName} · ` : ""}
            {onDuty} 位员工在岗
          </Text>
        </View>
        <Pressable
          onPress={openInbox}
          accessibilityRole="button"
          accessibilityLabel="收件箱"
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full active:bg-secondary"
        >
          <Ionicons name="notifications-outline" size={22} />
          {badgeText ? (
            <View
              pointerEvents="none"
              className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-brand items-center justify-center"
            >
              <Text className="text-[10px] font-semibold text-brand-foreground leading-4">
                {badgeText}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={openSearch}
          accessibilityRole="button"
          accessibilityLabel="搜索"
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full active:bg-secondary"
        >
          <Ionicons name="search" size={22} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
