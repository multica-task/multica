/**
 * Staff realtime — M4-9. Listing-level（工作区内常驻）。
 *
 * agent:* 事件的唯一订阅方（评审修复 MEDIUM-4：与 `usePresenceRealtime`
 * 去重 —— presence 不再订阅 agent:*，避免同一事件先 patch 后 invalidate、
 * 网络开销白付）。payload 携带完整 Agent，全部走 **patch**（≤500ms 零网络），
 * presence dot 读取的正是这份 agents 缓存。
 *
 * 订阅（PRD §7.3 实时）：
 *   - agent:status / agent:created / agent:archived / agent:restored → patch
 *   - onReconnect → invalidate agents 列表（离线期间漏掉 create/archived 的
 *     安全网）。
 *   - chat:session_updated → 未读点。该 payload 无 `has_unread` 字段（title/
 *     updated_at 之类），未读变化实际由 `chat:done` / `chat:session_read`
 *     invalidate 驱动（use-chat-sessions-realtime.ts 已处理），此处不重复。
 *
 * 事件 → 缓存的映射抽成纯函数 `staffRealtimeSubscriptions`
 * （agent-ws-updaters.ts），便于 Node-only vitest 单测覆盖。
 */
import { useQueryClient } from "@tanstack/react-query";
import { useWSSubscriptions } from "@/lib/use-ws-subscriptions";
import { staffRealtimeSubscriptions } from "./agent-ws-updaters";

export function useStaffRealtime() {
  const qc = useQueryClient();

  useWSSubscriptions(
    (ws, wsId) => staffRealtimeSubscriptions(qc, ws, wsId),
    [qc],
  );
}
