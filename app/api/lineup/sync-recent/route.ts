// 어제(KST) 종료 경기의 라인업을 sync 한다.
//   - "실제 경기 라인업 불러오기" 모달이 DB 에 결과가 없을 때 호출.
//   - throttle 30분 (lineups-sync:YYYY-MM-DD) — 통합 trigger 와 같은 키.
//   - 인증 없음. throttle 이 KBO 호출 부담 자체를 막아주므로 무한 호출에도 안전.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureSync } from "@/lib/server/kbo/ensureSync";
import { syncLineupsForDate } from "@/lib/server/kbo/syncLineups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function kstYesterday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() - 1);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const yesterday = kstYesterday();
  const result = await ensureSync(
    `lineups-sync:${yesterday}`,
    1800,
    () => syncLineupsForDate(yesterday)
  );
  return NextResponse.json({ date: yesterday, result });
}
