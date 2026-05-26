import { redirect } from "next/navigation";
import { WinnerPredictScreen, type WinnerPredictGame } from "@/components/domain/WinnerPredictScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getMyPredictionStats,
  listMyPredictionResultsForDate,
  type BpPredictionResultRow
} from "@/lib/supabase/query-parts/bpPredictions";
import { refreshTodayStartersIfStale } from "@/lib/server/kbo/refreshStarters";

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

  // 오늘 날짜 진입 시에만 선발 투수 on-demand refresh (throttle 10분, 모두 채워지면 skip).
  // listGamesFromDb 호출 BEFORE 실행해야 갱신된 값이 fetch에 반영됨.
  if (isToday) {
    await refreshTodayStartersIfStale();
  }

  // 해당 날짜의 경기 + 본인 예측 + 통계 — 병렬 fetch.
  // dateStats는 화면에 표시 중인 selectedDate 기준 (어제로 가면 어제 적중률).
  const [gamesResult, predictionsResult, dateStatsResult, allTimeStatsResult] = await Promise.all([
    listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []),
    listMyPredictionResultsForDate(supabase, user.id, selectedDate),
    getMyPredictionStats(supabase, user.id, { dateISO: selectedDate }),
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
      homeStarter: g.homeStarter ?? null,
      awayStarter: g.awayStarter ?? null,
      predictedWinnerTeamId: pred?.predicted_winner_team_id ?? null,
      lockedAt: pred?.locked_at ?? null,
      actualWinnerTeamId: pred?.actual_winner_team_id ?? null,
      isJudged: pred?.is_judged ?? false,
      isCorrect: pred?.is_correct ?? null
    };
  });

  return (
    <WinnerPredictScreen
      // 날짜가 바뀌면 컴포넌트 강제 재마운트 — predictions/lockedMap state가 새 날짜 기준으로 초기화되도록.
      // 없으면 이전 날짜의 state가 그대로 남아 picked가 undefined → 애니메이션 트리거 못 함.
      key={selectedDate}
      selectedDateISO={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      prevDateISO={prevDate}
      nextDateISO={nextDate}
      games={games}
      dateStats={dateStatsResult.ok ? dateStatsResult.stats : { total: 0, correct: 0, pending: 0 }}
      allTimeStats={allTimeStatsResult.ok ? allTimeStatsResult.stats : { total: 0, correct: 0, pending: 0 }}
    />
  );
}
