import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // 1단계: Supabase View (v_bp_team_special_rankings) 조회 시도
    const { data: viewData, error: viewError } = await supabase
      .from("v_bp_team_special_rankings")
      .select("*");

    if (!viewError && viewData && viewData.length > 0) {
      return NextResponse.json({ ok: true, source: "view", rows: viewData });
    }

    console.warn(
      "[rankings/special] View query failed or empty, running in-memory aggregation fallback:",
      viewError?.message
    );

    // 2단계: 폴백 (메모리 합산 집계)
    const { data: rows, error: rawError } = await supabase
      .from("bp_team_game_stats")
      .select("team_id, total_bases, late_runs, sacrifice_hits, sacrifice_flies, hits, walks, hbp, runs, stolen_bases, caught_stealing, pitcher_strikeouts, pitcher_earned_runs, pitcher_walks_hbp, errors");

    if (rawError) {
      console.error("[rankings/special] Fallback raw query failed:", rawError.message);
      return NextResponse.json(
        { ok: false, error: "데이터를 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const statsMap: Record<string, any> = {};

    for (const r of rows || []) {
      if (!statsMap[r.team_id]) {
        statsMap[r.team_id] = {
          team_id: r.team_id,
          games_played: 0,
          total_bases: 0,
          total_late_runs: 0,
          total_sacrifice_hits_flies: 0,
          total_left_on_base: 0,
          total_stolen_bases: 0,
          total_caught_stealing: 0,
          total_pitcher_strikeouts: 0,
          total_pitcher_earned_runs: 0,
          total_pitcher_walks_hbp: 0,
          total_errors: 0
        };
      }

      const t = statsMap[r.team_id];
      t.games_played += 1;
      t.total_bases += r.total_bases || 0;
      t.total_late_runs += r.late_runs || 0;
      t.total_sacrifice_hits_flies += (r.sacrifice_hits || 0) + (r.sacrifice_flies || 0);

      // 잔루 계산: 안타 + 사사구 - 득점
      const lob = (r.hits || 0) + (r.walks || 0) + (r.hbp || 0) - (r.runs || 0);
      t.total_left_on_base += lob;

      t.total_stolen_bases += r.stolen_bases || 0;
      t.total_caught_stealing += r.caught_stealing || 0;
      t.total_pitcher_strikeouts += r.pitcher_strikeouts || 0;
      t.total_pitcher_earned_runs += r.pitcher_earned_runs || 0;
      t.total_pitcher_walks_hbp += r.pitcher_walks_hbp || 0;
      t.total_errors += r.errors || 0;
    }

    const fallbackData = Object.values(statsMap).map((t: any) => ({
      team_id: t.team_id,
      games_played: t.games_played,
      total_bases: t.total_bases,
      total_late_runs: t.total_late_runs,
      total_sacrifice_hits_flies: t.total_sacrifice_hits_flies,
      avg_left_on_base: t.games_played > 0 ? Math.round((t.total_left_on_base / t.games_played) * 100) / 100 : 0,
      total_stolen_bases: t.total_stolen_bases,
      total_caught_stealing: t.total_caught_stealing,
      total_pitcher_strikeouts: t.total_pitcher_strikeouts,
      avg_earned_runs: t.games_played > 0 ? Math.round((t.total_pitcher_earned_runs / t.games_played) * 100) / 100 : 0,
      total_pitcher_walks_hbp: t.total_pitcher_walks_hbp,
      total_errors: t.total_errors
    }));

    return NextResponse.json({ ok: true, source: "memory_fallback", rows: fallbackData });
  } catch (err) {
    console.error("[rankings/special] Internal Server Error:", err);
    return NextResponse.json(
      { ok: false, error: "서버 내부에 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
