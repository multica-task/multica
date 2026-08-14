/**
 * Bottom tab bar semantic config — single source of truth for the 5-tab IA
 * (PRD §3.1「2+1+2」/ §13.1「底栏 5 项」), consumed by
 * `app/(app)/[workspace]/(tabs)/_layout.tsx`.
 *
 * Extracted into a pure module so the tab collection / order / badge wiring
 * are unit-testable in the mobile vitest channel (which does not render RN
 * components). Any change to the bar's tabs must edit THIS file and the
 * layout together; the tests here assert the collection / order / badge
 * mapping stay stable.
 *
 * M1 收敛后的最终 5 项：首页 / 看板(占位) / ●录音 / 工作台 / 我的。收件箱
 * （M1-1 迁出底栏）与我的事项（M1-2 迁出底栏）不再是 Tab；More 弹窗（`more`）
 * 在 M1-6 收敛为 `mine` 页（COD-34）。
 */
export const TAB_ORDER = ["home", "board", "voice", "chat", "mine"] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** Semantic tab titles (M1-3, COD-31 + 收敛). 看板是 M3 真实看板前的占位。 */
export const TAB_TITLES: Record<TabName, string> = {
  home: "首页",
  board: "看板",
  voice: "录音",
  chat: "工作台",
  mine: "我的",
};

/**
 * Tab bar badge wiring: which tab shows an unread badge and which unread
 * source drives it. "inbox" → useInboxUnreadCount, "chat" →
 * useChatUnreadMessageCount, null → no badge. Kept as data so the
 * 「Tab badge / 铃铛 / 快捷入口 / 我的页角标四处一致」acceptance maps to one
 * testable table.
 */
export type TabBadgeKind = "inbox" | "chat" | null;
export const TAB_BADGES: Record<TabName, TabBadgeKind> = {
  home: "inbox",
  board: null,
  voice: null,
  chat: "chat",
  mine: null,
};

/** SF Symbol icon per tab, focused vs unfocused variant. */
export const TAB_ICONS: Record<TabName, { focused: string; unfocused: string }> = {
  home: { focused: "sf:house.fill", unfocused: "sf:house" },
  board: { focused: "sf:square.grid.2x2.fill", unfocused: "sf:square.grid.2x2" },
  voice: { focused: "sf:mic.fill", unfocused: "sf:mic" },
  chat: { focused: "sf:person.2.wave.2.fill", unfocused: "sf:person.2.wave.2" },
  mine: { focused: "sf:person.fill", unfocused: "sf:person" },
};

/**
 * Badge truncation aligned with web's sidebar badges: 99+. `undefined` hides
 * the badge in React Navigation, so a zero count is a free no-op.
 */
export function formatTabBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}
