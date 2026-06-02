// bp_ai_predictions 조회 헬퍼.
// 클라이언트가 published_at <= now() 인 row만 select 가능하도록 RLS가 걸려 있어
// "공개 전" 행은 anon 키 사용 시 자연 차단됨. service_role 은 우회 가능하나
// 본 모듈은 service_role 을 가정하지 않음 (page 에서 서버 컴포넌트로 호출).
//
// 적중률·결과 표시는 bp_ai_predictions_with_result VIEW 를 사용해 games 조인 →
// 점수 입력 즉시 라이브 판정. bp_ai_predictions.is_correct 컬럼은 deprecated.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AiProvider = "gemini" | "claude" | "gpt";

export type BpAiPredictionRow = {
  id: string;
  game_id: string;
  game_date: string;
  ai_provider: AiProvider;
  model_name: string | null;
  predicted_winner_team_id: string;
  confidence: number;
  key_factor: string;
  one_liner: string;
  detailed_analysis: string;
  published_at: string;
  is_correct: boolean | null;
};

/** bp_ai_predictions_with_result VIEW row. games 조인으로 라이브 판정 컬럼 포함. */
export type BpAiPredictionResultRow = BpAiPredictionRow & {
  game_status: "scheduled" | "in_progress" | "finished" | "canceled";
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  actual_winner_team_id: string | null;
  is_judged: boolean;
  /** 라이브 판정. 아직 안 끝났으면 null, 동점은 false. */
  is_correct_live: boolean | null;
};

const SELECT_COLS =
  "id,game_id,game_date,ai_provider,model_name,predicted_winner_team_id,confidence,key_factor,one_liner,detailed_analysis,published_at,is_correct";

const RESULT_VIEW_SELECT_COLS =
  "id,game_id,game_date,ai_provider,model_name,predicted_winner_team_id,confidence,key_factor,one_liner,detailed_analysis,published_at,is_correct,game_status,home_team_id,away_team_id,home_score,away_score,actual_winner_team_id,is_judged,is_correct_live";

/** 특정 날짜의 예측 모두 조회. 공개 전이면 RLS로 자연히 비어옴.
 *  테이블 직접 read — 결과 컬럼이 필요 없는 컨텍스트(reveal 등) 호환용. */
export async function listAiPredictionsForDate(
  client: SupabaseClient,
  dateISO: string
): Promise<{ ok: true; rows: BpAiPredictionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("bp_ai_predictions")
    .select(SELECT_COLS)
    .eq("game_date", dateISO)
    .order("game_id", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as BpAiPredictionRow[] };
}

/** 특정 날짜 예측 + 라이브 결과 조회. 점수 들어오자마자 is_correct_live 채워짐. */
export async function listAiPredictionResultsForDate(
  client: SupabaseClient,
  dateISO: string
): Promise<{ ok: true; rows: BpAiPredictionResultRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("bp_ai_predictions_with_result")
    .select(RESULT_VIEW_SELECT_COLS)
    .eq("game_date", dateISO)
    .order("game_id", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as BpAiPredictionResultRow[] };
}

/** 특정 경기의 3개 AI 예측. 테이블 직접 read — 결과 컬럼이 필요 없는 케이스용. */
export async function listAiPredictionsForGame(
  client: SupabaseClient,
  gameId: string
): Promise<{ ok: true; rows: BpAiPredictionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("bp_ai_predictions")
    .select(SELECT_COLS)
    .eq("game_id", gameId)
    .order("ai_provider", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as BpAiPredictionRow[] };
}

/** 특정 경기의 3개 AI 예측 + 라이브 결과. reveal 페이지에서 사용. */
export async function listAiPredictionResultsForGame(
  client: SupabaseClient,
  gameId: string
): Promise<{ ok: true; rows: BpAiPredictionResultRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("bp_ai_predictions_with_result")
    .select(RESULT_VIEW_SELECT_COLS)
    .eq("game_id", gameId)
    .order("ai_provider", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as BpAiPredictionResultRow[] };
}

export type AiOverallStats = {
  total_count: number;
  correct_count: number;
  accuracy: number | null;  // 0~100, 채점된 게 없으면 null
};

export type AiProviderStats = AiOverallStats & { ai_provider: AiProvider };

/** 시즌 종합 적중률 — VIEW 기반 RPC. is_judged=true 인 row 만 카운트. */
export async function getAiOverallStats(
  client: SupabaseClient,
  sinceISO?: string
): Promise<{ ok: true; stats: AiOverallStats } | { ok: false; error: string }> {
  const args = sinceISO ? { p_since: sinceISO } : {};
  const { data, error } = await client.rpc("bp_ai_predictions_overall_stats", args);
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: true, stats: { total_count: 0, correct_count: 0, accuracy: null } };
  }
  return {
    ok: true,
    stats: {
      total_count: Number(row.total_count) || 0,
      correct_count: Number(row.correct_count) || 0,
      accuracy: row.accuracy === null ? null : Number(row.accuracy)
    }
  };
}

/** AI별 적중률 — VIEW 기반 RPC. accuracy 내림차순. */
export async function getAiByProviderStats(
  client: SupabaseClient,
  sinceISO?: string
): Promise<{ ok: true; rows: AiProviderStats[] } | { ok: false; error: string }> {
  const args = sinceISO ? { p_since: sinceISO } : {};
  const { data, error } = await client.rpc("bp_ai_predictions_by_provider_stats", args);
  if (error) return { ok: false, error: error.message };
  const rows = (Array.isArray(data) ? data : []) as Array<{
    ai_provider: AiProvider;
    total_count: number | string;
    correct_count: number | string;
    accuracy: number | string | null;
  }>;
  return {
    ok: true,
    rows: rows.map((r) => ({
      ai_provider: r.ai_provider,
      total_count: Number(r.total_count) || 0,
      correct_count: Number(r.correct_count) || 0,
      accuracy: r.accuracy === null ? null : Number(r.accuracy)
    }))
  };
}
