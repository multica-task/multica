/**
 * Home ② 数据分析报告 — M1 骨架。
 *
 * M1 只放骨架（PRD §9.2 / M1-4 要求）: 标题 + `stat-placeholder`（`——` +
 * 说明）。真实日/周/月 segmented + 环形指标 + 客户端聚合在 M2 落地。
 *
 * 口径 (PRD §4.4 v1.5): 报告卡 = **工作区维度** (workspace 全量 issues 客户端
 * 聚合), 待办 = **个人维度** — 二者不共用 query key。M2 接入时走
 * `issueListOptions(wsId)` (挂 `issueKeys.list(wsId)`, workspace 前缀)。
 */
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { StatPlaceholder } from "@/components/ui/stat-placeholder";
import { Text } from "@/components/ui/text";

export function ReportCard() {
  return (
    <Card className="mx-4 mt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">数据报告</Text>
      </View>
      <StatPlaceholder />
    </Card>
  );
}
