// 홈 카드 펄스 뱃지에 필요한 서버 데이터.
// HomeScreen(server component)에서 한 번 fetch → HomeCardPulse(client)로 전달.

import { createSupabaseServerClient } from "@/lib/supabase/server";

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export type HomeBadgeServerData = {
  todayDate: string;
  todayGamesTotal: number;
  todayGamesFinished: number;
  userPredictionsToday: number;     // 로그인 안 했으면 0
  aiPredictionsToday: number;       // RLS가 published_at <= now() 필터링하므로 공개분만 카운트
  simResultsToday: number;          // bp_sim_results 오늘자 행 수 (1000판 시뮬 신규 신호)
  latestVideoAt: string | null;     // bp_videos.created_at 최신값 (ISO)
  latestNewsAt: string | null;      // bp_news.published_at 최신값 (ISO)
};

export async function getHomeBadgeServerData(): Promise<HomeBadgeServerData> {
  const todayDate = kstToday();
  try {
    const supabase = createSupabaseServerClient();

    const [gamesRes, finishedRes, aiRes, simRes, userRes, latestVideoRes, latestNewsRes] = await Promise.all([
      supabase.from("games").select("id", { count: "exact", head: true }).eq("game_date", todayDate),
      supabase
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("game_date", todayDate)
        .eq("status", "finished"),
      supabase
        .from("bp_ai_predictions")
        .select("id", { count: "exact", head: true })
        .eq("game_date", todayDate),
      supabase
        .from("bp_sim_results")
        .select("id", { count: "exact", head: true })
        .eq("game_date", todayDate),
      supabase.auth.getUser(),
      supabase
        .from("bp_videos")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("bp_news")
        .select("published_at")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    let userPredictionsToday = 0;
    const userId = userRes.data.user?.id;
    if (userId) {
      const r = await supabase
        .from("bp_predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("game_date", todayDate);
      userPredictionsToday = r.count ?? 0;
    }

    return {
      todayDate,
      todayGamesTotal: gamesRes.count ?? 0,
      todayGamesFinished: finishedRes.count ?? 0,
      userPredictionsToday,
      aiPredictionsToday: aiRes.count ?? 0,
      simResultsToday: simRes.count ?? 0,
      latestVideoAt: (latestVideoRes.data?.created_at as string | undefined) ?? null,
      latestNewsAt: (latestNewsRes.data?.published_at as string | undefined) ?? null
    };
  } catch {
    // 어떤 이유로든 실패 시 뱃지 미표시(=안전 디폴트).
    return {
      todayDate,
      todayGamesTotal: 0,
      todayGamesFinished: 0,
      userPredictionsToday: 0,
      aiPredictionsToday: 0,
      simResultsToday: 0,
      latestVideoAt: null,
      latestNewsAt: null
    };
  }
}
