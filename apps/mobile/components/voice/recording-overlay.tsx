/**
 * RecordingOverlay — the full-screen overlay shown while the central voice
 * button is held past the long-press threshold (PRD §6.1).
 *
 * Layout:
 *   - Top: 「将发送给 · {targetAgentName}」— the user sees where the release
 *     will land before they lift their finger (PRD §6.4). When there is no
 *     available employee it reads 「暂无可用数字员工」 and the release shows a
 *     Toast instead of sending.
 *   - Center: recording timer (MM:SS, HH:MM:SS once ≥ 1h — PRD §6.3 Dock
 *     timing) with a fixed-width mono-ish layout so it doesn't jitter.
 *   - Bottom-center, above the button: 3 concentric ripples (1600ms period,
 *     400ms stagger, scale 0.7→1.4, opacity 1→0).
 *
 * Rendered through the root `@rn-primitives/portal` host (not a native
 * `Modal`) so the user's touch stays on the button: a Modal's separate
 * window would cancel the active gesture the moment it appears mid-hold.
 * `pointerEvents="none"` keeps every touch flowing to the tab bar below.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Portal } from "@rn-primitives/portal";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";
import {
  RECORDING_CAPSULE,
  RECORDING_SCRIM,
} from "@/lib/voice-gradient";

interface Props {
  visible: boolean;
  /** Target employee name for the top banner; rendered as 「将发送给 · {name}」. */
  targetAgentName: string | null;
  /**
   * True when the target data has loaded and no employee is available →
   * the banner reads 「暂无可用数字员工」. While still loading both are off.
   */
  showNoTarget: boolean;
  /** Epoch ms when the recording started — drives the timer. */
  startedAt: number;
}

const RIPPLE_COUNT = 3;
const RIPPLE_PERIOD_MS = 1600;
const RIPPLE_STAGGER_MS = 400;
const RIPPLE_SIZE = 120;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours >= 1
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** One expanding ring — pure display, no pointer capture. */
function Ripple({
  index,
  color,
}: {
  index: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withDelay(
        index * RIPPLE_STAGGER_MS,
        withTiming(1, { duration: RIPPLE_PERIOD_MS, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + progress.value * 0.7 }],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: RIPPLE_SIZE,
          height: RIPPLE_SIZE,
          borderRadius: RIPPLE_SIZE / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export function RecordingOverlay({
  visible,
  targetAgentName,
  showNoTarget,
  startedAt,
}: Props) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const header = targetAgentName
    ? `将发送给 · ${targetAgentName}`
    : showNoTarget
      ? "暂无可用数字员工"
      : null;

  return (
    <Portal name="voice-recording-overlay">
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: RECORDING_SCRIM,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Top banner — the target the user is about to message. Rendered
            only once the target data is known (loading → nothing). */}
        {header ? (
          <View
            style={{
              position: "absolute",
              top: 96,
              alignSelf: "center",
              backgroundColor: RECORDING_CAPSULE,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                color: THEME.light.brandForeground,
                fontSize: 14,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {header}
            </Text>
          </View>
        ) : null}

        {/* Recording timer. */}
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            marginTop: 8,
          }}
        >
          <Text
            style={{
              color: t.foreground,
              fontSize: 40,
              fontWeight: "300",
              fontVariant: ["tabular-nums"],
              letterSpacing: 1,
            }}
          >
            {formatElapsed(Math.max(0, now - startedAt))}
          </Text>
        </View>

        {/* Concentric ripples anchored where the finger is holding. */}
        <View
          style={{
            position: "absolute",
            bottom: 140,
            alignSelf: "center",
            width: RIPPLE_SIZE,
            height: RIPPLE_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
            <Ripple key={i} index={i} color={t.brand} />
          ))}
        </View>
      </View>
    </Portal>
  );
}
