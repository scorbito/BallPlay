import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 사용자 무관(모두 동일) → 공개 캐시로 CDN 재사용.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
};

/**
 * 홈 "지난주 예측왕" 스트립용 — 가장 최근 추첨 결과 + 당첨자 발표 공지 링크.
 * 닉네임만 노출(연락처 X). 추첨 이력이 없으면 show:false.
 */
export async function GET() {
  const admin = createSupabaseAdminClient();

  const { data: draw } = await admin
    .from("bp_predict_event_draws")
    .select("week_start_date, week_end_date, winner_nickname, winner_user_id, coupon_winners")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draw || (!draw.winner_user_id && (!Array.isArray(draw.coupon_winners) || draw.coupon_winners.length === 0))) {
    return NextResponse.json({ show: false }, { headers: PUBLIC_CACHE_HEADERS });
  }

  // 당첨자 발표 공지(최신)로 연결. 없으면 공지 목록으로 폴백.
  const { data: notice } = await admin
    .from("bp_notices")
    .select("id")
    .ilike("title", "%당첨자 발표%")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    {
      show: true,
      weekStart: draw.week_start_date,
      weekEnd: draw.week_end_date,
      winnerNickname: draw.winner_nickname ?? null, // null = 그 주 예측왕 없음(AI 승)
      couponCount: Array.isArray(draw.coupon_winners) ? draw.coupon_winners.length : 0,
      noticeId: notice?.id ?? null
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}
