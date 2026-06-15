import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
};

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const supabase = createSupabaseAdminClient();

  // bp_ai_battle_predictions 테이블에서 해당 game_id에 맞는 배틀 데이터 조회
  // admin client를 사용하여 양팀 데이터 존재 여부로 공개 여부를 판단합니다.
  const { data: predictions, error } = await supabase
    .from("bp_ai_battle_predictions")
    .select("id, game_id, game_date, target_side, ai_provider, model_name, predicted_winner_team_id, key_factor, one_liner, detailed_analysis, counter_argument, published_at, is_correct")
    .eq("game_id", params.gameId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const list = predictions ?? [];
  const hasHome = list.some((p) => p.target_side === "home");
  const hasAway = list.some((p) => p.target_side === "away");
  const isReleased = hasHome && hasAway;

  return NextResponse.json({
    ok: true,
    gameId: params.gameId,
    predictions: isReleased ? list : []
  }, { headers: PUBLIC_CACHE_HEADERS });
}
