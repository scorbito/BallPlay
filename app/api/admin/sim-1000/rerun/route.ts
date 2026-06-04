// POST /api/admin/sim-1000/rerun
// Body: { date?: "YYYY-MM-DD" }   // 기본값: KST 오늘
//
// 운영자(admin) 수동 재실행 엔드포인트.
// 09:00 cron 이후 발표 라인업/선발 교체 등이 반영된 데이터로 다시 시뮬할 때 사용.
//
// 보안: 쿠키 세션 → getUserTier → tier !== "admin" 이면 403.
//      실제 시뮬+UPSERT 는 service-role 어드민 클라이언트로 수행 (cron 핸들러와 동일).
//
// 실패 격리: 한 경기 실패가 다른 경기를 막지 않음 (공용 함수에서 try/catch).

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth/userTier";
import { runDailySimAndUpsert } from "@/lib/server/sim/runDailySimAndUpsert";

export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  // 1) admin 판정 — 쿠키 기반 사용자 세션
  const userClient = createSupabaseServerClient();
  const { tier } = await getUserTier(userClient);
  if (tier !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // 2) body.date 검증 (없거나 잘못된 형식이면 KST 오늘)
  let date = kstToday();
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.date === "string" && DATE_RE.test(body.date)) {
      date = body.date;
    }
  } catch {
    // body 없음 → 기본값 그대로
  }

  // 3) 시뮬+UPSERT (service-role)
  const admin = createSupabaseAdminClient();
  const outcome = await runDailySimAndUpsert(admin, date);

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }

  // 4) ISR 무효화
  try {
    revalidatePath("/predict/sim-1000");
  } catch {
    // 무시 — 본 작업은 성공.
  }

  return NextResponse.json({
    ok: true,
    gameDate: outcome.gameDate,
    ran: outcome.ran,
    failed: outcome.failed,
    results: outcome.results
  });
}
