// 페이지 진입 시 호출되는 on-demand 선발 투수 refresh.
// 트리거: /predict/winner 페이지가 SSR될 때.
//
// 동작:
//   1. 오늘 경기 fetch (KST 기준)
//   2. 선발이 비어있는 경기가 하나라도 있는지 확인
//   3. 모두 채워져 있으면 → skip (불필요 API call 방지)
//   4. throttle 체크: 마지막 starter_fetched_at가 N분 이내면 skip
//   5. 통과하면 KBO API 호출 → games 테이블 UPDATE
//
// fail-soft: 예외 발생해도 throw X (페이지 SSR 중단 안 됨). console.error만.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { syncGamesForDate } from "./syncGames";

// throttle 간격 — 10분. KBO 발표는 보통 새벽~경기 직전에 한 번 확정되므로
// 너무 자주 fetch할 필요 없음.
const THROTTLE_MS = 10 * 60 * 1000;

function kstTodayISO(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export async function refreshTodayStartersIfStale(): Promise<{
  refreshed: boolean;
  reason: string;
}> {
  const today = kstTodayISO();
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("games")
      .select("home_starter, away_starter, starter_fetched_at, status")
      .eq("game_date", today);

    if (error) {
      // 42703 = undefined column → add-games-starters.sql 미적용. graceful skip.
      if (error.code === "42703") {
        return { refreshed: false, reason: "starter-columns-missing (run add-games-starters.sql)" };
      }
      console.error("[refreshStarters] select failed:", error.message);
      return { refreshed: false, reason: `select-error: ${error.message}` };
    }

    const games = (data ?? []) as Array<{
      home_starter: string | null;
      away_starter: string | null;
      starter_fetched_at: string | null;
      status: string;
    }>;

    if (games.length === 0) {
      return { refreshed: false, reason: "no-games-today" };
    }

    // 종료된 경기는 무시. scheduled / in_progress 중에서 null 선발 있나 확인.
    const pending = games.filter((g) => g.status !== "finished" && g.status !== "canceled");
    const needsFetch = pending.some((g) => !g.home_starter || !g.away_starter);
    if (!needsFetch) {
      return { refreshed: false, reason: "all-starters-filled" };
    }

    // throttle: pending 경기 중 가장 최근 fetch가 N분 이내면 skip
    const now = Date.now();
    const recentFetch = pending
      .map((g) => (g.starter_fetched_at ? Date.parse(g.starter_fetched_at) : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    if (recentFetch > 0 && now - recentFetch < THROTTLE_MS) {
      const ageSec = Math.round((now - recentFetch) / 1000);
      return { refreshed: false, reason: `throttled (${ageSec}s ago)` };
    }

    // 실제 fetch + UPSERT (syncGamesForDate가 starter_fetched_at도 갱신)
    const result = await syncGamesForDate(today);
    return {
      refreshed: true,
      reason: `synced from ${result.source}: inserted ${result.inserted}, updated ${result.updated}`
    };
  } catch (err) {
    console.error("[refreshStarters] unexpected error:", (err as Error).message);
    return { refreshed: false, reason: `error: ${(err as Error).message}` };
  }
}
