"use client";

import { useEffect, useMemo, useState } from "react";
import { simulateGame } from "@/lib/sim/engine";
import {
  loadMatchSession,
  saveMatchSession,
  type MatchSession
} from "@/lib/sim/matchSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getServerTimeOffsetMs, serverNow } from "@/lib/sim/serverClock";
import { flatten } from "../eventHelpers";
import type { FlatEvent } from "../types";

type Router = { replace: (path: string) => void };

type Args = {
  router: Router;
  setMode: (m: "normal" | "fast" | "superfast" | "live") => void;
  setPlaying: (v: boolean) => void;
};

type Return = {
  session: MatchSession | null;
  events: FlatEvent[];
  hydrated: boolean;
  isLive: boolean;
  liveStartAt: string | undefined;
  liveMatchId: string | undefined;
};

export function useMatchSession({ router, setMode, setPlaying }: Args): Return {
  const [session, setSession] = useState<MatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadMatchSession();
    if (!s || !s.input) {
      router.replace("/stadium/lobby");
      return;
    }
    let next = s;
    if (!s.result) {
      const result = simulateGame(s.input, s.seed);
      next = { ...s, result };
      saveMatchSession(next);
    }
    setSession(next);
    setHydrated(true);

    // 친구 대결(라이브 매치) — 방장이 선택한 진행 속도(liveMode)로 진행.
    // 구버전 세션은 liveMode 없을 수 있으므로 기본 'fast'로 폴백.
    if (next.liveMatchId) {
      setMode(next.liveMode ?? "fast");
    }

    // 카운트다운: startAt이 미래면 그때까지 playing=false.
    // 비교는 server-equivalent time 기준(serverNow) — 양쪽 클라이언트 wall-clock 이 어긋나도
    // 같은 server time 에 동시에 시작되도록.
    if (next.liveMatchId && next.liveStartAt) {
      // 친구 매치면 server time offset 미리 fetch (countdown effect 가 사용).
      void getServerTimeOffsetMs(createSupabaseBrowserClient());
      const startMs = new Date(next.liveStartAt).getTime();
      if (serverNow() < startMs) {
        setPlaying(false);
      }
    }
    // mount-only effect. 의존성 router/setMode/setPlaying 은 안정적이라 가정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const events = useMemo(() => {
    if (!session?.result) return [];
    return flatten(session.result.innings);
  }, [session]);

  const isLive = !!session?.liveMatchId;
  const liveStartAt = session?.liveStartAt;
  const liveMatchId = session?.liveMatchId;

  return { session, events, hydrated, isLive, liveStartAt, liveMatchId };
}
