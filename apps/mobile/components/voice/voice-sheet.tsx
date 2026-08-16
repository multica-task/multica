/**
 * VoiceSheet — the three-way menu opened by a short press (< long-press
 * threshold) on the central voice button (PRD §6.1).
 *
 *   - 录音   → push `/{slug}/voice-record`     (prototype, gray 原型 badge)
 *   - 翻译   → push `/{slug}/voice-translate`  (prototype, gray 原型 badge)
 *   - 发语音 → push `/{slug}/voice-talk`       (really sends — no badge)
 *
 * Short fixed action menu → `Modal transparent` + bottom card, the same
 * container the rest of the app uses for < 5 actions without a keyboard
 * (see components/chat/agent-picker-sheet.tsx).
 */
import { Modal, Pressable, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { PrototypeBadge } from "@/components/voice/prototype-badge";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useColorScheme } from "@/lib/use-color-scheme";
import { THEME } from "@/lib/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface VoiceSheetItem {
  label: string;
  /** SF Symbol name, rendered via expo-image `source: "sf:<name>"`. */
  icon: string;
  /** Path under /:slug/ — final href is `/${slug}${path}`. */
  path: string;
  /** 录音 / 翻译 are prototypes and carry the gray badge; 发语音 doesn't. */
  prototype?: boolean;
}

const SHEET_ITEMS: VoiceSheetItem[] = [
  { label: "录音", icon: "record.circle", path: "/voice-record", prototype: true },
  { label: "翻译", icon: "character.bubble", path: "/voice-translate", prototype: true },
  { label: "发语音", icon: "waveform.and.mic", path: "/voice-talk" },
];

export function VoiceSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        {/* useSafeAreaInsets can read 0 inside a transparent Modal
            (apps/mobile/CLAUDE.md Lesson 5); floor it so the bottom row
            never collides with the Home Indicator. */}
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="flex-1 justify-end px-3"
        >
          <Pressable onPress={() => {}}>
            <View
              style={{ backgroundColor: t.background }}
              className="rounded-2xl overflow-hidden"
            >
              {SHEET_ITEMS.map((item, index) => (
                <View key={item.path}>
                  {index > 0 ? (
                    <View style={{ backgroundColor: t.border, height: 0.5 }} />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => {
                      onClose();
                      if (slug) router.push(`/${slug}${item.path}`);
                    }}
                    className="flex-row items-center gap-3 px-4 py-4 active:bg-secondary"
                  >
                    <ExpoImage
                      source={`sf:${item.icon}`}
                      tintColor={t.foreground}
                      style={{ width: 20, height: 20 }}
                    />
                    <Text className="text-base text-foreground">{item.label}</Text>
                    {item.prototype ? (
                      <View className="ml-auto">
                        <PrototypeBadge />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              ))}
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消"
            onPress={onClose}
            className="mt-3"
          >
            <View
              style={{ backgroundColor: t.background }}
              className="rounded-2xl py-4 items-center"
            >
              <Text className="text-base text-foreground">取消</Text>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
