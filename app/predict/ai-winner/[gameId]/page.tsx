import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listAiPredictionResultsForGame,
  type BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import { getUserTier } from "@/lib/auth/userTier";
import { AiWinnerRevealScreen } from "@/components/domain/AiWinnerRevealScreen";
import type { GameStatus } from "@/lib/types/api-contracts";

export const dynamic = "force-dynamic";

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function AiWinnerRevealPage({ params }: { params: { gameId: string } }) {
  const supabase = createSupabaseServerClient();

  // game 자체는 listGamesFromDb 가 날짜 범위라 광범위. 한 행만 가져오는 게 더 적합한데
  // 별도 query helper 없으니 일단 단일 select 로.
  // 선발 투수 컬럼(home_starter/away_starter)은 add-games-starters.sql 적용 후에만 존재.
  // 미적용 환경 대비 fallback select.
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
    home_starter?: string | null;
    away_starter?: string | null;
  };
  let gameRow: GameRow | null = null;
  let gameError: { code?: string } | null = null;
  {
    const res = await supabase
      .from("games")
      .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status,home_starter,away_starter")
      .eq("id", params.gameId)
      .maybeSingle();
    gameRow = res.data as GameRow | null;
    gameError = res.error;
  }
  if (gameError?.code === "42703") {
    const fb = await supabase
      .from("games")
      .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status")
      .eq("id", params.gameId)
      .maybeSingle();
    gameRow = fb.data as GameRow | null;
    gameError = fb.error;
  }

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

  // 예측 조회. VIEW(bp_ai_predictions_with_result) — 점수 들어오자마자 is_correct_live 채워짐.
  // 컴포넌트(AiWinnerRevealScreen) 시그니처는 BpAiPredictionRow[] 라서 page 안에서 is_correct_live → is_correct 로 매핑.
  // 일반 유저는 VIEW(security_invoker=true) 가 underlying RLS(published_at <= now()) 상속.
  const predictionsResult = await listAiPredictionResultsForGame(predictionsClient, params.gameId);
  const predictions: BpAiPredictionRow[] = predictionsResult.ok
    ? predictionsResult.rows.map((p) => ({
        id: p.id,
        game_id: p.game_id,
        game_date: p.game_date,
        ai_provider: p.ai_provider,
        model_name: p.model_name,
        predicted_winner_team_id: p.predicted_winner_team_id,
        confidence: p.confidence,
        key_factor: p.key_factor,
        one_liner: p.one_liner,
        detailed_analysis: p.detailed_analysis,
        published_at: p.published_at,
        is_correct: p.is_correct_live
      }))
    : [];

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
        status: gameRow.status,
        homeStarter: (gameRow as { home_starter?: string | null }).home_starter ?? null,
        awayStarter: (gameRow as { away_starter?: string | null }).away_starter ?? null
      }}
      predictions={predictions}
      isToday={isToday}
    />
  );
}
