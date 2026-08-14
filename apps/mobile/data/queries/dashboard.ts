/**
 * dashboard 端点就绪探测（PRD §4.4 接口就绪判定 + §10.2 B-1）。
 *
 * 6 个 `/api/dashboard/*` 端点尚未上线：服务端未排期且未加入平台 API mirror
 * 白名单，真机必然 404。本模块做**单次探测** —— 首个端点返回 404 即整体
 * 降级，并把判定结果缓存至本次会话结束（不重复打请求）。
 *
 * 本期（M2）报告卡走 `/api/issues` 客户端聚合（完成/新建/状态分布），
 * 运行时长 / Tokens 无论探测结果都无数据源 → 渲染 `——`。探测结果用于
 * 驱动卡片底部「部分统计接口未上线」说明文案，以及 M3 看板接入真实
 * dashboard 数据时的开关。探测本身静默：404 只在 `api.ts` 里 `console.warn`。
 */
import { api } from "@/data/api";

/** null = 未探测；true = 就绪；false = 降级（本次会话有效）。 */
let dashboardAvailability: boolean | null = null;

export function probeDashboardAvailability(): Promise<boolean> {
  if (dashboardAvailability !== null) {
    return Promise.resolve(dashboardAvailability);
  }
  return api
    .probeDashboard()
    .then(() => {
      dashboardAvailability = true;
      return true;
    })
    .catch(() => {
      // 404 / 网络错 / 超时 — 一律按「未就绪」降级，静默。
      dashboardAvailability = false;
      return false;
    });
}
