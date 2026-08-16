/**
 * 看板 (board) placeholder tab — M1-2 (COD-30) migration.
 *
 * M1-3 (COD-31) retitled the old `my-issues` tab to 看板 as a stand-in
 * until the real board lands in M3. When my-issues moved out of the tab
 * bar (M1-2), that tab disappeared entirely — so this placeholder keeps
 * the 5-tab bottom bar (PRD §3.1「2+1+2」/ §13.1「底栏 5 项」) intact:
 * 首页 · 看板(占位) · ●录音 · 工作台 · 我的.
 *
 * The full kanban board ships in M3; until then this screen just marks
 * the slot. Deep links to a not-yet-existing board route bounce here too.
 */
import { Redirect } from "expo-router";
import { View } from "react-native";
import { useWorkspaceStore } from "@/data/workspace-store";
import { Text } from "@/components/ui/text";

export default function BoardPlaceholder() {
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);

  // Board is a pure placeholder in M1 — no real route target exists yet.
  // Keep the tab pressable so the 5-tab IA reads correctly, but if a deep
  // link ever lands here with no workspace, bounce to select-workspace.
  if (!slug) {
    return <Redirect href="/select-workspace" />;
  }

  return (
    <View className="flex-1 items-center justify-center gap-2 px-6 bg-background">
      <Text className="text-base font-semibold text-foreground">看板</Text>
      <Text className="text-sm text-muted-foreground text-center">
        看板视图将在 M3 上线，敬请期待
      </Text>
    </View>
  );
}
