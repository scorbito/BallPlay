import { RankingScreen } from "@/components/domain/RankingScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
  PREDICTION_RANKING_MIN_GAMES,
  getPredictionRanking,
  getWeeklyPredictionRanking
} from "@/lib/supabase/query-parts/bpPredictions";

export const dynamic = "force-dynamic";

// KBO 주간(화요일 시작) — 오늘이 속한 주의 화요일 ISO. 월요일이면 직전 주 화요일.
function kstWeekStartTuesday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = kst.getDay(); // 0=일 .. 6=토
  const daysSinceTue = (dow - 2 + 7) % 7;
  kst.setDate(kst.getDate() - daysSinceTue);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function PredictionRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 적중률 랭킹은 누구나 열람 가능(보기 무료). 비로그인은 본인 행 하이라이트만 없음.

  // 주간(화~일, 우선 노출) + 전체(시즌) 둘 다 prefetch — 탭 전환은 클라이언트에서.
  const [weeklyResult, seasonResult] = await Promise.all([
    getWeeklyPredictionRanking(supabase, {
      weekStartISO: kstWeekStartTuesday(),
      minGames: PREDICTION_RANKING_MIN_GAMES,
      limit: 20
    }),
    getPredictionRanking(supabase, {
      period: "season",
      minGames: PREDICTION_RANKING_MIN_GAMES,
      activeWithinDays: PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
      limit: 20
    })
  ]);

  return (
    <RankingScreen
      currentUserId={user?.id ?? null}
      weeklyRanking={weeklyResult.ok ? weeklyResult.rows : []}
      seasonRanking={seasonResult.ok ? seasonResult.rows : []}
    />
  );
}
