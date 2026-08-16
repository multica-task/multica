/**
 * Board 视图 B — project swimlanes (PRD §5.2). SectionList grouped by
 * project; each section header carries the project emoji + title + progress
 * bar (`done_count / issue_count`, same source as the project detail page)
 * + status/priority icons, and taps through to `project/[id]`.
 *
 * Section content = the project's open issues (done / cancelled folded into
 * a per-section collapsible group, PRD §5.2 "done / cancelled 折叠，可展开").
 * Issues with no project fall into a trailing "未归属项目" section.
 *
 * The visible issue set is the board's filtered list, so an active project /
 * priority / assignee / status filter narrows the swimlane too. Section
 * order: projects by title asc (stable across renders), "未归属项目" last.
 */
import { useMemo, useState } from "react";
import { Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Issue, Project } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { ProjectIcon } from "@/components/ui/project-icon";
import { ProjectStatusIcon } from "@/components/ui/project-status-icon";
import { ProjectPriorityIcon } from "@/components/ui/project-priority-icon";
import { BoardIssueCard } from "./board-issue-card";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NONE_PROJECT_KEY = "__none__";

type Row =
  | { kind: "issue"; issue: Issue }
  | { kind: "done-toggle"; count: number; expanded: boolean };

interface SwimlaneSection {
  key: string;
  projectId: string | null;
  title: string;
  icon?: string | null;
  status: Project["status"];
  priority: Project["priority"];
  doneCount: number;
  issueCount: number;
  active: Issue[];
  doneCancelled: Issue[];
  data: Row[];
}

const OPEN_STATUSES: ReadonlySet<string> = new Set([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
]);

function buildSections(issues: Issue[], projects: Project[]): SwimlaneSection[] {
  const byProject = new Map<string | null, Issue[]>();
  for (const issue of issues) {
    const list = byProject.get(issue.project_id);
    if (list) list.push(issue);
    else byProject.set(issue.project_id, [issue]);
  }

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const sections: SwimlaneSection[] = [];
  for (const [projectId, projectIssues] of byProject) {
    const project = projectId ? projectById.get(projectId) : undefined;
    const active: Issue[] = [];
    const doneCancelled: Issue[] = [];
    for (const issue of projectIssues) {
      if (OPEN_STATUSES.has(issue.status)) active.push(issue);
      else doneCancelled.push(issue);
    }
    // Stable order within the section: BOARD_STATUSES order comes from the
    // board's issue array (already grouped by status upstream); keep the
    // arrival order.
    sections.push({
      key: projectId ?? NONE_PROJECT_KEY,
      projectId,
      title: project?.title ?? "未归属项目",
      icon: project?.icon,
      status: project?.status ?? "planned",
      priority: project?.priority ?? "none",
      doneCount: project?.done_count ?? 0,
      issueCount: project?.issue_count ?? active.length + doneCancelled.length,
      active,
      doneCancelled,
      data: [], // filled below once expanded state is known
    });
  }

  sections.sort((a, b) => {
    if (a.key === NONE_PROJECT_KEY) return 1;
    if (b.key === NONE_PROJECT_KEY) return -1;
    return a.title.localeCompare(b.title);
  });
  return sections;
}

function rowsForSection(
  section: SwimlaneSection,
  expanded: boolean,
): Row[] {
  const rows: Row[] = section.active.map((issue) => ({ kind: "issue", issue }));
  if (section.doneCancelled.length > 0) {
    rows.push({
      kind: "done-toggle",
      count: section.doneCancelled.length,
      expanded,
    });
    if (expanded) {
      rows.push(
        ...section.doneCancelled.map((issue) => ({ kind: "issue" as const, issue })),
      );
    }
  }
  return rows;
}

interface Props {
  issues: Issue[];
  projects: Project[];
  wsSlug: string | null;
  onPressIssue: (issue: Issue) => void;
  onReassignIssue: (issue: Issue) => void;
}

export function BoardSwimlanes({
  issues,
  projects,
  wsSlug,
  onPressIssue,
  onReassignIssue,
}: Props) {
  const { colorScheme } = useColorScheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sections = useMemo(
    () => buildSections(issues, projects),
    [issues, projects],
  );
  // `data` depends on the per-section expanded flag — SectionList wants a
  // stable reference per render, so rebuild the row arrays here.
  const dataSections = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        data: rowsForSection(s, expanded[s.key] ?? false),
      })),
    [sections, expanded],
  );

  if (issues.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-sm text-muted-foreground text-center">
          暂无事项
        </Text>
      </View>
    );
  }

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));

  return (
    <SectionList
      sections={dataSections}
      keyExtractor={(row, index) =>
        row.kind === "issue" ? row.issue.id : `toggle:${index}`
      }
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Pressable
          onPress={() => {
            if (section.projectId && wsSlug) {
              router.push(`/${wsSlug}/project/${section.projectId}`);
            }
          }}
          className="flex-row items-center gap-2.5 px-4 py-2.5 bg-background"
        >
          <ProjectIcon icon={section.icon} size="md" />
          <View className="flex-1 min-w-0 gap-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-sm font-medium text-foreground"
                numberOfLines={1}
              >
                {section.title}
              </Text>
              <ProjectStatusIcon status={section.status} size={12} />
              {section.priority !== "none" ? (
                <ProjectPriorityIcon priority={section.priority} size={12} />
              ) : null}
            </View>
            <ProjectProgress
              doneCount={section.doneCount}
              issueCount={section.issueCount}
            />
          </View>
          <Text className="text-xs text-muted-foreground tabular-nums">
            {section.doneCount}/{section.issueCount}
          </Text>
          {section.projectId ? (
            <Ionicons
              name="chevron-forward"
              size={14}
              color={THEME[colorScheme].mutedForeground}
            />
          ) : null}
        </Pressable>
      )}
      renderItem={({ item, section }) => {
        if (item.kind === "issue") {
          return (
            <View className="px-4 pb-2">
              <BoardIssueCard
                issue={item.issue}
                projectTitle={section.projectId ? section.title : undefined}
                onPress={() => onPressIssue(item.issue)}
                onReassign={() => onReassignIssue(item.issue)}
              />
            </View>
          );
        }
        return (
          <Pressable
            onPress={() => toggleExpanded(section.key)}
            className="flex-row items-center gap-1.5 px-5 py-2 active:bg-secondary"
            accessibilityLabel={
              item.expanded ? "收起已完成事项" : "展开已完成事项"
            }
          >
            <Ionicons
              name={item.expanded ? "chevron-down" : "chevron-forward"}
              size={14}
              color={THEME[colorScheme].mutedForeground}
            />
            <Text className="text-xs text-muted-foreground">
              {item.expanded ? "收起" : "展开"}已完成 / 已取消（{item.count}）
            </Text>
          </Pressable>
        );
      }}
      contentContainerClassName="pb-6"
    />
  );
}

/** Inline progress bar — `done_count / issue_count`, same numbers as the
 *  project detail page (PRD §5.5 acceptance). `formatPercent`'s sample-size
 *  guard is deliberately NOT applied: a project's bar is a raw ratio, not a
 *  statistic a user must make a decision from. */
function ProjectProgress({
  doneCount,
  issueCount,
}: {
  doneCount: number;
  issueCount: number;
}) {
  const pct = issueCount > 0 ? doneCount / issueCount : 0;
  return (
    <View className="h-1.5 rounded-full bg-secondary overflow-hidden">
      <View
        className={cn("h-full rounded-full", pct >= 1 ? "bg-success" : "bg-info")}
        style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
      />
    </View>
  );
}
