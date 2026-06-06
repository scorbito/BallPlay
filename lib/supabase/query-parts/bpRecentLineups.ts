// bp_team_recent_lineups 조회.
// AI 대결, 라인업 짜기, AI 예측 등에서 팀별 최근 선발 라인업을 가져올 때 사용.

import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "bp_team_recent_lineups";

export type RecentLineupBatter = {
  order: number;
  name: string;
  position: string | null;
  rosterId: string | null;
};

export type RecentLineupRow = {
  id: string;
  game_id: string;
  game_date: string;
  team_id: string;
  is_home: boolean;
  batting: RecentLineupBatter[];
  starter_roster_id: string | null;
  starter_name: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

/** 팀별 가장 최신 라인업 1건. AI 대결 자동 라인업 등에 사용. */
export async function getLatestLineupForTeam(
  client: SupabaseClient,
  teamId: string
): Promise<{ ok: true; row: RecentLineupRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data ?? null) as RecentLineupRow | null };
}

/** 팀별 "타순이 채워진(9명) 가장 최신" 라인업.
 *  오늘 경기 전에는 선발 투수만 있고 타순(batting)이 비어 있는 행이 최신일 수 있어,
 *  타순이 완성된 최신 라인업(=어제 등)을 고른다. AI 상대 라인업 등에 사용. */
export async function getLatestBattingLineupForTeam(
  client: SupabaseClient,
  teamId: string
): Promise<{ ok: true; row: RecentLineupRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as RecentLineupRow[];
  const complete = rows.find((r) => Array.isArray(r.batting) && r.batting.length >= 9) ?? null;
  return { ok: true, row: complete };
}

/** 여러 팀의 "타순 완성된 최신" 라인업을 한 번에 (대진표 실시간 조회용).
 *  최근 N일치를 받아 team_id별로 batting 9명 채워진 첫(=최신) 행을 고른다. */
export async function listLatestBattingLineupsByTeam(
  client: SupabaseClient,
  opts?: { withinDays?: number }
): Promise<{ ok: true; byTeam: Record<string, RecentLineupRow> } | { ok: false; error: string }> {
  const withinDays = opts?.withinDays ?? 14;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - withinDays);
  const sinceISO = sinceDate.toISOString().slice(0, 10);

  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .gte("game_date", sinceISO)
    .order("game_date", { ascending: false });
  if (error) return { ok: false, error: error.message };

  const byTeam: Record<string, RecentLineupRow> = {};
  for (const row of (data ?? []) as RecentLineupRow[]) {
    if (!byTeam[row.team_id] && Array.isArray(row.batting) && row.batting.length >= 9) {
      byTeam[row.team_id] = row;
    }
  }
  return { ok: true, byTeam };
}

/** 모든 팀의 최신 라인업 한 번에. LobbyScreen 등 진입 시 prefetch용.
 *  team_id별 최신 1건만 추리려고 DISTINCT ON 대신 충분한 범위(최근 N일) 받아서 클라이언트에서 그룹화.
 *  팀당 일주일 ~6경기, 10팀 ≈ 60행 이라 부담 없음. */
export async function listLatestLineupsByTeam(
  client: SupabaseClient,
  opts?: { withinDays?: number }
): Promise<{ ok: true; byTeam: Record<string, RecentLineupRow> } | { ok: false; error: string }> {
  const withinDays = opts?.withinDays ?? 14;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - withinDays);
  const sinceISO = sinceDate.toISOString().slice(0, 10);

  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .gte("game_date", sinceISO)
    .order("game_date", { ascending: false });
  if (error) return { ok: false, error: error.message };

  // team_id별 첫 등장(=최신) 한 건만
  const byTeam: Record<string, RecentLineupRow> = {};
  for (const row of (data ?? []) as RecentLineupRow[]) {
    if (!byTeam[row.team_id]) byTeam[row.team_id] = row;
  }
  return { ok: true, byTeam };
}

/** 팀별 최근 N경기 라인업 (예상 라인업 최빈 산출 등 다음 단계용). */
export async function listRecentLineupsForTeam(
  client: SupabaseClient,
  teamId: string,
  limit = 10
): Promise<{ ok: true; rows: RecentLineupRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as RecentLineupRow[] };
}
