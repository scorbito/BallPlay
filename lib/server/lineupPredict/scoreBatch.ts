// 라인업 예측 채점 배치 — 실제 선발 라인업과 대조해 부분 점수를 매긴다.
//
// sync:kbo-day 의 라인업 수집 직후와 CLI(scripts/score-lineup-predictions.mts) 양쪽에서 쓴다.
// 실제 라인업이 아직 없으면 건너뛰고 다음 실행 때 다시 잡으므로 여러 번 돌려도 안전하다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreLineupPrediction, type LineupPick } from "@/lib/lineupPredict/scoring";

export type ScoreBatchResult = {
  scored: number;
  /** 실제 라인업이 아직 없어 미룬 건수. */
  pending: number;
  errors: string[];
};

/**
 * @param admin service role 클라이언트. 채점 컬럼은 RLS 가 유저 수정을 막으므로 필수다.
 * @param throughDate 이 날짜까지의 미채점 예측을 대상으로 한다(보통 오늘).
 */
export async function scorePendingLineupPredictions(
  admin: SupabaseClient,
  throughDate: string
): Promise<ScoreBatchResult> {
  const result: ScoreBatchResult = { scored: 0, pending: 0, errors: [] };

  const { data: rows, error } = await admin
    .from("bp_lineup_predictions")
    .select("id,game_date,team_id,picks")
    .is("scored_at", null)
    .lte("game_date", throughDate)
    .order("game_date", { ascending: true });
  if (error) {
    result.errors.push(`예측 조회 실패: ${error.message}`);
    return result;
  }
  const pendingRows = rows ?? [];
  if (pendingRows.length === 0) return result;

  // Array.from 을 쓰는 이유: 이 프로젝트의 tsconfig target 에서는 Set 스프레드가 막혀 있다.
  const dates = Array.from(new Set(pendingRows.map((r) => r.game_date as string)));
  const { data: actualRows, error: actualError } = await admin
    .from("bp_team_recent_lineups")
    .select("game_date,team_id,batting")
    .in("game_date", dates);
  if (actualError) {
    result.errors.push(`실제 라인업 조회 실패: ${actualError.message}`);
    return result;
  }

  const actualByKey = new Map<string, LineupPick[]>();
  for (const a of actualRows ?? []) {
    const batting = (a.batting ?? []) as LineupPick[];
    // 경기 전 행은 batting 이 비어 있다. 9명이 채워진 것만 채점 근거로 삼는다.
    if (batting.length >= 9) actualByKey.set(`${a.game_date}|${a.team_id}`, batting);
  }

  for (const row of pendingRows) {
    const actual = actualByKey.get(`${row.game_date}|${row.team_id}`);
    if (!actual) {
      result.pending += 1;
      continue;
    }
    const score = scoreLineupPrediction((row.picks ?? []) as LineupPick[], actual);
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("bp_lineup_predictions")
      .update({
        hit_count: score.hitCount,
        exact_count: score.exactCount,
        scored_at: now,
        updated_at: now
      })
      .eq("id", row.id);
    if (updateError) {
      result.errors.push(`저장 실패 (${row.id}): ${updateError.message}`);
      continue;
    }
    result.scored += 1;
  }

  return result;
}
