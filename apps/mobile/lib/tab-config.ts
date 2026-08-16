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
 * File names stay as-is in M1 (chat.tsx → workbench.tsx lands in M4); only
 * titles / icons / order are semantic here.
 */
export const TAB_ORDER = ["inbox", "my-issues", "voice", "chat", "more"] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** Semantic tab titles (M1-3, COD-31). The "看板" tab is a board placeholder
 * (M3 real board); "工作台" is the workbench (chat data source until M4). */
export const TAB_TITLES: Record<TabName, string> = {
  inbox: "首页",
  "my-issues": "看板",
  voice: "录音",
  chat: "工作台",
  more: "我的",
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
  inbox: "inbox",
  "my-issues": null,
  voice: null,
  chat: "chat",
  more: null,
};

/** SF Symbol icon per tab, focused vs unfocused variant. */
export const TAB_ICONS: Record<TabName, { focused: string; unfocused: string }> = {
  inbox: { focused: "sf:house.fill", unfocused: "sf:house" },
  "my-issues": { focused: "sf:square.grid.2x2.fill", unfocused: "sf:square.grid.2x2" },
  voice: { focused: "sf:mic.fill", unfocused: "sf:mic" },
  chat: { focused: "sf:person.2.wave.2.fill", unfocused: "sf:person.2.wave.2" },
  more: { focused: "sf:person.fill", unfocused: "sf:person" },
};

/**
 * Badge truncation aligned with web's sidebar badges: 99+. `undefined` hides
 * the badge in React Navigation, so a zero count is a free no-op.
 */
export function formatTabBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}
