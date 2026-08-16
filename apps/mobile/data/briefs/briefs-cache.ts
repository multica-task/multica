/**
 * 行业简报离线缓存（AsyncStorage）。
 *
 * 拉取每日 JSON 成功后把完整列表写入本地缓存；弱网/离线时首页从缓存渲染，
 * 不白屏。缓存的是上一次成功拉取的 `daily.json`（真数据，`source: "daily"`），
 * 不是 mock —— 缓存命中时徽标仍显示「每日更新」。
 *
 * 为什么用 AsyncStorage 而不是 expo-secure-store：每日 6–8 条简报含 Markdown
 * 正文，JSON 序列化约 4–8KB，超过 SecureStore ~2KB 单值上限。AsyncStorage 是
 * Expo SDK 55 内置对齐的标准离线缓存（@react-native-async-storage 2.2.0）。
 *
 * 读写均为 best-effort：缓存损坏/写入失败只降级，不阻塞主链路（拉取成功当次
 * 已可渲染；下次成功拉取会重写缓存）。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BriefListSchema, EMPTY_BRIEF_LIST } from "@/data/schemas";
import type { Brief } from "@/data/schemas";

const BRIEFS_CACHE_KEY = "briefs:daily";

/** 读取缓存；缺失/损坏一律返回空数组（调用方据此回退 MOCK_BRIEFS）。 */
export async function readCachedBriefs(): Promise<Brief[]> {
  try {
    const raw = await AsyncStorage.getItem(BRIEFS_CACHE_KEY);
    if (!raw) return EMPTY_BRIEF_LIST;
    const result = BriefListSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY_BRIEF_LIST;
  } catch {
    // JSON.parse 或 AsyncStorage 读失败：缓存缺失/损坏按空处理，属正常降级。
    return EMPTY_BRIEF_LIST;
  }
}

/** 覆盖写入缓存；失败静默（不阻塞当前渲染，下次成功拉取会再写）。 */
export async function writeCachedBriefs(items: Brief[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BRIEFS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // 写入失败不致命：本次数据已在内存渲染，仅失去离线兜底。
  }
}
