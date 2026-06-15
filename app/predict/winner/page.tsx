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

  // 비로그인도 예측 화면을 열람할 수 있다(보기 무료). 본인 예측/통계만 없을 뿐이며,
  // 실제 "예측 선택/제출" 시점에 WinnerPredictScreen이 익명 계정을 lazy 생성한다.

  const today = kstToday();
  // URL ?date=YYYY-MM-DD 파싱 — 형식 안 맞으면 null 처리.
  const explicitDate = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : null;

  let selectedDate = explicitDate ?? today;
  let gamesResult = await listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []);

  // 오늘 진입인데 경기 자체가 없음 → 14일 lookahead 중 가장 이른 경기일로 자동 이동.
  // (승리팀 예측이 목적이라 오늘 경기 없는 날에 빈 화면 대신 미리 다음 경기 예측 화면 노출.)
  if (!explicitDate && gamesResult.length === 0) {
    const lookahead = await listGamesFromDb({
      from: addDays(today, 1),
      to: addDays(today, 14)
    }).catch(() => []);
    if (lookahead.length > 0) {
      selectedDate = lookahead[0].date;
      gamesResult = lookahead.filter((g) => g.date === selectedDate);
    }
  }

  // 인접 경기일 탐색 — prev/next 화살표가 경기 없는 날을 자동으로 스킵.
  // (예: 5/31 → 6/2 점프, 월요일 휴식일은 노출 안 함.)
  // ±14일 윈도우. 시즌 휴식기 등 더 긴 공백은 화살표 숨김 처리.
  const [prevLookback, nextLookahead] = await Promise.all([
    listGamesFromDb({ from: addDays(selectedDate, -14), to: addDays(selectedDate, -1) }).catch(() => []),
    listGamesFromDb({ from: addDays(selectedDate, 1), to: addDays(selectedDate, 14) }).catch(() => [])
  ]);
  // listGamesFromDb는 ascending 정렬 — prev는 마지막 row(가장 가까운 과거), next는 첫 row(가장 가까운 미래).
  const prevDate = prevLookback.length > 0 ? prevLookback[prevLookback.length - 1].date : null;
  const nextDate = nextLookahead.length > 0 ? nextLookahead[0].date : null;

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  // 미래 예측은 "내일까지만, 오늘 경기 끝났을 때만" 허용.
  //   - 오늘 → 항상 편집 가능
  //   - 내일(today+1) + 오늘 경기 모두 끝남 → 편집 가능
  //   - 그 외 미래 → 보기만 가능
  const tomorrow = addDays(today, 1);
  const isTomorrow = selectedDate === tomorrow;
  let canEditFuture = false;
  if (isTomorrow) {
    const todayGames = await listGamesFromDb({ from: today, to: today }).catch(() => []);
    canEditFuture =
      todayGames.length > 0 &&
      todayGames.every((g) => g.status === "finished" || g.status === "canceled");
  }

  // 본인 예측 + 통계 — 로그인(또는 익명 세션) 있을 때만 fetch. 비로그인은 빈 값.
  // dateStats는 화면에 표시 중인 selectedDate 기준 (어제로 가면 어제 적중률).
  const emptyStats = { total: 0, correct: 0, pending: 0 };
  const predictionByGameId = new Map<string, BpPredictionResultRow>();
  let dateStats = emptyStats;
  let allTimeStats = emptyStats;

  if (user) {
    const [predictionsResult, dateStatsResult, allTimeStatsResult] = await Promise.all([
      listMyPredictionResultsForDate(supabase, user.id, selectedDate),
      getMyPredictionStats(supabase, user.id, { dateISO: selectedDate }),
      getMyPredictionStats(supabase, user.id)
    ]);
    if (predictionsResult.ok) {
      for (const row of predictionsResult.rows) {
        predictionByGameId.set(row.game_id, row);
      }
    }
    if (dateStatsResult.ok) dateStats = dateStatsResult.stats;
    if (allTimeStatsResult.ok) allTimeStats = allTimeStatsResult.stats;
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
      canEditFuture={canEditFuture}
      prevDateISO={prevDate}
      nextDateISO={nextDate}
      games={games}
      dateStats={dateStats}
      allTimeStats={allTimeStats}
    />
  );
}
