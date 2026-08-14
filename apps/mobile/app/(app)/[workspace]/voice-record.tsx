/**
 * Voice → 录音 prototype page (PRD §6.3). Presented as a formSheet by the
 * parent Stack. The full mock transcript UI lands in M4; M1 only carries the
 * prototype banner + placeholder so the central-button sheet has a live
 * target and every recording-related screen shows the prototype marker.
 */
import { VoicePrototypeScreen } from "@/components/voice/voice-prototype-screen";

export default function VoiceRecordRoute() {
  return (
    <VoicePrototypeScreen
      title="录音"
      description="录音转写原型开发中，M4 接入"
    />
  );
}
