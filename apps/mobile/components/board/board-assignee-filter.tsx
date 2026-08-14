/**
 * 负责人多选（board-view formSheet 内嵌段）。复用 assignee picker 的数据
 * 查询与 ActorAvatar 视觉（PRD §5.3「复用 assignee picker 的原生搜索」——
 * board-view 用 `SHEET_OPTIONS`（headerShown: false），原生 UISearchController
 * 不可用，故为内嵌搜索框 + 同一组 members / agents / squads 数据源）。
 *
 * 空选 = 全部（positive-selection 语义，与 web `applyIssueFilters` 一致）。
 * 每行点按切换选中态，选中行显示系统色 checkmark。
 */
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { IssueActorRef } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { memberListOptions } from "@/data/queries/members";
import { agentListOptions } from "@/data/queries/agents";
import { squadListOptions } from "@/data/queries/squads";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

const AVATAR_SIZE = 30;

type Row =
  | { kind: "member"; id: string; name: string }
  | { kind: "agent"; id: string; name: string }
  | { kind: "squad"; id: string; name: string };

interface Props {
  selected: IssueActorRef[];
  onToggle: (ref: IssueActorRef) => void;
}

export function BoardAssigneeFilter({ selected, onToggle }: Props) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: squads = [] } = useQuery(squadListOptions(wsId));
  const { colorScheme } = useColorScheme();
  const checkColor =
    colorScheme === "dark" ? THEME.dark.primary : THEME.light.primary;
  const [query, setQuery] = useState("");

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (name: string) => !q || name.toLowerCase().includes(q);
    const memberRows: Row[] = members
      .filter((m) => match(m.name))
      .map((m) => ({ kind: "member" as const, id: m.user_id, name: m.name }));
    const agentRows: Row[] = agents
      .filter((a) => !a.archived_at && match(a.name))
      .map((a) => ({ kind: "agent" as const, id: a.id, name: a.name }));
    const squadRows: Row[] = squads
      .filter((s) => !s.archived_at && match(s.name))
      .map((s) => ({ kind: "squad" as const, id: s.id, name: s.name }));
    const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
    return [...memberRows, ...agentRows, ...squadRows].sort(byName);
  }, [members, agents, squads, query]);

  const isSelected = (row: Row) =>
    selected.some((f) => f.type === row.kind && f.id === row.id);

  return (
    <View>
      <View className="flex-row items-center gap-2 border border-border rounded-md mx-4 mb-1 px-3 py-2">
        <Ionicons name="search" size={16} color={THEME[colorScheme].mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索员工 / 成员 / 战队"
          placeholderTextColor={THEME[colorScheme].mutedForeground}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          className="flex-1 text-sm text-foreground"
        />
      </View>
      {rows.length === 0 ? (
        <Text className="px-4 py-3 text-xs text-muted-foreground">无匹配结果</Text>
      ) : (
        rows.map((row) => {
          const checked = isSelected(row);
          return (
            <Pressable
              key={`${row.kind}:${row.id}`}
              onPress={() => onToggle({ type: row.kind, id: row.id })}
              className="flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary"
            >
              <ActorAvatar type={row.kind} id={row.id} size={AVATAR_SIZE} />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {row.name}
              </Text>
              {checked ? (
                <Ionicons name="checkmark" size={18} color={checkColor} />
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}
