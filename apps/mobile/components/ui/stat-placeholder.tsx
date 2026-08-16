/**
 * Unified "missing statistic" placeholder — PRD §9.4 / §9.2.
 *
 * Renders `——` (em dash) + a 12px muted explanation. The dash is a
 * deliberate "missing / not-yet-available" marker: it must NOT be confused
 * with a real zero (§9.4 "`——` 是缺失，`0` 是真的零"). A 类决策数据（§0.4）
 * 无数据源时一律渲染本组件，禁止用 0 或假数字冒充（§13.3）。
 *
 * Used by the home report-card / brief-list skeletons in M1; dashboard
 * endpoints not yet shipped (PRD §10.2 B-1) render through this too.
 */
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

interface Props {
  /** 12px 弱色说明，默认「部分统计接口未上线」。传空字符串可隐藏。 */
  note?: string;
  /** 紧凑尺寸（metric-ring 等小格位）。 */
  compact?: boolean;
  className?: string;
}

const DEFAULT_NOTE = "部分统计接口未上线";

export function StatPlaceholder({
  note = DEFAULT_NOTE,
  compact = false,
  className,
}: Props) {
  return (
    <View
      accessible
      accessibilityLabel={note || "暂无数据"}
      className={cn(
        "items-center justify-center gap-1",
        compact ? "py-1" : "py-3",
        className,
      )}
    >
      <Text
        className={cn(
          "text-muted-foreground",
          compact ? "text-base leading-6" : "text-2xl leading-8",
        )}
      >
        ——
      </Text>
      {note ? (
        <Text className="text-xs text-muted-foreground/70">{note}</Text>
      ) : null}
    </View>
  );
}
