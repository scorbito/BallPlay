// 팀 전적 랭킹 — bp_records(source='public') 중 사용자가 직접 실행한 홈경기만 집계.
//   - 시즌: 전체 기간 누적
//   - 주간: 이번 주 (월요일 00:00 KST ~ 일요일 23:59 KST)
// admin 클라이언트로 RLS 우회 → 다른 사용자 라인업/프로필 join 필요.
// 라인업이 등록된 매치(home_lineup_id/away_lineup_id non-null)만 집계 대상.
// 다른 유저가 내 팀을 상대로 실행한 mirror/원정 기록은 대표 전적에서 제외한다.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type LineupRankingRow = {
  rank: number;
  lineupId: string;
  ownerUserId: string;
  nickname: string;
  teamId: string;
  lineupName: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number; // 0~1
};

/** "정식" 매치만 집계 (연습 매치는 제외) */
const TARGET_SOURCE = "public";

/** Asia/Seoul 기준으로 "이번 주 월요일 00:00 KST"의 UTC ISO 문자열. */
function startOfWeekKstIso(now = new Date()): string {
  // KST = UTC+9. UTC 시각을 KST로 환산 → 월요일 00:00 KST 시점 산정 → 다시 UTC ISO 반환.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  // getUTCDay(): 일=0, 월=1, ..., 토=6. KST 월요일을 주 시작으로.
  const kstDay = kstNow.getUTCDay();
  const daysSinceMonday = (kstDay + 6) % 7; // 일요일이면 6, 월요일이면 0
  const kstMidnight = new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  ));
  // kstMidnight 는 UTC 좌표지만 의미는 "KST 월요일 00:00"이므로 9시간 빼서 실제 UTC로.
  const utcMs = kstMidnight.getTime() - KST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

type RecordRowSlim = {
  owner_user_id: string;
  user_side: "home" | "away";
  final_score: { home: number; away: number } | null;
  home_lineup_id: string | null;
  away_lineup_id: string | null;
};

type Aggregate = {
  lineupId: string;
  ownerUserId: string;
  wins: number;
  losses: number;
};

/** bp_records 슬림 페치 (필요 컬럼만) + 페이지네이션으로 1000행 한도 우회. */
async function fetchRecordsSince(sinceIso: string | null, max = 10000): Promise<RecordRowSlim[]> {
  const supabase = createSupabaseAdminClient();
  const all: RecordRowSlim[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (offset < max) {
    let q = supabase
      .from("bp_records")
      .select("owner_user_id, user_side, final_score, home_lineup_id, away_lineup_id")
      .eq("source", TARGET_SOURCE)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (sinceIso) q = q.gte("created_at", sinceIso);

    const { data, error } = await q;
    if (error) {
      console.warn("[ranking] fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as RecordRowSlim[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/** 레코드 배열을 (lineup_id, owner) 단위로 집계. 홈경기와 라인업 ID 없는 row만 사용. */
function aggregate(records: RecordRowSlim[]): Aggregate[] {
  const map = new Map<string, Aggregate>();

  for (const r of records) {
    if (!r.final_score) continue;
    if (r.user_side !== "home") continue;
    const userLineupId = r.home_lineup_id;
    if (!userLineupId) continue;

    const userScore = r.final_score.home;
    const oppScore = r.final_score.away;
    const isWin = userScore > oppScore;
    const isTie = userScore === oppScore;
    if (isTie) continue; // 무승부는 양쪽 다 제외 (랭킹 노이즈)

    const key = `${userLineupId}|${r.owner_user_id}`;
    const cur = map.get(key) ?? {
      lineupId: userLineupId,
      ownerUserId: r.owner_user_id,
      wins: 0,
      losses: 0
    };
    if (isWin) cur.wins += 1;
    else cur.losses += 1;
    map.set(key, cur);
  }

  return Array.from(map.values());
}

/** 라인업 이름·팀, 프로필 닉네임 일괄 lookup → LineupRankingRow 로 확장. */
async function hydrate(aggs: Aggregate[], limit: number): Promise<LineupRankingRow[]> {
  // 정렬: 승수 desc → 승률 desc → 총 경기수 desc (안정 정렬 위해 다중 키).
  const sorted = aggs
    .map((a) => ({ ...a, total: a.wins + a.losses }))
    .filter((a) => a.total > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const ra = a.wins / a.total;
      const rb = b.wins / b.total;
      if (rb !== ra) return rb - ra;
      return b.total - a.total;
    })
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const lineupIds = Array.from(new Set(sorted.map((s) => s.lineupId)));
  const ownerIds = Array.from(new Set(sorted.map((s) => s.ownerUserId)));

  const [lineupsRes, profilesRes] = await Promise.all([
    supabase.from("bp_lineups").select("id, name, team_id").in("id", lineupIds),
    supabase.from("profiles").select("id, nickname").in("id", ownerIds)
  ]);

  const lineupMap = new Map<string, { name: string; team_id: string }>();
  for (const row of (lineupsRes.data ?? []) as Array<{ id: string; name: string; team_id: string }>) {
    lineupMap.set(row.id, { name: row.name, team_id: row.team_id });
  }
  const nickMap = new Map<string, string>();
  for (const row of (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null }>) {
    nickMap.set(row.id, row.nickname ?? "익명");
  }

  return sorted.map((s, idx) => {
    const lineup = lineupMap.get(s.lineupId);
    return {
      rank: idx + 1,
      lineupId: s.lineupId,
      ownerUserId: s.ownerUserId,
      nickname: nickMap.get(s.ownerUserId) ?? "익명",
      teamId: lineup?.team_id ?? "",
      lineupName: lineup?.name ?? "(삭제된 라인업)",
      wins: s.wins,
      losses: s.losses,
      total: s.total,
      winRate: s.total > 0 ? s.wins / s.total : 0
    };
  });
}

/** 시즌 누적 랭킹 (전체 기간). */
export async function listSeasonLineupRanking(limit = 100): Promise<LineupRankingRow[]> {
  try {
    const records = await fetchRecordsSince(null);
    const aggs = aggregate(records);
    return await hydrate(aggs, limit);
  } catch (e) {
    console.warn("[ranking] season 조회 실패:", (e as Error).message);
    return [];
  }
}

/** 이번 주(월~일 KST) 랭킹. */
export async function listWeeklyLineupRanking(limit = 100): Promise<LineupRankingRow[]> {
  try {
    const since = startOfWeekKstIso();
    const records = await fetchRecordsSince(since);
    const aggs = aggregate(records);
    return await hydrate(aggs, limit);
  } catch (e) {
    console.warn("[ranking] weekly 조회 실패:", (e as Error).message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 캐시 wrapper — 전체 사용자 공통 데이터(라인업 정렬 결과)만 60초 캐시.
// 본인 user_id 종속 로직이 없으므로 단순 캐시 적용. 본인 강조는 클라이언트가
// LineupRankingRow.ownerUserId 와 자체 보유 userId 를 비교하는 식으로 처리.
// ─────────────────────────────────────────────────────────────────────────────

const RANKING_REVALIDATE_SECONDS = 60;

/** 시즌 라인업 랭킹 — 60초 캐시. */
export const getCachedSeasonLineupRanking = unstable_cache(
  async (limit = 100): Promise<LineupRankingRow[]> => listSeasonLineupRanking(limit),
  ["lineup-ranking-season-v2-home-only"],
  { tags: ["ranking", "lineup-ranking-season"], revalidate: RANKING_REVALIDATE_SECONDS }
);

/** 이번 주 라인업 랭킹 — 60초 캐시. */
export const getCachedWeeklyLineupRanking = unstable_cache(
  async (limit = 100): Promise<LineupRankingRow[]> => listWeeklyLineupRanking(limit),
  ["lineup-ranking-weekly-v2-home-only"],
  { tags: ["ranking", "lineup-ranking-weekly"], revalidate: RANKING_REVALIDATE_SECONDS }
);
