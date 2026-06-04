import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  listSimResultsForDate,
  listSimResultDates,
  getSim1000AccuracyStats,
  type BpSimResultRow,
  type Sim1000AccuracyStats
} from "@/lib/supabase/query-parts/bpSimResults";
import { getUserTier } from "@/lib/auth/userTier";
import { Sim1000ListScreen, type Sim1000GameCard } from "@/components/domain/Sim1000ListScreen";

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

export default async function Sim1000ListPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const today = kstToday();
  const explicitDate = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : null;
  const selectedDate = explicitDate ?? today;

  const supabase = createSupabaseServerClient();

  // 운영자(admin) 여부 — "다시 돌리기" 버튼 노출 분기용. 일반 사용자는 false.
  const userTier = await getUserTier(supabase);
  const isAdmin = userTier.tier === "admin";

  // 시뮬 결과 + 게임 부가 정보 병렬.
  // listGamesFromDb 는 admin client (선발 컬럼 포함) — 매치업 시각·구장 보강용.
  const [simResult, gamesForDate, datesResult, accuracyResult] = await Promise.all([
    listSimResultsForDate(supabase, selectedDate),
    listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []),
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
  const gameMeta = new Map<string, (typeof gamesForDate)[number]>();
  for (const g of gamesForDate) gameMeta.set(g.id, g);

  const cards: Sim1000GameCard[] = simRows.map((row) => {
    const meta = gameMeta.get(row.game_id);
    return {
      gameId: row.game_id,
      gameDate: row.game_date,
      gameTime: meta?.time ?? null,
      stadium: meta?.stadium ?? "",
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeWins: row.home_wins,
      awayWins: row.away_wins,
      ties: row.ties,
      n: row.n,
      homeAvgRuns: row.home_avg_runs,
      awayAvgRuns: row.away_avg_runs,
      // 실제 경기 결과 — 과거 카드에서 시뮬 vs 실제 비교 표시용.
      // listGamesFromDb 에 game meta 가 없으면 (예: 시즌 외 시뮬) null.
      actualHomeScore: meta?.homeScore ?? null,
      actualAwayScore: meta?.awayScore ?? null,
      gameStatus: meta?.status ?? "scheduled"
    };
  });

  // prev/next — 시뮬 결과가 있는 날짜 중 selectedDate 기준 인접.
  const dates = datesResult.ok ? datesResult.dates : [];
  const sorted = [...dates].sort();
  let prevDate: string | null = null;
  let nextDate: string | null = null;
  for (const d of sorted) {
    if (d < selectedDate) prevDate = d;
    else if (d > selectedDate && nextDate === null) nextDate = d;
  }

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  return (
    <Sim1000ListScreen
      key={selectedDate}
      today={today}
      selectedDate={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      prevDate={prevDate}
      nextDate={nextDate}
      games={cards}
      isAdmin={isAdmin}
      accuracyStats={accuracyStats}
    />
  );
}
