// bp_playoff_champions 조회 — 전체 유저 공개 "명예의 전당".
// 우승 시점 닉네임/팀/라인업을 박제한 불변 행. SELECT 는 RLS 상 누구나 가능.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

const TABLE = "bp_playoff_champions";

export type PlayoffChampionRow = {
  id: string;
  userId: string;
  nickname: string;
  teamId: string;
  teamName: string;
  batting: SavedLineup | null;
  pitching: SavedPitcherLineup | null;
  completedAt: string | null;
};

type Row = {
  id: string;
  user_id: string;
  nickname: string | null;
  team_id: string;
  team_name: string;
  batting: SavedLineup | null;
  pitching: SavedPitcherLineup | null;
  completed_at: string | null;
};

function rowToChampion(row: Row): PlayoffChampionRow {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname?.trim() || "익명",
    teamId: row.team_id,
    teamName: row.team_name,
    batting: row.batting,
    pitching: row.pitching,
    completedAt: row.completed_at
  };
}

/** 최신 우승자 목록 (completed_at 최신순). */
export async function listPlayoffChampions(
  client: SupabaseClient,
  limit = 10
): Promise<{ ok: true; rows: PlayoffChampionRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("id, user_id, nickname, team_id, team_name, batting, pitching, completed_at")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: ((data ?? []) as Row[]).map(rowToChampion) };
}

/** 역대 우승 총 횟수. */
export async function countPlayoffChampions(
  client: SupabaseClient
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { count, error } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? 0 };
}
