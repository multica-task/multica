import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * 秘书设置页占位（PRD §8.4 / M2-6 落地）。M1 我的页「秘书设置」行路由到
 * 这里，避免死链；默认员工 / 语音阈值 / 简报偏好等设置在 M2-6 实现。
 */
export default function AssistantSettingsPage() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-sm text-muted-foreground text-center">
        秘书设置 · 功能开发中
      </Text>
    </View>
  );
}
