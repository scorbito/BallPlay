// POST /api/push/subscribe
// Body: { endpoint: string, keys: { p256dh: string, auth: string } }
//
// 인증된 user(익명 계정 포함)의 푸시 구독을 bp_push_subscriptions 에 upsert.
// onConflict endpoint — 같은 브라우저가 재구독하면 user_id/keys 갱신.
//
// 보안: 쿠키 세션의 user.id 로만 저장 → 남의 endpoint 를 본인 것으로 등록 불가.
//       RLS(own insert/update)와 service_role 둘 다 안전하게 동작하도록 admin 클라이언트로
//       upsert 하되 user_id 는 서버에서 검증한 값만 사용.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1) 본인 확인
  const userClient = createSupabaseServerClient();
  const { data: authData } = await userClient.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2) body 검증
  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : null;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "Missing subscription fields" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");

  // 3) upsert (onConflict endpoint) — endpoint 가 unique 라 같은 기기 1행 유지.
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("bp_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
