// 사용자 누적 공개 매치 전적 집계 — bp_records (source='public') 기준.
// HOME 히어로 뱃지와 /records 상단 카드에서 공통 사용.
// 무승부는 wins/losses/total 어디에도 카운트 안 함 (랭킹 페이지와 동일 규칙).

import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPublicMatchRecord = {
  wins: number;
  losses: number;
  total: number;
  winRate: number; // 0~1
};

const ZERO: UserPublicMatchRecord = { wins: 0, losses: 0, total: 0, winRate: 0 };

type RecordRowSlim = {
  user_side: "home" | "away";
  final_score: { home: number; away: number } | null;
};

/**
 * 특정 user의 공개 매치 누적 전적 (승/패/합계/승률).
 * - service-role 클라이언트(또는 본인 인증 클라이언트)를 받아 RLS 우회.
 * - 무승부는 제외 (랭킹 페이지 정책과 일치).
 * - 페이지네이션으로 1000행 한도 우회.
 */
export async function getUserPublicMatchRecord(
  client: SupabaseClient,
  userId: string | null | undefined
): Promise<UserPublicMatchRecord> {
  if (!userId) return ZERO;

  const pageSize = 1000;
  const maxRows = 10000;
  let offset = 0;
  let wins = 0;
  let losses = 0;

  try {
    while (offset < maxRows) {
      const { data, error } = await client
        .from("bp_records")
        .select("user_side, final_score")
        .eq("source", "public")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.warn("[bpUserRecords] fetch error:", error.message);
        break;
      }
      if (!data || data.length === 0) break;

      for (const r of data as RecordRowSlim[]) {
        if (!r.final_score) continue;
        const userScore = r.user_side === "home" ? r.final_score.home : r.final_score.away;
        const oppScore = r.user_side === "home" ? r.final_score.away : r.final_score.home;
        if (userScore === oppScore) continue; // 무승부 제외
        if (userScore > oppScore) wins += 1;
        else losses += 1;
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }
  } catch (e) {
    console.warn("[bpUserRecords] 조회 실패:", (e as Error).message);
    return ZERO;
  }

  const total = wins + losses;
  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? wins / total : 0
  };
}

/** 승률을 .625 형식으로 포맷 (1.000 → 1.000, 0 → .000). 랭킹/뱃지 공통 헬퍼. */
export function formatWinRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return ".000";
  if (rate >= 1) return "1.000";
  return rate.toFixed(3).replace(/^0/, "");
}
