// bp_lineup_predictions 조회·저장.
// 오늘의 라인업 예측 — 하루 1팀, 경기 시작 전까지 수정 가능, 경기 후 부분 점수 채점.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupPick } from "@/lib/lineupPredict/scoring";

const TABLE = "bp_lineup_predictions";

export type LineupPredictionRow = {
  id: string;
  user_id: string;
  game_id: string;
  game_date: string;
  team_id: string;
  picks: LineupPick[];
  hit_count: number | null;
  exact_count: number | null;
  /** 수비 위치 보너스. 이 지표 도입 전에 채점된 행은 null 이다. */
  position_count: number | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 해당 날짜의 내 예측 1건 (하루 1팀이라 최대 하나). */
export async function getMyLineupPrediction(
  client: SupabaseClient,
  userId: string,
  dateISO: string
): Promise<{ ok: true; row: LineupPredictionRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("game_date", dateISO)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data ?? null) as LineupPredictionRow | null };
}

/**
 * 제출·수정. 하루 1팀이므로 (user_id, game_date) 충돌 시 덮어쓴다.
 * 다른 경기로 갈아타도 같은 행이 갱신된다 — game_id·team_id 까지 함께 바뀐다.
 * 이미 채점된 건은 RLS 가 막으므로 여기서 따로 검사하지 않는다.
 */
export async function upsertLineupPrediction(
  client: SupabaseClient,
  input: {
    userId: string;
    gameId: string;
    gameDate: string;
    teamId: string;
    picks: LineupPick[];
  }
): Promise<{ ok: true; row: LineupPredictionRow } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .upsert(
      {
        user_id: input.userId,
        game_id: input.gameId,
        game_date: input.gameDate,
        team_id: input.teamId,
        picks: input.picks,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,game_date" }
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as LineupPredictionRow };
}

/** 채점 대상 — 지난 날짜인데 아직 점수가 없는 예측. 채점 배치가 쓴다. */
export async function listUnscoredPredictions(
  client: SupabaseClient,
  beforeDateISO: string
): Promise<{ ok: true; rows: LineupPredictionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .is("scored_at", null)
    .lte("game_date", beforeDateISO)
    .order("game_date", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as LineupPredictionRow[] };
}

/** 채점 결과 기록. service role 로만 호출한다(RLS 가 유저 수정을 막는다). */
export async function saveLineupScore(
  client: SupabaseClient,
  id: string,
  score: { hitCount: number; exactCount: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TABLE)
    .update({
      hit_count: score.hitCount,
      exact_count: score.exactCount,
      scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 채점이 끝난 최근 예측 — 결과 화면에서 "지난 예측이 어땠는지" 보여준다. */
export async function listMyScoredPredictions(
  client: SupabaseClient,
  userId: string,
  limit = 5
): Promise<{ ok: true; rows: LineupPredictionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .not("scored_at", "is", null)
    .order("game_date", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as LineupPredictionRow[] };
}

/** 내 누적 성적 — 결과 화면과 마이 기록에서 쓴다. */
export async function getMyLineupStats(
  client: SupabaseClient,
  userId: string
): Promise<
  | { ok: true; stats: { played: number; totalHit: number; totalExact: number; bestHit: number } }
  | { ok: false; error: string }
> {
  const { data, error } = await client
    .from(TABLE)
    .select("hit_count,exact_count")
    .eq("user_id", userId)
    .not("scored_at", "is", null);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{ hit_count: number | null; exact_count: number | null }>;
  const stats = rows.reduce(
    (acc, r) => ({
      played: acc.played + 1,
      totalHit: acc.totalHit + (r.hit_count ?? 0),
      totalExact: acc.totalExact + (r.exact_count ?? 0),
      bestHit: Math.max(acc.bestHit, r.hit_count ?? 0)
    }),
    { played: 0, totalHit: 0, totalExact: 0, bestHit: 0 }
  );
  return { ok: true, stats };
}
