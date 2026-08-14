/**
 * Staff realtime — M4-9. Listing-level（工作区内常驻）。
 *
 * 与 `usePresenceRealtime` 的分工：
 *   - presence realtime 对 agent:* 事件走 invalidate（连带 runtimes /
 *     snapshot 一起刷新，presence dot 需要全套）。
 *   - 本 hook 对同一批 agent:* 事件走 **patch**（payload 携带完整 Agent），
 *     让员工 rail 的状态点 / 未读 / 名册卡在 ≤500ms 内更新且零网络开销
 *     （apps/mobile/CLAUDE.md "patch over invalidate" 蜂窝数据规则）。
 *
 * 订阅（PRD §7.3 实时）：
 *   - agent:status / agent:created / agent:archived / agent:restored → patch
 *   - chat:session_updated → 未读点。该 payload 无 `has_unread` 字段（title/
 *     updated_at 之类），未读变化实际由 `chat:done` / `chat:session_read`
 *     invalidate 驱动（use-chat-sessions-realtime.ts 已处理），此处不重复。
 *
 * Reconnect：agents 身份不随离线漂移（agent:created / archived 罕见），
 * 由 presence realtime 的重连 invalidate 兜底，本 hook 不重复订阅。
 */
import { useQueryClient } from "@tanstack/react-query";
import { useWSSubscriptions } from "@/lib/use-ws-subscriptions";
import {
  dropArchivedAgentFromList,
  upsertAgentInList,
} from "./agent-ws-updaters";

export function useStaffRealtime() {
  const qc = useQueryClient();

  useWSSubscriptions(
    (ws, wsId) => [
      ws.on("agent:status", (payload) => upsertAgentInList(qc, wsId, payload)),
      ws.on("agent:created", (payload) => upsertAgentInList(qc, wsId, payload)),
      ws.on("agent:archived", (payload) =>
        dropArchivedAgentFromList(qc, wsId, payload),
      ),
      ws.on("agent:restored", (payload) =>
        upsertAgentInList(qc, wsId, payload),
      ),
    ],
    [qc],
  );
}
