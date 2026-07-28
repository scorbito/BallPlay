// 승리팀 예측의 팀별 집계.
//
// 예전 구현은 bp_predictions 행을 1000건씩 최대 5만 건까지 끌어와 JS 로 셌다.
// 경기 하나짜리 상세 화면에서는 CDN 캐시로 버텼지만, 예측 목록(5경기)으로 확장하면
// 요청 한 번에 수만 행이 오간다. count:exact + head:true 로 바꾸면 행을 전혀
// 전송하지 않고 개수만 받으므로 DB 스키마 변경 없이 같은 결과를 얻는다.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PickTally = {
  /** 홈+원정 픽 합계 */
  total: number;
  /** teamId → 픽 수 */
  teams: Record<string, number>;
};

export type TallyGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
};

/** 팀 1개의 픽 수. head:true 라 행 본문은 오지 않고 count 헤더만 온다. */
async function countPicksForTeam(
  client: SupabaseClient,
  gameId: string,
  teamId: string
): Promise<number> {
  const { count, error } = await client
    .from("bp_predictions")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("predicted_winner_team_id", teamId);
  if (error) return 0;
  return count ?? 0;
}

/** 경기 1개의 홈/원정 픽 집계. */
export async function getPickTally(
  client: SupabaseClient,
  game: TallyGame
): Promise<PickTally> {
  const [homeCount, awayCount] = await Promise.all([
    countPicksForTeam(client, game.id, game.homeTeamId),
    countPicksForTeam(client, game.id, game.awayTeamId)
  ]);
  return {
    total: homeCount + awayCount,
    teams: {
      [game.homeTeamId]: homeCount,
      [game.awayTeamId]: awayCount
    }
  };
}

/** 여러 경기 집계를 gameId 키 맵으로. 경기당 2회 count 쿼리를 전부 병렬 실행. */
export async function getPickTallies(
  client: SupabaseClient,
  games: TallyGame[]
): Promise<Record<string, PickTally>> {
  const entries = await Promise.all(
    games.map(async (game) => [game.id, await getPickTally(client, game)] as const)
  );
  return Object.fromEntries(entries);
}
