import { createSupabaseAdminClient } from "@/lib/supabase/server";

type BullpenSnapshot = {
  snapshot_date: string;
  team_id: string;
  recent10_games: number;
  recent10_era: number | null;
  recent10_whip: number | null;
  late_runs_allowed_per_game: number | null;
  pitches_last_3_days: number;
  back_to_back_pitchers: number;
  high_usage_yesterday: number;
  source_through_date: string;
};

export type UpsertBullpenDailyResult = {
  snapshotDate: string;
  teams: number;
  upserted: number;
};

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(2)) : null;
}

export async function upsertBullpenDailySnapshots(sourceThroughDate: string): Promise<UpsertBullpenDailyResult> {
  const supabase = createSupabaseAdminClient();
  // 경기 없는 날에는 동기화가 생략될 수 있으므로, 다음 달력일이 아니라 리그의 다음 예정 경기일을 찾는다.
  const { data: upcomingGames, error: upcomingGamesError } = await supabase
    .from("games")
    .select("game_date,home_team_id,away_team_id")
    .gt("game_date", sourceThroughDate)
    .neq("status", "canceled")
    .order("game_date", { ascending: true })
    .limit(20);

  if (upcomingGamesError) throw new Error(upcomingGamesError.message);

  const snapshotDate = upcomingGames?.[0]?.game_date ?? addDays(sourceThroughDate, 1);
  const nextGames = (upcomingGames ?? []).filter((game) => game.game_date === snapshotDate);
  const teamIds = Array.from(new Set(nextGames.flatMap((game) => [game.home_team_id, game.away_team_id])));
  if (teamIds.length === 0) return { snapshotDate, teams: 0, upserted: 0 };

  const snapshots = await Promise.all(teamIds.map(async (teamId): Promise<BullpenSnapshot> => {
    const { data: recentGames, error: recentGamesError } = await supabase
      .from("games")
      .select("game_date")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", "finished")
      .lt("game_date", snapshotDate)
      .order("game_date", { ascending: false })
      .limit(10);
    if (recentGamesError) throw new Error(recentGamesError.message);

    const gameDates = (recentGames ?? []).map((game) => game.game_date);
    if (gameDates.length === 0) {
      return {
        snapshot_date: snapshotDate,
        team_id: teamId,
        recent10_games: 0,
        recent10_era: null,
        recent10_whip: null,
        late_runs_allowed_per_game: null,
        pitches_last_3_days: 0,
        back_to_back_pitchers: 0,
        high_usage_yesterday: 0,
        source_through_date: sourceThroughDate
      };
    }

    const [logsResult, teamStatsResult] = await Promise.all([
      supabase
        .from("bp_pitcher_game_logs")
        .select("pitcher_name,game_date,pitches,outs,hits_allowed,walks_hbp,earned_runs")
        .eq("team_id", teamId)
        .neq("pitcher_order", "1")
        .in("game_date", gameDates),
      supabase
        .from("bp_team_game_stats")
        .select("late_runs_allowed")
        .eq("team_id", teamId)
        .in("game_date", gameDates)
    ]);
    if (logsResult.error) throw new Error(logsResult.error.message);
    if (teamStatsResult.error) throw new Error(teamStatsResult.error.message);

    const logs = logsResult.data ?? [];
    const totals = logs.reduce((acc, row) => ({
      outs: acc.outs + Number(row.outs ?? 0),
      hits: acc.hits + Number(row.hits_allowed ?? 0),
      walks: acc.walks + Number(row.walks_hbp ?? 0),
      earnedRuns: acc.earnedRuns + Number(row.earned_runs ?? 0)
    }), { outs: 0, hits: 0, walks: 0, earnedRuns: 0 });

    const yesterday = addDays(snapshotDate, -1);
    const twoDaysAgo = addDays(snapshotDate, -2);
    const threeDaysAgo = addDays(snapshotDate, -3);
    const fatigueLogs = logs.filter((row) => row.game_date >= threeDaysAgo && row.game_date <= yesterday);
    const yesterdayPitchers = new Set(logs.filter((row) => row.game_date === yesterday).map((row) => row.pitcher_name));
    const twoDaysAgoPitchers = new Set(logs.filter((row) => row.game_date === twoDaysAgo).map((row) => row.pitcher_name));
    const lateRunsAllowed = (teamStatsResult.data ?? []).reduce((sum, row) => sum + Number(row.late_runs_allowed ?? 0), 0);

    return {
      snapshot_date: snapshotDate,
      team_id: teamId,
      recent10_games: gameDates.length,
      recent10_era: rate(totals.earnedRuns * 27, totals.outs),
      recent10_whip: rate((totals.hits + totals.walks) * 3, totals.outs),
      late_runs_allowed_per_game: (teamStatsResult.data?.length ?? 0) > 0 ? Number((lateRunsAllowed / gameDates.length).toFixed(1)) : null,
      pitches_last_3_days: fatigueLogs.reduce((sum, row) => sum + Number(row.pitches ?? 0), 0),
      back_to_back_pitchers: Array.from(yesterdayPitchers).filter((name) => twoDaysAgoPitchers.has(name)).length,
      high_usage_yesterday: logs.filter((row) => row.game_date === yesterday && Number(row.pitches ?? 0) >= 25).length,
      source_through_date: sourceThroughDate
    };
  }));

  const { error: upsertError } = await supabase
    .from("bp_team_bullpen_daily")
    .upsert(snapshots, { onConflict: "snapshot_date,team_id" });
  if (upsertError) throw new Error(upsertError.message);

  return { snapshotDate, teams: teamIds.length, upserted: snapshots.length };
}