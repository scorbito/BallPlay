"use client";

// 라이브 스코어 훅 — 사용자가 페이지를 보고 있을 때만 경기 상태를 갱신한다.
//
//   - 마운트 · 탭 포커스 · 다시 보임(visibilitychange) 시 호출 (새로고침/재접속 개념)
//   - 클라이언트 스로틀 60초 + 탭이 보이는 동안 60초 자동 갱신
//   - 진행 중 경기가 하나라도 있을 때만 작동, 전 경기 종료되면 중단
//   - /api/games/live 가 서버에서 90초 스로틀로 KBO 재조회 → 부하 안전

import { useCallback, useEffect, useRef, useState } from "react";

type LiveFields = { homeScore: number | null; awayScore: number | null; status: string };
type LiveGame = { id: string } & LiveFields & {
  innings?: number | null;
  inningHalf?: "top" | "bottom" | null;
};
type LiveResponse = { games?: LiveGame[] };

const CLIENT_THROTTLE_MS = 60_000;
const POLL_MS = 60_000;

export function useLiveGames<T extends { id: string } & LiveFields>(
  dateISO: string,
  initial: T[],
  enabled = true
): T[] {
  const [games, setGames] = useState<T[]>(initial);
  const lastFetchRef = useRef(0);
  const dateRef = useRef(dateISO);

  // 날짜가 바뀌면(날짜 이동) 새 초기값으로 리셋. initial 참조 변경만으론 리셋 안 함(무한루프 방지).
  useEffect(() => {
    if (dateRef.current !== dateISO) {
      dateRef.current = dateISO;
      setGames(initial);
      lastFetchRef.current = 0;
    }
  }, [dateISO, initial]);

  const hasLive = games.some((g) => g.status !== "finished" && g.status !== "canceled");
  const active = enabled && games.length > 0 && hasLive;

  const fetchLive = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < CLIENT_THROTTLE_MS) return;
    lastFetchRef.current = now;
    try {
      const res = await fetch(`/api/games/live?date=${dateISO}`);
      if (!res.ok) return;
      const data = (await res.json()) as LiveResponse;
      if (!Array.isArray(data.games)) return;
      const byId = new Map(data.games.map((g) => [g.id, g]));
      setGames((prev) =>
        prev.map((g) => {
          const live = byId.get(g.id);
          return live
            ? ({
                ...g,
                homeScore: live.homeScore,
                awayScore: live.awayScore,
                status: live.status,
                innings: live.innings ?? null,
                inningHalf: live.inningHalf ?? null
              } as T)
            : g;
        })
      );
    } catch {
      // 라이브 갱신 실패는 조용히 무시 — 화면은 기존 값으로 성립.
    }
  }, [dateISO]);

  useEffect(() => {
    if (!active) return;
    void fetchLive();
    const onFocus = () => void fetchLive();
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchLive();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchLive();
    }, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [active, fetchLive]);

  return games;
}
