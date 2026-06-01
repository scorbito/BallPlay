"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getServerTimeOffsetMs, serverNow } from "@/lib/sim/serverClock";

type Args = {
  isLive: boolean;
  liveStartAt: string | undefined | null;
  setPlaying: (v: boolean) => void;
};

// 라이브 카운트다운 — startAt 도달 시 자동 play.
// server-equivalent time 기준 비교(serverNow) → 클라 wall-clock drift 무관하게 양쪽 동시 시작.
export function useLiveCountdown({ isLive, liveStartAt, setPlaying }: Args): { countdownMs: number | null } {
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isLive || !liveStartAt) return;
    const startMs = new Date(liveStartAt).getTime();
    const client = createSupabaseBrowserClient();
    // offset 아직 미캐시면 한 번 fetch 후 tick 시작. 캐시 있으면 즉시.
    let cancelled = false;
    let intervalId = 0;
    void getServerTimeOffsetMs(client).then(() => {
      if (cancelled) return;
      const tick = () => {
        const remain = Math.max(0, Math.ceil((startMs - serverNow()) / 1000));
        setLiveCountdown(remain);
        if (remain <= 0) {
          setPlaying(true);
          setLiveCountdown(null);
          return false;
        }
        return true;
      };
      if (!tick()) return;
      intervalId = window.setInterval(() => {
        if (!tick()) window.clearInterval(intervalId);
      }, 200);
    });
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isLive, liveStartAt, setPlaying]);

  return { countdownMs: liveCountdown };
}
