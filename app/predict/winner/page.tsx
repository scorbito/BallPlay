import { redirect } from "next/navigation";
import { WinnerPredictScreen, type WinnerPredictGame } from "@/components/domain/WinnerPredictScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getMyPredictionStats,
  listMyPredictionResultsForDate,
  type BpPredictionResultRow
} from "@/lib/supabase/query-parts/bpPredictions";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function WinnerPredictPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 비로그인이면 익명 세션 자동 생성. 부트스트랩이 next로 다시 돌려보냄.
  if (!user) {
    const next = searchParams.date
      ? `/predict/winner?date=${encodeURIComponent(searchParams.date)}`
      : "/predict/winner";
    redirect(`/api/anon-bootstrap?next=${encodeURIComponent(next)}`);
  }

  const today = kstToday();
  // URL ?date=YYYY-MM-DD 파싱 — 형식 안 맞으면 오늘로 폴백.
  const requested = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : today;
  const selectedDate = requested;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const prevDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);

  // 해당 날짜의 경기 + 본인 예측 + 통계 — 병렬 fetch
  const [gamesResult, predictionsResult, todayStatsResult, allTimeStatsResult] = await Promise.all([
    listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []),
    listMyPredictionResultsForDate(supabase, user.id, selectedDate),
    getMyPredictionStats(supabase, user.id, { dateISO: today }),
    getMyPredictionStats(supabase, user.id)
  ]);

  const predictionByGameId = new Map<string, BpPredictionResultRow>();
  if (predictionsResult.ok) {
    for (const row of predictionsResult.rows) {
      predictionByGameId.set(row.game_id, row);
    }
  }

  const games: WinnerPredictGame[] = gamesResult.map((g) => {
    const pred = predictionByGameId.get(g.id) ?? null;
    return {
      id: g.id,
      gameTime: g.time ?? null,
      stadium: g.stadium,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      status: g.status,
      predictedWinnerTeamId: pred?.predicted_winner_team_id ?? null,
      lockedAt: pred?.locked_at ?? null,
      actualWinnerTeamId: pred?.actual_winner_team_id ?? null,
      isJudged: pred?.is_judged ?? false,
      isCorrect: pred?.is_correct ?? null
    };
  });

  return (
    <WinnerPredictScreen
      selectedDateISO={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      prevDateISO={prevDate}
      nextDateISO={nextDate}
      games={games}
      todayStats={todayStatsResult.ok ? todayStatsResult.stats : { total: 0, correct: 0, pending: 0 }}
      allTimeStats={allTimeStatsResult.ok ? allTimeStatsResult.stats : { total: 0, correct: 0, pending: 0 }}
    />
  );
}
