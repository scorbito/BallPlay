// 계정 누적 랭킹 — bp_records(source='public') 기반, owner_user_id 단위로 집계.
// 라인업 랭킹(bpLineupRankings)과 달리 라인업 ID는 무시하고 사용자별 누적 전적만 본다.
// admin 클라이언트로 RLS 우회 → 전체 사용자 집계 가능. 닉네임은 profiles 별도 IN 쿼리.
// 무승부는 wins/losses/total 어디에도 카운트 안 함 (랭킹/요약 카드와 동일 규칙).

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountRankingRow = {
  rank: number;
  ownerUserId: string;
  nickname: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number; // 0~1
};

export type MyAccountRank = {
  rank: number;
  wins: number;
  losses: number;
  total: number;
  winRate: number; // 0~1
};

/** "정식" 매치만 집계 (연습 매치는 제외) */
const TARGET_SOURCE = "public";

type RecordRowSlim = {
  owner_user_id: string;
  user_side: "home" | "away";
  final_score: { home: number; away: number } | null;
};

type Aggregate = {
  ownerUserId: string;
  wins: number;
  losses: number;
};

/** bp_records 슬림 페치 (필요 컬럼만) + 페이지네이션으로 1000행 한도 우회.
 *  bpLineupRankings.ts 와 동일 패턴. */
async function fetchAllPublicRecords(client: SupabaseClient, max = 20000): Promise<RecordRowSlim[]> {
  const all: RecordRowSlim[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (offset < max) {
    const { data, error } = await client
      .from("bp_records")
      .select("owner_user_id, user_side, final_score")
      .eq("source", TARGET_SOURCE)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("[accountRanking] fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as RecordRowSlim[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/** 레코드 배열을 owner_user_id 단위로 집계. 무승부 + 결과 없는 row 스킵. */
function aggregateByUser(records: RecordRowSlim[]): Aggregate[] {
  const map = new Map<string, Aggregate>();

  for (const r of records) {
    if (!r.final_score) continue;
    if (!r.owner_user_id) continue;

    const userScore = r.user_side === "home" ? r.final_score.home : r.final_score.away;
    const oppScore = r.user_side === "home" ? r.final_score.away : r.final_score.home;
    if (userScore === oppScore) continue; // 무승부 제외

    const cur = map.get(r.owner_user_id) ?? {
      ownerUserId: r.owner_user_id,
      wins: 0,
      losses: 0
    };
    if (userScore > oppScore) cur.wins += 1;
    else cur.losses += 1;
    map.set(r.owner_user_id, cur);
  }

  return Array.from(map.values());
}

/** 정렬: wins desc → winRate desc → total desc.
 *  bpLineupRankings 와 동일 정책. */
function sortAggregates(aggs: Aggregate[]): Array<Aggregate & { total: number; winRate: number }> {
  return aggs
    .map((a) => {
      const total = a.wins + a.losses;
      return {
        ...a,
        total,
        winRate: total > 0 ? a.wins / total : 0
      };
    })
    .filter((a) => a.total > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    });
}

/**
 * 시즌 누적 계정 랭킹 (전체 기간).
 * - 상위 `limit`명까지. 정렬: wins desc → winRate desc → total desc.
 * - 닉네임은 profiles 테이블 IN 쿼리. FK가 없을 수 있으니 별도 select.
 */
export async function listSeasonAccountRanking(
  client: SupabaseClient,
  limit = 100
): Promise<{ ok: true; rows: AccountRankingRow[] } | { ok: false; reason: string }> {
  try {
    const records = await fetchAllPublicRecords(client);
    const aggs = aggregateByUser(records);
    const sorted = sortAggregates(aggs).slice(0, limit);

    if (sorted.length === 0) {
      return { ok: true, rows: [] };
    }

    const ownerIds = Array.from(new Set(sorted.map((s) => s.ownerUserId)));
    const profilesRes = await client.from("profiles").select("id, nickname").in("id", ownerIds);

    const nickMap = new Map<string, string>();
    for (const row of (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null }>) {
      nickMap.set(row.id, (row.nickname?.trim() || null) ?? "익명");
    }

    const rows: AccountRankingRow[] = sorted.map((s, idx) => ({
      rank: idx + 1,
      ownerUserId: s.ownerUserId,
      nickname: nickMap.get(s.ownerUserId) ?? "익명",
      wins: s.wins,
      losses: s.losses,
      total: s.total,
      winRate: s.winRate
    }));

    return { ok: true, rows };
  } catch (e) {
    const reason = (e as Error).message;
    console.warn("[accountRanking] season 조회 실패:", reason);
    return { ok: false, reason };
  }
}

/**
 * 본인의 누적 전적 + 전체 사용자 중 본인 순위.
 * - rank: 전체 사용자 정렬(wins desc → winRate desc → total desc)에서
 *   본인보다 앞선 인원 수 + 1.
 * - 본인 row가 집계 결과에 존재하지 않으면(공개 매치 0건) ok:false.
 */
export async function getMyAccountRank(
  client: SupabaseClient,
  userId: string | null | undefined
): Promise<{ ok: true; data: MyAccountRank } | { ok: false }> {
  if (!userId) return { ok: false };

  try {
    const records = await fetchAllPublicRecords(client);
    const aggs = aggregateByUser(records);
    const sorted = sortAggregates(aggs);

    const myIndex = sorted.findIndex((a) => a.ownerUserId === userId);
    if (myIndex === -1) return { ok: false };

    const mine = sorted[myIndex];
    return {
      ok: true,
      data: {
        rank: myIndex + 1,
        wins: mine.wins,
        losses: mine.losses,
        total: mine.total,
        winRate: mine.winRate
      }
    };
  } catch (e) {
    console.warn("[accountRanking] my rank 조회 실패:", (e as Error).message);
    return { ok: false };
  }
}
