/**
 * Home ② 数据分析报告 — 环形指标（PRD §9.2 新增组件，3+ 调用方：日/周/月
 * 各 3 个环形）。
 *
 * 圆环用 SVG 双弧（背景 + 进度弧），`progress` 0..1 由父级传入 —— 三个环形
 * 的进度相对同一周期内的最大值，视觉表达「哪个指标更突出」，不声称是某个
 * 绝对目标完成度。
 *
 * 缺失态（A 类数据，PRD §0.4 / §9.4）：`value` 为 `null` 时渲染 `——` +
 * 12px 说明，**绝不显示 0**。进度弧此时不画（progress 置 0），只留背景环。
 */
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

interface Props {
  /** 中心数字；`null` = 缺失 → 渲染 `——`（A 类数据不显示 0）。 */
  value: number | null;
  /** 环形下方标签（如「新建事项」）。 */
  label: string;
  /** 0..1 环形填充比例。 */
  progress: number;
  /** 环与数字颜色（默认品牌色；沿用 token，不硬编码 hex）。 */
  color?: string;
  /** 数字后缀（如 "h"），缺失时忽略。 */
  suffix?: string;
  /** 缺失时环下方/中心的说明文案。 */
  note?: string;
  /** 数字格式化（默认按当前 locale 千分位）。 */
  formatValue?: (value: number) => string;
}

const R = 30;
const STROKE = 5;
const SIZE = R * 2 + STROKE;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function MetricRing({
  value,
  label,
  progress,
  color,
  suffix,
  note,
  formatValue = (v) => v.toLocaleString(),
}: Props) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = clamped * CIRCUMFERENCE;
  const stroke = color ?? t.mutedForeground;

  // 评审修复（LOW）：环形为纯图形 + 相邻文字，给可访问标签合成「标签 · 数值」。
  const accessibilityLabel =
    value !== null
      ? `${label}，${formatValue(value)}${suffix ? suffix : ""}`
      : `${label}，暂无数据`;

  return (
    <View
      className="items-center gap-1 flex-1"
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* 背景环 */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={stroke}
            strokeOpacity={0.15}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* 进度弧 */}
          {value !== null && dash > 0 ? (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={stroke}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ) : null}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          {value !== null ? (
            <Text className="text-lg font-semibold text-foreground leading-6">
              {formatValue(value)}
              {suffix ? (
                <Text className="text-xs font-normal text-muted-foreground">
                  {suffix}
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text className="text-base text-muted-foreground leading-6">——</Text>
          )}
        </View>
      </View>
      <Text className="text-xs text-muted-foreground text-center">{label}</Text>
      {value === null && note ? (
        <Text className="text-[10px] text-muted-foreground/70 text-center px-1 leading-3">
          {note}
        </Text>
      ) : null}
    </View>
  );
}
