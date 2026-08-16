/**
 * `daily-source.ts` 回退链测试（COD-55 App 接入侧）。
 *
 * 覆盖链路：远程成功（写缓存）→ 远程失败回退缓存 → 无缓存回退 MOCK_BRIEFS
 * → 调用方取消时向上抛（不落回退数据）→ `findBriefById` 查找/未命中。
 *
 * AsyncStorage 是原生模块，Node 环境用内存 Map mock；`globalThis.fetch` 用
 * vitest spy 按用例控制远程结果。daily.json 由子任务 1（COD-56 / PR #13）
 * 在 main 维护，本模块不内置 —— 回退链不再依赖内置 JSON。
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const { storage } = vi.hoisted(() => ({ storage: new Map<string, string>() }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

import {
  DAILY_BRIEFS_URL,
  findBriefById,
  loadDailyBriefs,
  type BriefListResult,
} from "./daily-source";
import { type Brief } from "@/data/schemas";
import { MOCK_BRIEFS } from "@/data/mocks/briefs";

const BRIEFS_CACHE_KEY = "briefs:daily";

function brief(id: string, overrides: Partial<Brief> = {}): Brief {
  return {
    id,
    workspace_id: "",
    category: "AI Infra",
    title: `标题 ${id}`,
    summary: `摘要 ${id}`,
    content: `正文 ${id}`,
    source_url: null,
    source_name: null,
    published_at: "2026-08-16T08:00:00.000Z",
    read: false,
    relevance: "medium",
    ...overrides,
  };
}

function okResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

beforeEach(() => {
  storage.clear();
  vi.restoreAllMocks();
});

describe("loadDailyBriefs", () => {
  it("fetches remote daily.json, returns real data and writes the cache", async () => {
    const remote = [brief("r1"), brief("r2")];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse(remote));

    const result = await loadDailyBriefs();

    expect(result).toEqual({ items: remote, source: "daily" });
    expect(fetchMock).toHaveBeenCalledWith(
      DAILY_BRIEFS_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // 成功拉取必须写本地缓存（离线兜底）。
    const cachedRaw = storage.get(BRIEFS_CACHE_KEY);
    expect(cachedRaw).toBeDefined();
    expect(JSON.parse(cachedRaw!)).toEqual(remote);
  });

  it("falls back to the local cache when remote fails (offline / timeout)", async () => {
    const cached = [brief("c1"), brief("c2")];
    storage.set(BRIEFS_CACHE_KEY, JSON.stringify(cached));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Network request failed"),
    );

    const result = await loadDailyBriefs();

    expect(result).toEqual({ items: cached, source: "daily" });
  });

  it("falls back to MOCK_BRIEFS with source 'mock' when remote fails and cache is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await loadDailyBriefs();

    expect(result.source).toBe("mock");
    expect(result.items).toEqual(MOCK_BRIEFS);
  });

  it("treats an empty remote payload as failure and does not wipe the cache", async () => {
    const cached = [brief("keep-me")];
    storage.set(BRIEFS_CACHE_KEY, JSON.stringify(cached));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse([]));

    const result = await loadDailyBriefs();

    // 空数组视为异常输出 → 继续回退，且不覆盖已有缓存。
    expect(result).toEqual({ items: cached, source: "daily" });
    expect(JSON.parse(storage.get(BRIEFS_CACHE_KEY)!)).toEqual(cached);
  });

  it("re-throws when the caller aborts instead of falling back to cache", async () => {
    storage.set(BRIEFS_CACHE_KEY, JSON.stringify([brief("c1")]));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("cancelled"));

    const controller = new AbortController();
    controller.abort();

    await expect(loadDailyBriefs({ signal: controller.signal })).rejects.toThrow(
      "cancelled",
    );
    // 取消的请求不应把回退数据写进查询缓存 —— 这里验证它没有静默返回缓存。
  });
});

describe("findBriefById", () => {
  it("finds a brief by id and carries the source through", () => {
    const result: BriefListResult = {
      items: [brief("b1"), brief("b2")],
      source: "mock",
    };
    expect(findBriefById(result, "b1")).toEqual({
      brief: result.items[0],
      source: "mock",
    });
  });

  it("returns null + source for an unknown id", () => {
    const result: BriefListResult = { items: [brief("b1")], source: "daily" };
    expect(findBriefById(result, "missing")).toEqual({
      brief: null,
      source: "daily",
    });
  });
});
