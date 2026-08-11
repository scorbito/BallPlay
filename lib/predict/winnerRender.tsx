// 승리팀 예측 — 공개 셸 렌더 (base 오늘/자동이동 + /date/[date] 공유).
//
// 예전엔 page 가 auth.getUser + 내 픽/통계 + searchParams 를 서버에서 읽어 라우트가
// 완전 동적(no-store)이었다 — 트래픽이 가장 많은 화면이라 CPU 스파이크의 핵심.
// 이제 공개 데이터(경기·AI 픽·AI 주간 적중률·날짜 네비)만 서버에서 렌더해 ISR 캐시하고,
// 유저별(내 픽·내 적중률)은 클라에서 /api/predict/winner/my 로 하이드레이션한다.

import {
  WinnerPredictScreen,
  type AiGamePick,
  type WinnerPredictGame
} from "@/components/domain/WinnerPredictScreen";
import { createSupabaseCacheClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAiOverallStats, listAiPredictionsForDate } from "@/lib/supabase/query-parts/bpAiPredictions";
import { listGamesFromDb } from "@/lib/supabase/queries";
import { contestWeekStart } from "@/lib/server/predict/weeklyContest";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidWinnerDate(d: string): boolean {
  return DATE_RE.test(d);
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** explicitDate=null 이면 오늘(경기 없으면 다음 경기일로 자동 이동)을 보여준다. */
export async function renderWinner(explicitDate: string | null) {
  const today = kstToday();

  let selectedDate = explicitDate ?? today;
  let gamesResult = await listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []);

  // 오늘 이후 가장 이른 경기일(=다음 경기일). 자동 이동 + 다음 경기 예측 개방 판정에 공용.
  const afterToday = await listGamesFromDb({ from: addDays(today, 1), to: addDays(today, 14) }).catch(
    () => []
  );
  const nextGameDate = afterToday.length > 0 ? afterToday[0].date : null;

  // 오늘 진입인데 경기 자체가 없음 → 다음 경기일로 자동 이동.
  if (!explicitDate && gamesResult.length === 0 && nextGameDate) {
    selectedDate = nextGameDate;
    gamesResult = afterToday.filter((g) => g.date === selectedDate);
  }

  // 인접 경기일 탐색 — prev/next 화살표가 경기 없는 날을 자동 스킵. ±14일 윈도우.
  const [prevLookback, nextLookahead] = await Promise.all([
    listGamesFromDb({ from: addDays(selectedDate, -14), to: addDays(selectedDate, -1) }).catch(() => []),
    listGamesFromDb({ from: addDays(selectedDate, 1), to: addDays(selectedDate, 14) }).catch(() => [])
  ]);
  const prevDate = prevLookback.length > 0 ? prevLookback[prevLookback.length - 1].date : null;
  const nextDate = nextLookahead.length > 0 ? nextLookahead[0].date : null;

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  // 미래 예측은 "다음 경기일 하나만, 오늘 경기가 모두 끝났을 때(또는 휴식일)" 허용.
  let canEditFuture = false;
  if (isFuture && selectedDate === nextGameDate) {
    const todayGames = await listGamesFromDb({ from: today, to: today }).catch(() => []);
    canEditFuture = todayGames.every((g) => g.status === "finished" || g.status === "canceled");
  }

  // 이번 주 AI 3개 평균 적중률 — 공개 집계(과거 판정 결과)라 admin 클라이언트로 조회해도 무방.
  const aiWeeklyResult = await getAiOverallStats(createSupabaseAdminClient(), contestWeekStart()).catch(
    () => null
  );
  const aiWeeklyAccuracy = aiWeeklyResult && aiWeeklyResult.ok ? aiWeeklyResult.stats.accuracy : null;

  // 경기별 AI 픽 — 캐시(anon) 클라이언트로 조회해 published_at RLS 를 그대로 태운다.
  //   (공개 전 예측이 새어나가면 안 되므로 admin 클라이언트를 쓰지 않는다. anon 은 RLS 로 published 만 봄.)
  const cache = createSupabaseCacheClient(60);
  const aiPicksResult = await listAiPredictionsForDate(cache, selectedDate).catch(() => null);
  const aiPicks: AiGamePick[] = [];
  if (aiPicksResult && aiPicksResult.ok) {
    const votesByGame = new Map<string, Map<string, number>>();
    for (const row of aiPicksResult.rows) {
      const votes = votesByGame.get(row.game_id) ?? new Map<string, number>();
      votes.set(row.predicted_winner_team_id, (votes.get(row.predicted_winner_team_id) ?? 0) + 1);
      votesByGame.set(row.game_id, votes);
    }
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

  // 공개 셸 — 유저 필드(내 픽·잠금·판정)는 비워 보낸다. 클라에서 하이드레이션.
  const games: WinnerPredictGame[] = gamesResult.map((g) => ({
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
    predictedWinnerTeamId: null,
    lockedAt: null,
    actualWinnerTeamId: null,
    isJudged: false,
    isCorrect: null
  }));

  return (
    <WinnerPredictScreen
      key={selectedDate}
      selectedDateISO={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      canEditFuture={canEditFuture}
      prevDateISO={prevDate}
      nextDateISO={nextDate}
      games={games}
      aiWeeklyAccuracy={aiWeeklyAccuracy}
      aiPicks={aiPicks}
    />
  );
}
