import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSimResultByGameId,
  type BpSimResultRow
} from "@/lib/supabase/query-parts/bpSimResults";
import { Sim1000DetailScreen, type Sim1000GameInfo } from "@/components/domain/Sim1000DetailScreen";
import type { GameStatus } from "@/lib/types/api-contracts";

export const dynamic = "force-dynamic";

export default async function Sim1000DetailPage({
  params
}: {
  params: { gameId: string };
}) {
  const supabase = createSupabaseServerClient();

  type GameRow = {
    id: string;
    game_date: string;
    game_time: string | null;
    stadium: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    status: GameStatus;
  };

  const [simResult, gameRes] = await Promise.all([
    getSimResultByGameId(supabase, params.gameId),
    supabase
      .from("games")
      .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status")
      .eq("id", params.gameId)
      .maybeSingle()
  ]);

  if (!simResult.ok || simResult.row === null) {
    // 시뮬 결과 자체가 없으면 detail 페이지에 보여줄 게 없음 → 목록으로.
    notFound();
  }

  const sim: BpSimResultRow = simResult.row;
  const gameRow = gameRes.data as GameRow | null;

  const game: Sim1000GameInfo = {
    gameId: params.gameId,
    gameDate: sim.game_date,
    gameTime: gameRow?.game_time ?? null,
    stadium: gameRow?.stadium ?? "",
    homeTeamId: sim.home_team_id,
    awayTeamId: sim.away_team_id,
    homeStarter: sim.home_starter,
    awayStarter: sim.away_starter,
    homeScore: gameRow?.home_score ?? null,
    awayScore: gameRow?.away_score ?? null,
    status: gameRow?.status ?? "scheduled"
  };

  return <Sim1000DetailScreen game={game} sim={sim} />;
}
