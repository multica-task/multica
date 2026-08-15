/**
 * 行业简报数据源（COD-55 无后端 MVP · App 接入侧）。
 *
 * 数据链路从静态 mock 切换为「每日 JSON」：
 *
 *   fetch 远程 daily.json ──成功──▶ 写本地缓存 + 返回（真数据）
 *         │ 失败（超时/断网/HTTP/解析）
 *         ▼
 *     本地缓存（AsyncStorage）──命中──▶ 返回缓存（仍是真数据）
 *         │ 无
 *         ▼
 *     MOCK_BRIEFS（示例数据，徽标显示「示例数据」）
 *
 * `apps/mobile/data/briefs/daily.json` 由子任务 1（行业简报官 autopilot，
 * COD-56 / PR #13）在 main 维护；本模块只负责 fetch 与回退，不随包内置数据。
 *
 * 徽标语义由 `source` 区分：`"daily"`（每日更新）vs `"mock"`（示例数据）。
 * B-2 后端上线后，`data/queries/briefs.ts` 的 queryFn 切回 `api.listBriefs`，
 * 组件零改动（`briefListOptions` / `briefDetailOptions` 返回形状不变）。
 */
import { BriefListSchema } from "@/data/schemas";
import type { Brief } from "@/data/schemas";
import { MOCK_BRIEFS } from "@/data/mocks/briefs";
import { readCachedBriefs, writeCachedBriefs } from "@/data/briefs/briefs-cache";

/** 远程每日简报地址 —— 子任务 1（行业简报官 autopilot）每天 07:00 更新该文件。 */
export const DAILY_BRIEFS_URL =
  "https://raw.githubusercontent.com/multica-task/multica/main/apps/mobile/data/briefs/daily.json";

/**
 * 静态小文件，10s 足够（Hermes 不支持 AbortSignal.timeout，见
 * apps/mobile/CLAUDE.md「Lesson 4」——手动 controller + setTimeout）。
 */
const FETCH_TIMEOUT_MS = 10_000;

/** 数据来源：`daily`=每日 JSON 链路（真数据）；`mock`=MOCK_BRIEFS 兜底。 */
export type BriefSource = "daily" | "mock";

export interface BriefListResult {
  items: Brief[];
  source: BriefSource;
}

export interface BriefDetailResult {
  brief: Brief | null;
  source: BriefSource;
}

/** 拉取远程 daily.json（超时 + 转发调用方 signal），解析失败抛错交给链路回退。 */
async function fetchRemoteBriefs(signal?: AbortSignal): Promise<Brief[]> {
  // 手动合成单一 controller：调用方取消（TQ 导航/失效）或超时任一触发即 abort。
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onCallerAbort);
  }

  try {
    const res = await fetch(DAILY_BRIEFS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`daily briefs HTTP ${res.status}`);
    const raw: unknown = await res.json();
    const result = BriefListSchema.safeParse(raw);
    if (!result.success) throw new Error("daily briefs schema validation failed");
    return result.data;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

/**
 * 加载当日简报：远程 → 本地缓存 → MOCK_BRIEFS。
 *
 * 调用方 signal 被 TQ 取消时必须向上抛（不落回退数据），否则取消的请求会
 * 把过期的回退结果写进查询缓存，覆盖更新的数据。
 */
export async function loadDailyBriefs(
  opts?: { signal?: AbortSignal },
): Promise<BriefListResult> {
  try {
    const items = await fetchRemoteBriefs(opts?.signal);
    // 空数组视为异常输出（autopilot 正常产出 6–8 条），不覆盖缓存、继续回退。
    if (items.length > 0) {
      await writeCachedBriefs(items);
      return { items, source: "daily" };
    }
  } catch (err) {
    if (opts?.signal?.aborted) throw err;
    // 其余失败（超时/断网/HTTP/解析）进入回退链。
  }

  const cached = await readCachedBriefs();
  if (cached.length > 0) return { items: cached, source: "daily" };

  return { items: MOCK_BRIEFS, source: "mock" };
}

/** 供 `briefDetailOptions` 复用：单条查找，找不到返回 null（详情页空态）。 */
export function findBriefById(
  result: BriefListResult,
  id: string,
): BriefDetailResult {
  return {
    brief: result.items.find((b) => b.id === id) ?? null,
    source: result.source,
  };
}
