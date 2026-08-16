import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * 报告详情页占位（PRD §8.3 / M2-3 落地）。M1 我的页「数据报告」行路由到
 * 这里，避免死链；完整日/周/月报告在 M2-3 `/{slug}/reports` 实现。
 */
export default function ReportsPage() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-sm text-muted-foreground text-center">
        数据报告 · 功能开发中
      </Text>
    </View>
  );
}
