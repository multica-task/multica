/**
 * Pure picker body for the `staff-picker` formSheet route — a single-select
 * list of digital employees (agents) with native search. Unlike the issue
 * assignee picker this lists agents only (数字员工): both the dispatch
 * (`?intent=dispatch`) and default-employee (`?intent=default`) flows target
 * an agent, never a member or squad.
 *
 * Mirrors the assignee-picker-body split: the iOS native nav header owns the
 * title + UISearchController (wired via `useNativeSearchBar` in the route),
 * this body is just a FlatList with loading / error / empty states.
 *
 * Visibility parity (apps/mobile/CLAUDE.md §Behavioral parity): `/api/agents`
 * is already server-filtered to what the user can see; client-side we drop
 * archived agents and apply `canAssignAgent` (mobile mirror of
 * packages/core/permissions/rules.ts `canAssignAgentToIssue`). Agents without
 * a bound runtime render dimmed + disabled with a "需绑定运行时" tag, matching
 * the assignee picker's treatment — you can't dispatch work to an agent that
 * has no machine to run it.
 */
import { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import type { Agent } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { agentListOptions } from "@/data/queries/agents";
import { memberListOptions } from "@/data/queries/members";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { useScrollToTopOnChange } from "@/lib/use-scroll-to-top-on-change";
import { isAgentRuntimeBound } from "@/lib/is-agent-runtime-bound";
import {
  searchStaffAgents,
  visibleStaffAgents,
} from "@/lib/staff-picker-rows";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

const AVATAR_SIZE = 36;

interface Props {
  query: string;
  onSelect: (agent: Agent) => void;
  /** 列表底部附加内容（如 `?intent=default` 的「清除默认员工」）。 */
  footer?: React.ReactElement | null;
}

export function StaffPickerBody({ query, onSelect, footer }: Props) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data: agents = [],
    isLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useQuery(agentListOptions(wsId));
  const {
    data: members = [],
    isFetched: membersFetched,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery(memberListOptions(wsId));
  const listRef = useScrollToTopOnChange(query);
  const { colorScheme } = useColorScheme();

  const memberRole = members.find((m) => m.user_id === userId)?.role;

  // Base set before the search filter — drives the "no employees at all"
  // vs "no search matches" distinction so the empty state stays truthful.
  const visibleAgents = useMemo(
    () => visibleStaffAgents(agents, userId, memberRole),
    [agents, userId, memberRole],
  );

  const rows = useMemo(
    () => searchStaffAgents(visibleAgents, query),
    [visibleAgents, query],
  );

  // `visibleStaffAgents` drops every workspace agent while the member list
  // is still loading (memberRole is unknown → canAssignAgent denies). Wait
  // for both queries before rendering so the "暂无数字员工" empty state
  // never flashes on a cold open (same reasoning as
  // useWorkspaceAgentAvailability's three-state design).
  if (isLoading || !membersFetched) return <StaffPickerLoading />;
  // A failed member-list query means we can't determine the user's role, so
  // `visibleStaffAgents` would wrongly render "暂无数字员工" even when agents
  // exist — surface it as an error instead of a false empty state.
  if (agentsError || membersError) {
    return (
      <StaffPickerError
        message={
          agentsError instanceof Error
            ? agentsError.message
            : membersError instanceof Error
              ? membersError.message
              : "unknown error"
        }
        onRetry={() => {
          refetchAgents();
          refetchMembers();
        }}
      />
    );
  }

  if (visibleAgents.length === 0) {
    return <StaffPickerEmpty iconColor={THEME[colorScheme].mutedForeground} />;
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      keyExtractor={(agent) => agent.id}
      renderItem={({ item }) => <StaffRow agent={item} onSelect={onSelect} />}
      ListEmptyComponent={
        <View className="px-3 py-8 items-center">
          <Text className="text-sm text-muted-foreground">无匹配的员工</Text>
        </View>
      }
      ListFooterComponent={footer}
    />
  );
}

function StaffRow({
  agent,
  onSelect,
}: {
  agent: Agent;
  onSelect: (agent: Agent) => void;
}) {
  const runtimeBound = isAgentRuntimeBound(agent);
  return (
    <Pressable
      disabled={!runtimeBound}
      onPress={() => onSelect(agent)}
      className={cn(
        "flex-row items-center gap-3 px-4 py-3 active:bg-secondary",
        !runtimeBound && "opacity-50",
      )}
    >
      <ActorAvatar type="agent" id={agent.id} size={AVATAR_SIZE} showPresence />
      <View className="flex-1">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {agent.name}
        </Text>
        {agent.description ? (
          <Text className="text-sm text-muted-foreground mt-0.5" numberOfLines={1}>
            {agent.description}
          </Text>
        ) : null}
      </View>
      {!runtimeBound ? (
        <Text className="text-xs font-medium text-warning">需绑定运行时</Text>
      ) : null}
    </Pressable>
  );
}

// Loading — row-shaped Skeletons so the eye immediately sees the list-like
// structure instead of a centered spinner (same pattern as home's inbox).
function StaffPickerLoading() {
  return (
    <View className="px-4 pt-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} className="flex-row gap-3">
          <Skeleton className="size-9 rounded-full" />
          <View className="flex-1 gap-2 pt-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </View>
        </View>
      ))}
    </View>
  );
}

function StaffPickerError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <Text className="text-sm text-destructive text-center">
        加载员工失败：{message}
      </Text>
      <Button variant="outline" onPress={onRetry}>
        <Text>重试</Text>
      </Button>
    </View>
  );
}

function StaffPickerEmpty({ iconColor }: { iconColor: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <Ionicons name="people-outline" size={42} color={iconColor} />
      <Text className="text-base font-medium text-foreground text-center">
        暂无数字员工
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        当前工作区还没有可用的数字员工，请在桌面端创建后再来。
      </Text>
    </View>
  );
}
