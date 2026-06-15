import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { syncStatsSnapshot } from "@/lib/server/kbo/syncStats";
import { upsertRecent10TopPlayers } from "@/lib/server/recent10/upsertTopPlayers";

// 10팀 × 4페이지 × 0.8s 딜레이 + 응답 시간 = ~60~90s. 여유 두고 300s.
// 응답은 즉시 반환, 실제 작업은 waitUntil로 백그라운드. cron-job.org 30s 타임아웃 회피.
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 매주 월요일 새벽(KST 04시 = UTC 일 19시) 시즌 누적 스탯 스냅샷 적재.
// ?date=YYYY-MM-DD 로 특정 일자 강제 가능(백필/테스트).
// 외부 cron(cron-job.org)이 30s 타임아웃이라 즉시 200 응답, 실제 작업은 백그라운드.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const snapshotDate = dateParam ?? formatDate(kstNow());

  waitUntil(
    syncStatsSnapshot(snapshotDate)
      .then(async (result) => {
        console.log("[sync-kbo-stats]", JSON.stringify(result));
        const recent10Result = await upsertRecent10TopPlayers();
        console.log("[recent10-top]", JSON.stringify(recent10Result));
      })
      .catch((err) => {
        console.error("[sync-kbo-stats] failed:", err);
      })
  );

  return NextResponse.json({ ok: true, started: true, snapshotDate });
}
