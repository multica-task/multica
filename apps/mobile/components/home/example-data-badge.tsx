/**
 * 「示例数据」徽标 —— B 类 mock 数据的强制标识（PRD §0.4 / §10.6 徽标强制）。
 *
 * 显示与否由 `USE_MOCK_BRIEFS` 同一常量驱动：开关改 `false` 后徽标与 mock
 * 一起消失，不会出现「换真数据但徽标还在」或反之（PRD §4.6 切换到真实数据）。
 */
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { USE_MOCK_BRIEFS } from "@/data/queries/briefs";

export function ExampleDataBadge() {
  if (!USE_MOCK_BRIEFS) return null;
  return (
    <View className="rounded-full bg-secondary px-2 py-0.5">
      <Text className="text-[11px] text-muted-foreground">示例数据</Text>
    </View>
  );
}
