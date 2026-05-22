// bp_lineups CRUD — 로그인 사용자의 라인업 DB 동기화 (브라우저 클라이언트 한정).
// PR2에서 is_published 토글 + 공개 풀 조회 추가 예정.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry, SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

const TABLE = "bp_lineups";

// DB row 1:1 매핑 (snake_case)
export type BpLineupRow = {
  id: string;
  owner_user_id: string;
  entry_id: string;
  name: string;
  team_id: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================================
// 변환 — DB row ↔ LineupEntry
// ============================================================

export function rowToEntry(row: BpLineupRow): LineupEntry {
  return {
    entryId: row.entry_id,
    name: row.name,
    teamId: row.team_id,
    batting: row.batting,
    pitching: row.pitching,
    updatedAt: row.updated_at,
    isPublished: row.is_published
  };
}

function entryToInsert(entry: LineupEntry, userId: string): Omit<BpLineupRow, "id" | "created_at" | "updated_at"> {
  return {
    owner_user_id: userId,
    entry_id: entry.entryId,
    name: entry.name,
    team_id: entry.teamId,
    batting: entry.batting,
    pitching: entry.pitching,
    // LineupEntry.isPublished를 DB로 전파. undefined면 디폴트 공개(true)로 처리
    // (새 entry는 createEmptyEntry에서 true로 시작 — 사용자가 빌더에서 끄지 않는 한 공개)
    is_published: entry.isPublished ?? true
  };
}

// ============================================================
// Read — 본인 라인업 전체
// ============================================================

export async function listMyLineups(
  client: SupabaseClient,
  userId: string
): Promise<{ ok: true; rows: BpLineupRow[] } | { ok: false; error: string }> {
  // 명시적으로 owner_user_id 필터 — RLS가 본인 + 공개 row 둘 다 허용하므로
  // 명시 안 하면 다른 user의 공개 라인업까지 "내 라인업"으로 가져옴.
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as BpLineupRow[] };
}

// ============================================================
// Upsert — entry_id 기준 (한 사용자 내 unique).
// updated_at은 트리거가 자동 갱신하지만, 클라이언트 정렬용으로 직접 전달도 가능.
// ============================================================

export async function upsertLineup(
  client: SupabaseClient,
  entry: LineupEntry,
  userId: string
): Promise<{ ok: true; row: BpLineupRow } | { ok: false; error: string }> {
  const payload = entryToInsert(entry, userId);
  const { data, error } = await client
    .from(TABLE)
    .upsert(payload, { onConflict: "owner_user_id,entry_id" })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "라인업 저장 실패" };
  return { ok: true, row: data as BpLineupRow };
}

// 여러 entry를 한 번에 upsert (첫 로그인 마이그레이션용)
export async function bulkUpsertLineups(
  client: SupabaseClient,
  entries: LineupEntry[],
  userId: string
): Promise<{ ok: true; rows: BpLineupRow[] } | { ok: false; error: string }> {
  if (entries.length === 0) return { ok: true, rows: [] };
  const payload = entries.map((e) => entryToInsert(e, userId));
  const { data, error } = await client
    .from(TABLE)
    .upsert(payload, { onConflict: "owner_user_id,entry_id" })
    .select();
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as BpLineupRow[] };
}

// ============================================================
// Delete
// ============================================================

export async function deleteLineupByEntryId(
  client: SupabaseClient,
  entryId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TABLE)
    .delete()
    .eq("owner_user_id", userId)
    .eq("entry_id", entryId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// 공개 풀 (PR2) — is_published=true인 라인업 + 소유자 닉네임 join.
// 본인 라인업은 제외하고 다른 사용자만 (UI에서 자기 라인업과 매칭은 의미 없음).
// ============================================================

export type PublishedLineupRow = BpLineupRow & {
  owner_nickname: string | null;
  owner_display_name: string | null;
};

export async function listPublishedLineups(
  client: SupabaseClient,
  excludeUserId?: string | null,
  /** 본인 인식용 — 현재 기기 localStorage의 entryId 목록. 어떤 계정(정식/익명/비로그인)으로
   *  봐도 같은 기기에서 만든 라인업은 모두 제외. excludeUserId 보완 메커니즘. */
  excludeEntryIds?: string[]
): Promise<{ ok: true; rows: PublishedLineupRow[] } | { ok: false; error: string }> {
  // profiles 테이블과 join — 운영 DB의 user_profiles 또는 profiles 테이블 활용
  // (정확한 스키마는 운영 DB에 따라 다름. nickname/display_name 둘 중 살아있는 것 활용)
  let query = client
    .from(TABLE)
    .select(
      `
      *,
      profile:profiles!bp_lineups_owner_user_id_fkey(nickname, display_name)
    `
    )
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (excludeUserId) {
    query = query.neq("owner_user_id", excludeUserId);
  }
  if (excludeEntryIds && excludeEntryIds.length > 0) {
    // PostgREST "in" 필터 — `(id1,id2,id3)` 형식
    query = query.not("entry_id", "in", `(${excludeEntryIds.map((s) => `"${s}"`).join(",")})`);
  }
  const { data, error } = await query;
  if (error) {
    // profiles join이 실패하면 (FK 이름 불일치 등) profile 없이 fallback
    const fallback = await listPublishedLineupsNoJoin(client, excludeUserId, excludeEntryIds);
    return fallback;
  }
  const rows = (data ?? []).map((r) => {
    const row = r as BpLineupRow & {
      profile?: { nickname?: string | null; display_name?: string | null } | null;
    };
    return {
      ...row,
      owner_nickname: row.profile?.nickname ?? null,
      owner_display_name: row.profile?.display_name ?? null
    } as PublishedLineupRow;
  });
  return { ok: true, rows };
}

// profiles join이 안 되는 경우 — 라인업만 가져오고 닉네임은 null
async function listPublishedLineupsNoJoin(
  client: SupabaseClient,
  excludeUserId?: string | null,
  excludeEntryIds?: string[]
): Promise<{ ok: true; rows: PublishedLineupRow[] } | { ok: false; error: string }> {
  let query = client
    .from(TABLE)
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (excludeUserId) query = query.neq("owner_user_id", excludeUserId);
  if (excludeEntryIds && excludeEntryIds.length > 0) {
    query = query.not("entry_id", "in", `(${excludeEntryIds.map((s) => `"${s}"`).join(",")})`);
  }
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []).map((r) => ({
    ...(r as BpLineupRow),
    owner_nickname: null,
    owner_display_name: null
  })) as PublishedLineupRow[];
  return { ok: true, rows };
}

// 공개 토글 (true/false)
export async function togglePublished(
  client: SupabaseClient,
  entryId: string,
  userId: string,
  isPublished: boolean
): Promise<{ ok: true; row: BpLineupRow } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .update({ is_published: isPublished })
    .eq("owner_user_id", userId)
    .eq("entry_id", entryId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "공개 상태 변경 실패" };
  return { ok: true, row: data as BpLineupRow };
}
