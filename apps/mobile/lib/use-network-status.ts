/**
 * Realtime network connectivity — drives the "网络已断开，正在重连" row of
 * BlockingNoticeBar (PRD §7.2). Thin wrapper around NetInfo that mirrors the
 * `onlineManager` wiring in data/query-client.ts (isConnected === true) so
 * the notice bar agrees with TanStack Query's pause/replay behaviour.
 *
 * Returns `null` while the very first snapshot is still resolving — callers
 * treat that as "assume online" to avoid a speculative offline banner on
 * cold start.
 */
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected === true);
    });
    return unsub;
  }, []);

  return isConnected;
}
