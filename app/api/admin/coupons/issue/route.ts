import { NextResponse } from "next/server";
import { getUserTier } from "@/lib/auth/userTier";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 운영자 전용 쿠폰 지급 — 이미지 업로드 + bp_coupons INSERT.
export const dynamic = "force-dynamic";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const MAX_BYTES = 10 * 1024 * 1024; // 10MB (버킷 제한과 일치)

export async function POST(req: Request) {
  // 1) 운영자 인증 (API 라우트는 미들웨어 헤더가 없어 auth.getUser 기반으로 판정)
  const server = createSupabaseServerClient();
  const { tier, user } = await getUserTier(server);
  if (tier !== "admin" || !user) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
  }

  // 2) 폼 파싱
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const userId = String(form.get("userId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const source = String(form.get("source") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;
  const expiresRaw = String(form.get("expiresAt") ?? "").trim();
  const file = form.get("file");

  if (!userId) return NextResponse.json({ ok: false, error: "받는 사람이 없습니다." }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "쿠폰 제목을 입력하세요." }, { status: 400 });
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "쿠폰 이미지를 첨부하세요." }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "JPG/PNG/WEBP 이미지만 가능합니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "이미지가 10MB를 초과합니다." }, { status: 400 });
  }

  let expiresAt: string | null = null;
  if (expiresRaw) {
    const t = new Date(expiresRaw);
    if (!Number.isNaN(t.getTime())) expiresAt = t.toISOString();
  }

  const admin = createSupabaseAdminClient();

  // 3) 받는 사람이 실제 계정인지 확인 (오타로 엉뚱한 uid에 지급 방지)
  const { data: recipient, error: recipientErr } = await admin.auth.admin.getUserById(userId);
  if (recipientErr || !recipient?.user) {
    return NextResponse.json({ ok: false, error: "받는 사람 계정을 찾을 수 없습니다." }, { status: 400 });
  }

  // 4) 이미지 업로드 (비공개 버킷, 경로 = {uid}/{couponId}.ext)
  const couponId = crypto.randomUUID();
  const path = `${userId}/${couponId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage.from("coupon-images").upload(path, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadErr) {
    return NextResponse.json({ ok: false, error: `업로드 실패: ${uploadErr.message}` }, { status: 500 });
  }

  // 5) 쿠폰 row 삽입
  const { error: insertErr } = await admin.from("bp_coupons").insert({
    id: couponId,
    user_id: userId,
    title,
    image_path: path,
    source,
    note,
    issued_by: user.id,
    expires_at: expiresAt
  });
  if (insertErr) {
    // 롤백 — 방금 올린 이미지 정리
    await admin.storage.from("coupon-images").remove([path]);
    return NextResponse.json({ ok: false, error: `지급 실패: ${insertErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, couponId });
}
