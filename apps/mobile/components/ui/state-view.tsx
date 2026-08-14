/**
 * Unified empty / error / offline surface — PRD §9.4 6-state matrix.
 *
 * One layout, three kinds:
 *   - empty: 图标 + 一句话说明 + 一个可执行 CTA（PRD §9.4 Empty）
 *   - error: 一句人话 + 「重试」（PRD §9.4 Error；区块级失败只坏那一块）
 *   - offline: 无缓存可渲染时的兜底（有缓存走 Query 缓存渲染，不加横幅）
 *
 * Loading / Refreshing 不在此组件内：Loading 用贴合内容的骨架屏（§9.4 禁止
 * 全屏 spinner），Refreshing 用列表下拉刷新，均沿用现有模式。Partial 态用
 * `StatPlaceholder`（缺失位显示 `——`）。
 *
 * 无障碍（§9.4）：图标 `accessible={false}` 避免被读成符号名；CTA 按钮
 * min-h-11/min-w-11 ≥44×44pt；一屏只有一个主 CTA，`onAction` 与
 * `actionLabel` 同时提供才渲染按钮。
 */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type StateViewKind = "empty" | "error" | "offline";

type IconName = ComponentProps<typeof Ionicons>["name"];

const KIND_DEFAULTS: Record<
  StateViewKind,
  { icon: IconName; title: string; description?: string; actionLabel?: string }
> = {
  empty: { icon: "file-tray-outline", title: "", actionLabel: "" },
  error: {
    icon: "alert-circle-outline",
    title: "加载失败",
    description: "请检查网络后重试",
    actionLabel: "重试",
  },
  offline: {
    icon: "cloud-offline-outline",
    title: "网络未连接",
    description: "无法加载最新内容，请检查网络后重试",
    actionLabel: "重试",
  },
};

interface Props {
  kind: StateViewKind;
  /** 主文案（人话）。empty 必填；error/offline 有默认值。 */
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  className?: string;
}

export function StateView({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: Props) {
  const { colorScheme } = useColorScheme();
  const d = KIND_DEFAULTS[kind];
  const resolvedTitle = title ?? d.title;
  const resolvedDescription = description ?? d.description;
  const actionText = actionLabel ?? d.actionLabel;
  const showAction = Boolean(onAction && actionText);

  return (
    <View className={cn("items-center justify-center gap-2.5 px-6 py-8", className)}>
      <Ionicons
        name={icon ?? d.icon}
        size={40}
        color={THEME[colorScheme].mutedForeground}
        accessible={false}
      />
      <Text className="text-center text-sm font-medium text-foreground">
        {resolvedTitle}
      </Text>
      {resolvedDescription ? (
        <Text className="text-center text-sm text-muted-foreground">
          {resolvedDescription}
        </Text>
      ) : null}
      {showAction ? (
        <Button
          variant="outline"
          size="sm"
          onPress={onAction}
          className="mt-1 min-h-11 min-w-11"
        >
          <Text>{actionText}</Text>
        </Button>
      ) : null}
    </View>
  );
}
