import { notFound } from "next/navigation";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  listAiPredictionResultsForGame,
  listAiPredictionResultsForDate,
  type BpAiPredictionRow,
  type BpAiPredictionResultRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import { AiWinnerRevealScreen } from "@/components/domain/AiWinnerRevealScreen";
import type { GameStatus } from "@/lib/types/api-contracts";
import { loadConsensusCardForGame } from "@/lib/predict/consensus";
import { resolveDisplayStadium } from "@/lib/constants/stadiums";


// ISR — AI 예측 상세는 유저 무관 공개 데이터라 60초 캐시(전체 라우트 캐시 → 서버 CPU 절감).
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

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function AiWinnerRevealPage({
  params
}: {
  params: { gameId: string };
}) {
  // 로그인 게이트 제거(2026-06-18) + 쿠키리스 캐시 클라이언트로 ISR 가능.
  const supabase = createSupabaseCacheClient(60);

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

  const today = kstToday();
  const isFuture = gameRow.game_date > today;

  // 로그인 게이트 제거(2026-06-18) — AI 예측은 누구나 열람. 로그인 유도는 경품/참여 기능으로 전환.
  // "3개 AI 완료" 발행 게이트(predictionsPublished)는 유지 — 입력 중인 미완성 픽은 가린다.
  // (운영자 발행 전 미리보기는 ISR 캐시를 위해 제거 — 사전 확인은 localhost 에서.)

  // 1. 해당 날짜의 모든 경기 조회 (캐시 클라이언트로 — ISR 유지)
  const gamesForDate = await listGamesFromDb({ from: gameRow.game_date, to: gameRow.game_date }, supabase).catch(() => []);

  // 2. 해당 날짜의 모든 예측 조회
  const datePredictionsResult = await listAiPredictionResultsForDate(supabase, gameRow.game_date);

  // 3. 게임별 예측 매핑
  const predictionsByGameId = new Map<string, BpAiPredictionResultRow[]>();
  if (datePredictionsResult.ok) {
    for (const row of datePredictionsResult.rows) {
      const list = predictionsByGameId.get(row.game_id) ?? [];
      list.push(row);
      predictionsByGameId.set(row.game_id, list);
    }
  }

  // 4. 공개 게이트: 그 날의 모든 경기가 3개 AI(gemini/claude/gpt) 예측을 다 갖추면 공개.
  const AI_PROVIDER_COUNT = 3;
  const predictionsPublished =
    gamesForDate.length > 0 &&
    gamesForDate.every((g) => {
      const ps = predictionsByGameId.get(g.id) ?? [];
      return new Set(ps.map((p) => p.ai_provider)).size >= AI_PROVIDER_COUNT;
    });

  // 예측 조회. VIEW(bp_ai_predictions_with_result) — 점수 들어오자마자 is_correct_live 채워짐.
  // 컴포넌트(AiWinnerRevealScreen) 시그니처는 BpAiPredictionRow[] 라서 page 안에서 is_correct_live → is_correct 로 매핑.
  const predictionsResult = await listAiPredictionResultsForGame(supabase, params.gameId);
  const rawPredictions = predictionsResult.ok ? predictionsResult.rows : [];

  const predictions: BpAiPredictionRow[] = predictionsPublished
    ? rawPredictions.map((p) => ({
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

  // 종합분석 탭 데이터 (기존 1000판 시뮬 탭 대체) — 발행 게이트와 동일하게,
  // 3개 AI 예측 공개 전에는 픽 노출 방지를 위해 null.
  const consensusCard = predictionsPublished
    ? await loadConsensusCardForGame(gameRow.game_date, params.gameId).catch(() => null)
    : null;

  const isToday = gameRow.game_date === today;

  return (
    <AiWinnerRevealScreen
      gameId={params.gameId}
      game={{
        gameDate: gameRow.game_date,
        gameTime: gameRow.game_time,
        stadium: resolveDisplayStadium(gameRow.stadium, gameRow.home_team_id),
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
      isFuture={isFuture}
      selectedDate={gameRow.game_date}
      consensusCard={consensusCard}
    />
  );
}
