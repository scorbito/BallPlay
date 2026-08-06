// 공용: 특정 날짜의 모든 경기를 1000판 시뮬해 bp_sim_results 에 UPSERT.
//
// 사용처:
//   - /api/cron/sim-1000  : 매일 09:00 KST 자동
//   - /api/admin/sim-1000/rerun : 운영자 수동 재실행 (발표 라인업 반영 등)
//
// 핵심 로직은 한 곳에만: 경기별 try/catch 격리해 한 경기 실패가 다른 경기를 막지 않음.
// (game_id, game_date) unique + UPSERT 라 동시/반복 실행에도 마지막 결과로 수렴.

import type { SupabaseClient } from "@supabase/supabase-js";

import { runBatchSim } from "@/lib/server/sim/runBatchSim";

type GameRow = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_starter: string | null;
  away_starter: string | null;
  stadium: string | null;
  status: string;
};

export type DailySimPerGameResult = {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  ok: boolean;
  error?: string;
  elapsedMs?: number;
  homeWins?: number;
  awayWins?: number;
};

export type DailySimOutcome = {
  ok: true;
  gameDate: string;
  total: number;
  ran: number;
  failed: number;
  results: DailySimPerGameResult[];
};

export type DailySimError = {
  ok: false;
  error: string;
};

/**
 * date 일자의 모든 (취소 제외) 경기를 시뮬해 bp_sim_results 에 upsert.
 * adminClient 는 service-role 권한이 필요 (UPSERT 및 선발 컬럼 조회).
 */
export async function runDailySimAndUpsert(
  adminClient: SupabaseClient,
  date: string
): Promise<DailySimOutcome | DailySimError> {
  const { data: games, error: gErr } = await adminClient
    .from("games")
    .select("id, game_date, home_team_id, away_team_id, home_starter, away_starter, stadium, status")
    .eq("game_date", date)
    .order("game_time", { ascending: true });

  if (gErr) {
    return { ok: false, error: `games query: ${gErr.message}` };
  }

  // 취소된 경기는 제외 (cron 핸들러는 status 필터 없었지만 spec 에 명시 → admin 양쪽 동일하게 적용).
  const rows = ((games ?? []) as GameRow[]).filter((g) => g.status !== "canceled");

  const results: DailySimPerGameResult[] = [];

  for (const game of rows) {
    try {
      const sim = await runBatchSim(adminClient, {
        gameId: game.id,
        gameDate: game.game_date,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        homeStarter: game.home_starter,
        awayStarter: game.away_starter,
        stadium: game.stadium
      });

      if (!sim.ok) {
        results.push({
          gameId: game.id,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          ok: false,
          error: sim.error
        });
        continue;
      }

      const { error: upErr } = await adminClient
        .from("bp_sim_results")
        .upsert(
          {
            game_id: game.id,
            game_date: game.game_date,
            run_at: new Date().toISOString(),
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id,
            home_starter: game.home_starter,
            away_starter: game.away_starter,
            lineup_source_home: sim.lineupSource.home,
            lineup_source_away: sim.lineupSource.away,
            n: sim.n,
            home_wins: sim.summary.homeWins,
            away_wins: sim.summary.awayWins,
            ties: sim.summary.ties,
            home_avg_runs: Number(sim.summary.homeAvgRuns.toFixed(2)),
            away_avg_runs: Number(sim.summary.awayAvgRuns.toFixed(2)),
            extra_inning_count: sim.summary.extraInningCount,
            diff_hist: sim.diffHist,
            batters: sim.batters,
            pitchers: sim.pitchers,
            mvp_freq: sim.mvpFreq,
            engine_version: sim.engineVersion
          },
          { onConflict: "game_id,game_date" }
        );

      if (upErr) {
        results.push({
          gameId: game.id,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          ok: false,
          error: `upsert: ${upErr.message}`
        });
        continue;
      }

      results.push({
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        ok: true,
        elapsedMs: sim.elapsedMs,
        homeWins: sim.summary.homeWins,
        awayWins: sim.summary.awayWins
      });
    } catch (err) {
      results.push({
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        ok: false,
        error: (err as Error).message
      });
    }
  }

  const ran = results.filter((r) => r.ok).length;
  const failed = results.length - ran;

  return {
    ok: true,
    gameDate: date,
    total: rows.length,
    ran,
    failed,
    results
  };
}
