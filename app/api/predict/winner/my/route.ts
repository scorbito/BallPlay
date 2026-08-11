import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMyPredictionStats,
  listMyPredictionResultsForDate
} from "@/lib/supabase/query-parts/bpPredictions";
import { contestWeekStart } from "@/lib/server/predict/weeklyContest";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY = { total: 0, correct: 0, pending: 0 };

/**
 * GET /api/predict/winner/my?date=YYYY-MM-DD
 *   → 로그인(또는 익명 세션) 유저의 해당 날짜 픽 + 적중률 통계.
 *   승리팀 예측 페이지(전체 라우트 ISR 캐시)에서 유저별 데이터만 분리해 클라에서 하이드레이션.
 *   { picks: [{gameId, predictedWinnerTeamId, lockedAt, actualWinnerTeamId, isJudged, isCorrect}],
 *     dateStats, weekStats, allTimeStats }
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const empty = { picks: [], dateStats: EMPTY, weekStats: EMPTY, allTimeStats: EMPTY };
  if (!date || !DATE_RE.test(date)) return NextResponse.json(empty);

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(empty);

  const [predictionsResult, dateStatsResult, weekStatsResult, allTimeStatsResult] = await Promise.all([
    listMyPredictionResultsForDate(supabase, user.id, date),
    getMyPredictionStats(supabase, user.id, { dateISO: date }),
    getMyPredictionStats(supabase, user.id, { sinceISO: contestWeekStart() }),
    getMyPredictionStats(supabase, user.id)
  ]);

  const picks = predictionsResult.ok
    ? predictionsResult.rows.map((row) => ({
        gameId: row.game_id,
        predictedWinnerTeamId: row.predicted_winner_team_id,
        lockedAt: row.locked_at,
        actualWinnerTeamId: row.actual_winner_team_id,
        isJudged: row.is_judged,
        isCorrect: row.is_correct
      }))
    : [];

  return NextResponse.json({
    picks,
    dateStats: dateStatsResult.ok ? dateStatsResult.stats : EMPTY,
    weekStats: weekStatsResult.ok ? weekStatsResult.stats : EMPTY,
    allTimeStats: allTimeStatsResult.ok ? allTimeStatsResult.stats : EMPTY
  });
}
