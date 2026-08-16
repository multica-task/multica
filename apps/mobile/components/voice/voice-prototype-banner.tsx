/**
 * 语音原型横幅（PRD §6.3 / §13.3）。
 *
 * 三个语音子页（voice-record / voice-translate / voice-talk）顶部固定一行：
 * 「原型演示 · 尚未接入真实录音与转写」，可点开说明。B 类 mock 数据的可见
 * 标识必须与 `USE_MOCK_*` 常量同源（见 data/mocks/ 各文件头），不得只删徽标
 * 保留数据——标识与开关同源，无法只删一处。
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

const BANNER_COPY = "原型演示 · 尚未接入真实录音与转写";
const DETAIL_COPY =
  "当前为交互原型：链路完整、动画真实，但无音频采集 / ASR / 翻译。停止录音后不产生记录，也不会跳转模板页。";

export function VoicePrototypeBanner() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={BANNER_COPY}
      className="mx-4 mt-2 overflow-hidden rounded-md bg-warning/10 border border-warning/30"
    >
      <View className="flex-row items-center gap-1.5 px-2.5 py-1.5">
        <Ionicons name="flask-outline" size={13} color={t.warning} accessible={false} />
        <Text className="flex-1 text-xs text-warning">{BANNER_COPY}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={12}
          color={t.warning}
          accessible={false}
        />
      </View>
      {expanded ? (
        <Text className="px-2.5 pb-2 text-[11px] leading-4 text-muted-foreground">
          {DETAIL_COPY}
        </Text>
      ) : null}
    </Pressable>
  );
}
