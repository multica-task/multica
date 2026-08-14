/**
 * 首页本地视图状态（PRD §4.4 交互 + §10.5）：
 *   - 报告卡周期 day / week / month — **内存态**，切换工作区清空。
 *
 * 不持久化（切工作区清空是产品要求：周期选择是「当下想看什么」，不跨
 * 工作区记忆）。重置挂载在 `app/(app)/[workspace]/_layout.tsx`。
 */
import { useEffect, useRef } from "react";
import { create } from "zustand";
import type { ReportPeriod } from "@/lib/report-stats";

interface HomeViewState {
  reportPeriod: ReportPeriod;
  setReportPeriod: (period: ReportPeriod) => void;
  reset: () => void;
}

const INITIAL = {
  reportPeriod: "day" as ReportPeriod,
} as const;

export const useHomeViewStore = create<HomeViewState>((set) => ({
  ...INITIAL,
  setReportPeriod: (period) => set({ reportPeriod: period }),
  reset: () => set({ ...INITIAL }),
}));

/** 工作区切换时清空首页视图状态。挂载一次于 workspace `_layout.tsx`。 */
export function useHomeViewResetOnWorkspaceChange(wsId: string | null) {
  const prevRef = useRef(wsId);
  useEffect(() => {
    if (prevRef.current !== wsId) {
      useHomeViewStore.getState().reset();
      prevRef.current = wsId;
    }
  }, [wsId]);
}
