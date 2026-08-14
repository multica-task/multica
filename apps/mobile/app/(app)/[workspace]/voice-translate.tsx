/**
 * Voice → 翻译 prototype page (PRD §6.3). Presented as a formSheet by the
 * parent Stack. The full mock translation UI lands in M4; M1 only carries the
 * prototype banner + placeholder so the central-button sheet has a live
 * target and every recording-related screen shows the prototype marker.
 */
import { VoicePrototypeScreen } from "@/components/voice/voice-prototype-screen";

export default function VoiceTranslateRoute() {
  return (
    <VoicePrototypeScreen
      title="翻译"
      description="语音翻译原型开发中，M4 接入"
    />
  );
}
