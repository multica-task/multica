/**
 * 行业简报徽标 —— 由数据来源（`BriefSource`）驱动（PRD §0.4 / §10.6 徽标强制，
 * COD-55 语义调整）。
 *
 * - `source: "daily"`（每日 JSON 链路：远程 / 本地缓存）
 *   → 显示「每日更新」—— 这是真内容，由行业简报官每日 07:00 产出。
 * - `source: "mock"`（`MOCK_BRIEFS` 兜底）→ 显示「示例数据」—— 样例内容，
 *   提示用户当前非真实数据。
 *
 * 徽标与数据源同源（来源由 `loadDailyBriefs` 决定），不会出现「真数据却显示
 * 示例数据」或反之。
 */
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { BriefSource } from "@/data/briefs/daily-source";

interface ExampleDataBadgeProps {
  source: BriefSource;
}

export function ExampleDataBadge({ source }: ExampleDataBadgeProps) {
  if (source === "daily") {
    return (
      <View className="rounded-full bg-brand/10 px-2 py-0.5">
        <Text className="text-[11px] text-brand">每日更新</Text>
      </View>
    );
  }
  return (
    <View className="rounded-full bg-secondary px-2 py-0.5">
      <Text className="text-[11px] text-muted-foreground">示例数据</Text>
    </View>
  );
}
