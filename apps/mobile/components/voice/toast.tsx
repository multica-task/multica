/**
 * VoiceToast — a transient bottom floating message for the voice central
 * button ("暂无可用数字员工"). Local to `components/voice/` because it has a
 * single caller (record-button); per apps/mobile/CLAUDE.md we do not add a
 * generic `components/ui/` primitive for one consumer.
 *
 * Rendered through the root `@rn-primitives/portal` host (not an RN Modal)
 * so it never blocks touches: `pointerEvents="none"` lets everything pass
 * through, and on Android a transparent Modal would consume touches even
 * with pointerEvents="none" on its content.
 */
import { View } from "react-native";
import { Portal } from "@rn-primitives/portal";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

interface Props {
  visible: boolean;
  message: string;
  onHide: () => void;
}

export function VoiceToast({ visible, message, onHide }: Props) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  if (!visible) return null;

  return (
    <Portal name="voice-toast">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 96,
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: t.foreground,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 8,
            maxWidth: "80%",
          }}
        >
          <Text
            style={{
              color: t.background,
              fontSize: 13,
              lineHeight: 18,
              textAlign: "center",
            }}
          >
            {message}
          </Text>
        </View>
      </View>
    </Portal>
  );
}
