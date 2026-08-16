/**
 * Home ④ 行业简报 — M1 骨架。
 *
 * M1 只放骨架（PRD §9.2 / M1-4 要求）: 标题 + `stat-placeholder`。真实 mock
 * 数据源 (`data/mocks/briefs.ts` + `USE_MOCK_BRIEFS`) 与详情页在 M2 落地
 * (PRD §4.6 B 类 mock, 带「示例数据」徽标)。
 */
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { StatPlaceholder } from "@/components/ui/stat-placeholder";
import { Text } from "@/components/ui/text";

export function BriefList() {
  return (
    <Card className="mx-4 mt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">行业简报</Text>
      </View>
      <StatPlaceholder note="接入后每日推送与你项目相关的行业动态" />
    </Card>
  );
}
