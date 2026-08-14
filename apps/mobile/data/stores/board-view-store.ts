/**
 * Board view store — PRD §5.3. Workspace-scoped view mode + filters for the
 * board tab (列视图 / 泳道 / 进度) and its `board-view` formSheet.
 *
 * Filter semantics mirror web's positive-selection rule: empty array = show
 * all; `projectId === null` = 全部项目. `cancelled` is never part of the
 * status filter UI as a *column* (PRD §5.2), but the sheet still lets a user
 * toggle it via the same ALL_STATUSES row the issues-filter sheet uses — the
 * board simply never renders a cancelled column, so a cancelled filter is a
 * no-op for display (kept out of the store to avoid confusion).
 *
 * Cleared on workspace change via the shared
 * `useClearFiltersOnWorkspaceChange` hook (PRD §5.5: "切换工作区后筛选被清空").
 * `view` deliberately survives a workspace switch — it is a UI mode, not a
 * filter.
 */
import { create } from "zustand";
import type {
  IssueActorRef,
  IssuePriority,
  IssueStatus,
} from "@multica/core/types";
import type { BoardView } from "@/data/queries/board";

interface BoardViewState {
  view: BoardView;
  /** null = 全部项目. */
  projectId: string | null;
  statusFilters: IssueStatus[];
  priorityFilters: IssuePriority[];
  assigneeFilters: IssueActorRef[];
  setView: (view: BoardView) => void;
  setProjectId: (projectId: string | null) => void;
  toggleStatusFilter: (status: IssueStatus) => void;
  togglePriorityFilter: (priority: IssuePriority) => void;
  toggleAssigneeFilter: (ref: IssueActorRef) => void;
  clearFilters: () => void;
}

export const useBoardViewStore = create<BoardViewState>((set) => ({
  view: "columns",
  projectId: null,
  statusFilters: [],
  priorityFilters: [],
  assigneeFilters: [],
  setView: (view) => set({ view }),
  setProjectId: (projectId) => set({ projectId }),
  toggleStatusFilter: (status) =>
    set((state) => ({
      statusFilters: state.statusFilters.includes(status)
        ? state.statusFilters.filter((s) => s !== status)
        : [...state.statusFilters, status],
    })),
  togglePriorityFilter: (priority) =>
    set((state) => ({
      priorityFilters: state.priorityFilters.includes(priority)
        ? state.priorityFilters.filter((p) => p !== priority)
        : [...state.priorityFilters, priority],
    })),
  toggleAssigneeFilter: (ref) =>
    set((state) => ({
      assigneeFilters: state.assigneeFilters.some(
        (f) => f.type === ref.type && f.id === ref.id,
      )
        ? state.assigneeFilters.filter(
            (f) => !(f.type === ref.type && f.id === ref.id),
          )
        : [...state.assigneeFilters, ref],
    })),
  clearFilters: () =>
    set({ projectId: null, statusFilters: [], priorityFilters: [], assigneeFilters: [] }),
}));
