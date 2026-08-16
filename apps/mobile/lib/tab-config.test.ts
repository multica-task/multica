/**
 * Tab semantics tests (COD-31 / M1-3). The mobile vitest channel is
 * node-only and renders no RN components, so the 5-tab IA is pinned here as
 * pure data — the collection, order, titles, icons, and badge wiring that
 * (tabs)/_layout.tsx consumes. A regression that reorders / drops / renames
 * a tab (e.g. my-issues removal in M1-2) is caught by these assertions.
 */
import { describe, expect, it } from "vitest";
import {
  formatTabBadge,
  TAB_BADGES,
  TAB_ICONS,
  TAB_ORDER,
  TAB_TITLES,
  type TabName,
} from "./tab-config";

describe("tab-config", () => {
  it("has exactly the 5-tab collection (PRD §3.1 2+1+2)", () => {
    expect(TAB_ORDER).toEqual([
      "inbox",
      "my-issues",
      "voice",
      "chat",
      "more",
    ]);
  });

  it("keeps the central voice button at position 3", () => {
    expect(TAB_ORDER[2]).toBe("voice");
  });

  it("orders the bar as 首页 · 看板 · ●录音 · 工作台 · 我的", () => {
    expect(TAB_ORDER.map((t) => TAB_TITLES[t])).toEqual([
      "首页",
      "看板",
      "录音",
      "工作台",
      "我的",
    ]);
  });

  it("maps every tab to a semantic title", () => {
    for (const tab of TAB_ORDER) {
      expect(TAB_TITLES[tab].length).toBeGreaterThan(0);
    }
  });

  it("gives every tab a focused + unfocused icon", () => {
    for (const tab of TAB_ORDER) {
      const icon = TAB_ICONS[tab];
      expect(icon.focused).toMatch(/^sf:/);
      expect(icon.unfocused).toMatch(/^sf:/);
      expect(icon.focused).not.toBe(icon.unfocused);
    }
  });

  it("wires the inbox badge only to 首页 and chat badge only to 工作台", () => {
    expect(TAB_BADGES.inbox).toBe("inbox");
    expect(TAB_BADGES.chat).toBe("chat");
    // No other tab carries a badge.
    const others = TAB_ORDER.filter(
      (t): t is Exclude<TabName, "inbox" | "chat"> =>
        t !== "inbox" && t !== "chat",
    );
    for (const tab of others) {
      expect(TAB_BADGES[tab]).toBeNull();
    }
  });

  describe("formatTabBadge", () => {
    it("hides the badge at zero", () => {
      expect(formatTabBadge(0)).toBeUndefined();
    });

    it("renders the literal count below the cap", () => {
      expect(formatTabBadge(1)).toBe("1");
      expect(formatTabBadge(42)).toBe("42");
    });

    it("caps at 99+ like web's sidebar", () => {
      expect(formatTabBadge(99)).toBe("99");
      expect(formatTabBadge(100)).toBe("99+");
      expect(formatTabBadge(1234)).toBe("99+");
    });
  });
});
