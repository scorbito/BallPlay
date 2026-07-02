import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { teams } from "@/lib/constants/teams";
import type { CompareH2HResponse } from "@/lib/compare/types";

// 맞대결 전적은 완료 경기 기준 → 하루 1회 갱신이면 충분. 30분 신선 + 1시간 SWR.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
};

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

/** 두 팀의 이번 시즌 맞대결 전적 (당일 이전 완료 경기 기준). */
export async function GET(request: NextRequest): Promise<NextResponse<CompareH2HResponse>> {
  const a = request.nextUrl.searchParams.get("a");
  const b = request.nextUrl.searchParams.get("b");
  const valid = (id: string | null) => Boolean(id && teams.some((t) => t.id === id));
  if (!valid(a) || !valid(b) || a === b) {
    return NextResponse.json({ ok: false, error: "Invalid teams" }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const today = kstToday();
  const season = Number(today.slice(0, 4));

  const { data, error } = await adminClient
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score")
    .eq("status", "finished")
    .gte("game_date", `${season}-01-01`)
    .lte("game_date", today)
    .or(
      `and(home_team_id.eq.${a},away_team_id.eq.${b}),and(home_team_id.eq.${b},away_team_id.eq.${a})`
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  for (const g of data ?? []) {
    const hs = g.home_score ?? 0;
    const as = g.away_score ?? 0;
    if (hs === as) {
      draws++;
      continue;
    }
    const homeWon = hs > as;
    const homeIsA = g.home_team_id === a;
    if ((homeWon && homeIsA) || (!homeWon && !homeIsA)) aWins++;
    else bWins++;
  }

  return NextResponse.json(
    { ok: true, teamA: a as string, teamB: b as string, aWins, bWins, draws, games: (data ?? []).length },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}
