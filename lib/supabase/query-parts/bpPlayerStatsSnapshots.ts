// bp_player_stats_snapshots 조회.
// 매치 시작 시 출전 선수의 최신 2개 스냅샷을 가져와 시즌 + 주간 델타 계산에 사용.

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

/** 선수별 latest + previous(있으면) 스냅샷.
 *  - latest: 가장 최신
 *  - previous: 그 다음 최신 (없으면 null → 첫 윈도우, 델타 계산 불가) */
export type PlayerSnapshots = {
  playerId: string;
  kind: "batter" | "pitcher";
  latest: SimBatter | SimPitcher;
  previous: SimBatter | SimPitcher | null;
};

/** 주어진 player_id 목록의 최신 2개 스냅샷 조회.
 *  Supabase의 distinct 미지원 → 충분히 넉넉한 범위 받아 클라에서 그룹화.
 *  팀당 30~50명 × 2주 = 60~100행 정도. 부담 없음. */
export async function getPlayerSnapshotsForIds(
  client: SupabaseClient,
  playerIds: string[],
  opts?: { withinWeeks?: number }
): Promise<{ ok: true; byPlayer: Map<string, PlayerSnapshots> } | { ok: false; error: string }> {
  if (playerIds.length === 0) {
    return { ok: true, byPlayer: new Map() };
  }
  const withinWeeks = opts?.withinWeeks ?? 8;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - withinWeeks * 7);
  const sinceISO = sinceDate.toISOString().slice(0, 10);

  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .in("player_id", playerIds)
    .gte("snapshot_date", sinceISO)
    .order("snapshot_date", { ascending: false });
  if (error) return { ok: false, error: error.message };

  // (player_id, kind) 기준 그룹화 후 상위 2개 추출
  const groups = new Map<string, SnapshotRow[]>();
  for (const row of (data ?? []) as SnapshotRow[]) {
    const key = `${row.player_id}|${row.kind}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const byPlayer = new Map<string, PlayerSnapshots>();
  groups.forEach((rows, _key) => {
    // rows는 이미 snapshot_date desc 정렬 상태
    const first = rows[0];
    byPlayer.set(`${first.player_id}|${first.kind}`, {
      playerId: first.player_id,
      kind: first.kind,
      latest: first.sim_payload,
      previous: rows[1]?.sim_payload ?? null
    });
  });

  return { ok: true, byPlayer };
}

/** 팀별로 한 번에 가져오는 헬퍼. AI 예측처럼 양팀 전체가 필요한 경우. */
export async function getPlayerSnapshotsForTeams(
  client: SupabaseClient,
  teamIds: string[],
  opts?: { withinWeeks?: number }
): Promise<{ ok: true; byPlayer: Map<string, PlayerSnapshots> } | { ok: false; error: string }> {
  if (teamIds.length === 0) {
    return { ok: true, byPlayer: new Map() };
  }
  const withinWeeks = opts?.withinWeeks ?? 8;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - withinWeeks * 7);
  const sinceISO = sinceDate.toISOString().slice(0, 10);

  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .in("team_id", teamIds)
    .gte("snapshot_date", sinceISO)
    .order("snapshot_date", { ascending: false });
  if (error) return { ok: false, error: error.message };

  const groups = new Map<string, SnapshotRow[]>();
  for (const row of (data ?? []) as SnapshotRow[]) {
    const key = `${row.player_id}|${row.kind}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const byPlayer = new Map<string, PlayerSnapshots>();
  groups.forEach((rows) => {
    const first = rows[0];
    byPlayer.set(`${first.player_id}|${first.kind}`, {
      playerId: first.player_id,
      kind: first.kind,
      latest: first.sim_payload,
      previous: rows[1]?.sim_payload ?? null
    });
  });

  return { ok: true, byPlayer };
}
