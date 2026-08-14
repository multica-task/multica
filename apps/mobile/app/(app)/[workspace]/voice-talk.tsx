/**
 * Voice → "Hold to Talk" prototype route. Presented as a formSheet by the
 * parent Stack.
 *
 * Interaction (issue COD-15, Task 3):
 *   - Press and hold the mic button → "recording" state (mic icon + waveform
 *     placeholder). Released → the hold ends.
 *   - On release it sends a hard-coded "你好" to the current chat through
 *     the real send pipeline (`sendChatMessage`, same optimistic burst the
 *     chat composer uses). If no chat session is active yet, it falls back
 *     to a UI-only "已发送：你好（模拟）" confirmation — real recording / ASR
 *     is explicitly out of scope for the MVP.
 *
 * Hold interaction uses react-native-gesture-handler's Pan gesture with
 * minDistance 0 (activates on touch-down) + onFinalize (fires on release
 * or cancellation). The waveform loop is gated on `prefers-reduced-motion`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { PulseDot } from "@/components/ui/pulse-dot";
import { VoicePrototypeBanner } from "@/components/voice/voice-prototype-banner";
import type { ChatMessage, ChatPendingTask } from "@multica/core/types";
import { enqueuePendingChatTask, removePendingChatTask } from "@multica/core/chat/pending";
import { api } from "@/data/api";
import { chatKeys } from "@/data/queries/chat";
import { useChatSessionPickerStore } from "@/data/stores/chat-session-picker-store";
import { seedAcceptedPendingTask } from "@/data/realtime/chat-ws-updaters";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { VOICE_TALK_MOCK_CONTENT } from "@/data/mocks/voice-talk";

type Status = "idle" | "recording" | "sending" | "sent" | "simulated" | "error";

const SENT_CONTENT = VOICE_TALK_MOCK_CONTENT;

const STATUS_HINT: Record<Status, string> = {
  idle: "按住说话",
  recording: "松开发送",
  sending: "发送中…",
  sent: `已发送「${SENT_CONTENT}」`,
  simulated: `已发送「${SENT_CONTENT}」（模拟 — 暂无活跃会话）`,
  error: "发送失败 — 请检查网络后重试",
};

/** One-shot reduce-motion check (no listener needed for a short sheet). */
function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // Default to animating on failure.
      });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}

/** Resting heights, staggered so the bars don't pulse in lockstep. */
const BAR_CONFIG = [0.3, 0.7, 1, 0.55, 0.4];

/** One equalizer bar — scales on its own shared value so the row reads as
 *  a live waveform. scaleY-only → no layout thrash. */
function WaveformBar({
  index,
  reduceMotion,
}: {
  index: number;
  reduceMotion: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const base = BAR_CONFIG[index];
  const scale = useSharedValue(base);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = base;
      return;
    }
    const peak = Math.min(1, base + 0.45);
    scale.value = withRepeat(
      withSequence(
        withDelay(
          index * 90,
          withTiming(peak, {
            duration: 360 + index * 70,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        withTiming(base, {
          duration: 360 + index * 70,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(scale);
      scale.value = base;
    };
  }, [base, index, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 30,
          borderRadius: 2,
          backgroundColor: t.foreground,
          opacity: 0.85,
        },
        style,
      ]}
    />
  );
}

/** Equalizer-style bars that pulse while recording. Static while reduced
 *  motion is on. */
function RecordingWaveform() {
  const reduceMotion = useReducedMotion();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {BAR_CONFIG.map((_, i) => (
        <WaveformBar key={i} index={i} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

export default function VoiceTalkRoute() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const qc = useQueryClient();
  const activeSessionId = useChatSessionPickerStore((s) => s.activeSessionId);

  const [status, setStatusState] = useState<Status>("idle");
  const statusRef = useRef<Status>("idle");
  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const handleRelease = useCallback(async () => {
    if (statusRef.current !== "recording") return;
    setStatus("sending");
    const sessionId = activeSessionId;
    if (!sessionId) {
      // No active chat session (chat tab never opened / no history) —
      // simulate success with a UI-only confirmation.
      setStatus("simulated");
      return;
    }

    // 与 use-send-voice-message.ts 同一条乐观发送管线：seed messages →
    // seed pendingTask → POST → patch 真实 id → seed accepted pending task。
    const sentAt = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      chat_session_id: sessionId,
      role: "user",
      content: SENT_CONTENT,
      task_id: null,
      created_at: sentAt,
    };
    const optimisticTaskId = `optimistic-${optimistic.id}`;
    qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
      old ? [...old, optimistic] : [optimistic],
    );
    qc.setQueryData<ChatPendingTask>(
      chatKeys.pendingTask(sessionId),
      (old) =>
        enqueuePendingChatTask(
          old,
          {
            task_id: optimisticTaskId,
            status: "queued",
            created_at: sentAt,
            message_id: optimistic.id,
            content: SENT_CONTENT,
          },
          Boolean(old?.task_id),
        ),
    );

    try {
      const result = await api.sendChatMessage(sessionId, SENT_CONTENT);
      qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
        old?.map((message) =>
          message.id === optimistic.id
            ? {
                ...message,
                id: result.message_id,
                task_id: result.task_id,
                created_at: result.created_at,
              }
            : message,
        ),
      );
      seedAcceptedPendingTask(qc, {
        chat_session_id: sessionId,
        task_id: result.task_id,
        created_at: result.created_at,
        message_id: result.message_id,
        content: SENT_CONTENT,
        optimistic_task_id: optimisticTaskId,
        supports_queue: result.supports_queue,
        queued: result.queued,
      });
      qc.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
      setStatus("sent");
    } catch {
      qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
        old ? old.filter((m) => m.id !== optimistic.id) : old,
      );
      qc.setQueryData<ChatPendingTask>(
        chatKeys.pendingTask(sessionId),
        (old) => removePendingChatTask(old, optimisticTaskId),
      );
      setStatus("error");
    }
  }, [activeSessionId, qc, setStatus]);

  const holdGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          if (statusRef.current === "sending") return;
          setStatus("recording");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        })
        .onFinalize(() => {
          if (statusRef.current === "recording") void handleRelease();
        }),
    [handleRelease, setStatus],
  );

  const recording = status === "recording";
  const reduceMotion = useReducedMotion();

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-3">
        <Text className="text-base font-semibold text-foreground">
          发语音
        </Text>
      </View>
      <VoicePrototypeBanner />

      <View className="flex-1 items-center justify-center px-8 pb-24">
        <GestureDetector gesture={holdGesture}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={recording ? "录音中，松开发送" : "按住说话"}
            accessibilityHint={
              recording
                ? `松开后发送「${SENT_CONTENT}」到当前会话`
                : `按住后松开，发送「${SENT_CONTENT}」到当前会话`
            }
            style={{
              height: 144,
              width: 144,
              borderRadius: 72,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: recording ? t.secondary : t.muted,
              borderWidth: 1,
              borderColor: recording ? t.brand : t.border,
            }}
          >
            {recording ? (
              <>
                <Image
                  source="sf:mic.fill"
                  tintColor={t.brand}
                  style={{ width: 26, height: 26, marginBottom: 10 }}
                />
                <RecordingWaveform />
              </>
            ) : (
              <Image
                source={
                  status === "sent" || status === "simulated"
                    ? "sf:checkmark.circle.fill"
                    : status === "error"
                      ? "sf:exclamationmark.triangle.fill"
                      : "sf:mic.fill"
                }
                tintColor={
                  status === "sent" || status === "simulated"
                    ? t.success
                    : status === "error"
                      ? t.destructive
                      : t.foreground
                }
                style={{ width: 40, height: 40 }}
              />
            )}
          </View>
        </GestureDetector>

        <View className="mt-6 flex-row items-center gap-2">
          {recording ? (
            reduceMotion ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.brand,
                }}
              />
            ) : (
              <PulseDot size={8} />
            )
          ) : null}
          <Text
            className={
              recording
                ? "text-sm font-medium text-brand"
                : "text-sm text-muted-foreground"
            }
          >
            {STATUS_HINT[status]}
          </Text>
        </View>

        {status === "sent" || status === "simulated" ? (
          <Text className="mt-2 text-xs text-muted-foreground">
            下拉关闭，再次按住可重发。
          </Text>
        ) : null}
      </View>
    </View>
  );
}
