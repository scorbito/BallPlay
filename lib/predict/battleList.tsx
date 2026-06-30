import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import { AiBattleListScreen } from "@/components/domain/AiBattleListScreen";
import type { SupabaseClient } from "@supabase/supabase-js";

// AI 승부 맞대결 리스트 — 전역 데이터라 정적/ISR 캐시. 날짜는 경로(/date/[date])로.
export const BATTLE_REVALIDATE = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string | undefined | null): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

/** 양 진영(home/away) 예측이 모두 등록된 가장 최근 날짜. */
async function getLatestBattleContentDate(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("bp_ai_battle_predictions")
    .select("game_date, game_id, target_side")
    .order("game_date", { ascending: false })
    .limit(300);
  if (error || !data) return null;

  const byDate = new Map<string, Map<string, Set<string>>>();
  for (const row of data as Array<{ game_date: string; game_id: string; target_side: string }>) {
    if (!byDate.has(row.game_date)) byDate.set(row.game_date, new Map());
    const games = byDate.get(row.game_date)!;
    if (!games.has(row.game_id)) games.set(row.game_id, new Set());
    games.get(row.game_id)!.add(row.target_side);
  }
  for (const [date, games] of Array.from(byDate.entries())) {
    for (const sides of Array.from(games.values())) {
      if (sides.has("home") && sides.has("away")) return date;
    }
  }
  return null;
}

export async function renderBattleList(explicitDateParam: string | null) {
  const today = kstToday();
  const explicitDate = isValidDate(explicitDateParam) ? explicitDateParam : null;

  const supabase = createSupabaseCacheClient(BATTLE_REVALIDATE);
  const latestContentDate = explicitDate ? null : await getLatestBattleContentDate(supabase);
  const selectedDate = explicitDate ?? latestContentDate ?? today;

  const rawGames = await listGamesFromDb({ from: selectedDate, to: selectedDate }, supabase).catch(() => []);

  // 홈/원정 예측이 둘 다 등록된 경기만 활성화(hasPrediction). 클라이언트가 다시 보정함.
  const gameIds = rawGames.map((g) => g.id);
  const predictedGameIds = new Set<string>();
  if (gameIds.length > 0) {
    const { data } = await supabase
      .from("bp_ai_battle_predictions")
      .select("game_id, target_side")
      .in("game_id", gameIds);
    const gameSides = new Map<string, Set<string>>();
    for (const r of (data ?? []) as Array<{ game_id: string; target_side: string }>) {
      if (!gameSides.has(r.game_id)) gameSides.set(r.game_id, new Set());
      gameSides.get(r.game_id)!.add(r.target_side);
    }
    gameSides.forEach((sides, gid) => {
      if (sides.has("home") && sides.has("away")) predictedGameIds.add(gid);
    });
  }

  // 팀별 투표수 집계 (bp_ai_battle_votes: voted_side home/away)
  const voteByGame = new Map<string, { home: number; away: number }>();
  if (gameIds.length > 0) {
    const { data: votes } = await supabase
      .from("bp_ai_battle_votes")
      .select("game_id, voted_side")
      .in("game_id", gameIds);
    for (const v of (votes ?? []) as Array<{ game_id: string; voted_side: string }>) {
      const e = voteByGame.get(v.game_id) ?? { home: 0, away: 0 };
      if (v.voted_side === "home") e.home += 1;
      else if (v.voted_side === "away") e.away += 1;
      voteByGame.set(v.game_id, e);
    }
  }

  const games = rawGames.map((g) => ({
    id: g.id,
    gameDate: g.date,
    gameTime: g.time ?? null,
    stadium: g.stadium,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    status: g.status,
    homeStarter: g.homeStarter ?? null,
    awayStarter: g.awayStarter ?? null,
    hasPrediction: predictedGameIds.has(g.id),
    homeVotes: voteByGame.get(g.id)?.home ?? 0,
    awayVotes: voteByGame.get(g.id)?.away ?? 0
  }));

  return <AiBattleListScreen key={selectedDate} games={games} selectedDate={selectedDate} />;
}

/** generateStaticParams 용 — 배틀 예측이 있는 최근 날짜들. */
export async function recentBattleDates(limit = 30): Promise<string[]> {
  const client = createSupabaseCacheClient(BATTLE_REVALIDATE);
  const { data, error } = await client
    .from("bp_ai_battle_predictions")
    .select("game_date")
    .order("game_date", { ascending: false })
    .limit(400);
  if (error || !data) return [];
  const seen = new Set<string>();
  for (const row of data as Array<{ game_date: string }>) {
    if (typeof row.game_date === "string") seen.add(row.game_date);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}
