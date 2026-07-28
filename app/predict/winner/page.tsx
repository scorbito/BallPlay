import {
  WinnerPredictScreen,
  type AiGamePick,
  type WinnerPredictGame
} from "@/components/domain/WinnerPredictScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAiOverallStats, listAiPredictionsForDate } from "@/lib/supabase/query-parts/bpAiPredictions";
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

// KBO prediction week starts on Tuesday and shows the current in-progress week.
function kstWeekStartTuesday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = kst.getDay(); // 0=Sun .. 6=Sat
  const daysSinceTue = (dow - 2 + 7) % 7;
  kst.setDate(kst.getDate() - daysSinceTue);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
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

  // 오늘 이후 가장 이른 경기일(=다음 경기일). 자동 이동 + 다음 경기 예측 개방 판정에 공용.
  //   월요일 휴식일처럼 내일이 비면 화요일이 다음 경기일이 된다.
  const afterToday = await listGamesFromDb({
    from: addDays(today, 1),
    to: addDays(today, 14)
  }).catch(() => []);
  const nextGameDate = afterToday.length > 0 ? afterToday[0].date : null;

  // 오늘 진입인데 경기 자체가 없음 → 다음 경기일로 자동 이동.
  // (승리팀 예측이 목적이라 오늘 경기 없는 날에 빈 화면 대신 미리 다음 경기 예측 화면 노출.)
  if (!explicitDate && gamesResult.length === 0 && nextGameDate) {
    selectedDate = nextGameDate;
    gamesResult = afterToday.filter((g) => g.date === selectedDate);
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
  // 미래 예측은 "다음 경기일 하나만, 오늘 경기가 모두 끝났을 때" 허용.
  //   - 오늘 → 항상 편집 가능
  //   - 다음 경기일(nextGameDate) + 오늘 경기 모두 끝남 → 편집 가능
  //     · 오늘이 휴식일(경기 0건)이면 기다릴 경기가 없어 every()가 true → 즉시 개방.
  //       예) 일요일 경기 종료 → 월요일 휴식 → 화요일 예측 바로 가능.
  //   - 그 외 미래 → 보기만 가능
  let canEditFuture = false;
  if (isFuture && selectedDate === nextGameDate) {
    const todayGames = await listGamesFromDb({ from: today, to: today }).catch(() => []);
    canEditFuture = todayGames.every((g) => g.status === "finished" || g.status === "canceled");
  }

  // 본인 예측 + 통계 — 로그인(또는 익명 세션) 있을 때만 fetch. 비로그인은 빈 값.
  // dateStats는 화면에 표시 중인 selectedDate 기준 (어제로 가면 어제 적중률).
  const emptyStats = { total: 0, correct: 0, pending: 0 };
  const predictionByGameId = new Map<string, BpPredictionResultRow>();
  let dateStats = emptyStats;
  let weekStats = emptyStats;
  let allTimeStats = emptyStats;

  if (user) {
    const [predictionsResult, dateStatsResult, weekStatsResult, allTimeStatsResult] = await Promise.all([
      listMyPredictionResultsForDate(supabase, user.id, selectedDate),
      getMyPredictionStats(supabase, user.id, { dateISO: selectedDate }),
      getMyPredictionStats(supabase, user.id, { sinceISO: kstWeekStartTuesday() }),
      getMyPredictionStats(supabase, user.id)
    ]);
    if (predictionsResult.ok) {
      for (const row of predictionsResult.rows) {
        predictionByGameId.set(row.game_id, row);
      }
    }
    if (dateStatsResult.ok) dateStats = dateStatsResult.stats;
    if (weekStatsResult.ok) weekStats = weekStatsResult.stats;
    if (allTimeStatsResult.ok) allTimeStats = allTimeStatsResult.stats;
  }

  // 이번 주 AI 3개 평균 적중률 — 나 vs AI 대결 표시용. (공개 집계라 admin 클라이언트로 조회)
  const aiWeeklyResult = await getAiOverallStats(createSupabaseAdminClient(), kstWeekStartTuesday()).catch(() => null);
  const aiWeeklyAccuracy = aiWeeklyResult && aiWeeklyResult.ok ? aiWeeklyResult.stats.accuracy : null;

  // 경기별 AI 픽 — 유저 클라이언트로 조회해 published_at RLS를 그대로 태운다.
  //   (공개 전 예측이 화면에 새어나가면 안 되므로 admin 클라이언트를 쓰지 않는다.)
  const aiPicksResult = await listAiPredictionsForDate(supabase, selectedDate).catch(() => null);
  const aiPicks: AiGamePick[] = [];
  if (aiPicksResult && aiPicksResult.ok) {
    // game_id → (team_id → 표 수)
    const votesByGame = new Map<string, Map<string, number>>();
    for (const row of aiPicksResult.rows) {
      const votes = votesByGame.get(row.game_id) ?? new Map<string, number>();
      votes.set(row.predicted_winner_team_id, (votes.get(row.predicted_winner_team_id) ?? 0) + 1);
      votesByGame.set(row.game_id, votes);
    }
    // target es5 라 Map 직접 for...of 는 downlevelIteration 필요 → Array.from 경유.
    for (const [gameId, votes] of Array.from(votesByGame)) {
      let majorityTeamId: string | null = null;
      let majorityVotes = 0;
      let totalVotes = 0;
      let tied = false;
      for (const [teamId, count] of Array.from(votes)) {
        totalVotes += count;
        if (count > majorityVotes) {
          majorityVotes = count;
          majorityTeamId = teamId;
          tied = false;
        } else if (count === majorityVotes) {
          tied = true;
        }
      }
      aiPicks.push({
        gameId,
        majorityTeamId: tied ? null : majorityTeamId,
        majorityVotes,
        totalVotes
      });
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
      canEditFuture={canEditFuture}
      prevDateISO={prevDate}
      nextDateISO={nextDate}
      games={games}
      dateStats={dateStats}
      weekStats={weekStats}
      allTimeStats={allTimeStats}
      aiWeeklyAccuracy={aiWeeklyAccuracy}
      aiPicks={aiPicks}
    />
  );
}
