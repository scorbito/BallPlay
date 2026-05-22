// bp_records CRUD — 경기 기록 저장/조회 (공개 라인업 + 친구 대전 한정).
// 익명 계정은 DB 저장 불가 — 호출 측에서 user.is_anonymous 체크 후 skip.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimGameInput, SimGameResult } from "@/lib/sim/types";

const TABLE = "bp_records";

// ============================================================
// 타입
// ============================================================

export type BpRecordSource = "public" | "friend";
export type BpRecordSide = "home" | "away";

// DB row 1:1 매핑 (snake_case)
export type BpRecordRow = {
  id: string;
  owner_user_id: string;
  source: BpRecordSource;
  bp_match_id: string | null;
  user_side: BpRecordSide;
  engine_version: string;
  seed: number;
  // 7일 후 retention으로 NULL 될 수 있음 — 재생 불가 상태 판정에 사용
  input: SimGameInput | null;
  result: SimGameResult | null;
  home_team_id: string;
  away_team_id: string;
  home_label: string | null;
  away_label: string | null;
  final_score: { home: number; away: number };
  mvp_player_id: string | null;
  mvp_name: string | null;
  is_walkoff: boolean;
  total_innings: number;
  name: string | null;
  created_at: string;
};

export type CreateRecordInput = {
  ownerUserId: string;
  source: BpRecordSource;
  bpMatchId?: string | null;
  userSide: BpRecordSide;
  engineVersion: string;
  seed: number;
  input: SimGameInput;
  result: SimGameResult;
  homeTeamId: string;
  awayTeamId: string;
  homeLabel?: string | null;
  awayLabel?: string | null;
  finalScore: { home: number; away: number };
  mvpPlayerId?: string | null;
  mvpName?: string | null;
  isWalkoff?: boolean;
  totalInnings?: number;
  name?: string | null;
};

// ============================================================
// Create — 새 기록 저장 (insert)
// ============================================================

export async function createRecord(
  client: SupabaseClient,
  input: CreateRecordInput
): Promise<{ ok: true; row: BpRecordRow } | { ok: false; error: string }> {
  const insertRow = {
    owner_user_id: input.ownerUserId,
    source: input.source,
    bp_match_id: input.bpMatchId ?? null,
    user_side: input.userSide,
    engine_version: input.engineVersion,
    seed: input.seed,
    input: input.input,
    result: input.result,
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    home_label: input.homeLabel ?? null,
    away_label: input.awayLabel ?? null,
    final_score: input.finalScore,
    mvp_player_id: input.mvpPlayerId ?? null,
    mvp_name: input.mvpName ?? null,
    is_walkoff: input.isWalkoff ?? false,
    total_innings: input.totalInnings ?? 9,
    name: input.name ?? null
  };

  const { data, error } = await client.from(TABLE).insert(insertRow).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as BpRecordRow };
}

// ============================================================
// Read — 본인 기록 목록 (최신순)
// ============================================================

export async function listMyRecords(
  client: SupabaseClient,
  userId: string,
  limit = 50
): Promise<{ ok: true; rows: BpRecordRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as BpRecordRow[] };
}

// ============================================================
// Read — 단일 기록 (재생 진입 시)
// ============================================================

export async function getRecord(
  client: SupabaseClient,
  recordId: string
): Promise<{ ok: true; row: BpRecordRow } | { ok: false; error: string }> {
  const { data, error } = await client.from(TABLE).select("*").eq("id", recordId).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as BpRecordRow };
}

// ============================================================
// Update — 사용자 라벨(name) 변경
// ============================================================

export async function updateRecordName(
  client: SupabaseClient,
  recordId: string,
  name: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.from(TABLE).update({ name }).eq("id", recordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Delete — 단일 삭제
// ============================================================

export async function deleteRecord(
  client: SupabaseClient,
  recordId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.from(TABLE).delete().eq("id", recordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// 유틸 — 재생 가능 여부 판정
// ============================================================

const REPLAY_RETENTION_DAYS = 7;

/** 기록이 재생 가능한 상태인지 — 엔진 버전 일치 + 7일 이내 + input 보존 */
export function canReplay(row: BpRecordRow, currentEngineVersion: string): {
  ok: boolean;
  reason?: "expired" | "engine_mismatch" | "data_dropped";
} {
  if (!row.input) return { ok: false, reason: "data_dropped" };
  if (row.engine_version !== currentEngineVersion) return { ok: false, reason: "engine_mismatch" };
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const maxMs = REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxMs) return { ok: false, reason: "expired" };
  return { ok: true };
}
