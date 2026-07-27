import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 쿠폰 열람 표시 — 유저별 mutation, 캐시 금지.
export const dynamic = "force-dynamic";

/** 당첨자가 쿠폰을 처음 열면 viewed_at 을 기록(NEW 배지 해제). 본인 쿠폰만. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const server = createSupabaseServerClient();
  const { data: authData } = await server.auth.getUser();
  const user = authData.user;
  if (!user || user.is_anonymous) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  // 본인 소유 + 아직 안 본 쿠폰만 갱신 — 남의 쿠폰 조작 차단.
  const { error } = await admin
    .from("bp_coupons")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("viewed_at", null);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
