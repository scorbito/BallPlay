// 매일 09시 KST 실행 — 오늘 경기 전체를 1000판 시뮬해 bp_sim_results 에 UPSERT.
// /predict/sim-1000 페이지가 이 캐시를 조회.
//
// 보안: CRON_SECRET 환경변수 헤더 검증 (다른 cron 핸들러 패턴).
// 동시 실행: vercel.json 의 단일 cron 만 호출. 외부에서 짧은 간격으로 두 번 트리거돼도
//          (game_id, game_date) unique + UPSERT 라 마지막 결과로 수렴.
// timeout: 1경기당 1000판 ~3~5초, 최대 5경기 → 25초 안팎. maxDuration=60s 로 여유 확보.
//          그래도 안전망으로 경기별 try/catch 격리해서 한 경기 실패가 다른 경기를 막지 않음.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runBatchSim } from "@/lib/server/sim/runBatchSim";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type GameRow = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_starter: string | null;
  away_starter: string | null;
  status: string;
};

type PerGameLog = {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  ok: boolean;
  error?: string;
  elapsedMs?: number;
  homeWins?: number;
  awayWins?: number;
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateOverride = url.searchParams.get("date"); // YYYY-MM-DD (수동 트리거용)
  const gameDate = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)
    ? dateOverride
    : formatDate(kstNow());

  const sb = createSupabaseAdminClient();

  // 오늘 경기 조회 — 선발 컬럼 포함.
  const { data: games, error: gErr } = await sb
    .from("games")
    .select("id, game_date, home_team_id, away_team_id, home_starter, away_starter, status")
    .eq("game_date", gameDate)
    .order("game_time", { ascending: true });

  if (gErr) {
    return NextResponse.json({ ok: false, error: `games query: ${gErr.message}` }, { status: 500 });
  }

  const rows = (games ?? []) as GameRow[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, gameDate, total: 0, results: [] });
  }

  const logs: PerGameLog[] = [];

  for (const game of rows) {
    try {
      const result = await runBatchSim(sb, {
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        homeStarter: game.home_starter,
        awayStarter: game.away_starter
      });

      if (!result.ok) {
        logs.push({
          gameId: game.id,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          ok: false,
          error: result.error
        });
        continue;
      }

      // UPSERT to bp_sim_results
      const { error: upErr } = await sb
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
            lineup_source_home: result.lineupSource.home,
            lineup_source_away: result.lineupSource.away,
            n: result.n,
            home_wins: result.summary.homeWins,
            away_wins: result.summary.awayWins,
            ties: result.summary.ties,
            home_avg_runs: Number(result.summary.homeAvgRuns.toFixed(2)),
            away_avg_runs: Number(result.summary.awayAvgRuns.toFixed(2)),
            extra_inning_count: result.summary.extraInningCount,
            diff_hist: result.diffHist,
            batters: result.batters,
            pitchers: result.pitchers,
            mvp_freq: result.mvpFreq,
            engine_version: result.engineVersion
          },
          { onConflict: "game_id,game_date" }
        );

      if (upErr) {
        logs.push({
          gameId: game.id,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          ok: false,
          error: `upsert: ${upErr.message}`
        });
        continue;
      }

      logs.push({
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        ok: true,
        elapsedMs: result.elapsedMs,
        homeWins: result.summary.homeWins,
        awayWins: result.summary.awayWins
      });
    } catch (err) {
      logs.push({
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        ok: false,
        error: (err as Error).message
      });
    }
  }

  // ISR 무효화 — /predict/sim-1000 페이지 캐시 갱신
  try {
    revalidatePath("/predict/sim-1000");
  } catch {
    // revalidatePath 실패해도 cron 자체는 성공으로 처리.
  }

  const ok = logs.filter((l) => l.ok).length;
  const failed = logs.length - ok;
  return NextResponse.json({
    ok: true,
    gameDate,
    total: rows.length,
    succeeded: ok,
    failed,
    results: logs
  });
}
