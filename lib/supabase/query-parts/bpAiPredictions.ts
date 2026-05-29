// bp_ai_predictions 조회 헬퍼.
// 클라이언트가 published_at <= now() 인 row만 select 가능하도록 RLS가 걸려 있어
// "공개 전" 행은 anon 키 사용 시 자연 차단됨. service_role 은 우회 가능하나
// 본 모듈은 service_role 을 가정하지 않음 (page 에서 서버 컴포넌트로 호출).

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

const SELECT_COLS =
  "id,game_id,game_date,ai_provider,model_name,predicted_winner_team_id,confidence,key_factor,one_liner,detailed_analysis,published_at,is_correct";

/** 특정 날짜의 예측 모두 조회. 공개 전이면 RLS로 자연히 비어옴. */
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

/** 특정 경기의 3개 AI 예측. reveal 페이지에서 사용. */
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

export type AiOverallStats = {
  total_count: number;
  correct_count: number;
  accuracy: number | null;  // 0~100, 채점된 게 없으면 null
};

export type AiProviderStats = AiOverallStats & { ai_provider: AiProvider };

/** 시즌 종합 적중률 RPC 호출. */
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

/** AI별 적중률 RPC 호출. accuracy 내림차순. */
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
