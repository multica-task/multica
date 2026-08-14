/**
 * Bottom tab bar — JS `<Tabs>` from expo-router (react-navigation under the
 * hood). We tried NativeTabs first but its `canPreventDefault: false`
 * constraint makes "tap a tab → open something" impossible. JS Tabs
 * supports `listeners.tabPress + e.preventDefault()`, the canonical RN
 * pattern for tab-as-action.
 *
 * 5-Tab 语义（PRD §3.1 / `01-tab-ia` 原型）：
 *   1. 首页   — `home.tsx`（Today dashboard，`house` 图标 + 收件箱未读 badge）
 *   2. 看板   — `my-issues.tsx`（我的事项数据源，`square.grid.2x2` 图标）
 *   3. ● 中央按钮 — `voice.tsx`（录音，不导航：`tabPress` 一律
 *                 `preventDefault()`，录音/翻译/长按发语音等交互在
 *                 COD-35（M1-7）接入）
 *   4. 工作台 — `chat.tsx`（会话数据源，`person.2.wave.2` 图标 + 未读
 *               badge；文件名在 M4 才改为 `workbench.tsx`）
 *   5. 我的   — `more.tsx`（`person` 图标；M1 暂保留 More 弹窗能力，
 *              M1-6 迁入 mine 页后改回普通导航 Tab）
 *
 * M1 约定：文件暂不改名，只调整 `Tabs.Screen` 的标题 / 图标 / 顺序。
 *
 * M1-1（COD-29）：收件箱迁出到底栏外，成为 pushed route `/{slug}/inbox`。
 * 其未读计数改为落在 M1 验收关口的四处角标（Tab badge / 首页铃铛 /
 * 快捷入口磁贴 / 我的页角标）—— 见 #4 首页壳与 #6 我的页的消费方。
 *
 * The "More" tab is currently **not a navigation target** — its press opens
 * a DropdownMenu popover anchored above the tab, which doubles as the
 * interim "我的" page until M1-6 (COD-34) migrates its entries into
 * `mine.tsx`. The popover is rendered by `<MoreTabDropdownAnchor />` as a
 * sibling of `<Tabs>`, NOT as a `tabBarButton` replacement: keeping the
 * real tab button intact means the icon + label render identically to the
 * other tabs. We just open the dropdown imperatively from
 * `listeners.tabPress` via the exposed `TriggerRef.open()`.
 *
 * The stub (tabs)/more.tsx file still exists only because expo-router
 * requires every Tabs.Screen to have a backing route file — the press
 * is preventDefault'd so we never actually navigate to it.
 *
 * Active / inactive tint colors are derived from the current colour
 * scheme via THEME so dark mode picks contrasting values automatically.
 */
import { useRef } from "react";
import { Tabs } from "expo-router";
import { Image } from "expo-image";
import { View } from "react-native";
import type { TriggerRef } from "@rn-primitives/dropdown-menu";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  useInboxUnreadCount,
  useChatUnreadMessageCount,
} from "@/lib/unread-counts";
import { MoreTabDropdownAnchor } from "@/components/nav/more-tab-dropdown";
import {
  formatTabBadge,
  TAB_BADGES,
  TAB_ICONS,
  TAB_TITLES,
} from "@/lib/tab-config";

// Only override backgroundColor — @react-navigation/elements Badge internally
// sets borderRadius = size/2, height = size, minWidth = size, so a single
// character renders as a perfect circle. Overriding minWidth/fontSize here
// breaks that geometry. Text color is auto-derived from backgroundColor
// luminance by Badge itself (white on brand blue).
const BADGE_STYLE = {
  backgroundColor: THEME.light.brand,
};

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const inboxUnread = useInboxUnreadCount(wsId);
  const chatUnread = useChatUnreadMessageCount(wsId);

  // Truncation aligned with web's sidebar badges: 99+. `undefined` makes
  // React Navigation hide the badge, so zero-count is a free no-op.
  const inboxBadge = formatTabBadge(inboxUnread);
  const chatBadge = formatTabBadge(chatUnread);

  // Imperative handle into the More tab's dropdown — listeners.tabPress
  // calls .open(); the @rn-primitives Trigger measures itself inside
  // open() so the popover anchors to MoreTabDropdownAnchor's rect.
  const moreTriggerRef = useRef<TriggerRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.foreground,
          tabBarInactiveTintColor: t.mutedForeground,
          tabBarStyle: { backgroundColor: t.background },
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        {/* 首页 — 收件箱未读 badge 与铃铛 / 快捷入口 / 我的页角标同源
            `useInboxUnreadCount`（§4.3 parity 点，四处数字一致）。 */}
        <Tabs.Screen
          name="home"
          options={{
            title: "首页",
            tabBarBadge: inboxBadge,
            tabBarBadgeStyle: BADGE_STYLE,
            tabBarIcon: ({ color, size, focused }) => (
              <Image
                source={focused ? "sf:house.fill" : "sf:house"}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        {/* Inbox is no longer a tab — it moved to the pushed route
            `/{slug}/inbox` (M1-1, COD-29). Its unread count re-homes to the
            M1 gate's four badges — tab badge / home bell / quick-entry
            tile / mine-page row — all fed by the same `useInboxUnreadCount`
            hook (deduplicateInboxItems, same rule as web). */}
        <Tabs.Screen
          name="my-issues"
          options={{
            title: TAB_TITLES["my-issues"],
            tabBarIcon: ({ color, size, focused }) => (
              <Image
                source={
                  focused
                    ? TAB_ICONS["my-issues"].focused
                    : TAB_ICONS["my-issues"].unfocused
                }
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        {/* ● 中央按钮 — 录音入口。不导航：录音/翻译/长按发语音等交互由
            COD-35（M1-7）接入；图标暂用品牌色按钮占位，正式 RecordButton
            视觉（渐变 / 凸起）同步在 COD-35 收口。 */}
        <Tabs.Screen
          name="voice"
          options={{
            title: TAB_TITLES.voice,
            tabBarIcon: ({ size, focused }) => (
              <View
                style={{
                  width: size + 6,
                  height: size + 6,
                  borderRadius: (size + 6) / 3,
                  backgroundColor: t.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={focused ? TAB_ICONS.voice.focused : TAB_ICONS.voice.unfocused}
                  tintColor={t.brandForeground}
                  style={{ width: size * 0.7, height: size * 0.7 }}
                />
              </View>
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              // 中央按钮不导航；(tabs)/voice.tsx 保留 Redirect 兜底 deep link。
              e.preventDefault();
            },
          })}
        />
        {/* 工作台 — 会话未读 badge 保持不变（countUnreadChatMessages）。
            文件名 M4 才改 workbench.tsx。 */}
        <Tabs.Screen
          name="chat"
          options={{
            title: TAB_TITLES.chat,
            tabBarBadge: TAB_BADGES.chat ? chatBadge : undefined,
            tabBarBadgeStyle: BADGE_STYLE,
            tabBarIcon: ({ color, size, focused }) => (
              <Image
                source={focused ? TAB_ICONS.chat.focused : TAB_ICONS.chat.unfocused}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        {/* 我的 — 暂保留 More 弹窗能力（M1-6 迁入 mine.tsx 后改普通导航）。 */}
        <Tabs.Screen
          name="more"
          options={{
            title: TAB_TITLES.more,
            tabBarIcon: ({ color, size, focused }) => (
              <Image
                source={focused ? TAB_ICONS.more.focused : TAB_ICONS.more.unfocused}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              // Don't navigate to the (stub) /more screen — open the
              // dropdown popover instead. The trigger is invisible and
              // mounted in MoreTabDropdownAnchor below; ref.open() also
              // measures its rect so the popover anchors correctly.
              e.preventDefault();
              moreTriggerRef.current?.open();
            },
          })}
        />
      </Tabs>

      <MoreTabDropdownAnchor triggerRef={moreTriggerRef} />
    </View>
  );
}
