import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 안 본 쿠폰 수만 반환 — 홈 "쿠폰 도착" 모달용 경량 엔드포인트(서명 URL 생성 안 함).
export const dynamic = "force-dynamic";

export async function GET() {
  const server = createSupabaseServerClient();
  const { data: authData } = await server.auth.getUser();
  const user = authData.user;
  if (!user || user.is_anonymous) return NextResponse.json({ count: 0 });

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("bp_coupons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("viewed_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
