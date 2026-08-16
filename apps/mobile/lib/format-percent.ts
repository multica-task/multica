/**
 * Format a percentage with the PRD §13.1 sample-size guard.
 *
 * - total <= 0: no observations → no percentage exists (missing, not zero,
 *   §9.4) → returns null; callers render <StatPlaceholder />.
 * - 0 < total < 5: too few samples for a meaningful percentage → show the
 *   raw sample (e.g. "2/4") instead of a misleading "%".
 * - total >= 5: rounded percentage, e.g. "60%".
 */
export function formatPercent(part: number, total: number): string | null {
  if (total <= 0) return null;
  if (total < 5) return `${part}/${total}`;
  return `${Math.round((part / total) * 100)}%`;
}
