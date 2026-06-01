import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { listAiPredictionsForGame } from "@/lib/supabase/query-parts/bpAiPredictions";
import { getUserTier } from "@/lib/auth/userTier";
import { AiWinnerRevealScreen } from "@/components/domain/AiWinnerRevealScreen";

export const dynamic = "force-dynamic";

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

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

  // 운영자(admin) 는 09시 공개 전이라도 예측을 미리 볼 수 있어야 함 (컨텐츠 영상 제작용).
  // RLS 가 published_at <= now() 만 노출하므로 admin 만 service_role 클라이언트로 우회.
  const userTier = await getUserTier(supabase);

  // AI 예측 상세(reveal)는 정식 로그인 전용. 비로그인/익명(guest)은 로그인으로 보낸다.
  // (리스트는 소프트 게이트로 매치업만 노출하지만, 상세는 곧 결과 전체라 하드 게이트.)
  if (userTier.tier === "guest") {
    redirect(`/login?next=${encodeURIComponent(`/predict/ai-winner/${params.gameId}`)}`);
  }

  const predictionsClient =
    userTier.tier === "admin" ? createSupabaseAdminClient() : supabase;

  // 예측 조회. 일반 유저는 RLS 에 의해 published_at <= now() 만 노출.
  const predictionsResult = await listAiPredictionsForGame(predictionsClient, params.gameId);
  const predictions = predictionsResult.ok ? predictionsResult.rows : [];

  const isToday = gameRow.game_date === kstToday();

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
      isToday={isToday}
    />
  );
}
