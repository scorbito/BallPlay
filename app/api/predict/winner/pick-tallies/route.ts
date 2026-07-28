import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPickTallies } from "@/lib/supabase/query-parts/bpPredictionTallies";
import { listGamesFromDb } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// 집계는 사용자 무관(모두 동일) → 공개 캐시로 CDN에서 재사용.
// 승리팀 예측 페이지는 트래픽이 가장 많은 화면이라 원본 타격을 60초에 1회로 묶는 게 핵심.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/predict/winner/pick-tallies?date=YYYY-MM-DD
 *   → 해당 날짜 전 경기의 승리팀 예측 집계를 한 번에.
 *   { tallies: { [gameId]: { total, teams: { [teamId]: count } } } }
 *
 * 경기별 엔드포인트를 5번 호출하는 대신 한 요청으로 묶는다.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ tallies: {} }, { headers: PUBLIC_CACHE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  const games = await listGamesFromDb({ from: date, to: date }, supabase).catch(() => []);
  if (games.length === 0) {
    return NextResponse.json({ tallies: {} }, { headers: PUBLIC_CACHE_HEADERS });
  }

  const tallies = await getPickTallies(
    supabase,
    games.map((game) => ({
      id: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId
    }))
  );

  return NextResponse.json({ tallies }, { headers: PUBLIC_CACHE_HEADERS });
}
