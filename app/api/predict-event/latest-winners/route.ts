import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 사용자 무관(모두 동일) → 공개 캐시로 CDN 재사용.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
};

/**
 * 홈 "지난주 예측왕" 스트립용 — 가장 최근 확정된 예측왕.
 * 닉네임만 노출(연락처 X). 등재된 예측왕이 없으면 show:false.
 */
export async function GET() {
  const admin = createSupabaseAdminClient();

  // 확정 발표된 주만 노출 — 관리자가 "당첨자 확정"을 누른 주(published_at)만.
  // 이벤트 종료 후엔 참여상이 없으므로 예측왕이 나온 주만(= 명예의 전당 등재분).
  const { data: draw } = await admin
    .from("bp_predict_event_draws")
    .select("week_start_date, week_end_date, winner_nickname")
    .not("published_at", "is", null)
    .not("winner_user_id", "is", null)
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draw) {
    return NextResponse.json({ show: false }, { headers: PUBLIC_CACHE_HEADERS });
  }

  return NextResponse.json(
    {
      show: true,
      weekStart: draw.week_start_date,
      weekEnd: draw.week_end_date,
      winnerNickname: draw.winner_nickname ?? null
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}
