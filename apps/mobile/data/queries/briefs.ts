/**
 * 行业简报查询层（PRD §10.3 key 结构 + §4.6 数据源切换）。
 *
 * 本期数据源为 **mock**（B 类内容型，§0.4）：`USE_MOCK_BRIEFS = true`，
 * 列表来自 `data/mocks/briefs.ts`。单一常量同时驱动数据源与 UI 的
 * 「示例数据」徽标（§10.6 徽标强制）—— 改 `false` 后徽标与 mock 一起消失，
 * 不会出现「换真数据但徽标还在」。
 *
 * key 结构按最终接口设计（`briefKeys.list(wsId, category)`），列表页 /
 * 分类筛选后置，但 key 已预留，B-2 上线时零改动。
 */
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/data/api";
import { MOCK_BRIEFS } from "@/data/mocks/briefs";
import type { Brief } from "@/data/schemas";

/**
 * 是否使用 mock 简报。后端 `/api/briefs` 上线后改 `false` 并删除
 * `data/mocks/briefs.ts`（PRD §4.6 切换到真实数据）。
 */
export const USE_MOCK_BRIEFS = true;

/** 与后端契约（PRD §10.2 B-2）字段完全一致的类型。 */
export type { Brief };

export const briefKeys = {
  all: (wsId: string | null) => ["briefs", wsId] as const,
  list: (wsId: string | null, category: string | null) =>
    [...briefKeys.all(wsId), "list", category ?? "all"] as const,
  detail: (wsId: string | null, id: string) =>
    [...briefKeys.all(wsId), "detail", id] as const,
};

export function listMockBriefs(): Promise<Brief[]> {
  return Promise.resolve(MOCK_BRIEFS);
}

export function getMockBrief(id: string): Promise<Brief | undefined> {
  return Promise.resolve(MOCK_BRIEFS.find((b) => b.id === id));
}

export const briefListOptions = (wsId: string | null) =>
  queryOptions({
    queryKey: briefKeys.list(wsId, null),
    queryFn: ({ signal }) =>
      USE_MOCK_BRIEFS ? listMockBriefs() : api.listBriefs({ signal }),
    enabled: !!wsId,
  });

export const briefDetailOptions = (wsId: string | null, id: string) =>
  queryOptions({
    queryKey: briefKeys.detail(wsId, id),
    queryFn: ({ signal }) =>
      USE_MOCK_BRIEFS ? getMockBrief(id) : api.getBrief(id, { signal }),
    enabled: !!wsId && !!id,
  });
