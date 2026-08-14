/**
 * Dashboard / progress-view display formatting (PRD §5.2 视图 C).
 *
 * Mobile-owned mirror of the format helpers web/desktop use in
 * `packages/views/dashboard/utils.ts` + `packages/views/runtimes/utils.ts`
 * (`formatDuration`, `formatTokens`) and
 * `packages/views/runtimes/components/charts/failure-class-visuals.ts`
 * (`formatRate`). Output shapes match web so the same metric reads the same
 * across clients — the dashboard KPI values themselves only render once the
 * `/api/dashboard/*` endpoints ship (PRD §10.2 B-1); until then callers show
 * `StatPlaceholder` (——) and these helpers sit ready.
 */

const TOKEN_UNITS = [
  { divisor: 1, suffix: "" },
  { divisor: 1_000, suffix: "K" },
  { divisor: 1_000_000, suffix: "M" },
  { divisor: 1_000_000_000, suffix: "B" },
  { divisor: 1_000_000_000_000, suffix: "T" },
] as const;

/** Compact magnitude number — "1.2K" / "3.4M" / "5B" / "1.2T". Used for the
 *  dashboard Tokens KPI and per-agent token columns. Mirrors web
 *  `formatTokens` (packages/views/runtimes/utils.ts:118-139) with the
 *  cross-unit promotion so a value never renders as 1000K. */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const magnitude = Math.abs(n);
  let unitIndex = TOKEN_UNITS.findLastIndex(({ divisor }) => magnitude >= divisor);
  unitIndex = Math.max(unitIndex, 0);

  if (unitIndex === 0) return n.toLocaleString();

  let unit = TOKEN_UNITS[unitIndex]!;
  let scaled = n / unit.divisor;

  if (
    Math.abs(Number(scaled.toFixed(1))) >= 1_000 &&
    unitIndex < TOKEN_UNITS.length - 1
  ) {
    unit = TOKEN_UNITS[unitIndex + 1]!;
    scaled = n / unit.divisor;
  }

  return `${Number(scaled.toFixed(1))}${unit.suffix}`;
}

/** Token counts use the same compact scale as every other magnitude. */
export function formatTokens(n: number): string {
  return formatCompactNumber(n);
}

/**
 * Compact human duration, two segments max — "<1m" / "45s" / "12m 30s" /
 * "1h 23m" / "2d 3h". Mirrors web `formatDuration`
 * (packages/views/dashboard/utils.ts:459-478); the `lessThanMinuteLabel`
 * parameter keeps the copy decision at the call site (web passes the i18n
 * string; mobile passes a literal). Returns the label for missing / negative
 * / non-finite input so a caller never renders "NaN".
 */
export function formatDuration(
  seconds: number,
  lessThanMinuteLabel = "<1 分钟",
): string {
  if (seconds < 0 || !Number.isFinite(seconds)) return lessThanMinuteLabel;
  if (seconds < 60) {
    if (seconds < 1) return lessThanMinuteLabel;
    return `${Math.round(seconds)}s`;
  }
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) {
    const secs = Math.floor(seconds) % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Failure rate percent — "—" when there is no denominator (PRD §9.4: missing,
 * not zero), one decimal when <10%, else rounded. Mirrors web `formatRate`
 * (packages/views/runtimes/components/charts/failure-class-visuals.ts:63-67).
 */
export function formatRate(failed: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (failed / total) * 100;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}
