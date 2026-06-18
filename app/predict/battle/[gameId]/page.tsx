import { notFound } from "next/navigation";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { AiBattleRevealScreen } from "@/components/domain/AiBattleRevealScreen";
import type { GameStatus } from "@/lib/types/api-contracts";
import type { BattlePredictionRow } from "@/components/domain/AiWinnerBattleTab";


// ISR — 배틀 상세는 유저 무관 공개 데이터라 60초 캐시(전체 라우트 캐시 → 서버 CPU 절감).
export const revalidate = 60;

// 최근 경기들을 미리 생성(warm). 나머지 gameId 는 on-demand 로 렌더 후 ISR 캐시.
export async function generateStaticParams() {
  const supabase = createSupabaseCacheClient(60);
  const { data } = await supabase
    .from("games")
    .select("id")
    .order("game_date", { ascending: false })
    .limit(40);
  return (data ?? []).map((g: { id: string }) => ({ gameId: g.id }));
}

export default async function AiBattleRevealPage({ params }: { params: { gameId: string } }) {
  const supabase = createSupabaseCacheClient(60);

  // 1. 경기 정보 단일 조회 (games)
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

  // fallback select (선발 투수 없는 스키마 대비)
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

  // 배틀 데이터 조회 — 동일 캐시 클라이언트 사용(ISR 캐시 대상).
  const { data: dbPredictions, error: predError } = await supabase
    .from("bp_ai_battle_predictions")
    .select("id, game_id, game_date, target_side, ai_provider, model_name, predicted_winner_team_id, key_factor, one_liner, detailed_analysis, counter_argument, published_at, is_correct")
    .eq("game_id", params.gameId);

  const rawPredictions = dbPredictions ?? [];
  const hasHome = rawPredictions.some((p) => p.target_side === "home");
  const hasAway = rawPredictions.some((p) => p.target_side === "away");
  const isReleased = hasHome && hasAway;

  // 양팀(home/away) 예측이 모두 등록(발행)됐을 때만 노출. 미완성은 가림.
  // (운영자 발행 전 미리보기는 ISR 캐시를 위해 제거 — 사전 확인은 localhost 에서.)
  const filteredPredictions = isReleased ? rawPredictions : [];

  // 타입 매핑
  const predictions: BattlePredictionRow[] = filteredPredictions.map((p) => ({
    id: p.id,
    game_id: p.game_id,
    game_date: p.game_date,
    target_side: p.target_side as "home" | "away",
    ai_provider: p.ai_provider as "gemini" | "claude" | "gpt",
    model_name: p.model_name,
    predicted_winner_team_id: p.predicted_winner_team_id,
    key_factor: p.key_factor,
    one_liner: p.one_liner,
    detailed_analysis: p.detailed_analysis,
    counter_argument: p.counter_argument,
    published_at: p.published_at,
    is_correct: p.is_correct
  }));

  return (
    <AiBattleRevealScreen
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
    />
  );
}
