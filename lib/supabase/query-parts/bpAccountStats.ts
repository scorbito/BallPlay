// 계정 누적 전적 — bp_account_stats 카운터 테이블 기반.
// 기존 bp_records 전체 집계(bpAccountRanking / bpUserRecords)는 mirror row 까지 포함돼
// "자고 일어났더니 1패" 가 발생했다. 본 모듈은 본인이 직접 플레이한 경기(mirror 제외)만
// 카운트되는 별도 카운터 테이블을 읽는다. 트리거 정의는 supabase/add-bp-account-stats.sql.
//
// 무승부 정책: 카운터 테이블은 draws 컬럼을 따로 가진다. 기존 랭킹/뱃지 UI 는 무승부를
// total/winrate 어디에도 포함하지 않으므로, 본 모듈에서도 호출처 호환을 위해
// total = wins + losses, winRate = wins / total 로만 계산해 노출한다(draws 는 별도 노출 X).

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// 기존 호출처와 동일한 형태로 노출 — 호출처 변경 최소화.
export type AccountStats = {
  wins: number;
  losses: number;
  total: number;
  winRate: number; // 0~1
};

export type AccountStatsRankingRow = {
  rank: number;
  ownerUserId: string;
  nickname: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

export type MyAccountStatsRank = {
  rank: number;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

const ZERO: AccountStats = { wins: 0, losses: 0, total: 0, winRate: 0 };

type StatsRow = {
  user_id: string;
  wins: number;
  losses: number;
  draws: number;
};

/** 단일 user 의 누적 전적. row 없으면 0/0/0 반환. */
export async function getAccountStats(
  client: SupabaseClient,
  userId: string | null | undefined
): Promise<AccountStats> {
  if (!userId) return ZERO;

  try {
    const { data, error } = await client
      .from("bp_account_stats")
      .select("wins, losses, draws")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[bpAccountStats] getAccountStats error:", error.message);
      return ZERO;
    }
    if (!data) return ZERO;

    const wins = data.wins ?? 0;
    const losses = data.losses ?? 0;
    const total = wins + losses;
    return {
      wins,
      losses,
      total,
      winRate: total > 0 ? wins / total : 0
    };
  } catch (e) {
    console.warn("[bpAccountStats] getAccountStats 실패:", (e as Error).message);
    return ZERO;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 랭킹 — 전체 사용자 정렬(wins desc → winrate desc → total desc).
// 무승부는 wins/total 어디에도 포함하지 않으므로 카운터의 wins/losses 만 사용.
// 본인 user_id 와 무관한 "전체 정렬 결과" 만 캐시한다.
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_STATS_REVALIDATE_SECONDS = 60;

type FullAccountStatsRow = {
  rank: number;
  ownerUserId: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

/** bp_account_stats 전체 페치 + 정렬. wins+losses=0 인 user 는 제외. */
async function fetchAllStats(client: SupabaseClient, max = 20000): Promise<StatsRow[]> {
  const all: StatsRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (offset < max) {
    const { data, error } = await client
      .from("bp_account_stats")
      .select("user_id, wins, losses, draws")
      .order("wins", { ascending: false })
      .order("losses", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn("[bpAccountStats] fetchAllStats error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as StatsRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

function sortStats(rows: StatsRow[]): FullAccountStatsRow[] {
  return rows
    .map((r) => {
      const total = (r.wins ?? 0) + (r.losses ?? 0);
      return {
        ownerUserId: r.user_id,
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
        total,
        winRate: total > 0 ? (r.wins ?? 0) / total : 0
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    })
    .map((r, idx) => ({ rank: idx + 1, ...r }));
}

/** 캐시 대상 - 전체 정렬 결과. user 무관 → 안전하게 60초 캐시. */
async function buildFullAccountStatsRanking(): Promise<FullAccountStatsRow[]> {
  const client = createSupabaseAdminClient();
  try {
    const rows = await fetchAllStats(client);
    return sortStats(rows);
  } catch (e) {
    console.warn("[bpAccountStats] buildFullAccountStatsRanking 실패:", (e as Error).message);
    return [];
  }
}

export const getCachedFullAccountStatsRanking = unstable_cache(
  async (): Promise<FullAccountStatsRow[]> => buildFullAccountStatsRanking(),
  ["account-stats-ranking-full-v1"],
  { tags: ["ranking", "account-ranking", "account-stats"], revalidate: ACCOUNT_STATS_REVALIDATE_SECONDS }
);

/** 상위 N 슬라이스 후 닉네임 hydrate. 캐시 외부에서 호출. */
export async function hydrateAccountStatsNicknames(
  rows: FullAccountStatsRow[]
): Promise<AccountStatsRankingRow[]> {
  if (rows.length === 0) return [];
  const client = createSupabaseAdminClient();
  const ownerIds = Array.from(new Set(rows.map((r) => r.ownerUserId)));
  const profilesRes = await client.from("profiles").select("id, nickname").in("id", ownerIds);

  const nickMap = new Map<string, string>();
  for (const row of (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null }>) {
    nickMap.set(row.id, (row.nickname?.trim() || null) ?? "익명");
  }

  return rows.map((r) => ({
    rank: r.rank,
    ownerUserId: r.ownerUserId,
    nickname: nickMap.get(r.ownerUserId) ?? "익명",
    wins: r.wins,
    losses: r.losses,
    total: r.total,
    winRate: r.winRate
  }));
}

/**
 * 캐시 없이 즉시 호출 가능한 상위 N명 랭킹 1샷.
 * - 단발 호출처(향후 페이지)에서 사용. 페이지 단위 캐시는 호출처에서.
 */
export async function listAccountStatsRanking(
  client: SupabaseClient,
  limit = 100
): Promise<{ ok: true; rows: AccountStatsRankingRow[] } | { ok: false; reason: string }> {
  try {
    const rows = await fetchAllStats(client);
    const sorted = sortStats(rows).slice(0, limit);
    const hydrated = await hydrateAccountStatsNicknames(sorted);
    return { ok: true, rows: hydrated };
  } catch (e) {
    const reason = (e as Error).message;
    console.warn("[bpAccountStats] listAccountStatsRanking 실패:", reason);
    return { ok: false, reason };
  }
}

/**
 * 본인의 누적 전적 + 전체 사용자 중 본인 순위.
 * - 본인이 카운터 테이블에 row 없거나 wins+losses=0 이면 ok:false.
 * - 호출처는 캐시된 풀랭킹에서 find 하는 방식도 가능하므로, 본 함수는 admin client 직접 페치.
 */
export async function getMyAccountStatsRank(
  client: SupabaseClient,
  userId: string | null | undefined
): Promise<{ ok: true; data: MyAccountStatsRank } | { ok: false }> {
  if (!userId) return { ok: false };

  try {
    const rows = await fetchAllStats(client);
    const sorted = sortStats(rows);
    const myIndex = sorted.findIndex((r) => r.ownerUserId === userId);
    if (myIndex === -1) return { ok: false };
    const mine = sorted[myIndex];
    return {
      ok: true,
      data: {
        rank: mine.rank,
        wins: mine.wins,
        losses: mine.losses,
        total: mine.total,
        winRate: mine.winRate
      }
    };
  } catch (e) {
    console.warn("[bpAccountStats] getMyAccountStatsRank 실패:", (e as Error).message);
    return { ok: false };
  }
}
