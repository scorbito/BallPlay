import { NextResponse } from "next/server";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";

export const dynamic = "force-dynamic";

export async function GET() {
  // 백그라운드 비동기 트리거 (await를 걸지 않아 즉시 응답 가능)
  void triggerDailyDataSync();

  return NextResponse.json({ ok: true });
}
