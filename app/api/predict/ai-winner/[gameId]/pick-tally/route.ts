import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 집계는 사용자 무관(모두 동일) → 공개 캐시로 CDN에서 재사용.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
};

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
    return NextResponse.json({ total: 0, teams: {} }, { headers: PUBLIC_CACHE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  // locked_at 유무와 무관하게 전부 집계 — 새 모델에선 선택 즉시 locked 라 사실상 동일.
  const teams: Record<string, number> = {};
  let total = 0;
  const PAGE = 1000;
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from("bp_predictions")
      .select("predicted_winner_team_id")
      .eq("game_id", gameId)
      .range(from, from + PAGE - 1);
    if (error) {
      return NextResponse.json({ total: 0, teams: {} }, { headers: PUBLIC_CACHE_HEADERS });
    }
    const rows = (data ?? []) as Array<{ predicted_winner_team_id: string | null }>;
    for (const r of rows) {
      const t = r.predicted_winner_team_id;
      if (!t) continue;
      teams[t] = (teams[t] ?? 0) + 1;
      total += 1;
    }
    if (rows.length < PAGE) break;
  }

  return NextResponse.json({ total, teams }, { headers: PUBLIC_CACHE_HEADERS });
}
