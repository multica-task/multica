/**
 * 首页数据报告（PRD §4.4）—— workspace 维度客户端聚合。
 *
 * 报告卡 = **工作区维度**（整盘发生了什么），待办 = 个人维度，二者不共用
 * query key（v1.5 口径）。本文件是纯函数：给定 workspace 全量 issues
 * （`issueListOptions(wsId)` 的缓存）与周期，聚合出日/周/月报告指标。
 *
 * 数据源与降级（PRD §4.4 数据源表）：
 *   - 新建 / 完成 / 状态分布 → `/api/issues` 客户端按 `updated_at` / `status`
 *     聚合 ✅（完成以 `status === "done"` 且 `updated_at` 落在周期内近似，
 *     无 `done_at` 字段）
 *   - 运行时长 / Tokens → dashboard 端点未上线 → `null` → 渲染 `——`（A 类
 *     决策数据，§0.4；绝不 mock，绝不显示 0）
 *
 * 时区口径：客户端聚合用设备本地时区做「今日/本周/本月」边界（RFC3339
 * 时间戳换算）。PRD §10.2 B-1 的「服务端按 user.timezone 聚合」约束只针对
 * 真后端端点；客户端兜底只能取本地。
 */
import type { Issue } from "@multica/core/types";

export type ReportPeriod = "day" | "week" | "month";

export const REPORT_PERIODS: ReportPeriod[] = ["day", "week", "month"];

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  day: "日",
  week: "周",
  month: "月",
};

/** 行内状态分布（日视图）：进行中 · 待评审 · 受阻 · 失败（失败=cancelled）。 */
export interface ReportStatusCounts {
  inProgress: number;
  inReview: number;
  blocked: number;
  failed: number;
}

export interface ReportStats {
  period: ReportPeriod;
  /** 周期内新建（`created_at` 落在周期）。 */
  created: number;
  /** 周期内完成（`status === "done"` 且 `updated_at` 落在周期）。 */
  done: number;
  /** 员工运行时长 — 无数据源时 `null` → `——`。 */
  runtimeHours: number | null;
  /** Tokens — 无数据源时 `null` → `——`。 */
  tokens: number | null;
  /** 当前 workspace 状态快照（非周期）。 */
  statusDistribution: ReportStatusCounts;
  /** 周视图：近 7 日完成趋势（index 0 = 最早一天）。 */
  weeklyTrend: { dayStart: number; count: number }[];
  /** 周视图：环比 = (本周完成 - 上周完成) / 上周完成；无基期 → `null`。 */
  weekOverWeekPercent: number | null;
  /** 月视图：Top 3 贡献（按 assignee_id 聚合周期内完成数）。 */
  topContributors: { assigneeId: string | null; count: number }[];
  /** 月视图：失败率 = cancelled / 全部（当前 workspace 快照）；分母 <5 → `null`。 */
  failRate: number | null;
  /** 失败率分母，用于「样本不足」提示（§13.1）。 */
  failDenominator: number;
}

export type ReportIssue = Pick<
  Issue,
  "id" | "status" | "assignee_id" | "created_at" | "updated_at"
>;

/** 周期起点（本地时区）：日=今天 00:00、周=本周一 00:00、月=本月 1 日 00:00。 */
export function periodStart(period: ReportPeriod, now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "day") return start;
  if (period === "week") {
    // getDay(): 0=Sun … 6=Sat → 距周一的天数 = (day + 6) % 7。
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function inPeriod(iso: string, from: number, to: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= from && t <= to;
}

function isDone(issue: ReportIssue): boolean {
  return issue.status === "done";
}

export function computeReportStats(
  issues: ReportIssue[],
  period: ReportPeriod,
  now: Date = new Date(),
): ReportStats {
  const to = now.getTime();
  const from = periodStart(period, now).getTime();

  const created = issues.filter((i) => inPeriod(i.created_at, from, to)).length;
  const done = issues.filter(
    (i) => isDone(i) && inPeriod(i.updated_at, from, to),
  ).length;

  // 当前 workspace 状态快照（非周期）——日视图行内「进行中 · 待评审 · 受阻 · 失败」。
  const statusDistribution: ReportStatusCounts = {
    inProgress: issues.filter((i) => i.status === "in_progress").length,
    inReview: issues.filter((i) => i.status === "in_review").length,
    blocked: issues.filter((i) => i.status === "blocked").length,
    failed: issues.filter((i) => i.status === "cancelled").length,
  };

  let weeklyTrend: ReportStats["weeklyTrend"] = [];
  let weekOverWeekPercent: ReportStats["weekOverWeekPercent"] = null;
  if (period === "week") {
    const trend: ReportStats["weeklyTrend"] = [];
    for (let back = 6; back >= 0; back--) {
      const dayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - back,
      );
      const dayFrom = dayStart.getTime();
      const dayTo = dayFrom + 86_400_000 - 1;
      trend.push({
        dayStart: dayFrom,
        count: issues.filter(
          (i) => isDone(i) && inPeriod(i.updated_at, dayFrom, dayTo),
        ).length,
      });
    }
    weeklyTrend = trend;

    const lastWeekFrom = from - 7 * 86_400_000;
    const lastWeekTo = from - 1;
    const thisWeekDone = issues.filter(
      (i) => isDone(i) && inPeriod(i.updated_at, from, to),
    ).length;
    const lastWeekDone = issues.filter(
      (i) => isDone(i) && inPeriod(i.updated_at, lastWeekFrom, lastWeekTo),
    ).length;
    if (lastWeekDone > 0) {
      weekOverWeekPercent = Math.round(
        ((thisWeekDone - lastWeekDone) / lastWeekDone) * 100,
      );
    }
  }

  let topContributors: ReportStats["topContributors"] = [];
  let failRate: ReportStats["failRate"] = null;
  let failDenominator = issues.length;
  if (period === "month") {
    const byAssignee = new Map<string | null, number>();
    for (const i of issues) {
      if (isDone(i) && inPeriod(i.updated_at, from, to)) {
        byAssignee.set(i.assignee_id, (byAssignee.get(i.assignee_id) ?? 0) + 1);
      }
    }
    topContributors = [...byAssignee.entries()]
      .map(([assigneeId, count]) => ({ assigneeId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const cancelled = issues.filter((i) => i.status === "cancelled").length;
    // §13.1 百分比样本约束：分母 < 5 时显示样本量而非百分比。
    if (failDenominator >= 5) {
      failRate = Math.round((cancelled / failDenominator) * 1000) / 10;
    }
  }

  return {
    period,
    created,
    done,
    runtimeHours: null,
    tokens: null,
    statusDistribution,
    weeklyTrend,
    weekOverWeekPercent,
    topContributors,
    failRate,
    failDenominator,
  };
}
