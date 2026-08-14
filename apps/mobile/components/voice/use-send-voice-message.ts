/**
 * useSendVoiceMessage — the long-press send path for the central voice
 * button.
 *
 * Responsibilities:
 *   - Resolve the target employee via the fallback chain (see
 *     `lib/voice-target.ts`). M1 has no user-set default agent (that
 *     setting lands in M2) so this is "first available employee".
 *   - Send the prototype placeholder text to that employee's chat session,
 *     creating the session when it doesn't exist yet, through the exact
 *     optimistic pipeline the chat composer uses (seed messages → seed
 *     pendingTask → POST → patch real ids → seed accepted pending task).
 *
 * Explicitly does NOT navigate — switching to the workbench / focusing the
 * target session is the record button's job (it pushes `/{slug}/workbench`;
 * chat 已随 M4 重命名为 workbench，COD-41 调用点全量更新）。
 */
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, ChatMessage, ChatPendingTask } from "@multica/core/types";
import {
  enqueuePendingChatTask,
  removePendingChatTask,
} from "@multica/core/chat/pending";
import { api } from "@/data/api";
import { useAuthStore } from "@/data/auth-store";
import { useWorkspaceStore } from "@/data/workspace-store";
import { agentListOptions } from "@/data/queries/agents";
import { memberListOptions } from "@/data/queries/members";
import { chatKeys, chatSessionsOptions } from "@/data/queries/chat";
import { useCreateChatSession } from "@/data/mutations/chat";
import { useAssistantStore } from "@/data/stores/assistant-store";
import { useChatSessionPickerStore } from "@/data/stores/chat-session-picker-store";
import { seedAcceptedPendingTask } from "@/data/realtime/chat-ws-updaters";
import { pickVoiceTarget } from "@/lib/voice-target";

/**
 * The readable placeholder the central button sends until real recording /
 * ASR lands (PRD §6.2) — avoids a stray "你好" appearing in real sessions.
 */
export const VOICE_PLACEHOLDER_CONTENT = "（语音原型）请稍后补充需求描述";

export interface UseSendVoiceMessage {
  /** The employee a release will message, or null when none is available. */
  targetAgent: Agent | null;
  /**
   * False while the agent / session / member queries are still loading, so
   * callers don't misreport "暂无可用数字员工" before the data has arrived.
   */
  ready: boolean;
  /**
   * Sends the placeholder to the target employee's session (creating it if
   * needed). Resolves `true` on success, `false` when there is no target.
   * Never navigates.
   */
  send: () => Promise<boolean>;
}

export function useSendVoiceMessage(): UseSendVoiceMessage {
  const qc = useQueryClient();
  const wsId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // M2 默认数字员工（PRD §6.4）：SecureStore 按 wsId 存映射，app 启动时
  // hydrate。未 hydrate / 未设置时 `?? null` → 回退链取第一个可用员工。
  const defaultAgentId = useAssistantStore(
    (s) => (wsId ? (s.defaultAgentIds[wsId] ?? null) : null),
  );

  const { data: agents = [], isFetched: agentsFetched } = useQuery(
    agentListOptions(wsId),
  );
  const { data: sessions = [], isFetched: sessionsFetched } = useQuery(
    chatSessionsOptions(wsId),
  );
  const { data: members, isFetched: membersFetched } = useQuery(
    memberListOptions(wsId),
  );
  const memberRole = members?.find((m) => m.user_id === userId)?.role;

  const createSession = useCreateChatSession();

  const ready = agentsFetched && sessionsFetched && membersFetched;

  const targetAgent = useMemo(
    () =>
      pickVoiceTarget({
        agents,
        sessions,
        userId,
        memberRole,
        defaultAgentId,
      }).agent,
    [agents, sessions, userId, memberRole, defaultAgentId],
  );

  const send = useCallback(async (): Promise<boolean> => {
    const target = pickVoiceTarget({
      agents,
      sessions,
      userId,
      memberRole,
      defaultAgentId,
    });
    if (!target.agent) return false;

    // Reuse an existing non-archived session for the target employee, or
    // create one (same title-seed rule as the chat composer). Creating
    // awaits the server before we send so the optimistic burst renders
    // into a session that actually exists.
    let sessionId = target.sessionId;
    if (!sessionId) {
      const session = await createSession.mutateAsync({
        agent_id: target.agent.id,
        title: VOICE_PLACEHOLDER_CONTENT.slice(0, 50),
      });
      sessionId = session.id;
    }

    const content = VOICE_PLACEHOLDER_CONTENT;
    const sentAt = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      chat_session_id: sessionId,
      role: "user",
      content,
      task_id: null,
      created_at: sentAt,
    };
    const optimisticTaskId = `optimistic-${optimistic.id}`;

    qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
      old ? [...old, optimistic] : [optimistic],
    );
    qc.setQueryData<ChatPendingTask>(
      chatKeys.pendingTask(sessionId),
      (old) =>
        enqueuePendingChatTask(
          old,
          {
            task_id: optimisticTaskId,
            status: "queued",
            created_at: sentAt,
            message_id: optimistic.id,
            content,
          },
          Boolean(old?.task_id),
        ),
    );

    try {
      const result = await api.sendChatMessage(sessionId, content);
      qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
        old?.map((message) =>
          message.id === optimistic.id
            ? {
                ...message,
                id: result.message_id,
                task_id: result.task_id,
                created_at: result.created_at,
              }
            : message,
        ),
      );
      seedAcceptedPendingTask(qc, {
        chat_session_id: sessionId,
        task_id: result.task_id,
        created_at: result.created_at,
        message_id: result.message_id,
        content,
        optimistic_task_id: optimisticTaskId,
        supports_queue: result.supports_queue,
        queued: result.queued,
      });
      qc.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
      // One-shot session-focus request the chat tab consumes on its next
      // effect run (chat.tsx), so when the record button navigates to the
      // chat tab the freshly-sent session is the one on screen. Not
      // navigation itself — the tab switch stays in record-button.tsx.
      useChatSessionPickerStore.getState().requestSelect(sessionId);
      return true;
    } catch (err) {
      qc.setQueryData<ChatMessage[]>(chatKeys.messages(sessionId), (old) =>
        old ? old.filter((m) => m.id !== optimistic.id) : old,
      );
      qc.setQueryData<ChatPendingTask>(
        chatKeys.pendingTask(sessionId),
        (old) => removePendingChatTask(old, optimisticTaskId),
      );
      throw err;
    }
  }, [agents, sessions, userId, memberRole, defaultAgentId, qc, createSession]);

  return { targetAgent, ready, send };
}
