// bp_ai_predictions 의 is_correct 자동 채점.
//   sync-kbo-games cron 이 syncGamesInRange 후 호출.
//   해당 날짜 범위의 finished 경기들에 대해 predicted_winner_team_id 가
//   실제 승리팀과 일치하는지 비교해 is_correct 를 채운다.
//   무승부(home_score = away_score)는 false 처리.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ScoreResult = {
  scored: number;        // 새로 채점된 row 수
  draws: number;         // 무승부로 false 처리된 row 수
  skipped: number;       // 아직 finished 아니거나 점수 없어서 스킵
};

type GameRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type PredictionRow = {
  id: string;
  game_id: string;
  predicted_winner_team_id: string;
  is_correct: boolean | null;
};

/** 한 날짜 범위의 채점되지 않은 예측을 일괄 채점.
 *  - games 에서 finished + 점수 있는 행만 매핑
 *  - bp_ai_predictions 에서 is_correct is null 인 row 만 update */
export async function scoreAiPredictionsForRange(from: string, to: string): Promise<ScoreResult> {
  const supabase = createSupabaseAdminClient();

  // 해당 범위의 finished 게임들
  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id,home_team_id,away_team_id,home_score,away_score,status")
    .gte("game_date", from)
    .lte("game_date", to);

  if (gamesErr) throw new Error(`scoreAiPredictions games fetch failed: ${gamesErr.message}`);

  const rows = (games ?? []) as GameRow[];
  const finishedById = new Map<string, GameRow>();
  for (const g of rows) {
    if (g.status === "finished" && g.home_score !== null && g.away_score !== null) {
      finishedById.set(g.id, g);
    }
  }

  if (finishedById.size === 0) {
    return { scored: 0, draws: 0, skipped: 0 };
  }

  // 아직 채점되지 않은 예측만 가져오기
  const gameIds = Array.from(finishedById.keys());
  const { data: predictions, error: predErr } = await supabase
    .from("bp_ai_predictions")
    .select("id,game_id,predicted_winner_team_id,is_correct")
    .in("game_id", gameIds)
    .is("is_correct", null);

  if (predErr) throw new Error(`scoreAiPredictions predictions fetch failed: ${predErr.message}`);

  const preds = (predictions ?? []) as PredictionRow[];
  if (preds.length === 0) {
    return { scored: 0, draws: 0, skipped: gameIds.length };
  }

  let scored = 0;
  let draws = 0;

  // 예측별 update — 단건 update 가 안전 (vs bulk: in() update 는 같은 값만 가능)
  for (const p of preds) {
    const game = finishedById.get(p.game_id);
    if (!game || game.home_score === null || game.away_score === null) continue;

    let isCorrect: boolean;
    if (game.home_score === game.away_score) {
      // 무승부 = 모두 실패
      isCorrect = false;
      draws += 1;
    } else {
      const winnerTeamId = game.home_score > game.away_score ? game.home_team_id : game.away_team_id;
      isCorrect = p.predicted_winner_team_id === winnerTeamId;
    }

    const { error: updErr } = await supabase
      .from("bp_ai_predictions")
      .update({ is_correct: isCorrect })
      .eq("id", p.id);

    if (updErr) {
      console.error(`[scoreAiPredictions] update failed for ${p.id}:`, updErr.message);
      continue;
    }
    scored += 1;
  }

  return { scored, draws, skipped: 0 };
}
