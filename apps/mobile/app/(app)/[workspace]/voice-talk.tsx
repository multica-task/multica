/**
 * Voice → 发语音 prototype page (PRD §6.3). Presented as a formSheet by the
 * parent Stack. The long-press hold-to-talk entry point lives on the central
 * button (components/voice/record-button.tsx); this page is the prototype
 * destination for the sheet's 发语音 row. The full hold-to-talk UI lands in
 * M4; M1 only carries the prototype banner + placeholder.
 */
import { VoicePrototypeScreen } from "@/components/voice/voice-prototype-screen";

export default function VoiceTalkRoute() {
  return (
    <VoicePrototypeScreen
      title="发语音"
      description="按住说话原型开发中，M4 接入"
    />
  );
}
