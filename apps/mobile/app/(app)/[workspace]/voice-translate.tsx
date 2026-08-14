/**
 * Voice → Translate 原型子页（PRD §6.3）。M4-10 由占位升级为原型 UI：
 *
 *   语言对 chip + 双语气泡流 + 「我说 / 对方说」hold-to-speak 双栏
 *   + 顶部固定原型横幅。
 *
 * 全部为原型：无音频采集 / ASR / 翻译（对应后端需求 B-2，未对接）。示例
 * 文本抽到 `data/mocks/voice-translate.ts`。停止后不跳模板/文件页。
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { VoicePrototypeBanner } from "@/components/voice/voice-prototype-banner";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  VOICE_TRANSLATE_LANG_CHIPS,
  VOICE_TRANSLATE_MOCK_PAIRS,
} from "@/data/mocks/voice-translate";

type Side = "me" | "other";

interface Bubble {
  side: Side;
  text: string;
}

export default function VoiceTranslateRoute() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const [lang, setLang] = useState(VOICE_TRANSLATE_LANG_CHIPS[0]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const currentPair = VOICE_TRANSLATE_MOCK_PAIRS.find(
    (p) => p.lang === lang,
  ) ?? VOICE_TRANSLATE_MOCK_PAIRS[0];

  const speak = (side: Side) => {
    setBubbles((prev) => {
      const latest = [...prev];
      if (side === "me") {
        latest.push({ side, text: currentPair.said });
        latest.push({ side: "other", text: currentPair.translated });
      } else {
        latest.push({ side, text: currentPair.translated });
        latest.push({ side: "me", text: currentPair.said });
      }
      return latest;
    });
  };

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-base font-semibold text-foreground">翻译</Text>
      </View>
      <VoicePrototypeBanner />

      {/* 语言对 chip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 gap-1.5 py-2"
      >
        {VOICE_TRANSLATE_LANG_CHIPS.map((c) => {
          const active = c === lang;
          return (
            <Pressable
              key={c}
              onPress={() => setLang(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full px-3 py-1 ${active ? "bg-brand" : "bg-secondary"}`}
            >
              <Text
                className={`text-xs ${active ? "text-brandForeground" : "text-foreground"}`}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 双语气泡流 */}
      <ScrollView className="flex-1 px-4 pt-2" contentContainerClassName="pb-4">
        {bubbles.length === 0 ? (
          <Text className="text-center text-sm text-muted-foreground py-8">
            按住下方「我说」或「对方说」模拟同声传译
          </Text>
        ) : (
          bubbles.map((b, i) => (
            <View
              key={i}
              className={`mb-2 max-w-[80%] rounded-lg px-3 py-2 ${
                b.side === "me" ? "self-end bg-brand" : "self-start bg-secondary"
              }`}
            >
              <Text
                className={`text-sm ${
                  b.side === "me" ? "text-brandForeground" : "text-foreground"
                }`}
              >
                {b.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* hold-to-speak 双栏 */}
      <View className="flex-row gap-3 border-t border-border px-4 py-4">
        <HoldSpeakButton
          label="我说"
          onHold={() => speak("me")}
          tint={t.brand}
        />
        <HoldSpeakButton
          label="对方说"
          onHold={() => speak("other")}
          tint={t.mutedForeground}
          outline
        />
      </View>
    </View>
  );
}

function HoldSpeakButton({
  label,
  onHold,
  tint,
  outline = false,
}: {
  label: string;
  onHold: () => void;
  tint: string;
  outline?: boolean;
}) {
  return (
    <Pressable
      onPress={onHold}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-1 items-center justify-center rounded-lg py-3 ${
        outline ? "border border-border" : ""
      }`}
      style={outline ? undefined : { backgroundColor: tint }}
    >
      <Text
        className="text-sm font-medium"
        style={{ color: outline ? tint : "hsl(0 0% 100%)" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
