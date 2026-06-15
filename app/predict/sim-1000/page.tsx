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

function areGamesDone(games: Array<{ status: string | null | undefined }>): boolean {
  return games.every((g) => g.status === "finished" || g.status === "canceled");
}

export default async function Sim1000ListPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const today = kstToday();
  const tomorrow = addDays(today, 1);
  const explicitDate = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : null;
  const requestedDate = explicitDate ?? today;

  const supabase = createSupabaseServerClient();

  // 운영자(admin) 여부 — "다시 돌리기" 버튼 노출 분기용. 일반 사용자는 false.
  const userTier = await getUserTier(supabase);
  const isAdmin = userTier.tier === "admin";
  const selectedDate = !isAdmin && requestedDate > today ? today : requestedDate;
  // 소프트 게이트: 비로그인/익명(guest)은 시뮬 수치를 못 본다. 매치업·누적 적중률(미끼)만 노출.
  // 정식 로그인(free/pro/admin)만 해제. 잠긴 사용자에겐 민감 수치를 서버에서 비워 보내
  // 개발자도구로도 훔쳐볼 수 없게 한다. AI 예측 page 와 동일 기준 (userTier.tier === "guest").
  const locked = userTier.tier === "guest";

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
  // gameOrder: gamesForDate 의 등장 순서(=game_time 정렬) — AI 예측·승리팀 예측과 동일한
  // listGamesFromDb 순서라, 이 인덱스로 시뮬 카드를 정렬하면 3개 페이지 경기 순서가 일치.
  const todayGamesForGate = isAdmin
    ? selectedDate === today
      ? gamesForDate
      : await listGamesFromDb({ from: today, to: today }).catch(() => [])
    : [];
  const tomorrowGamesForGate = isAdmin
    ? selectedDate === tomorrow
      ? gamesForDate
      : await listGamesFromDb({ from: tomorrow, to: tomorrow }).catch(() => [])
    : [];
  const adminCanPrepareTomorrow =
    isAdmin && areGamesDone(todayGamesForGate) && tomorrowGamesForGate.length > 0;
  const canAdminRerunSelectedDate =
    isAdmin && (selectedDate === today || (selectedDate === tomorrow && adminCanPrepareTomorrow));

  const gameMeta = new Map<string, (typeof gamesForDate)[number]>();
  const gameOrder = new Map<string, number>();
  gamesForDate.forEach((g, i) => {
    gameMeta.set(g.id, g);
    gameOrder.set(g.id, i);
  });

  const cards: Sim1000GameCard[] = simRows.map((row) => {
    const meta = gameMeta.get(row.game_id);
    // 잠긴 사용자에겐 민감 수치(승/패 분포·평균점수·실제결과·결과성 status)를 서버에서 비워 전송.
    // 노출 OK: 시각·구장·양팀 ID(매치업). AI 예측이 predictions=[] 로 보내는 것과 동형.
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
      // 실제 경기 결과 — 과거 카드에서 시뮬 vs 실제 비교 표시용.
      // listGamesFromDb 에 game meta 가 없으면 (예: 시즌 외 시뮬) null.
      actualHomeScore: locked ? null : meta?.homeScore ?? null,
      actualAwayScore: locked ? null : meta?.awayScore ?? null,
      // 결과성 정보(finished/canceled) 도 가림 — 잠금 상태에선 매치업만.
      gameStatus: locked ? "scheduled" : meta?.status ?? "scheduled"
    };
  });

  // AI 예측·승리팀 예측과 동일한 경기 순서로 정렬 (game_time 기준 = gamesForDate 순서).
  // gamesForDate 에 없는 시뮬(시즌 외 등)은 뒤로.
  cards.sort((a, b) => {
    const ai = gameOrder.get(a.gameId) ?? Number.MAX_SAFE_INTEGER;
    const bi = gameOrder.get(b.gameId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  // prev/next — 시뮬 결과가 있는 날짜 중 selectedDate 기준 인접.
  // 단, "오늘" 은 결과 유무와 무관하게 next 후보에 포함 — 운영자가 임의 시간에
  // 시뮬을 돌리는 워크플로우라 오늘 결과가 없어도 오늘 페이지로 이동 가능해야 함.
  const dates = datesResult.ok
    ? datesResult.dates.filter((date) => isAdmin || date <= today)
    : [];
  const dateList = [...dates];
  if (!dateList.includes(today)) dateList.push(today);
  if (adminCanPrepareTomorrow && !dateList.includes(tomorrow)) dateList.push(tomorrow);
  const sorted = [...dateList].sort();
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
      canAdminRerun={canAdminRerunSelectedDate}
      accuracyStats={accuracyStats}
      locked={locked}
    />
  );
}
