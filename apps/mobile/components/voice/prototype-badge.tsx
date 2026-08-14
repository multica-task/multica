/**
 * PrototypeBadge — the small gray "原型" pill used wherever a screen or
 * entry point is a prototype (PRD §13.3: every recording-related screen
 * must carry a prototype marker; §6.2: the Record / Translate sheet rows
 * carry it too, while "发语音" does not because it really sends a message).
 *
 * Pure presentational, token-driven so dark mode is automatic.
 */
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { useColorScheme } from "@/lib/use-color-scheme";

export function PrototypeBadge() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  return (
    <View
      style={{
        backgroundColor: t.muted,
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          color: t.mutedForeground,
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "500",
        }}
      >
        原型
      </Text>
    </View>
  );
}
