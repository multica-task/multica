/**
 * `staff-picker` formSheet route — pick a digital employee (agent). Dual
 * intent via `?intent=`, both render the same agents list + native search
 * (see components/staff/staff-picker-body.tsx):
 *
 *   - `?intent=dispatch` (default): 派单 — pick who to dispatch a new issue
 *     to. On select, seeds the New Issue modal's assignee through URL params
 *     and `router.replace`s to `new-issue.tsx` (which prefills it from the
 *     params). PRD §4.3: push staff-picker → 选中员工后进入 new-issue 并预填
 *     assignee.
 *   - `?intent=default`: M2 秘书设置页选默认员工时使用. M1 only builds the
 *     route shape; on select the sheet dismisses. M2 wires SecureStore
 *     persistence (key `utter_default_agent_id`, PRD §6.4) into this branch.
 *
 * Title + search bar live in the iOS native nav header (registered in
 * `_layout.tsx` with `headerShown: true`); `useNativeSearchBar` wires the
 * UISearchController and the route overrides the title per intent.
 */
import { useLayoutEffect } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import type { Agent } from "@multica/core/types";
import { StaffPickerBody } from "@/components/staff/staff-picker-body";
import { useWorkspaceStore } from "@/data/workspace-store";
import { useNativeSearchBar } from "@/lib/use-native-search-bar";

type StaffPickerIntent = "dispatch" | "default";

export default function StaffPickerRoute() {
  const { intent: rawIntent } = useLocalSearchParams<{ intent?: string }>();
  const intent: StaffPickerIntent =
    rawIntent === "default" ? "default" : "dispatch";
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  const navigation = useNavigation();
  // Browse-first list (a workspace rarely has more than a handful of
  // employees), so the keyboard stays out of the way until the user taps
  // the search field — Apple HIG cautions against auto-keyboard for
  // browse-first pickers.
  const query = useNativeSearchBar("搜索员工");

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intent === "default" ? "选择默认员工" : "选择员工",
    });
  }, [navigation, intent]);

  const onSelect = (agent: Agent) => {
    if (intent === "dispatch") {
      if (!slug) return;
      // Hand the picked employee to the New Issue modal via URL params —
      // the draft store can't carry it across this transition because
      // new-issue.tsx resets the draft on mount. `replace` swaps the sheet
      // out so dismissing the modal lands back on the tab under it, not on
      // the picker again.
      //
      // Constraint: staff-picker must only be opened from a non-new-issue
      // surface (the planned entry points — home 派单, brief 深挖 — both
      // are). `replace` always mounts a FRESH new-issue; opening the picker
      // from inside the new-issue modal would stack a second copy and the
      // shared draft store's mount reset would clobber the first form.
      router.replace({
        pathname: "/[workspace]/new-issue",
        params: {
          workspace: slug,
          assignee_type: "agent",
          assignee_id: agent.id,
        },
      });
      return;
    }
    // intent === "default" — M1 route shape only. M2 persists the selection
    // to SecureStore (`utter_default_agent_id`) from here before dismissing.
    router.back();
  };

  return <StaffPickerBody query={query} onSelect={onSelect} />;
}
