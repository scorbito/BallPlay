// sim-1000 리스트 렌더 — base(오늘/최신)와 /date/[date] 가 공유.
//
// 예전엔 page 가 searchParams.date 를 읽어서 라우트가 동적 강제(no-store)됐다.
// 시뮬 수치는 유저 무관 공개 데이터라, 날짜를 경로 파라미터로 분리하고 여기서
// 렌더를 공유하면 base·각 날짜 URL 이 모두 ISR(전체 라우트 캐시)로 잡힌다.

import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  listSimResultsForDate,
  listSimResultDates,
  getSim1000AccuracyStats,
  type BpSimResultRow,
  type Sim1000AccuracyStats
} from "@/lib/supabase/query-parts/bpSimResults";
import { Sim1000ListScreen, type Sim1000GameCard } from "@/components/domain/Sim1000ListScreen";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidSimDate(d: string): boolean {
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

/** explicitDate=null 이면 최신 시뮬 결과 날짜(없으면 오늘)를 보여준다. */
export async function renderSim1000(explicitDate: string | null) {
  const today = kstToday();
  const supabase = createSupabaseCacheClient(60);

  const latestResult = explicitDate ? null : await listSimResultDates(supabase, { limit: 1 });
  const latestContentDate = latestResult?.ok ? latestResult.dates[0] ?? null : null;
  const selectedDate = explicitDate ?? latestContentDate ?? today;
  // 로그인 게이트 제거(2026-06-18) — 비로그인도 시뮬 수치 열람. 로그인 유도는 경품/참여로 전환.
  const locked = false;

  // 시뮬 결과 + 게임 부가 정보 병렬.
  // listGamesFromDb 는 admin client (선발 컬럼 포함) — 매치업 시각·구장 보강용.
  const [simResult, gamesForDate, datesResult, accuracyResult] = await Promise.all([
    listSimResultsForDate(supabase, selectedDate),
    listGamesFromDb({ from: selectedDate, to: selectedDate }, supabase).catch(() => []),
    // 시뮬 결과가 존재하는 날짜 목록 — prev/next 화살표 자동 스킵용. ±30일 윈도우.
    listSimResultDates(supabase, { from: addDays(selectedDate, -30), to: addDays(selectedDate, 30) }),
    // 시즌 누적 적중률 (live 집계) — 상단 헤더 카드용.
    getSim1000AccuracyStats(supabase)
  ]);

  const simRows: BpSimResultRow[] = simResult.ok ? simResult.rows : [];
  const accuracyStats: Sim1000AccuracyStats | undefined = accuracyResult.ok
    ? accuracyResult.stats
    : undefined;

  // game_id → game meta 인덱스. 시뮬 행에 시각·구장 부가.
  // gameOrder: gamesForDate 의 등장 순서(=game_time 정렬) — AI 예측·승리팀 예측과 동일한
  // listGamesFromDb 순서라, 이 인덱스로 시뮬 카드를 정렬하면 3개 페이지 경기 순서가 일치.
  const gameMeta = new Map<string, (typeof gamesForDate)[number]>();
  const gameOrder = new Map<string, number>();
  gamesForDate.forEach((g, i) => {
    gameMeta.set(g.id, g);
    gameOrder.set(g.id, i);
  });

  const cards: Sim1000GameCard[] = simRows.map((row) => {
    const meta = gameMeta.get(row.game_id);
    return {
      gameId: row.game_id,
      gameDate: row.game_date,
      gameTime: meta?.time ?? null,
      stadium: meta?.stadium ?? "",
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeWins: locked ? 0 : row.home_wins,
      awayWins: locked ? 0 : row.away_wins,
      ties: locked ? 0 : row.ties,
      n: locked ? 0 : row.n,
      homeAvgRuns: locked ? 0 : row.home_avg_runs,
      awayAvgRuns: locked ? 0 : row.away_avg_runs,
      actualHomeScore: locked ? null : meta?.homeScore ?? null,
      actualAwayScore: locked ? null : meta?.awayScore ?? null,
      gameStatus: locked ? "scheduled" : meta?.status ?? "scheduled"
    };
  });

  // AI 예측·승리팀 예측과 동일한 경기 순서로 정렬 (game_time 기준 = gamesForDate 순서).
  cards.sort((a, b) => {
    const ai = gameOrder.get(a.gameId) ?? Number.MAX_SAFE_INTEGER;
    const bi = gameOrder.get(b.gameId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  // prev/next — 시뮬 결과가 있는 날짜 중 selectedDate 기준 인접. "오늘"은 결과 유무와
  // 무관하게 next 후보에 포함 — 운영자가 임의 시간에 시뮬을 돌리는 워크플로우.
  const dates = datesResult.ok ? datesResult.dates : [];
  const dateList = [...dates];
  if (!dateList.includes(today)) dateList.push(today);
  const sorted = [...dateList].sort();
  let prevDate: string | null = null;
  let nextDate: string | null = null;
  for (const d of sorted) {
    if (d < selectedDate) prevDate = d;
    else if (d > selectedDate && nextDate === null) nextDate = d;
  }

  return (
    <Sim1000ListScreen
      key={selectedDate}
      today={today}
      selectedDate={selectedDate}
      isToday={selectedDate === today}
      isFuture={selectedDate > today}
      prevDate={prevDate}
      nextDate={nextDate}
      games={cards}
      accuracyStats={accuracyStats}
      locked={locked}
    />
  );
}
