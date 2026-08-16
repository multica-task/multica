/**
 * Stub route. The "●" central button in (tabs)/_layout.tsx intercepts
 * tabPress and `preventDefault()`s — the tab is a tab-as-action, never a
 * navigation target — so this screen is not rendered through normal use.
 * expo-router still requires a file to exist at this path to register the
 * Tabs.Screen entry.
 *
 * PRD §3.1: keep a Redirect here as the deep-link fallback. If a deep link
 * or stale tab state lands the user on /voice, bounce to the home tab
 * (inbox) so they don't see a blank screen. The actual recording /
 * translation / hold-to-talk interactions land in COD-35 (M1-7).
 */
import { Redirect } from "expo-router";
import { useWorkspaceStore } from "@/data/workspace-store";

export default function VoiceStub() {
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  return <Redirect href={slug ? `/${slug}/inbox` : "/select-workspace"} />;
}
