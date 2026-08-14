/**
 * Mirror of the BOARD_STATUSES order + status labels from
 * packages/core/issues/config/status.ts.
 *
 * Mirrored, not imported: the source file co-exports `STATUS_CONFIG` with
 * web colour tokens (Tailwind v4 syntax) that mobile must not pull in.
 * Keeping this list owned by mobile keeps the import boundary clean.
 *
 * If web ever reorders BOARD_STATUSES or adds/removes a status, this file
 * must be updated to keep the "Counts and visibility must agree" rule
 * (apps/mobile/CLAUDE.md) intact.
 */
import type { IssuePriority, IssueStatus } from "@multica/core/types";

/** Statuses surfaced in list/board views (matches web — `cancelled` excluded). */
export const BOARD_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

// Display copy is Chinese per PRD §9.5 (the translation table is the single
// source of truth). Only the display values change; enum keys and the
// BOARD_STATUSES order/members are behavior semantics and stay untouched.
export const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "待规划",
  todo: "待处理",
  in_progress: "进行中",
  in_review: "待评审",
  done: "已完成",
  blocked: "受阻",
  cancelled: "已取消",
};

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  none: "无优先级",
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};
