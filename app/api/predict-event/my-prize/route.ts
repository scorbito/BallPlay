import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 본인 세션 기준 당첨 여부 판별 — 유저별로 달라 캐시 금지.
export const dynamic = "force-dynamic";

const PRIZE_BY_ROLE: Record<"main" | "coupon", string> = {
  main: "뿌링클 콤보 쿠폰",
  coupon: "메가커피 5,000원 쿠폰",
};

/**
 * 로그인 사용자가 최신 추첨의 당첨자이고 "등록 이메일이 없는(카카오)" 경우에만 show:true.
 * 구글 당첨자는 등록 이메일로 자동 발송하므로 모달을 띄우지 않는다.
 */
export async function GET() {
  const server = createSupabaseServerClient();
  const { data: authData } = await server.auth.getUser();
  const user = authData.user;
  if (!user || user.is_anonymous) return NextResponse.json({ show: false });

  const admin = createSupabaseAdminClient();
  const { data: draw } = await admin
    .from("bp_predict_event_draws")
    .select("week_start_date, winner_user_id, winner_nickname, coupon_winners")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draw) return NextResponse.json({ show: false });

  let role: "main" | "coupon" | null = null;
  let nickname: string | null = null;
  if (draw.winner_user_id && String(draw.winner_user_id) === user.id) {
    role = "main";
    nickname = draw.winner_nickname ?? null;
  } else {
    const coupon = (Array.isArray(draw.coupon_winners) ? draw.coupon_winners : []).find(
      (c: { userId?: string; nickname?: string | null }) => String(c?.userId) === user.id
    );
    if (coupon) {
      role = "coupon";
      nickname = coupon.nickname ?? null;
    }
  }
  if (!role) return NextResponse.json({ show: false });

  // 이메일이 있으면(구글) 자동 발송 대상 → 모달 불필요. 없으면(카카오) 연락 유도.
  if (user.email) return NextResponse.json({ show: false });

  return NextResponse.json({
    show: true,
    role,
    prize: PRIZE_BY_ROLE[role],
    nickname,
    weekStart: draw.week_start_date,
  });
}
