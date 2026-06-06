// bp_lineups CRUD — 로그인 사용자의 라인업 DB 동기화 (브라우저 클라이언트 한정).
// 공개/비공개 모델: is_published=true면 공개 라인업 풀에 노출 + 수정 잠금 + 전적 누적.
// 비공개 → 공개: lineup_hash 계산해서 세팅. 본인 중복 차단(unique index).
// 공개 → 비공개: bp_records의 본인 측 row 삭제(전적 리셋) + lineup_hash null.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry, SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

const TABLE = "bp_lineups";
const RECORDS_TABLE = "bp_records";

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
  // 공개 라인업이면 lineup_hash 채워짐. 비공개로 가면 null.
  lineup_hash?: string | null;
  // status / description은 레거시 컬럼 — 새 모델에선 미사용.
  status?: string | null;
  description?: string | null;
  // 팀 은퇴(보관). true 면 활성 목록/슬롯 한도/매치 풀에서 제외하되 전적은 보존.
  is_archived?: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

// 라인업 전적 (bp_lineup_stats view + RPC).
export type LineupStats = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
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
    is_published: entry.isPublished ?? false
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
  // 은퇴(is_archived=true) 팀은 활성 목록에서 제외 — 슬롯 한도/피커/동기화에 안 잡힘.
  // JS에서 필터: is_archived 컬럼이 아직 없을 수 있어(SQL 미적용) 쿼리 .eq 대신
  // 후처리. 컬럼 없으면 undefined → !undefined=true → 모두 활성으로 취급.
  const rows = ((data ?? []) as BpLineupRow[]).filter((r) => !r.is_archived);
  return { ok: true, rows };
}

// ============================================================
// Read — 본인 은퇴 팀 (마이페이지/팀 히스토리용)
// ============================================================

export async function listMyArchivedLineups(
  client: SupabaseClient,
  userId: string
): Promise<{ ok: true; rows: BpLineupRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  // 은퇴 컬럼 미적용 환경에서도 안전하도록 JS에서 필터/정렬(은퇴일 desc).
  const rows = ((data ?? []) as BpLineupRow[])
    .filter((r) => r.is_archived === true)
    .sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));
  return { ok: true, rows };
}

// ============================================================
// Upsert — entry_id 기준 (한 사용자 내 unique).
// 비공개 상태에서만 호출되어야 함 — 공개 row는 trigger에 의해 batting/pitching 수정 차단.
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
// 은퇴 (archive) — 전적 있는 팀은 삭제 대신 보관.
//   is_archived=true + archived_at 기록 + is_published=false(매치 풀에서 제외).
//   bp_records 는 건드리지 않음 → 전적 보존 (비공개 전환과 다른 점).
//   team_id 는 그대로라 immutable 트리거(구단 변경 차단)에도 안 걸림.
// ============================================================

export async function archiveLineupByEntryId(
  client: SupabaseClient,
  entryId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TABLE)
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      is_published: false
    })
    .eq("owner_user_id", userId)
    .eq("entry_id", entryId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// 공개 / 비공개 전환
//   - publish: lineup_hash 계산해서 함께 세팅. 본인 중복은 unique constraint로 차단.
//   - unpublish: bp_records의 본인 측 row 삭제(전적 리셋) + lineup_hash null.
//                public 매치만 대상 (friend는 lineup_id가 null이라 무관).
// ============================================================

export async function publishLineup(
  client: SupabaseClient,
  params: {
    entryId: string;
    userId: string;
    lineupHash: string;
    /** 공개 시 batting/pitching/name까지 함께 원자적으로 저장.
     *  이전엔 is_published만 update → 직전 syncedUpsert(fire-and-forget)와 race가 나면
     *  DB에 stale batting이 남고 sync에서 그게 local을 덮어쓰는 모바일 버그 발생. */
    entry: LineupEntry;
  }
): Promise<{ ok: true; row: BpLineupRow } | { ok: false; error: string; code?: "duplicate" | "unknown" }> {
  // upsert로 처리 — INSERT 또는 UPDATE 둘 다 자동.
  // (이전엔 update만 사용해 row가 아직 DB에 없으면 실패했음. 신규 라인업 공개 시 새로 만들어지도록 변경.)
  const payload = {
    ...entryToInsert(params.entry, params.userId),
    is_published: true,
    lineup_hash: params.lineupHash
  };
  const { data, error } = await client
    .from(TABLE)
    .upsert(payload, { onConflict: "owner_user_id,entry_id" })
    .select()
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "이미 같은 라인업을 공개했어요", code: "duplicate" };
    }
    return { ok: false, error: error?.message ?? "공개 전환 실패", code: "unknown" };
  }
  return { ok: true, row: data as BpLineupRow };
}

export async function unpublishLineup(
  client: SupabaseClient,
  params: {
    entryId: string;
    userId: string;
  }
): Promise<{ ok: true; row: BpLineupRow } | { ok: false; error: string }> {
  // 1. lineup row id 조회 (entry_id → id 매핑)
  const { data: existing } = await client
    .from(TABLE)
    .select("id")
    .eq("owner_user_id", params.userId)
    .eq("entry_id", params.entryId)
    .maybeSingle();
  const lineupRowId = (existing as { id: string } | null)?.id ?? null;

  // 2. 본인 매치 기록 중 이 라인업으로 한 row 삭제 (전적 리셋)
  if (lineupRowId) {
    await client
      .from(RECORDS_TABLE)
      .delete()
      .eq("owner_user_id", params.userId)
      .eq("home_lineup_id", lineupRowId);
    await client
      .from(RECORDS_TABLE)
      .delete()
      .eq("owner_user_id", params.userId)
      .eq("away_lineup_id", lineupRowId);
  }

  // 3. bp_lineups 자체 비공개 + lineup_hash null
  const { data, error } = await client
    .from(TABLE)
    .update({ is_published: false, lineup_hash: null })
    .eq("owner_user_id", params.userId)
    .eq("entry_id", params.entryId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "비공개 전환 실패" };
  return { ok: true, row: data as BpLineupRow };
}

// 레거시 — 단순 boolean toggle. 새 코드는 publishLineup / unpublishLineup 직접 호출.
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

// ============================================================
// 공개 라인업 풀 조회 (닉네임 join + 전적 RPC)
// ============================================================

export type PublishedLineupRow = BpLineupRow & {
  owner_nickname: string | null;
  owner_display_name: string | null;
};

/** 본인이 같은 lineup_hash로 이미 공개했는지 확인 (UI 사전 안내). */
export async function existsOwnerPublishedHash(
  client: SupabaseClient,
  userId: string,
  lineupHash: string,
  excludeEntryId?: string
): Promise<boolean> {
  let query = client
    .from(TABLE)
    .select("id")
    .eq("owner_user_id", userId)
    .eq("is_published", true)
    .eq("lineup_hash", lineupHash);
  if (excludeEntryId) query = query.neq("entry_id", excludeEntryId);
  const { data } = await query.maybeSingle();
  return data !== null;
}

/** 메인 6개 — 승률 정렬 RPC. 5경기 가중. 본인 도전 매치만 집계됨(view). */
export async function listPublishedByWinrate(
  client: SupabaseClient,
  limit: number
): Promise<{ ok: true; statsByLineupId: Record<string, LineupStats>; lineupIds: string[] } | { ok: false; error: string }> {
  const { data, error } = await client.rpc("list_published_lineups_by_winrate", { p_limit: limit });
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Array<{
    lineup_id: string;
    matches: number;
    wins: number;
    losses: number;
    draws: number;
  }>;
  const ids = rows.map((r) => r.lineup_id);
  const stats: Record<string, LineupStats> = {};
  for (const r of rows) {
    stats[r.lineup_id] = { matches: r.matches, wins: r.wins, losses: r.losses, draws: r.draws };
  }
  return { ok: true, statsByLineupId: stats, lineupIds: ids };
}

/** 라인업 ID 배열 → 공개 라인업 row + 닉네임 join. join 실패 시 닉네임 null fallback. */
export async function fetchPublishedLineupsByIds(
  client: SupabaseClient,
  lineupIds: string[]
): Promise<{ ok: true; rows: PublishedLineupRow[] } | { ok: false; error: string }> {
  if (lineupIds.length === 0) return { ok: true, rows: [] };
  const { data, error } = await client
    .from(TABLE)
    .select(
      `
      *,
      profile:profiles!bp_lineups_owner_user_id_fkey(nickname)
    `
    )
    .in("id", lineupIds);
  let rows: PublishedLineupRow[];
  if (error) {
    const noJoin = await client.from(TABLE).select("*").in("id", lineupIds);
    if (noJoin.error) return { ok: false, error: noJoin.error.message };
    rows = (noJoin.data ?? []).map((r) => ({
      ...(r as BpLineupRow),
      owner_nickname: null,
      owner_display_name: null
    })) as PublishedLineupRow[];
  } else {
    rows = (data ?? []).map((r) => {
      const row = r as BpLineupRow & {
        profile?: { nickname?: string | null; display_name?: string | null } | null;
      };
      return {
        ...row,
        owner_nickname: row.profile?.nickname ?? null,
        owner_display_name: row.profile?.display_name ?? null
      } as PublishedLineupRow;
    });
  }

  // 닉네임 보강 — join 실패하거나 빠진 닉네임 별도 fetch
  const missingOwnerIds = rows
    .filter((r) => !r.owner_nickname && !r.owner_display_name)
    .map((r) => r.owner_user_id);
  if (missingOwnerIds.length > 0) {
    const profiles = await fetchProfilesByUserIds(client, missingOwnerIds);
    rows = rows.map((r) => {
      if (r.owner_nickname || r.owner_display_name) return r;
      const p = profiles[r.owner_user_id];
      if (!p) return r;
      return { ...r, owner_nickname: p.nickname, owner_display_name: p.display_name };
    });
  }

  const sorted = lineupIds.map((id) => rows.find((r) => r.id === id)).filter((r): r is PublishedLineupRow => Boolean(r));
  return { ok: true, rows: sorted };
}

/** 전체보기 — 최신순. excludeUserId=null이면 본인 카드 포함. */
export async function listPublishedByRecent(
  client: SupabaseClient,
  limit: number,
  excludeUserId?: string | null
): Promise<{ ok: true; rows: PublishedLineupRow[]; statsByLineupId: Record<string, LineupStats> } | { ok: false; error: string }> {
  let query = client
    .from(TABLE)
    .select(
      `
      *,
      profile:profiles!bp_lineups_owner_user_id_fkey(nickname)
    `
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excludeUserId) query = query.neq("owner_user_id", excludeUserId);
  const { data, error } = await query;

  let rows: PublishedLineupRow[];
  if (error) {
    // profiles join 실패 → 닉네임 null fallback
    let fallbackQuery = client
      .from(TABLE)
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (excludeUserId) fallbackQuery = fallbackQuery.neq("owner_user_id", excludeUserId);
    const fb = await fallbackQuery;
    if (fb.error) return { ok: false, error: fb.error.message };
    rows = (fb.data ?? []).map((r) => ({
      ...(r as BpLineupRow),
      owner_nickname: null,
      owner_display_name: null
    })) as PublishedLineupRow[];
  } else {
    rows = (data ?? []).map((r) => {
      const row = r as BpLineupRow & {
        profile?: { nickname?: string | null; display_name?: string | null } | null;
      };
      return {
        ...row,
        owner_nickname: row.profile?.nickname ?? null,
        owner_display_name: row.profile?.display_name ?? null
      } as PublishedLineupRow;
    });
  }

  // 닉네임 보강 — join 실패하거나 빠진 닉네임 별도 fetch
  const missingOwnerIds = rows
    .filter((r) => !r.owner_nickname && !r.owner_display_name)
    .map((r) => r.owner_user_id);
  if (missingOwnerIds.length > 0) {
    const profiles = await fetchProfilesByUserIds(client, missingOwnerIds);
    rows = rows.map((r) => {
      if (r.owner_nickname || r.owner_display_name) return r;
      const p = profiles[r.owner_user_id];
      if (!p) return r;
      return { ...r, owner_nickname: p.nickname, owner_display_name: p.display_name };
    });
  }

  const ids = rows.map((r) => r.id);
  const stats = await fetchLineupStatsBulk(client, ids);
  return { ok: true, rows, statsByLineupId: stats };
}

/** owner_user_id 배열 → profiles의 nickname 매핑.
 *  운영 DB의 profiles 컬럼이 nickname만 있어서 display_name select 시 400. nickname만 가져옴. */
export async function fetchProfilesByUserIds(
  client: SupabaseClient,
  userIds: string[]
): Promise<Record<string, { nickname: string | null; display_name: string | null }>> {
  if (userIds.length === 0) return {};
  const uniq = Array.from(new Set(userIds));
  const { data, error } = await client
    .from("profiles")
    .select("id, nickname")
    .in("id", uniq);
  if (error) return {};
  const result: Record<string, { nickname: string | null; display_name: string | null }> = {};
  for (const row of (data ?? []) as Array<{ id: string; nickname: string | null }>) {
    result[row.id] = { nickname: row.nickname ?? null, display_name: null };
  }
  return result;
}

export async function fetchLineupStatsBulk(
  client: SupabaseClient,
  lineupIds: string[]
): Promise<Record<string, LineupStats>> {
  if (lineupIds.length === 0) return {};
  const { data, error } = await client.rpc("get_lineup_stats_bulk", { p_lineup_ids: lineupIds });
  if (error) return {};
  const rows = (data ?? []) as Array<{
    lineup_id: string;
    matches: number;
    wins: number;
    losses: number;
    draws: number;
  }>;
  const result: Record<string, LineupStats> = {};
  for (const r of rows) {
    result[r.lineup_id] = { matches: r.matches, wins: r.wins, losses: r.losses, draws: r.draws };
  }
  return result;
}
