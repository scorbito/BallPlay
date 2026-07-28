import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPickTally } from "@/lib/supabase/query-parts/bpPredictionTallies";

export const dynamic = "force-dynamic";

// 집계는 사용자 무관(모두 동일) → 공개 캐시로 CDN에서 재사용.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
};

const EMPTY = { total: 0, teams: {} };

/**
 * GET /api/predict/ai-winner/:gameId/pick-tally
 *   → 해당 경기의 승리팀 예측을 팀별로 집계.
 *   { total, teams: { [teamId]: count } }
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!gameId) {
    return NextResponse.json(EMPTY, { headers: PUBLIC_CACHE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  // count 쿼리를 쓰려면 셀 팀을 알아야 하므로 경기의 홈/원정을 먼저 조회.
  const { data: game, error } = await supabase
    .from("games")
    .select("id,home_team_id,away_team_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error || !game) {
    return NextResponse.json(EMPTY, { headers: PUBLIC_CACHE_HEADERS });
  }

  const row = game as { id: string; home_team_id: string; away_team_id: string };
  const tally = await getPickTally(supabase, {
    id: row.id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id
  });

  return NextResponse.json(tally, { headers: PUBLIC_CACHE_HEADERS });
}
