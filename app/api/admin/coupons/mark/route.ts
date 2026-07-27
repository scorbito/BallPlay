import { NextResponse } from "next/server";
import { getUserTier } from "@/lib/auth/userTier";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 운영자 전용 — 당첨자를 '외부 지급 완료'로 표시/해제 (쿠폰함 도입 이전 외부 전달분).
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const server = createSupabaseServerClient();
  const { tier } = await getUserTier(server);
  if (tier !== "admin") {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { weekStartDate?: string; userId?: string; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }
  const weekStartDate = String(body.weekStartDate ?? "");
  const userId = String(body.userId ?? "");
  const done = Boolean(body.done);
  if (!DATE_RE.test(weekStartDate) || !userId) {
    return NextResponse.json({ ok: false, error: "잘못된 파라미터" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: readErr } = await admin
    .from("bp_predict_event_draws")
    .select("coupon_issued_external")
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json({ ok: false, error: "추첨 기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const current: string[] = Array.isArray(row.coupon_issued_external)
    ? (row.coupon_issued_external as unknown[]).map((v) => String(v))
    : [];
  const set = new Set(current);
  if (done) set.add(userId);
  else set.delete(userId);
  const next = Array.from(set);

  const { error: updErr } = await admin
    .from("bp_predict_event_draws")
    .update({ coupon_issued_external: next })
    .eq("week_start_date", weekStartDate);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, external: next });
}
