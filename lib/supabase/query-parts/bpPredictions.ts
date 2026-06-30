// bp_predictions CRUD — 승리팀 예측 게임.
// 익명 로그인 사용자도 저장 가능 (bp_records와 다름).

import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "bp_predictions";
const RESULTS_VIEW = "bp_prediction_results";
export const PREDICTION_RANKING_MIN_GAMES = 5;
export const PREDICTION_RANKING_ACTIVE_WITHIN_DAYS = 0; // 0 = no activity retention filter.

// ============================================================
// 타입
// ============================================================

export type BpPredictionRow = {
  id: string;
  user_id: string;
  game_id: string;
  predicted_winner_team_id: string;
  game_date: string;       // YYYY-MM-DD
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 통계 view row — bp_predictions + games join. 채점 가능한 경기는 is_judged=true. */
export type BpPredictionResultRow = {
  id: string;
  user_id: string;
  game_id: string;
  game_date: string;
  predicted_winner_team_id: string;
  locked_at: string | null;
  game_status: "scheduled" | "in_progress" | "finished" | "canceled";
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  actual_winner_team_id: string | null;
  is_judged: boolean;
  is_correct: boolean | null;
};

export type PredictionStats = {
  total: number;        // 채점된 예측 수
  correct: number;      // 적중한 예측 수
  pending: number;      // 잠겼지만 아직 채점 안 된 예측 수 (경기 안 끝남 / 동점 / 취소)
};

// ============================================================
// Read — 본인의 특정 날짜 예측
// ============================================================

export async function listMyPredictionsForDate(
  client: SupabaseClient,
  userId: string,
  dateISO: string
): Promise<{ ok: true; rows: BpPredictionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("game_date", dateISO);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as BpPredictionRow[] };
}

// ============================================================
// Upsert — draft 예측 저장/수정. 잠긴 행은 trigger가 차단.
// ============================================================

export async function upsertPrediction(
  client: SupabaseClient,
  input: {
    userId: string;
    gameId: string;
    gameDate: string;
    predictedWinnerTeamId: string;
  }
): Promise<{ ok: true; row: BpPredictionRow } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .upsert(
      {
        user_id: input.userId,
        game_id: input.gameId,
        game_date: input.gameDate,
        predicted_winner_team_id: input.predictedWinnerTeamId
      },
      { onConflict: "user_id,game_id" }
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as BpPredictionRow };
}

// ============================================================
// Delete — draft 예측 취소 (잠금 전에만 가능)
// ============================================================

export async function deletePrediction(
  client: SupabaseClient,
  userId: string,
  gameId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .is("locked_at", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Lock — 해당 날짜의 본인 draft 예측 일괄 잠금
// ============================================================

export async function lockPredictionsForDate(
  client: SupabaseClient,
  userId: string,
  dateISO: string
): Promise<{ ok: true; locked: number } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .update({ locked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("game_date", dateISO)
    .is("locked_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, locked: (data ?? []).length };
}

// ============================================================
// Stats — 본인 전체 누적 + 특정 날짜
// ============================================================

export async function getMyPredictionStats(
  client: SupabaseClient,
  userId: string,
  opts?: { dateISO?: string; sinceISO?: string }
): Promise<{ ok: true; stats: PredictionStats } | { ok: false; error: string }> {
  // 잠금된(lockedAt is not null) 예측만 통계 대상 — draft는 가짜 적중률 방지를 위해 제외.
  let query = client
    .from(RESULTS_VIEW)
    .select("is_judged,is_correct")
    .eq("user_id", userId)
    .not("locked_at", "is", null);
  if (opts?.dateISO) query = query.eq("game_date", opts.dateISO);
  if (opts?.sinceISO) query = query.gte("game_date", opts.sinceISO);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  let total = 0;
  let correct = 0;
  let pending = 0;
  for (const row of (data ?? []) as Array<{ is_judged: boolean; is_correct: boolean | null }>) {
    if (row.is_judged) {
      total += 1;
      if (row.is_correct === true) correct += 1;
    } else {
      pending += 1;
    }
  }
  return { ok: true, stats: { total, correct, pending } };
}

// ============================================================
// Read — 본인의 특정 날짜 결과 view (UI에서 카드별 적중/오답 표시용)
// ============================================================

export async function listMyPredictionResultsForDate(
  client: SupabaseClient,
  userId: string,
  dateISO: string
): Promise<{ ok: true; rows: BpPredictionResultRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(RESULTS_VIEW)
    .select("*")
    .eq("user_id", userId)
    .eq("game_date", dateISO);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as BpPredictionResultRow[] };
}

// ============================================================
// Ranking — 적중률 TOP. period: today/week/month/season.
//   최소 경기 수 임계값 이상만 노출 — 1경기 100%가 1등 되는 거 방지.
// ============================================================

export type PredictionRankingPeriod = "today" | "week" | "month" | "season";

export type PredictionRankingRow = {
  rank: number;
  user_id: string;
  /** profiles에 행이 없으면 null (= 아주 오래된 익명 잔여 등). UI는 폴백 라벨 처리. */
  nickname: string | null;
  main_team_id: string | null;
  avatar_image_url: string | null;
  total: number;
  correct: number;
  rate: number;  // 0.0 ~ 1.0
  /** AI 행(유저 아님). 주간 랭킹에 3개 AI를 각각 끼워 넣을 때 표시용. */
  isAi?: boolean;
  /** AI 행일 때 provider id (gpt/gemini/claude) — 색·아이콘용. */
  aiProvider?: string;
};

export async function getPredictionRanking(
  client: SupabaseClient,
  opts: {
    period: PredictionRankingPeriod;
    minGames?: number;
    activeWithinDays?: number;
    limit?: number;
  }
): Promise<{ ok: true; rows: PredictionRankingRow[] } | { ok: false; error: string }> {
  const { data, error } = await client.rpc("get_prediction_ranking", {
    p_period: opts.period,
    p_min_games: opts.minGames ?? PREDICTION_RANKING_MIN_GAMES,
    p_active_within_days: opts.activeWithinDays ?? PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
    p_limit: opts.limit ?? 20
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as PredictionRankingRow[] };
}

/**
 * 화~일 고정 주간 적중률 랭킹. 기존 RPC('week')는 롤링 7일이라 이벤트 주간과 어긋나
 * 앱단에서 weekStartISO(화) 이후를 직접 집계한다. (운영 공유 DB 함수 변경 회피)
 */
export async function getWeeklyPredictionRanking(
  client: SupabaseClient,
  opts: { weekStartISO: string; minGames?: number; limit?: number }
): Promise<{ ok: true; rows: PredictionRankingRow[] } | { ok: false; error: string }> {
  const minGames = opts.minGames ?? PREDICTION_RANKING_MIN_GAMES;
  const limit = opts.limit ?? 20;

  // 잠금·채점된 예측만, 그 주(화~) 범위. 행이 많을 수 있어 1000행씩 페이지네이션.
  const byUser = new Map<string, { total: number; correct: number }>();
  const PAGE = 1000;
  const MAX_ROWS = 50000;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await client
      .from(RESULTS_VIEW)
      .select("user_id,is_correct")
      .gte("game_date", opts.weekStartISO)
      .not("locked_at", "is", null)
      .eq("is_judged", true)
      .range(from, from + PAGE - 1);
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as Array<{ user_id: string; is_correct: boolean | null }>;
    for (const row of rows) {
      const agg = byUser.get(row.user_id) ?? { total: 0, correct: 0 };
      agg.total += 1;
      if (row.is_correct === true) agg.correct += 1;
      byUser.set(row.user_id, agg);
    }
    if (rows.length < PAGE) break;
  }

  const ranked = Array.from(byUser.entries())
    .map(([user_id, agg]) => ({
      user_id,
      total: agg.total,
      correct: agg.correct,
      rate: agg.total > 0 ? agg.correct / agg.total : 0
    }))
    .filter((r) => r.total >= minGames)
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
    .slice(0, limit);

  if (ranked.length === 0) return { ok: true, rows: [] };

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id,nickname,main_team_id,avatar_image_url")
    .in("id", ranked.map((r) => r.user_id));
  if (profileError) return { ok: false, error: profileError.message };
  const profileById = new Map(
    (profiles ?? []).map((p: { id: string; nickname: string | null; main_team_id: string | null; avatar_image_url: string | null }) => [p.id, p])
  );

  const rows: PredictionRankingRow[] = ranked.map((r, idx) => {
    const p = profileById.get(r.user_id);
    return {
      rank: idx + 1,
      user_id: r.user_id,
      nickname: p?.nickname ?? null,
      main_team_id: p?.main_team_id ?? null,
      avatar_image_url: p?.avatar_image_url ?? null,
      total: r.total,
      correct: r.correct,
      rate: r.rate
    };
  });
  return { ok: true, rows };
}
