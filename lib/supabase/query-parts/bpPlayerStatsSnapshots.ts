// bp_player_stats_snapshots 조회.
// 매치/예측에 필요한 선수 스탯은 "최신 스냅샷 1개 + 7일 전 기준 스냅샷 1개"만 가져온다.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";

const TABLE = "bp_player_stats_snapshots";

export type SnapshotRow = {
  id: string;
  snapshot_date: string;
  player_id: string;
  team_id: string;
  kind: "batter" | "pitcher";
  sim_payload: SimBatter | SimPitcher;
  source: string;
};

export type PlayerSnapshots = {
  playerId: string;
  kind: "batter" | "pitcher";
  latest: SimBatter | SimPitcher;
  /** 기본값은 latest 기준 7일 전 이하에서 가장 가까운 스냅샷. */
  previous: SimBatter | SimPitcher | null;
};

type SnapshotQueryOptions = {
  /** 경기/매치 기준일. 지정하면 이 날짜 이하에서 latest를 고정한다. */
  asOfDate?: string;
  /** recent form delta 기준 간격. 기본 7일 = 주간 델타. */
  comparisonDays?: number;
  /** comparisonDays 지점에 정확한 행이 없을 때 뒤로 더 찾을 범위. 기본 14일. */
  previousLookbackDays?: number;
};

export async function getLatestPlayerStatsSnapshotDate(
  client: SupabaseClient
): Promise<{ ok: true; snapshotDate: string | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshotDate: (data as { snapshot_date?: string } | null)?.snapshot_date ?? null };
}

export async function getPlayerSnapshotsForIds(
  client: SupabaseClient,
  playerIds: string[],
  opts?: SnapshotQueryOptions
): Promise<{ ok: true; byPlayer: Map<string, PlayerSnapshots> } | { ok: false; error: string }> {
  if (playerIds.length === 0) return { ok: true, byPlayer: new Map() };

  const latestDateRes = await getLatestSnapshotDateForPlayerIds(client, playerIds, opts?.asOfDate);
  if (!latestDateRes.ok) return latestDateRes;
  if (!latestDateRes.snapshotDate) return { ok: true, byPlayer: new Map() };

  const rows = await getSnapshotPointRows(client, "player_id", playerIds, latestDateRes.snapshotDate, opts);
  if (!rows.ok) return rows;
  return { ok: true, byPlayer: pairLatestAndPrevious(rows.latestRows, rows.previousRows) };
}

export async function getPlayerSnapshotsForTeams(
  client: SupabaseClient,
  teamIds: string[],
  opts?: SnapshotQueryOptions
): Promise<{ ok: true; byPlayer: Map<string, PlayerSnapshots> } | { ok: false; error: string }> {
  if (teamIds.length === 0) return { ok: true, byPlayer: new Map() };

  const latestDateRes = await getLatestSnapshotDateForTeamIds(client, teamIds, opts?.asOfDate);
  if (!latestDateRes.ok) return latestDateRes;
  if (!latestDateRes.snapshotDate) return { ok: true, byPlayer: new Map() };

  const rows = await getSnapshotPointRows(client, "team_id", teamIds, latestDateRes.snapshotDate, opts);
  if (!rows.ok) return rows;
  return { ok: true, byPlayer: pairLatestAndPrevious(rows.latestRows, rows.previousRows) };
}

async function getLatestSnapshotDateForPlayerIds(
  client: SupabaseClient,
  playerIds: string[],
  asOfDate?: string
): Promise<{ ok: true; snapshotDate: string | null } | { ok: false; error: string }> {
  let query = client.from(TABLE).select("snapshot_date").in("player_id", playerIds);
  if (asOfDate) query = query.lte("snapshot_date", asOfDate);
  const { data, error } = await query.order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshotDate: (data as { snapshot_date?: string } | null)?.snapshot_date ?? null };
}

async function getLatestSnapshotDateForTeamIds(
  client: SupabaseClient,
  teamIds: string[],
  asOfDate?: string
): Promise<{ ok: true; snapshotDate: string | null } | { ok: false; error: string }> {
  let query = client.from(TABLE).select("snapshot_date").in("team_id", teamIds);
  if (asOfDate) query = query.lte("snapshot_date", asOfDate);
  const { data, error } = await query.order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshotDate: (data as { snapshot_date?: string } | null)?.snapshot_date ?? null };
}

async function getSnapshotPointRows(
  client: SupabaseClient,
  column: "player_id" | "team_id",
  values: string[],
  latestDate: string,
  opts?: SnapshotQueryOptions
): Promise<{ ok: true; latestRows: SnapshotRow[]; previousRows: SnapshotRow[] } | { ok: false; error: string }> {
  const previousTargetDate = addDaysISO(latestDate, -(opts?.comparisonDays ?? 7));
  const previousSinceDate = addDaysISO(previousTargetDate, -(opts?.previousLookbackDays ?? 14));

  const { data: latestRows, error: latestError } = await client
    .from(TABLE)
    .select("*")
    .in(column, values)
    .eq("snapshot_date", latestDate);
  if (latestError) return { ok: false, error: latestError.message };

  const { data: previousRows, error: previousError } = await client
    .from(TABLE)
    .select("*")
    .in(column, values)
    .lte("snapshot_date", previousTargetDate)
    .gte("snapshot_date", previousSinceDate)
    .order("snapshot_date", { ascending: false });
  if (previousError) return { ok: false, error: previousError.message };

  return {
    ok: true,
    latestRows: (latestRows ?? []) as SnapshotRow[],
    previousRows: (previousRows ?? []) as SnapshotRow[]
  };
}

function pairLatestAndPrevious(latestRows: SnapshotRow[], previousRows: SnapshotRow[]): Map<string, PlayerSnapshots> {
  const previousByKey = new Map<string, SnapshotRow>();
  for (const row of previousRows) {
    const key = `${row.player_id}|${row.kind}`;
    if (!previousByKey.has(key)) previousByKey.set(key, row);
  }

  const byPlayer = new Map<string, PlayerSnapshots>();
  for (const row of latestRows) {
    const key = `${row.player_id}|${row.kind}`;
    byPlayer.set(key, {
      playerId: row.player_id,
      kind: row.kind,
      latest: row.sim_payload,
      previous: previousByKey.get(key)?.sim_payload ?? null
    });
  }
  return byPlayer;
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
