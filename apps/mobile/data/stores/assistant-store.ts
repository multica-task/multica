/**
 * 秘书设置 store（PRD §8.4 / §10.5）—— 默认数字员工 + 语音偏好。
 *
 * 持久化（SecureStore）：
 *   - 默认数字员工：key `utter_default_agent_id`，值为 `{ [wsId]: agentId }`
 *     JSON 映射（PRD §6.4：按 workspace 分别存）。`null` / 缺 key = 未设置。
 *   - 语音偏好：key `utter_voice_prefs`（长按阈值 / 自动跳转 / 语音入口默认项）。
 *
 * 读写都是异步（SecureStore），store 里维护内存镜像；`hydrate()` 在 app 启动
 * 时调用一次（`app/_layout.tsx`），此后 `getState()` 同步可用。写失败静默
 * （偏好丢失可接受，不阻塞主链路）。
 *
 * 回退链（PRD §6.4）不在本 store —— 那是「已存的值 + 员工列表」的纯函数
 * 解析，见 `lib/default-agent.ts`。
 */
import { useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const DEFAULT_AGENT_KEY = "utter_default_agent_id";
const VOICE_PREFS_KEY = "utter_voice_prefs";

export type VoiceDefaultEntry = "record" | "translate" | "voice";

export interface VoicePrefs {
  /** 长按录音时长阈值（秒）：1 | 2 | 3，默认 2（PRD §8.4）。 */
  holdThresholdSeconds: number;
  /** 松手后自动跳工作台，默认开。 */
  autoJumpWorkbench: boolean;
  /** 语音入口默认项，影响 Sheet 高亮，默认「录音」。 */
  voiceDefaultEntry: VoiceDefaultEntry;
}

const DEFAULT_VOICE_PREFS: VoicePrefs = {
  holdThresholdSeconds: 2,
  autoJumpWorkbench: true,
  voiceDefaultEntry: "record",
};

interface AssistantState {
  /** wsId → agentId；`null` 或缺失 = 未设置。 */
  defaultAgentIds: Record<string, string | null>;
  voicePrefs: VoicePrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** 设置 / 清除某工作区默认员工。 */
  setDefaultAgent: (wsId: string, agentId: string | null) => Promise<void>;
  setHoldThreshold: (seconds: number) => Promise<void>;
  setAutoJumpWorkbench: (enabled: boolean) => Promise<void>;
  setVoiceDefaultEntry: (entry: VoiceDefaultEntry) => Promise<void>;
  reset: () => void;
}

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

async function loadDefaults(): Promise<Record<string, string | null>> {
  try {
    const raw = await SecureStore.getItemAsync(DEFAULT_AGENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [
        k,
        typeof v === "string" ? v : null,
      ]),
    );
  } catch {
    return {};
  }
}

async function loadVoicePrefs(): Promise<VoicePrefs> {
  try {
    const raw = await SecureStore.getItemAsync(VOICE_PREFS_KEY);
    return readJson<VoicePrefs>(raw, DEFAULT_VOICE_PREFS);
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

async function persistDefaults(map: Record<string, string | null>): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEFAULT_AGENT_KEY, JSON.stringify(map));
  } catch {
    // 写失败静默 —— 偏好丢失可接受。
  }
}

async function persistVoicePrefs(prefs: VoicePrefs): Promise<void> {
  try {
    await SecureStore.setItemAsync(VOICE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 静默。
  }
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  defaultAgentIds: {},
  voicePrefs: DEFAULT_VOICE_PREFS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const [defaultAgentIds, voicePrefs] = await Promise.all([
      loadDefaults(),
      loadVoicePrefs(),
    ]);
    set({ defaultAgentIds, voicePrefs, hydrated: true });
  },

  setDefaultAgent: async (wsId, agentId) => {
    const next = { ...get().defaultAgentIds, [wsId]: agentId };
    set({ defaultAgentIds: next });
    await persistDefaults(next);
  },

  setHoldThreshold: async (seconds) => {
    const next = { ...get().voicePrefs, holdThresholdSeconds: seconds };
    set({ voicePrefs: next });
    await persistVoicePrefs(next);
  },

  setAutoJumpWorkbench: async (enabled) => {
    const next = { ...get().voicePrefs, autoJumpWorkbench: enabled };
    set({ voicePrefs: next });
    await persistVoicePrefs(next);
  },

  setVoiceDefaultEntry: async (entry) => {
    const next = { ...get().voicePrefs, voiceDefaultEntry: entry };
    set({ voicePrefs: next });
    await persistVoicePrefs(next);
  },

  reset: () =>
    set({ defaultAgentIds: {}, voicePrefs: DEFAULT_VOICE_PREFS, hydrated: true }),
}));

/** 工作区切换时清空内存中的默认员工映射（不删除 SecureStore —— 换回同一
 *  工作区仍应保留设置）。挂载于 workspace `_layout.tsx`。
 *
 * 评审修复（HIGH-2）：原实现清空 `defaultAgentIds` 但 `hydrated` 保持 true，
 * 切回原工作区时 `hydrate()` 提前返回、不再重读 SecureStore，默认员工直到
 * 重启才恢复。现在清空后置 `hydrated: false` 并立即重新 hydrate，换回原
 * 工作区时下一轮 hydrate 从持久层恢复该工作区设置。 */
export function useAssistantStoreResetOnWorkspaceChange(wsId: string | null) {
  const prevRef = useRef(wsId);
  useEffect(() => {
    if (prevRef.current !== wsId) {
      // 仅清空内存镜像，不动持久化；随后重新 hydrate 装载新工作区设置。
      useAssistantStore.setState({ defaultAgentIds: {}, hydrated: false });
      void useAssistantStore.getState().hydrate();
      prevRef.current = wsId;
    }
  }, [wsId]);
}
