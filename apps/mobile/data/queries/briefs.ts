/**
 * 行业简报查询层（PRD §10.3 key 结构 + COD-55 无后端 MVP 数据源切换）。
 *
 * 数据源为「每日 JSON」链路（`data/briefs/daily-source.ts`）：fetch 远程
 * `daily.json` → 本地缓存 → `MOCK_BRIEFS` 兜底。列表查询返回
 * `BriefListResult`、详情返回 `BriefDetailResult`（均含 `source`，驱动
 * 「每日更新」/「示例数据」徽标，见 `components/home/example-data-badge.tsx`）。
 *
 * B-2 后端上线后：把两个 queryFn 切回 `api.listBriefs` / `api.getBrief`
 * （包一层 `BriefListResult` / `BriefDetailResult`），组件与 key 零改动。
 *
 * key 结构按最终接口设计（`briefKeys.list(wsId, category)`），列表页 /
 * 分类筛选后置，但 key 已预留。
 */
import { queryOptions } from "@tanstack/react-query";
import { queryClient } from "@/data/query-client";
import {
  loadDailyBriefs,
  findBriefById,
  type BriefListResult,
} from "@/data/briefs/daily-source";
import type { Brief } from "@/data/schemas";

/** 与后端契约（PRD §10.2 B-2）字段完全一致的类型。 */
export type { Brief };

export const briefKeys = {
  all: (wsId: string | null) => ["briefs", wsId] as const,
  list: (wsId: string | null, category: string | null) =>
    [...briefKeys.all(wsId), "list", category ?? "all"] as const,
  detail: (wsId: string | null, id: string) =>
    [...briefKeys.all(wsId), "detail", id] as const,
};

export const briefListOptions = (wsId: string | null) =>
  queryOptions({
    queryKey: briefKeys.list(wsId, null),
    // offlineFirst：无缓存数据时离线也允许 queryFn 跑一次，让链路回退到
    // AsyncStorage 缓存（不白屏）；有数据后离线 refetch 则暂停，等网络恢复。
    networkMode: "offlineFirst",
    queryFn: ({ signal }) => loadDailyBriefs({ signal }),
    enabled: !!wsId,
  });

export const briefDetailOptions = (wsId: string | null, id: string) =>
  queryOptions({
    queryKey: briefKeys.detail(wsId, id),
    // 与列表一致：离线冷启动也要能跑一次，从列表缓存 / AsyncStorage 兜底。
    networkMode: "offlineFirst",
    // 详情数据从同一份每日列表派生：优先读列表缓存（首页已拉取），深链 /
    // 冷启动才重新加载数据源，避免详情页重复请求。queryFn 不是 hook，
    // 无法用 useQueryClient，这里直接用全局单例读缓存。
    queryFn: async ({ signal }) => {
      const list = queryClient.getQueryData<BriefListResult>(
        briefKeys.list(wsId, null),
      );
      if (list) return findBriefById(list, id);
      return findBriefById(await loadDailyBriefs({ signal }), id);
    },
    enabled: !!wsId && !!id,
  });
