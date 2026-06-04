// 매일 09시 KST 실행 — 오늘 경기 전체를 1000판 시뮬해 bp_sim_results 에 UPSERT.
// /predict/sim-1000 페이지가 이 캐시를 조회.
//
// 보안: CRON_SECRET 환경변수 헤더 검증 (다른 cron 핸들러 패턴).
// 동시 실행: vercel.json 의 단일 cron 만 호출. 외부에서 짧은 간격으로 두 번 트리거돼도
//          (game_id, game_date) unique + UPSERT 라 마지막 결과로 수렴.
// timeout: 1경기당 1000판 ~3~5초, 최대 5경기 → 25초 안팎. maxDuration=60s 로 여유 확보.
//
// 실제 시뮬+UPSERT 로직은 lib/server/sim/runDailySimAndUpsert 공용 함수.
// admin 수동 재실행 엔드포인트(/api/admin/sim-1000/rerun)도 동일 함수 호출.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runDailySimAndUpsert } from "@/lib/server/sim/runDailySimAndUpsert";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateOverride = url.searchParams.get("date"); // YYYY-MM-DD (수동 트리거용)
  const gameDate = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)
    ? dateOverride
    : formatDate(kstNow());

  const sb = createSupabaseAdminClient();
  const outcome = await runDailySimAndUpsert(sb, gameDate);

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }

  // ISR 무효화 — /predict/sim-1000 페이지 캐시 갱신
  try {
    revalidatePath("/predict/sim-1000");
  } catch {
    // revalidatePath 실패해도 cron 자체는 성공으로 처리.
  }

  return NextResponse.json({
    ok: true,
    gameDate: outcome.gameDate,
    total: outcome.total,
    succeeded: outcome.ran,
    failed: outcome.failed,
    results: outcome.results
  });
}
