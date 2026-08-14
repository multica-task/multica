import { queryOptions } from "@tanstack/react-query";
import { api } from "@/data/api";

// B-9 · 30 天统计（PRD §7.6 KPI 口径）。档案 KPI 四格的唯一数据源。
// 未镜像 / 404 / 权限不足时 api 落到空数组 → KPI 格显示 `——`（StatPlaceholder）。
export const agentActivity30dOptions = (wsId: string | null) =>
  queryOptions({
    queryKey: ["agent-activity-30d", wsId] as const,
    queryFn: ({ signal }) => api.listAgentActivity30d({ signal }),
    enabled: !!wsId,
  });

export const agentRunCountsOptions = (wsId: string | null) =>
  queryOptions({
    queryKey: ["agent-run-counts", wsId] as const,
    queryFn: ({ signal }) => api.listAgentRunCounts({ signal }),
    enabled: !!wsId,
  });
