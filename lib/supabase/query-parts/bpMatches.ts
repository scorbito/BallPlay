// bp_matches CRUD + Realtime 구독 헬퍼 (브라우저 클라이언트 한정).
// 운영 DB와 공유 중이라 schema 변경 X, 새 테이블 bp_matches만 사용.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { getStatsSnapshotDate } from "@/lib/sim/statsLoader";
import type { SharedTeam } from "@/lib/sim/matchShare";
import { getLatestPlayerStatsSnapshotDate } from "./bpPlayerStatsSnapshots";

export type BpMatchStatus = "pending" | "ready" | "playing" | "finished" | "cancelled";

// DB row 1:1 매핑 (snake_case 그대로)
export type BpMatchMode = "fast" | "normal" | "live";

export type BpMatchRow = {
  id: string;
  invite_code: string | null;
  status: BpMatchStatus;
  away_team_id: string | null;
  home_team_id: string | null;
  away_lineup_snapshot: SharedTeam | null;
  home_lineup_snapshot: SharedTeam | null;
  away_owner_id: string | null;
  home_owner_id: string | null;
  away_guest_id: string | null;
  home_guest_id: string | null;
  // 공개 라인업 ID — 비공개/임시 라인업이면 null. 양쪽 NOT NULL 이면 매치 종료 시 정식 매치로 집계.
  home_lineup_id: string | null;
  away_lineup_id: string | null;
  seed: number;
  engine_version: string;
  stats_snapshot_date: string;
  start_at: string | null;
  mode: BpMatchMode; // 진행 모드 — 매치 생성 시 결정, 양쪽 동일
  created_at: string;
  updated_at: string;
};

const TABLE = "bp_matches";

// ============================================================
// 매치 생성 — 생성자가 한쪽 슬롯을 점유. 상대는 빈 슬롯으로 남김.
// ============================================================

export type CreateMatchInput = {
  ownerSide: "home" | "away"; // 생성자가 어느 쪽에 들어갈지
  ownerId: string | null;     // auth.uid() — 익명이면 null
  guestId: string;            // localStorage 게스트 ID (auth와 별개)
  team: SharedTeam;           // 생성자 라인업 스냅샷
  seed: number;
  mode?: BpMatchMode;         // 진행 모드 (디폴트 'fast')
  /** 공개 라인업 ID (bp_lineups.id). 비공개/임시 라인업이면 null/undefined. */
  lineupId?: string | null;
};

export async function createMatch(
  client: SupabaseClient,
  input: CreateMatchInput
): Promise<{ ok: true; row: BpMatchRow } | { ok: false; error: string }> {
  // invite_code는 DB 함수로 발급
  const { data: codeData, error: codeErr } = await client
    .rpc("generate_bp_match_invite_code");
  if (codeErr) return { ok: false, error: codeErr.message };
  const inviteCode = codeData as string;
  const latestSnapshot = await getLatestPlayerStatsSnapshotDate(client);
  const statsSnapshotDate =
    latestSnapshot.ok && latestSnapshot.snapshotDate
      ? latestSnapshot.snapshotDate
      : getStatsSnapshotDate();

  const insert: Partial<BpMatchRow> = {
    invite_code: inviteCode,
    status: "pending",
    seed: input.seed,
    engine_version: SIM_ENGINE_VERSION,
    stats_snapshot_date: statsSnapshotDate,
    mode: input.mode ?? "fast",
    away_team_id: input.ownerSide === "away" ? input.team.t : null,
    home_team_id: input.ownerSide === "home" ? input.team.t : null,
    away_lineup_snapshot: input.ownerSide === "away" ? input.team : null,
    home_lineup_snapshot: input.ownerSide === "home" ? input.team : null,
    away_owner_id: input.ownerSide === "away" ? input.ownerId : null,
    home_owner_id: input.ownerSide === "home" ? input.ownerId : null,
    away_guest_id: input.ownerSide === "away" ? input.guestId : null,
    home_guest_id: input.ownerSide === "home" ? input.guestId : null,
    away_lineup_id: input.ownerSide === "away" ? (input.lineupId ?? null) : null,
    home_lineup_id: input.ownerSide === "home" ? (input.lineupId ?? null) : null
  };

  const { data, error } = await client
    .from(TABLE)
    .insert(insert)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "매치 생성 실패" };
  return { ok: true, row: data as BpMatchRow };
}

// ============================================================
// invite_code로 조회 (참가자가 URL 따라 들어왔을 때)
// ============================================================

export async function getMatchByInviteCode(
  client: SupabaseClient,
  inviteCode: string
): Promise<BpMatchRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (error || !data) return null;
  return data as BpMatchRow;
}

export async function getMatchById(
  client: SupabaseClient,
  id: string
): Promise<BpMatchRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as BpMatchRow;
}

// ============================================================
// 빈 슬롯에 join — 라인업 + owner/guest 채움. 양쪽 다 채워지면 status=ready로.
// ============================================================

export type JoinMatchInput = {
  matchId: string;
  ownerId: string | null;
  guestId: string;
  team: SharedTeam;
  /** 공개 라인업 ID (bp_lineups.id). 비공개/임시 라인업이면 null/undefined. */
  lineupId?: string | null;
};

export async function joinMatch(
  client: SupabaseClient,
  input: JoinMatchInput
): Promise<{ ok: true; row: BpMatchRow } | { ok: false; error: string }> {
  // 현재 row 조회 — 어느 슬롯이 비어있는지 확인
  const current = await getMatchById(client, input.matchId);
  if (!current) return { ok: false, error: "매치를 찾을 수 없습니다." };
  if (current.status !== "pending") {
    return { ok: false, error: "이미 진행 중이거나 종료된 매치입니다." };
  }
  if (current.engine_version !== SIM_ENGINE_VERSION) {
    return { ok: false, error: `엔진 버전 불일치 (${current.engine_version} ≠ ${SIM_ENGINE_VERSION})` };
  }
  const emptySide: "home" | "away" | null = current.away_lineup_snapshot
    ? current.home_lineup_snapshot ? null : "home"
    : "away";
  if (!emptySide) return { ok: false, error: "매치가 이미 가득 찼습니다." };

  const update: Partial<BpMatchRow> = {
    status: "ready",
    [`${emptySide}_team_id` as keyof BpMatchRow]: input.team.t,
    [`${emptySide}_lineup_snapshot` as keyof BpMatchRow]: input.team,
    [`${emptySide}_owner_id` as keyof BpMatchRow]: input.ownerId,
    [`${emptySide}_guest_id` as keyof BpMatchRow]: input.guestId,
    [`${emptySide}_lineup_id` as keyof BpMatchRow]: input.lineupId ?? null
  } as Partial<BpMatchRow>;

  const { data, error } = await client
    .from(TABLE)
    .update(update)
    .eq("id", input.matchId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "매치 참여 실패" };
  return { ok: true, row: data as BpMatchRow };
}

// ============================================================
// 시작 시각 설정 — 호스트(생성자)가 양쪽 ready 확인 후 호출.
// 클라이언트 시계 차이 보정을 위해 now + 3초 정도로 여유.
// ============================================================

export async function setMatchStart(
  client: SupabaseClient,
  matchId: string,
  delaySeconds = 3
): Promise<{ ok: true; row: BpMatchRow } | { ok: false; error: string }> {
  const startAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const { data, error } = await client
    .from(TABLE)
    .update({ status: "playing", start_at: startAt })
    .eq("id", matchId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "시작 실패" };
  return { ok: true, row: data as BpMatchRow };
}

// ============================================================
// 매치 종료 (finished/cancelled)
// ============================================================

export async function finishMatch(client: SupabaseClient, matchId: string) {
  return client.from(TABLE).update({ status: "finished" }).eq("id", matchId);
}

export async function cancelMatch(client: SupabaseClient, matchId: string) {
  return client.from(TABLE).update({ status: "cancelled" }).eq("id", matchId);
}

// ============================================================
// Realtime — 특정 match row의 UPDATE 구독
// ============================================================

export function subscribeToMatch(
  client: SupabaseClient,
  matchId: string,
  onUpdate: (row: BpMatchRow) => void
): () => void {
  const channel = client
    .channel(`bp_match:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: TABLE,
        filter: `id=eq.${matchId}`
      },
      (payload) => {
        const next = payload.new as BpMatchRow;
        onUpdate(next);
      }
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
