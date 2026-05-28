import { NextResponse, type NextRequest } from "next/server";
import { syncStatsSnapshot } from "@/lib/server/kbo/syncStats";

// 10팀 × 4페이지 × 0.8s 딜레이 + 응답 시간 = ~60~90s. 여유 두고 300s.
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
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const snapshotDate = dateParam ?? formatDate(kstNow());

  try {
    const result = await syncStatsSnapshot(snapshotDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
