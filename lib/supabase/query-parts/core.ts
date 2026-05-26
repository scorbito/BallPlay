import type { Team, TeamStanding } from "@/lib/types/domain";
import type { GameRecord } from "@/lib/types/api-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function toTeam(row: {
  id: string;
  name: string;
  short_name: string;
  initial: string;
  color: string;
  accent: string | null;
}): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    initial: row.initial,
    color: row.color,
    accent: row.accent ?? undefined
  };
}

function toGame(row: {
  id: string;
  game_date: string;
  game_time: string | null;
  stadium: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: GameRecord["status"];
  innings: number | null;
  home_starter?: string | null;
  away_starter?: string | null;
}): GameRecord {
  return {
    id: row.id,
    date: row.game_date,
    time: row.game_time,
    stadium: row.stadium,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    status: row.status,
    innings: row.innings,
    homeStarter: row.home_starter ?? null,
    awayStarter: row.away_starter ?? null
  };
}

function toStanding(row: {
  team_id: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  games_behind: string;
  form: Array<"win" | "lose" | "draw">;
}): TeamStanding {
  const resultMap = {
    win: "W",
    lose: "L",
    draw: "D"
  } as const;
  const decisions = row.wins + row.losses;

  return {
    teamId: row.team_id,
    rank: row.rank,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: decisions > 0 ? `.${Math.round((row.wins / decisions) * 1000).toString().padStart(3, "0")}` : ".000",
    gamesBehind: row.games_behind,
    form: row.form.map((item) => resultMap[item])
  };
}

export async function listTeamsFromDb(): Promise<Team[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id,name,short_name,initial,color,accent")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load teams: ${error.message}`);
  }

  return data.map(toTeam);
}

export async function listGamesFromDb(params: { from: string; to: string; teamId?: string }): Promise<GameRecord[]> {
  const supabase = createSupabaseAdminClient();

  // 선발 컬럼 포함 select — add-games-starters.sql 적용 전이면 42703(undefined_column)으로 실패하므로
  // 그 경우 기본 컬럼만으로 fallback. SQL 적용 후엔 fallback 분기 안 탐.
  const baseCols = "id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status,innings";
  const withStarterCols = `${baseCols},home_starter,away_starter`;

  const runQuery = async (cols: string) => {
    let q = supabase
      .from("games")
      .select(cols)
      .gte("game_date", params.from)
      .lte("game_date", params.to)
      .order("game_date", { ascending: true })
      .order("game_time", { ascending: true });
    if (params.teamId) {
      q = q.or(`home_team_id.eq.${params.teamId},away_team_id.eq.${params.teamId}`);
    }
    return q;
  };

  let { data, error } = await runQuery(withStarterCols);
  if (error?.code === "42703") {
    const fb = await runQuery(baseCols);
    if (fb.error) throw new Error(`Failed to load games: ${fb.error.message}`);
    data = fb.data;
    error = null;
  } else if (error) {
    throw new Error(`Failed to load games: ${error.message}`);
  }

  return (data ?? []).map((row) => toGame(row as Parameters<typeof toGame>[0]));
}

export async function listStandingsFromDb(season: number): Promise<TeamStanding[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_standings")
    .select("team_id,rank,wins,losses,draws,games_behind,form")
    .eq("season", season)
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(`Failed to load standings: ${error.message}`);
  }

  return data.map(toStanding);
}
