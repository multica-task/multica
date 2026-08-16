/**
 * Voice → Record 原型子页（PRD §6.3）。M4-10 由占位升级为原型 UI：
 *
 *   顶部状态胶囊 + 转写列表（Mock 流式追加）+ 底部 Dock（波形 / 计时 /
 *   暂停 / 停止）+ 顶部固定原型横幅。
 *
 * 全部为原型：无音频采集 / ASR（对应后端需求 B-2，未对接）。示例文本抽到
 * `data/mocks/voice-record.ts`。停止录音后不跳模板/文件页，回到上一屏并提示
 * 「原型不产生记录」（PRD §6.3）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/text";
import { VoicePrototypeBanner } from "@/components/voice/voice-prototype-banner";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  VOICE_RECORD_MOCK_TRANSCRIPT,
  VOICE_RECORD_TIMER_INIT,
} from "@/data/mocks/voice-record";

type DockStatus = "idle" | "recording" | "paused";

export default function VoiceRecordRoute() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const [status, setStatus] = useState<DockStatus>("idle");
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [timer, setTimer] = useState(VOICE_RECORD_TIMER_INIT);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mock 流式追加：录音中每 ~1.8s 追加一条转写。
  useEffect(() => {
    if (status !== "recording") return;
    const interval = setInterval(() => {
      setVisibleLines((lines) =>
        lines.length < VOICE_RECORD_MOCK_TRANSCRIPT.length
          ? [...lines, VOICE_RECORD_MOCK_TRANSCRIPT[lines.length]]
          : lines,
      );
    }, 1800);
    return () => clearInterval(interval);
  }, [status]);

  // 等宽计时：MM:SS / HH:MM:SS（PRD §6.3 Dock 计时格式）。
  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setTimer(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [status]);

  const handleStop = useCallback(() => {
    setStatus("idle");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // 停止后不跳模板/文件页 —— 回到上一屏并提示「原型不产生记录」。
    router.back();
  }, []);

  const recording = status === "recording";

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-base font-semibold text-foreground">录音</Text>
      </View>
      <VoicePrototypeBanner />

      {/* 顶部状态胶囊 */}
      <View className="items-center pt-3">
        <View className="flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
          <View
            className={`h-2 w-2 rounded-full ${recording ? "bg-destructive" : "bg-muted-foreground/40"}`}
          />
          <Text className="text-xs text-foreground">
            {status === "recording"
              ? "录音中 · 原型"
              : status === "paused"
                ? "已暂停 · 原型"
                : "待开始 · 原型"}
          </Text>
        </View>
      </View>

      {/* 转写列表（Mock 流式追加） */}
      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-4">
        {visibleLines.length === 0 ? (
          <Text className="text-center text-sm text-muted-foreground py-6">
            点击下方「开始」模拟录音转写
          </Text>
        ) : (
          visibleLines.map((line, i) => (
            <View
              key={`${i}-${line}`}
              className="mb-2 rounded-lg bg-secondary/60 px-3 py-2"
            >
              <Text className="text-sm text-foreground">{line}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* 底部 Dock：波形 / 计时 / 暂停 / 停止 */}
      <View className="border-t border-border px-6 py-4">
        <View className="flex-row items-center justify-center gap-6">
          {/* 波形占位 */}
          <View className="h-6 w-10 flex-row items-center gap-0.5">
            {[0.4, 0.9, 0.6, 1, 0.5].map((h, i) => (
              <View
                key={i}
                className="w-1 rounded-sm"
                style={{
                  height: 18 * h,
                  backgroundColor: recording ? t.brand : t.mutedForeground,
                }}
              />
            ))}
          </View>
          <Text className="text-xl font-semibold tabular-nums text-foreground">
            {timer}
          </Text>

          {status === "idle" ? (
            <Pressable
              onPress={() => {
                setStatus("recording");
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              accessibilityRole="button"
              accessibilityLabel="开始录音"
              className="h-14 w-14 items-center justify-center rounded-full bg-brand"
            >
              <Image
                source="sf:mic.fill"
                tintColor={t.brandForeground}
                style={{ width: 22, height: 22 }}
              />
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => setStatus(recording ? "paused" : "recording")}
                accessibilityRole="button"
                accessibilityLabel={recording ? "暂停" : "继续"}
                className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              >
                <Image
                  source={recording ? "sf:pause.fill" : "sf:play.fill"}
                  tintColor={t.foreground}
                  style={{ width: 16, height: 16 }}
                />
              </Pressable>
              <Pressable
                onPress={handleStop}
                accessibilityRole="button"
                accessibilityLabel="停止录音"
                className="h-14 w-14 items-center justify-center rounded-full bg-destructive"
              >
                <Image
                  source="sf:stop.fill"
                  tintColor={t.destructiveForeground}
                  style={{ width: 20, height: 20 }}
                />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
