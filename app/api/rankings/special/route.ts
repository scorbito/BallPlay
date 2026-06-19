import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TeamGameStatRow = {
  game_id: string | null;
  game_date: string | null;
  team_id: string;
  opponent_team_id: string | null;
  is_home: boolean | null;
  inning_scores: unknown;
  runs: number | null;
  hits: number | null;
  walks: number | null;
  hbp: number | null;
  rbi: number | null;
  doubles: number | null;
  triples: number | null;
  homers: number | null;
  total_bases: number | null;
  gidp: number | null;
  late_runs: number | null;
  sacrifice_hits: number | null;
  sacrifice_flies: number | null;
  stolen_bases: number | null;
  caught_stealing: number | null;
  pitcher_hits_allowed: number | null;
  pitcher_homers_allowed: number | null;
  pitcher_strikeouts: number | null;
  pitcher_runs_allowed: number | null;
  pitcher_earned_runs: number | null;
  pitcher_walks_hbp: number | null;
  errors: number | null;
};

type TeamAggregate = {
  team_id: string;
  games_played: number;
  total_runs: number;
  total_hits: number;
  total_walks_hbp: number;
  total_rbi: number;
  total_doubles: number;
  total_triples: number;
  total_homers: number;
  total_bases: number;
  total_gidp: number;
  total_late_runs: number;
  total_sacrifice_hits_flies: number;
  total_left_on_base: number;
  total_stolen_bases: number;
  total_caught_stealing: number;
  total_pitcher_hits_allowed: number;
  total_pitcher_homers_allowed: number;
  total_pitcher_strikeouts: number;
  total_pitcher_runs_allowed: number;
  total_pitcher_earned_runs: number;
  total_pitcher_walks_hbp: number;
  total_errors: number;
  comeback_wins: number;
  comeback_losses: number;
  first_score_games: number;
  first_score_wins: number;
  late_comeback_wins: number;
};

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0) || 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeInningScores(value: unknown): number[] {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!Array.isArray(parsed)) return [];

  return parsed.map((score) => numberValue(Number(score)));
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function cumulativeScores(teamScores: number[], opponentScores: number[]) {
  const length = Math.max(teamScores.length, opponentScores.length);
  const snapshots: Array<{ team: number; opponent: number }> = [];
  let team = 0;
  let opponent = 0;

  for (let i = 0; i < length; i += 1) {
    team += numberValue(teamScores[i]);
    opponent += numberValue(opponentScores[i]);
    snapshots.push({ team, opponent });
  }

  return snapshots;
}

function getFirstScoringTeam(row: TeamGameStatRow, opponent: TeamGameStatRow) {
  const teamScores = normalizeInningScores(row.inning_scores);
  const opponentScores = normalizeInningScores(opponent.inning_scores);
  const length = Math.max(teamScores.length, opponentScores.length);

  for (let i = 0; i < length; i += 1) {
    const teamRuns = numberValue(teamScores[i]);
    const opponentRuns = numberValue(opponentScores[i]);

    if (teamRuns <= 0 && opponentRuns <= 0) continue;
    if (teamRuns > 0 && opponentRuns <= 0) return row.team_id;
    if (opponentRuns > 0 && teamRuns <= 0) return opponent.team_id;

    return row.is_home ? opponent.team_id : row.team_id;
  }

  return null;
}

function applyFlowStats(target: TeamAggregate, row: TeamGameStatRow, opponent: TeamGameStatRow) {
  const teamRuns = numberValue(row.runs);
  const opponentRuns = numberValue(row.pitcher_runs_allowed);
  const won = teamRuns > opponentRuns;
  const lost = teamRuns < opponentRuns;
  const snapshots = cumulativeScores(
    normalizeInningScores(row.inning_scores),
    normalizeInningScores(opponent.inning_scores)
  );
  const beforeFinal = snapshots.slice(0, Math.max(0, snapshots.length - 1));
  const trailedBeforeFinal = beforeFinal.some((score) => score.team < score.opponent);
  const ledBeforeFinal = beforeFinal.some((score) => score.team > score.opponent);
  const trailedAfterSixthOrLater = beforeFinal.some(
    (score, index) => index >= 5 && score.team < score.opponent
  );
  const firstScoringTeam = getFirstScoringTeam(row, opponent);

  if (won && trailedBeforeFinal) target.comeback_wins += 1;
  if (lost && ledBeforeFinal) target.comeback_losses += 1;
  if (won && trailedAfterSixthOrLater) target.late_comeback_wins += 1;

  if (firstScoringTeam === row.team_id) {
    target.first_score_games += 1;
    if (won) target.first_score_wins += 1;
  }
}

function createAggregate(teamId: string): TeamAggregate {
  return {
    team_id: teamId,
    games_played: 0,
    total_runs: 0,
    total_hits: 0,
    total_walks_hbp: 0,
    total_rbi: 0,
    total_doubles: 0,
    total_triples: 0,
    total_homers: 0,
    total_bases: 0,
    total_gidp: 0,
    total_late_runs: 0,
    total_sacrifice_hits_flies: 0,
    total_left_on_base: 0,
    total_stolen_bases: 0,
    total_caught_stealing: 0,
    total_pitcher_hits_allowed: 0,
    total_pitcher_homers_allowed: 0,
    total_pitcher_strikeouts: 0,
    total_pitcher_runs_allowed: 0,
    total_pitcher_earned_runs: 0,
    total_pitcher_walks_hbp: 0,
    total_errors: 0,
    comeback_wins: 0,
    comeback_losses: 0,
    first_score_games: 0,
    first_score_wins: 0,
    late_comeback_wins: 0
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: rows, error: rawError } = await supabase
      .from("bp_team_game_stats")
      .select(
        "game_id, game_date, team_id, opponent_team_id, is_home, inning_scores, runs, hits, walks, hbp, rbi, doubles, triples, homers, total_bases, gidp, late_runs, sacrifice_hits, sacrifice_flies, stolen_bases, caught_stealing, pitcher_hits_allowed, pitcher_homers_allowed, pitcher_strikeouts, pitcher_runs_allowed, pitcher_earned_runs, pitcher_walks_hbp, errors"
      )
      .gte("game_date", "2026-01-01");

    if (rawError) {
      console.error("[rankings/special] Raw query failed:", rawError.message);
      return NextResponse.json(
        { ok: false, error: "랭킹 데이터를 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const typedRows = (rows || []) as TeamGameStatRow[];
    const asOfDate = typedRows.reduce((latest, row) => {
      if (!row.game_date) return latest;
      return !latest || row.game_date > latest ? row.game_date : latest;
    }, "");
    const statsMap: Record<string, TeamAggregate> = {};
    const rowsByGame = new Map<string, TeamGameStatRow[]>();

    for (const row of typedRows) {
      if (row.game_id) {
        rowsByGame.set(row.game_id, [...(rowsByGame.get(row.game_id) || []), row]);
      }
    }

    for (const r of typedRows) {
      if (!statsMap[r.team_id]) {
        statsMap[r.team_id] = createAggregate(r.team_id);
      }

      const t = statsMap[r.team_id];
      t.games_played += 1;
      t.total_runs += numberValue(r.runs);
      t.total_hits += numberValue(r.hits);
      t.total_walks_hbp += numberValue(r.walks) + numberValue(r.hbp);
      t.total_rbi += numberValue(r.rbi);
      t.total_doubles += numberValue(r.doubles);
      t.total_triples += numberValue(r.triples);
      t.total_homers += numberValue(r.homers);
      t.total_bases += numberValue(r.total_bases);
      t.total_gidp += numberValue(r.gidp);
      t.total_late_runs += numberValue(r.late_runs);
      t.total_sacrifice_hits_flies += numberValue(r.sacrifice_hits) + numberValue(r.sacrifice_flies);

      const lob = numberValue(r.hits) + numberValue(r.walks) + numberValue(r.hbp) - numberValue(r.runs);
      t.total_left_on_base += lob;

      t.total_stolen_bases += numberValue(r.stolen_bases);
      t.total_caught_stealing += numberValue(r.caught_stealing);
      t.total_pitcher_hits_allowed += numberValue(r.pitcher_hits_allowed);
      t.total_pitcher_homers_allowed += numberValue(r.pitcher_homers_allowed);
      t.total_pitcher_strikeouts += numberValue(r.pitcher_strikeouts);
      t.total_pitcher_runs_allowed += numberValue(r.pitcher_runs_allowed);
      t.total_pitcher_earned_runs += numberValue(r.pitcher_earned_runs);
      t.total_pitcher_walks_hbp += numberValue(r.pitcher_walks_hbp);
      t.total_errors += numberValue(r.errors);

      const gameRows = r.game_id ? rowsByGame.get(r.game_id) || [] : [];
      const opponent =
        gameRows.find((gameRow) => gameRow.team_id === r.opponent_team_id) ||
        gameRows.find((gameRow) => gameRow.team_id !== r.team_id);

      if (opponent) {
        applyFlowStats(t, r, opponent);
      }
    }

    const rankingRows = Object.values(statsMap).map((t) => ({
      team_id: t.team_id,
      games_played: t.games_played,
      total_runs: t.total_runs,
      avg_runs: t.games_played > 0 ? round2(t.total_runs / t.games_played) : 0,
      total_hits: t.total_hits,
      avg_hits: t.games_played > 0 ? round2(t.total_hits / t.games_played) : 0,
      total_walks_hbp: t.total_walks_hbp,
      total_rbi: t.total_rbi,
      total_doubles: t.total_doubles,
      total_triples: t.total_triples,
      total_homers: t.total_homers,
      total_bases: t.total_bases,
      total_gidp: t.total_gidp,
      total_late_runs: t.total_late_runs,
      total_sacrifice_hits_flies: t.total_sacrifice_hits_flies,
      avg_left_on_base: t.games_played > 0 ? round2(t.total_left_on_base / t.games_played) : 0,
      total_stolen_bases: t.total_stolen_bases,
      total_caught_stealing: t.total_caught_stealing,
      total_pitcher_hits_allowed: t.total_pitcher_hits_allowed,
      total_pitcher_homers_allowed: t.total_pitcher_homers_allowed,
      total_pitcher_strikeouts: t.total_pitcher_strikeouts,
      total_pitcher_runs_allowed: t.total_pitcher_runs_allowed,
      avg_runs_allowed: t.games_played > 0 ? round2(t.total_pitcher_runs_allowed / t.games_played) : 0,
      avg_earned_runs: t.games_played > 0 ? round2(t.total_pitcher_earned_runs / t.games_played) : 0,
      total_pitcher_walks_hbp: t.total_pitcher_walks_hbp,
      total_errors: t.total_errors,
      comeback_wins: t.comeback_wins,
      comeback_losses: t.comeback_losses,
      first_score_games: t.first_score_games,
      first_score_wins: t.first_score_wins,
      first_score_win_rate:
        t.first_score_games > 0 ? round2((t.first_score_wins / t.first_score_games) * 100) : 0,
      late_comeback_wins: t.late_comeback_wins
    }));

    return NextResponse.json({ ok: true, source: "team_game_stats", asOfDate, rows: rankingRows });
  } catch (err) {
    console.error("[rankings/special] Internal Server Error:", err);
    return NextResponse.json(
      { ok: false, error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
