/**
 * 看板视图与筛选 formSheet（PRD §5.3）。`SHEET_OPTIONS` 注册于
 * `[workspace]/_layout.tsx`：formSheet + grabber + `[0.6, 0.95]` detents +
 * radius 20 + headerShown false（标题由本屏 body 自绘）。
 *
 * 筛选项：
 *   - 视图：列 / 泳道 / 进度（segmented）
 *   - 项目：单选（含「全部项目」）
 *   - 状态：多选（BOARD_STATUSES 六列；cancelled 无列，不参与筛选）
 *   - 优先级：多选（PRIORITY_ORDER）
 *   - 负责人：成员 / 员工 / 战队多选 + 内嵌搜索（`BoardAssigneeFilter`）
 *
 * 自包含：直接读写 `useBoardViewStore`，无回调上抛。状态存 Zustand，
 * 切工作区由 `useClearFiltersOnWorkspaceChange` 清空（PRD §5.5）。
 */
import { Pressable, ScrollView, View } from "react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { IssuePriority } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { StatusIcon } from "@/components/ui/status-icon";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { ProjectIcon } from "@/components/ui/project-icon";
import { BoardAssigneeFilter } from "@/components/board/board-assignee-filter";
import { projectListOptions } from "@/data/queries/projects";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useBoardViewStore } from "@/data/stores/board-view-store";
import { BOARD_STATUSES, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/issue-status";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Mirrors PRIORITY_ORDER in packages/core/issues/config/priority.ts.
const PRIORITY_ORDER: IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

const VIEW_OPTIONS: string[] = ["列", "泳道", "进度"];

export default function BoardViewRoute() {
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { data: projects = [] } = useQuery(projectListOptions(wsId));
  const { colorScheme } = useColorScheme();

  const view = useBoardViewStore((s) => s.view);
  const setView = useBoardViewStore((s) => s.setView);
  const projectId = useBoardViewStore((s) => s.projectId);
  const setProjectId = useBoardViewStore((s) => s.setProjectId);
  const statusFilters = useBoardViewStore((s) => s.statusFilters);
  const priorityFilters = useBoardViewStore((s) => s.priorityFilters);
  const assigneeFilters = useBoardViewStore((s) => s.assigneeFilters);

  const hasActive =
    projectId !== null ||
    statusFilters.length > 0 ||
    priorityFilters.length > 0 ||
    assigneeFilters.length > 0;

  const viewIndex = VIEW_OPTIONS.indexOf(
    view === "swimlanes" ? "泳道" : view === "progress" ? "进度" : "列",
  );

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <Text className="text-base font-semibold text-foreground">看板筛选</Text>
        {hasActive ? (
          <Pressable
            onPress={() => useBoardViewStore.getState().clearFilters()}
            hitSlop={8}
            className="px-2 py-1 active:opacity-60"
          >
            <Text className="text-sm text-primary font-medium">重置</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionLabel>视图</SectionLabel>
        <View className="px-4 pb-2 items-start">
          <SegmentedControl
            values={VIEW_OPTIONS}
            selectedIndex={viewIndex}
            onValueChange={(v) => {
              if (v === "泳道") setView("swimlanes");
              else if (v === "进度") setView("progress");
              else setView("columns");
            }}
            tintColor={THEME[colorScheme].brand}
            backgroundColor={THEME[colorScheme].secondary}
            style={{ width: 220, height: 30 }}
          />
        </View>

        <SectionLabel>项目</SectionLabel>
        <RadioRow
          label="全部项目"
          selected={projectId === null}
          onPress={() => setProjectId(null)}
        />
        {projects.map((p) => (
          <RadioRow
            key={p.id}
            label={p.title}
            icon={<ProjectIcon icon={p.icon} size="sm" />}
            selected={projectId === p.id}
            onPress={() => setProjectId(p.id)}
          />
        ))}

        <SectionLabel>状态</SectionLabel>
        {BOARD_STATUSES.map((status) => (
          <CheckRow
            key={status}
            label={STATUS_LABEL[status]}
            icon={<StatusIcon status={status} size={16} />}
            checked={statusFilters.includes(status)}
            onPress={() => useBoardViewStore.getState().toggleStatusFilter(status)}
          />
        ))}

        <SectionLabel>优先级</SectionLabel>
        {PRIORITY_ORDER.map((priority) => (
          <CheckRow
            key={priority}
            label={PRIORITY_LABEL[priority]}
            icon={<PriorityIcon priority={priority} />}
            checked={priorityFilters.includes(priority)}
            onPress={() => useBoardViewStore.getState().togglePriorityFilter(priority)}
          />
        ))}

        <SectionLabel>负责人</SectionLabel>
        <BoardAssigneeFilter
          selected={assigneeFilters}
          onToggle={useBoardViewStore.getState().toggleAssigneeFilter}
        />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="px-4 pt-3 pb-1.5">
      <Text className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {children}
      </Text>
    </View>
  );
}

function RadioRow({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const checkColor =
    colorScheme === "dark" ? THEME.dark.primary : THEME.light.primary;
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary",
        selected && "bg-secondary/60",
      )}
    >
      {icon ?? (
        <View className="size-[22px] items-center justify-center">
          <Text className="text-sm text-muted-foreground">🗂</Text>
        </View>
      )}
      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {selected ? <IoniconsCheck color={checkColor} /> : null}
    </Pressable>
  );
}

function CheckRow({
  label,
  icon,
  checked,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onPress: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const checkColor =
    colorScheme === "dark" ? THEME.dark.primary : THEME.light.primary;
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary",
        checked && "bg-secondary/60",
      )}
    >
      {icon}
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
      {checked ? <IoniconsCheck color={checkColor} /> : null}
    </Pressable>
  );
}

function IoniconsCheck({ color }: { color: string }) {
  return <Ionicons name="checkmark" size={18} color={color} />;
}
