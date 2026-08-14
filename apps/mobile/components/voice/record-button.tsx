/**
 * RecordButton — the "central voice button" in the bottom tab bar (PRD §6).
 * Used as the voice tab's `tabBarButton`: it never navigates on its own tap;
 * instead it runs the interaction state machine:
 *
 *   pressIn
 *     ├─ scale 1 → 0.92 (120ms)
 *     ├─ start `longPressMs` timer
 *     └─ if already recording/sending: ignore this press
 *
 *   release < longPressMs ──▶ open VoiceSheet (录音 / 翻译 / 发语音)
 *
 *   timer fires ──▶ Haptics.medium + recording = true
 *                   + mic icon → 4-bar EQ animation
 *                   + full-screen RecordingOverlay (「将发送给 · {员工}」top
 *                     banner + timer + concentric ripples)
 *
 *   release while recording ──▶ Haptics.success
 *                   + send 「（语音原型）请稍后补充需求描述」 to the target
 *                     employee (fallback chain first available, M2 will add
 *                     the user-set default) via useSendVoiceMessage
 *                   + on success navigate to the chat tab — this is the
 *                     `/chat` navigation that M4 renames to `/workbench`,
 *                     left untouched here per COD-35 scope
 *                   + no available employee → Toast 「暂无可用数字员工」
 *
 * Visual: 54×54, radius 18, brand gradient (base = THEME.brand token,
 * PRD §6.1), white SF Symbol mic glyph, brand-colored shadow. Gradient
 * stops live in lib/voice-gradient.ts (§9.1 — no bare hex in components).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
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
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import { VOICE_GRADIENT_STOPS } from "@/lib/voice-gradient";
import { useSendVoiceMessage } from "./use-send-voice-message";
import { VoiceSheet } from "./voice-sheet";
import { RecordingOverlay } from "./recording-overlay";
import { VoiceToast } from "./toast";

/** Long-press threshold; override per screen for prototype testing (1/2/3s). */
export const DEFAULT_LONG_PRESS_MS = 2000;

export interface RecordButtonProps {
  /** Hold duration before recording starts. Defaults to 2000ms. */
  longPressMs?: number;
  /**
   * Whether the voice tab is the focused tab. Wired from react-navigation's
   * tabBarButton props so screen readers announce the selected state.
   */
  focused?: boolean;
}

const BTN_SIZE = 54;
const BTN_RADIUS = 18;

// Gradient stops live in lib/voice-gradient.ts — base stop = THEME.brand,
// the two lighter stops are brand-light extensions (PRD §6.1, §9.1).
const GRADIENT_STOPS = VOICE_GRADIENT_STOPS;

/** Resting scale of the 4 EQ bars; staggered so they don't pulse in lockstep. */
const EQ_BARS = [0.33, 0.55, 1, 0.7];

type Phase = "idle" | "pressing" | "recording" | "sending";

function EqBar({ index }: { index: number }) {
  const scale = useSharedValue(EQ_BARS[index]);

  useEffect(() => {
    const peak = Math.min(1, EQ_BARS[index] + 0.45);
    scale.value = withRepeat(
      withSequence(
        withDelay(
          index * 150,
          withTiming(peak, {
            duration: 450,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        withTiming(EQ_BARS[index], {
          duration: 450,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
    );
    return () => cancelAnimation(scale);
  }, [index, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: 16,
          borderRadius: 1.5,
          backgroundColor: THEME.light.brandForeground,
          opacity: 0.9,
        },
        style,
      ]}
    />
  );
}

function EqBars() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      {EQ_BARS.map((_, i) => (
        <EqBar key={i} index={i} />
      ))}
    </View>
  );
}

export function RecordButton({
  longPressMs = DEFAULT_LONG_PRESS_MS,
  focused = false,
}: RecordButtonProps) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);

  const { targetAgent, ready, send } = useSendVoiceMessage();

  const [phase, setPhase] = useState<Phase>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2400);
  }, []);

  // Cleanup timers on unmount (tab switch / workspace switch mid-press).
  useEffect(
    () => () => {
      clearPressTimer();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [clearPressTimer],
  );

  const navigateToChatTab = useCallback(() => {
    // Long-press release lands the user on the chat tab so they see the
    // message they just sent. M4 renames this path `/chat` → `/workbench`
    // (PRD §6.1); COD-35 deliberately does NOT touch this navigation.
    if (slug) router.push(`/${slug}/chat`);
  }, [slug]);

  const handleRecordingRelease = useCallback(async () => {
    setPhaseSafe("sending");
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    try {
      const sent = await send();
      if (sent) {
        navigateToChatTab();
      } else if (!ready) {
        // Target data still loading — never misreport a "no employee" that
        // is just a slow fetch.
        showToast("正在加载数字员工，请稍后再试");
      } else {
        // No available employee — Toast (PRD §6.2); the chat tab itself
        // shows the no-agent banner if the user heads there manually.
        showToast("暂无可用数字员工");
      }
    } catch {
      showToast("发送失败，请检查网络后重试");
    } finally {
      // This is the ONLY owner of the "sending" → "idle" transition; the
      // gesture's onFinalize must not reset it while the await is in flight.
      setPhaseSafe("idle");
    }
  }, [send, navigateToChatTab, setPhaseSafe, showToast, ready]);

  const openVoiceSheet = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setPhaseSafe("idle");
    setSheetOpen(true);
  }, [setPhaseSafe]);

  const holdGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          if (phaseRef.current !== "idle") return;
          setPhaseSafe("pressing");
          scale.value = withTiming(0.92, { duration: 120 });
          pressTimerRef.current = setTimeout(() => {
            if (phaseRef.current !== "pressing") return;
            setPhaseSafe("recording");
            setRecordingStartedAt(Date.now());
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
          }, longPressMs);
        })
        .onEnd((_event, success) => {
          // onEnd fires only on a real finger lift (never on a cancellation),
          // so a system interruption (app backgrounded, Control Center pull,
          // a competing gesture winning) can't fire the send accidentally.
          if (!success) return;
          clearPressTimer();
          scale.value = withTiming(1, { duration: 120 });
          if (phaseRef.current === "recording") {
            void handleRecordingRelease();
          } else if (phaseRef.current === "pressing") {
            // Short press — open the three-way voice sheet.
            setPhaseSafe("idle");
            setSheetOpen(true);
          }
        })
        .onFinalize(() => {
          // Cleanup only. A cancellation leaves the phase "pressing" /
          // "recording" — reset without sending. "sending" is owned by
          // handleRecordingRelease's finally, never touch it here.
          clearPressTimer();
          scale.value = withTiming(1, { duration: 120 });
          if (
            phaseRef.current === "pressing" ||
            phaseRef.current === "recording"
          ) {
            setPhaseSafe("idle");
          }
        }),
    [
      clearPressTimer,
      handleRecordingRelease,
      longPressMs,
      scale,
      setPhaseSafe,
    ],
  );

  const recording = phase === "recording";
  const overlayTargetName = targetAgent?.name ?? null;

  return (
    <>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <GestureDetector gesture={holdGesture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="录音"
            accessibilityState={{ selected: focused }}
            accessibilityHint={
              recording
                ? "录音中，松手发送"
                : "短按打开录音选项，长按开始录音"
            }
            onPress={openVoiceSheet}
          >
            <Animated.View style={scaleStyle}>
              <View
                style={{
                  width: BTN_SIZE,
                  height: BTN_SIZE,
                  borderRadius: BTN_RADIUS,
                  shadowColor: t.brand,
                  shadowOpacity: 0.45,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 6,
                }}
              >
                <Svg width={BTN_SIZE} height={BTN_SIZE}>
                  <Defs>
                    <LinearGradient id="voiceBtnGrad" x1="0" y1="0" x2="1" y2="1">
                      {GRADIENT_STOPS.map((stop) => (
                        <Stop
                          key={stop.offset}
                          offset={stop.offset}
                          stopColor={stop.color}
                        />
                      ))}
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x={0}
                    y={0}
                    width={BTN_SIZE}
                    height={BTN_SIZE}
                    rx={BTN_RADIUS}
                    fill="url(#voiceBtnGrad)"
                  />
                </Svg>
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {recording ? (
                    <EqBars />
                  ) : (
                    <ExpoImage
                      source="sf:mic.fill"
                      tintColor={THEME.light.brandForeground}
                      style={{ width: 22, height: 22 }}
                    />
                  )}
                </View>
              </View>
            </Animated.View>
          </Pressable>
        </GestureDetector>
      </View>

      <VoiceSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      <RecordingOverlay
        visible={recording}
        targetAgentName={overlayTargetName}
        showNoTarget={ready && !targetAgent}
        startedAt={recordingStartedAt}
      />
      <VoiceToast
        visible={toastMessage !== null}
        message={toastMessage ?? ""}
        onHide={() => setToastMessage(null)}
      />
    </>
  );
}
