/**
 * 我的（Mine）— 第 5 个 Tab 根屏（PRD §8）。
 *
 * 由 M1-6 从旧 `more.tsx` 占位 + More 弹窗迁入：分区重组 + 新增
 * 收件箱 / 我的事项 / 版本号行；「智能体」行改标签「数字员工」但
 * **路由保持 `more/agents`**（`/staff` 是 M4 才建，M1 不制造死链，
 * PRD §8.3 行 1029）。
 *
 * 分区（PRD §8.2）：
 *   - 身份卡（用户 name + email / 当前 workspace）
 *   - 工作：收件箱（未读角标）· 我的事项 · 置顶 · 事项 · 项目 · 数字员工
 *   - 报告：数据报告（`/reports` 为 M2-3 落地，本期先放占位屏防死链）
 *   - 秘书：秘书设置（`more/settings/assistant` 为 M2-6 落地，占位）
 *   - 设置：设置 · 个人资料 · 通知
 *   - 关于：版本号（M1 用示例文案；真实版本后续取 `expo-application`
 *            + `X-Client-Version`，PRD §8.3）
 *
 * 角标口径：收件箱行未读数复用 `useInboxUnreadCount`（与底栏 Tab badge /
 * 首页铃铛 / 快捷入口同一镜像 `deduplicateInboxItems` 的定义，PRD §8.5）。
 */
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/ui/header";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { workspaceListOptions } from "@/data/queries/workspaces";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useInboxUnreadCount } from "@/lib/unread-counts";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

// M1 版本号示例：真实版本由 expo-application + X-Client-Version 提供
// （PRD §8.3「关于 | 版本号」），本期先用 PRD §8.2 的示例文案占位。
const VERSION_LABEL = "版本 1.0.0 (55)";

// 超过 99 的角标折叠为 "99+"，与底栏 Tab badge 截断口径一致。
const MAX_BADGE = 99;

/** 一行的数据定义。`href` 为空 = 不可点行（如版本号）。 */
interface Row {
  /** Ionicons 图标名。 */
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href?: string;
}

// 工作分区（PRD §8.2）。数字员工行指向 /staff（M4-5；M1 曾占位 more/agents）。
const WORK_ROWS: Row[] = [
  { icon: "mail-outline", label: "收件箱", href: "/inbox" },
  { icon: "checkbox-outline", label: "我的事项", href: "/my-issues" },
  { icon: "pin-outline", label: "置顶", href: "/more/pins" },
  { icon: "list-outline", label: "事项", href: "/more/issues" },
  { icon: "folder-open-outline", label: "项目", href: "/more/projects" },
  { icon: "people-outline", label: "数字员工", href: "/staff" },
];

// 设置分区（PRD §8.2）。
const SETTINGS_ROWS: Row[] = [
  { icon: "settings-outline", label: "设置", href: "/more/settings" },
  { icon: "person-outline", label: "个人资料", href: "/more/settings/profile" },
  { icon: "notifications-outline", label: "通知", href: "/more/settings/notifications" },
];

export default function MinePage() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const user = useAuthStore((s) => s.user);
  const inboxUnread = useInboxUnreadCount(wsId);
  const { data: workspaces } = useQuery(workspaceListOptions());
  const currentWorkspace = useMemo(
    () => (slug ? workspaces?.find((w) => w.slug === slug) : undefined),
    [workspaces, slug],
  );
  // 单工作区时 workspace 行禁用（无 chevron / 不可点），与旧 More 弹窗一致。
  const canSwitchWorkspace = (workspaces?.length ?? 0) > 1;

  const go = (href: string) => {
    if (slug) router.push(`/${slug}${href}`);
  };

  return (
    <View className="flex-1 bg-background">
      <Header title="我的" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 gap-6"
      >
        {/* 身份卡（PRD §8.2）：用户行 + 当前 workspace 行，沿用旧 More 弹窗
            UserCard / WorkspaceCard 的形态。 */}
        <View className="rounded-md border border-border bg-card overflow-hidden">
          <UserCard
            name={user?.name ?? "—"}
            email={user?.email}
            avatarUrl={user?.avatar_url}
            chevronTint={t.mutedForeground}
            onPress={() => go("/more/settings")}
          />
          <Separator />
          <WorkspaceCard
            name={currentWorkspace?.name}
            avatarUrl={currentWorkspace?.avatar_url}
            canSwitch={canSwitchWorkspace}
            chevronTint={t.mutedForeground}
            onPress={() => go("/switch-workspace")}
          />
        </View>

        <SectionGroup title="工作">
          {WORK_ROWS.map((row, idx) => {
            const isLast = idx === WORK_ROWS.length - 1;
            return (
              <View key={row.label}>
                <NavRow
                  icon={row.icon}
                  label={row.label}
                  badge={row.label === "收件箱" ? inboxUnread : undefined}
                  chevronTint={t.mutedForeground}
                  onPress={row.href ? () => go(row.href!) : undefined}
                />
                {!isLast ? <Separator /> : null}
              </View>
            );
          })}
        </SectionGroup>

        <SectionGroup title="报告">
          <NavRow
            icon="bar-chart-outline"
            label="数据报告"
            subtitle="日 / 周 / 月"
            chevronTint={t.mutedForeground}
            onPress={() => go("/reports")}
          />
        </SectionGroup>

        <SectionGroup title="秘书">
          <NavRow
            icon="person-circle-outline"
            label="秘书设置"
            subtitle="默认员工 · 语音 · 简报"
            chevronTint={t.mutedForeground}
            onPress={() => go("/more/settings/assistant")}
          />
        </SectionGroup>

        <SectionGroup title="设置">
          {SETTINGS_ROWS.map((row, idx) => {
            const isLast = idx === SETTINGS_ROWS.length - 1;
            return (
              <View key={row.label}>
                <NavRow
                  icon={row.icon}
                  label={row.label}
                  chevronTint={t.mutedForeground}
                  onPress={row.href ? () => go(row.href!) : undefined}
                />
                {!isLast ? <Separator /> : null}
              </View>
            );
          })}
        </SectionGroup>

        <SectionGroup title="关于">
          {/* 版本号行不可点（PRD §8.3：非可点行）。帮助与反馈 M4 才展示，先隐藏。 */}
          <NavRow
            icon="information-circle-outline"
            label={VERSION_LABEL}
            chevronTint={t.mutedForeground}
            onPress={undefined}
          />
        </SectionGroup>
      </ScrollView>
    </View>
  );
}

/** 分组卡片：小节标题 + 圆角边框分组（沿用 settings.tsx 的 SectionGroup 形态）。 */
function SectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-wider text-muted-foreground px-1">
        {title}
      </Text>
      <View className="rounded-md border border-border bg-card overflow-hidden">
        {children}
      </View>
    </View>
  );
}

/** 单行入口：图标 + 标签 +（可选）未读角标 + chevron。 */
function NavRow({
  icon,
  label,
  subtitle,
  badge,
  chevronTint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: number;
  chevronTint: string;
  onPress?: () => void;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center px-4 py-3.5 gap-3",
        !disabled && "active:bg-secondary",
      )}
    >
      <Ionicons name={icon} size={20} color={chevronTint} />
      <View className="flex-1 min-w-0">
        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-muted-foreground mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge && badge > 0 ? <CountBadge count={badge} /> : null}
      {!disabled ? (
        <Ionicons name="chevron-forward" size={18} color={chevronTint} />
      ) : null}
    </Pressable>
  );
}

/** 未读角标：brand 底圆点 + 数字，与底栏 Tab badge 视觉一致。 */
function CountBadge({ count }: { count: number }) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const label = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
  return (
    <View
      className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
      style={{ backgroundColor: t.brand }}
    >
      <Text
        className="text-[11px] font-semibold leading-none"
        style={{ color: t.brandForeground }}
      >
        {label}
      </Text>
    </View>
  );
}

/** 身份卡用户行：头像 + name + email → 设置。 */
function UserCard({
  name,
  email,
  avatarUrl,
  chevronTint,
  onPress,
}: {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  chevronTint: string;
  onPress: () => void;
}) {
  const initial = (name !== "—" ? name : email ?? "U").charAt(0).toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-secondary gap-3"
    >
      {avatarUrl ? (
        <ExpoImage source={{ uri: avatarUrl }} className="size-8 rounded-full bg-muted" />
      ) : (
        <View className="size-8 rounded-full bg-muted items-center justify-center">
          <Text className="text-xs font-medium text-muted-foreground">{initial}</Text>
        </View>
      )}
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {name}
        </Text>
        {email ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={chevronTint} />
    </Pressable>
  );
}

/** 身份卡 workspace 行：单工作区时禁用（无 chevron / 不可点）。 */
function WorkspaceCard({
  name,
  avatarUrl,
  canSwitch,
  chevronTint,
  onPress,
}: {
  name: string | undefined;
  avatarUrl: string | null | undefined;
  canSwitch: boolean;
  chevronTint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!canSwitch}
      className="flex-row items-center px-4 py-3.5 active:bg-secondary gap-3"
    >
      <WorkspaceAvatar name={name ?? "Workspace"} avatarUrl={avatarUrl} size={32} />
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {name ?? "Workspace"}
        </Text>
      </View>
      {canSwitch ? (
        <Ionicons name="chevron-forward" size={18} color={chevronTint} />
      ) : null}
    </Pressable>
  );
}
