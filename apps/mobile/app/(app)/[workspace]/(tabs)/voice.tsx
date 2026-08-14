/**
 * Stub route for the "●" central voice button in (tabs)/_layout.tsx. The
 * tab is a tab-as-action: its `tabBarButton` is the RecordButton, which
 * handles every press itself (short press → sheet, long press → record) and
 * never navigates here. expo-router still requires a file to exist at this
 * path to register the Tabs.Screen entry.
 *
 * If a deep link or stale tab state lands the user on /voice, bounce to the
 * home tab (inbox) so they don't see a blank screen (PRD §3.1 / §6.5).
 */
import { Redirect } from "expo-router";
import { useWorkspaceStore } from "@/data/workspace-store";

export default function VoiceStub() {
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  return <Redirect href={slug ? `/${slug}/inbox` : "/select-workspace"} />;
}
