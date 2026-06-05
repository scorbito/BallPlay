// GET /api/cron/push-daily
//
// 매일 12:00 KST(=03:00 UTC) 실행 — 오늘 published AI 예측이 있을 때만 전체 구독자에게
// "오늘 프로야구 경기 AI 예측이 도착했어요" 푸시 발송.
//
// ⚠️ vercel.json cron 한도(2개)가 꽉 차서 이 엔드포인트는 vercel.json 에 등록하지 않음.
//    cron-job.org 에 매일 03:00 UTC + Authorization: Bearer <CRON_SECRET> 로 등록할 것.
//
// 보안: CRON_SECRET Bearer 검증 (다른 cron 핸들러 패턴).
// 데이터 가드: 오늘(KST) bp_ai_predictions 에서 published_at <= now() 인 행이 0이면 발송 안 함.
// 만료 정리: 410/404 응답(구독 만료)은 해당 row 삭제.
//
// 서버 전용: web-push / VAPID_PRIVATE_KEY 는 이 라우트에서만 import.

import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

const PAYLOAD = JSON.stringify({
  title: "오늘 프로야구 경기 AI 예측이 도착했어요",
  body: "야구놀이터에서 오늘의 AI 승부예측을 확인해보세요",
  url: "/predict/ai-winner",
  icon: "/assets/mascot-default.png"
});

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // VAPID 설정 — 서버 키 3개 필수.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json(
      { ok: false, error: "Missing VAPID environment variables" },
      { status: 500 }
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const admin = createSupabaseAdminClient();
  const today = kstToday();

  // 1) 오늘 published AI 예측 카운트 — 없으면 발송 안 함.
  const { count: publishedCount, error: countError } = await admin
    .from("bp_ai_predictions")
    .select("id", { count: "exact", head: true })
    .eq("game_date", today)
    .lte("published_at", new Date().toISOString());

  if (countError) {
    return NextResponse.json({ ok: false, error: countError.message }, { status: 500 });
  }
  if (!publishedCount || publishedCount === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no published predictions" });
  }

  // 2) 전체 구독 조회.
  const { data: subs, error: subsError } = await admin
    .from("bp_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (subsError) {
    return NextResponse.json({ ok: false, error: subsError.message }, { status: 500 });
  }

  const subscriptions = subs ?? [];
  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  // 3) 각 구독에 발송 (병렬). 410/404 는 만료 → 삭제 대상.
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth }
          },
          PAYLOAD
        );
        sent += 1;
      } catch (e: unknown) {
        failed += 1;
        const statusCode =
          e && typeof e === "object" && "statusCode" in e
            ? (e as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(s.endpoint);
        }
      }
    })
  );

  // 4) 만료 구독 정리.
  let removed = 0;
  if (expiredEndpoints.length > 0) {
    const { error: delError, count } = await admin
      .from("bp_push_subscriptions")
      .delete({ count: "exact" })
      .in("endpoint", expiredEndpoints);
    if (!delError) removed = count ?? expiredEndpoints.length;
  }

  return NextResponse.json({
    ok: true,
    checked: subscriptions.length,
    sent,
    failed,
    removed
  });
}
