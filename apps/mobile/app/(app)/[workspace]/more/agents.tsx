/**
 * M4-11：`more/agents` 占位删除 → 重定向到 `/staff`。
 *
 * PRD §14.2#7 决策：`more/agents.tsx` 占位（"Agents coming soon."）删除，
 * `/{slug}/more/agents` 重定向到 `/{slug}/staff`（数字员工名册，M4-5）。
 * 我的页「数字员工」行与 NoAgentBanner 已改指 `/staff`；此路由仅兜底旧的
 * deep link / 缓存跳转。
 */
import { Redirect } from "expo-router";
import { useWorkspaceStore } from "@/data/workspace-store";

export default function MoreAgentsRedirect() {
  const slug = useWorkspaceStore((s) => s.currentWorkspaceSlug);
  return <Redirect href={slug ? `/${slug}/staff` : "/select-workspace"} />;
}
