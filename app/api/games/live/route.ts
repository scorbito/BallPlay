import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { syncGamesInRange } from "@/lib/server/kbo/syncGames";
import { listGamesFromDb } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 사용자가 페이지를 보고 있을 때만 호출되는 온디맨드 라이브 스코어.
//   - KBO 재조회는 날짜당 90초에 1번으로 서버 스로틀(여러 명이 봐도 1번).
//   - 아무도 안 보면 호출 자체가 없으니 크론처럼 상시 돌지 않는다.
const THROTTLE_MS = 90_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("date");
  const date = q && DATE_RE.test(q) ? q : kstToday();
  const admin = createSupabaseAdminClient();

  // 스로틀 — 마지막 동기화가 90초 지났을 때만 KBO 재조회.
  let synced = false;
  const { data: state } = await admin
    .from("bp_live_sync_state")
    .select("synced_at")
    .eq("game_date", date)
    .maybeSingle();
  const lastSync = state?.synced_at ? Date.parse(String(state.synced_at)) : 0;
  if (Date.now() - lastSync > THROTTLE_MS) {
    // 슬롯을 먼저 선점(동시 요청 경쟁 최소화)한 뒤 동기화.
    await admin
      .from("bp_live_sync_state")
      .upsert({ game_date: date, synced_at: new Date().toISOString() }, { onConflict: "game_date" });
    try {
      await syncGamesInRange(date, date, { delayMs: 150 });
      synced = true;
    } catch {
      // KBO 실패해도 아래에서 현재 DB 값 반환.
    }
  }

  const games = await listGamesFromDb({ from: date, to: date }, admin).catch(() => []);
  const payload = games.map((g) => ({
    id: g.id,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    status: g.status,
    innings: g.innings ?? null,
    inningHalf: g.inningHalf ?? null
  }));
  const allFinished =
    payload.length > 0 && payload.every((g) => g.status === "finished" || g.status === "canceled");

  return NextResponse.json(
    { date, synced, allFinished, games: payload },
    { headers: { "Cache-Control": "no-store" } }
  );
}
