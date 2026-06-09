import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET ?ids=uuid1,uuid2,... → 홈+원정 예측이 모두 있는 game_id 배열 반환 */
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json([]);

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("bp_ai_battle_predictions")
    .select("game_id, target_side")
    .in("game_id", ids);

  const map = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!map.has(r.game_id)) map.set(r.game_id, new Set());
    map.get(r.game_id)!.add(r.target_side);
  }

  const active: string[] = [];
  map.forEach((sides, id) => {
    if (sides.has("home") && sides.has("away")) active.push(id);
  });

  return NextResponse.json(active);
}
