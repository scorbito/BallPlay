import { redirect } from "next/navigation";
import { RankingScreen } from "@/components/domain/RankingScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
  PREDICTION_RANKING_MIN_GAMES,
  getPredictionRanking
} from "@/lib/supabase/query-parts/bpPredictions";

export const dynamic = "force-dynamic";

export default async function PredictionRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/api/anon-bootstrap?next=/predict/ranking");
  }

  // 시즌 탭 prefetch — 다른 탭은 클릭 시 클라이언트 fetch
  const rankingResult = await getPredictionRanking(supabase, {
    period: "season",
    minGames: PREDICTION_RANKING_MIN_GAMES,
    activeWithinDays: PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
    limit: 20
  });

  return (
    <RankingScreen
      currentUserId={user.id}
      initialRanking={rankingResult.ok ? rankingResult.rows : []}
    />
  );
}
