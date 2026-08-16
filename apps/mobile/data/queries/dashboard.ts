/**
 * dashboard 端点就绪探测（PRD §4.4 接口就绪判定 + §10.2 B-1）+ 6 个
 * `/api/dashboard/*` 的查询入口。
 *
 * 服务端未排期且未加入平台 API mirror 白名单，真机必然 404。本模块做
 * **单次探测** —— 首个端点返回 404 即整体降级，并把判定结果缓存至本次会话
 * 结束（不重复打请求）。探测结果通过 `useDashboardAvailability` 驱动视图 C
 * （进度视图）的开关：未就绪时所有 dashboard query 都不启用，UI 渲染统一
 * 占位卡（PRD §5.2 / §9.4），不逐块报错。
 *
 * 查询 options 与 web `packages/core/dashboard/queries.ts` 对齐：同款
 * key 形状（`dashboard/<wsId>/…`）、同款 `staleTime`（1m）与轮询（5m）。
 * 本期端点未上线，query 不会真正发出；服务端上线后把 `probeDashboard`
 * 的白名单配好即可无缝切换，无需改动 UI 层。
 */
import { queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/data/api";

export const dashboardKeys = {
  all: (wsId: string | null) => ["dashboard", wsId] as const,
  daily: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "daily", days, tz] as const,
  byAgent: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "by-agent", days, tz] as const,
  agentRuntime: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "agent-runtime", days, tz] as const,
  runTimeDaily: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "runtime-daily", days, tz] as const,
  failuresDaily: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "failures-daily", days, tz] as const,
  failuresByAgent: (wsId: string | null, days: number, tz: string) =>
    [...dashboardKeys.all(wsId), "failures-by-agent", days, tz] as const,
};

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

/**
 * React binding for the probe result. `null` while the first probe is in
 * flight (view C renders its skeleton / nothing briefly); `false` afterwards
 * means "dashboard endpoints down for this session" and the view renders the
 * single placeholder card.
 */
export function useDashboardAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void probeDashboardAvailability().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/** Viewer-local IANA timezone for dashboard day-bucket alignment. Hermes
 *  supports `Intl` on Expo SDK 55; the try/catch keeps a fallback so a build
 *  without ICU data still produces a valid string. */
function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const DASHBOARD_WINDOWS = [7, 30, 90] as const;
export type DashboardWindow = (typeof DASHBOARD_WINDOWS)[number];

const STALE_TIME = 60 * 1000;
const REFETCH_INTERVAL = 5 * 60 * 1000;

function dashboardOptions<T>(
  wsId: string | null,
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey,
    queryFn,
    enabled: enabled && !!wsId,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function dashboardUsageDailyOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.daily(wsId, days, tz),
    () => api.getDashboardUsageDaily({ days, tz }),
    enabled,
  );
}

export function dashboardUsageByAgentOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.byAgent(wsId, days, tz),
    () => api.getDashboardUsageByAgent({ days, tz }),
    enabled,
  );
}

export function dashboardAgentRunTimeOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.agentRuntime(wsId, days, tz),
    () => api.getDashboardAgentRunTime({ days, tz }),
    enabled,
  );
}

export function dashboardRunTimeDailyOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.runTimeDaily(wsId, days, tz),
    () => api.getDashboardRunTimeDaily({ days, tz }),
    enabled,
  );
}

export function dashboardFailuresDailyOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.failuresDaily(wsId, days, tz),
    () => api.getDashboardFailuresDaily({ days, tz }),
    enabled,
  );
}

export function dashboardFailuresByAgentOptions(
  wsId: string | null,
  days: number,
  tz: string,
  enabled: boolean,
) {
  return dashboardOptions(
    wsId,
    dashboardKeys.failuresByAgent(wsId, days, tz),
    () => api.getDashboardFailuresByAgent({ days, tz }),
    enabled,
  );
}

export { localTimezone };
