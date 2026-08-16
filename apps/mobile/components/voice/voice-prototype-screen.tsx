/**
 * VoicePrototypeScreen — shared body for the three voice sub-pages
 * (voice-record / voice-translate / voice-talk) in M1. Per PRD §6.3 each
 * page carries a fixed top prototype banner 「原型演示 · 尚未接入真实录音与转写」
 * and must never show deterministic copy like "转写完成" / "已保存录音".
 * The full prototype UI for these pages lands in M4.
 */
import { View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

interface Props {
  title: string;
  /** Short one-line "coming soon" copy for the page body. */
  description: string;
}

export function VoicePrototypeScreen({ title, description }: Props) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  return (
    <View className="flex-1">
      {/* Fixed prototype banner (PRD §6.3 / §13.3). Muted surface so the
          notice reads as informational; warning glyph keeps it distinct. */}
      <View
        style={{ backgroundColor: t.muted }}
        className="flex-row items-center justify-center gap-2 px-4 py-2"
      >
        <ExpoImage
          source="sf:exclamationmark.triangle"
          tintColor={t.warning}
          style={{ width: 14, height: 14 }}
        />
        <Text className="text-xs font-medium text-muted-foreground">
          原型演示 · 尚未接入真实录音与转写
        </Text>
      </View>

      <View className="px-4 pt-4 pb-3">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8 pb-24">
        <ExpoImage
          source="sf:waveform"
          tintColor={t.mutedForeground}
          style={{ width: 36, height: 36, marginBottom: 12 }}
        />
        <Text className="text-sm text-muted-foreground text-center">
          {description}
        </Text>
      </View>
    </View>
  );
}
