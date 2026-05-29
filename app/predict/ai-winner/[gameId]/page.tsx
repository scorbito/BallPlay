import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import { listAiPredictionsForGame } from "@/lib/supabase/query-parts/bpAiPredictions";
import { AiWinnerRevealScreen } from "@/components/domain/AiWinnerRevealScreen";

export const dynamic = "force-dynamic";

export default async function AiWinnerRevealPage({ params }: { params: { gameId: string } }) {
  const supabase = createSupabaseServerClient();

  // game 자체는 listGamesFromDb 가 날짜 범위라 광범위. 한 행만 가져오는 게 더 적합한데
  // 별도 query helper 없으니 일단 단일 select 로.
  const { data: gameRow, error: gameError } = await supabase
    .from("games")
    .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status")
    .eq("id", params.gameId)
    .maybeSingle();

  if (gameError || !gameRow) notFound();

  // 예측 조회. RLS 에 의해 published_at <= now() 만 노출.
  const predictionsResult = await listAiPredictionsForGame(supabase, params.gameId);
  const predictions = predictionsResult.ok ? predictionsResult.rows : [];

  return (
    <AiWinnerRevealScreen
      gameId={params.gameId}
      game={{
        gameDate: gameRow.game_date,
        gameTime: gameRow.game_time,
        stadium: gameRow.stadium,
        homeTeamId: gameRow.home_team_id,
        awayTeamId: gameRow.away_team_id,
        homeScore: gameRow.home_score,
        awayScore: gameRow.away_score,
        status: gameRow.status
      }}
      predictions={predictions}
    />
  );
}
