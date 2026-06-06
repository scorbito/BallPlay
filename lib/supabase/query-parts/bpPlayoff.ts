// 플레이오프(가을야구) 솔로 PvE — bp_playoff_runs CRUD + 마이페이지 집계.
// 공식 전적과 분리: 결과는 이 테이블에만 기록(기획서 §0).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

const TABLE = "bp_playoff_runs";

export const PLAYOFF_TOTAL_ROUNDS = 4;
/** 라운드 번호 → 표시명. 5위로 시작해 4·5위전부터. */
export const PLAYOFF_ROUND_LABEL: Record<number, string> = {
  1: "4·5위전",
  2: "준플레이오프",
  3: "플레이오프",
  4: "한국시리즈"
};

export type PlayoffStatus = "active" | "champion" | "eliminated" | "abandoned";

/** 상대 AI 팀 — run 생성 시 라운드별로 고정(시드로 라인업 박제). */
export type PlayoffOpponent = {
  round: number;        // 1..4
  teamId: string;
  teamName: string;
  lineupSeed: number;   // buildFakeOpponentTeam 결정성 → 상대 라인업 박제
};

/** 끝난 경기 1건. */
export type PlayoffGame = {
  round: number;
  oppTeamId: string;
  playSeed: number;     // simulateGame 재현용
  score: { me: number; opp: number };
  win: boolean;
  playedAt: string;
};

export type PlayoffRunState = {
  myEntryId: string;            // 선택한 팀 슬롯 (라인업은 경기 시작 시 사용)
  opponents: PlayoffOpponent[]; // 4팀, 라운드순
  games: PlayoffGame[];         // 진행된 경기 누적
  // 플레이오프 전용 임시 라인업 — 편집 시에만 채워짐. 실제 팀과 분리.
  // 없으면 경기 시작 시 선택 팀의 현재 라인업을 그대로 사용.
  myLineup?: { batting: SavedLineup; pitching: SavedPitcherLineup };
};

export type PlayoffRun = {
  id: string;
  userId: string;
  teamId: string;
  teamName: string;
  status: PlayoffStatus;
  currentRound: number;
  state: PlayoffRunState;
  createdAt: string;
  completedAt: string | null;
};

type Row = {
  id: string;
  user_id: string;
  team_id: string;
  team_name: string;
  status: PlayoffStatus;
  current_round: number;
  state: PlayoffRunState;
  created_at: string;
  completed_at: string | null;
};

function rowToRun(row: Row): PlayoffRun {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    teamName: row.team_name,
    status: row.status,
    currentRound: row.current_round,
    state: row.state,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

/** 진행 중인 run (있으면 1개). */
export async function getActivePlayoffRun(
  client: SupabaseClient,
  userId: string
): Promise<PlayoffRun | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRun(data as Row);
}

/** 가장 최근 run (포기 제외) — active면 진행, champion/eliminated면 결과 화면용. */
export async function getLatestPlayoffRun(
  client: SupabaseClient,
  userId: string
): Promise<PlayoffRun | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRun(data as Row);
}

export async function getPlayoffRunById(
  client: SupabaseClient,
  id: string,
  userId: string
): Promise<PlayoffRun | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRun(data as Row);
}

export async function insertPlayoffRun(
  client: SupabaseClient,
  params: { userId: string; teamId: string; teamName: string; state: PlayoffRunState }
): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      user_id: params.userId,
      team_id: params.teamId,
      team_name: params.teamName,
      status: "active",
      current_round: 1,
      state: params.state
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "도전 생성 실패" };
  return { ok: true, run: rowToRun(data as Row) };
}

export async function updatePlayoffRun(
  client: SupabaseClient,
  id: string,
  userId: string,
  patch: Partial<{ state: PlayoffRunState; current_round: number; status: PlayoffStatus; completed_at: string | null }>
): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "도전 갱신 실패" };
  return { ok: true, run: rowToRun(data as Row) };
}

// ============================================================
// 마이페이지 집계 — 우승 횟수 / 최고 도달 라운드 / 명예의 전당
// ============================================================

export type PlayoffChampion = {
  runId: string;
  teamId: string;
  teamName: string;
  completedAt: string | null;
};

export type PlayoffSummary = {
  championCount: number;
  bestRound: number;            // 도달한 최고 라운드(우승=5로 표기, 1~4 진행)
  totalRuns: number;
  champions: PlayoffChampion[]; // 명예의 전당 (최신순)
};

export const EMPTY_PLAYOFF_SUMMARY: PlayoffSummary = {
  championCount: 0,
  bestRound: 0,
  totalRuns: 0,
  champions: []
};

export async function getPlayoffSummary(
  client: SupabaseClient,
  userId: string
): Promise<PlayoffSummary> {
  const { data, error } = await client
    .from(TABLE)
    .select("id, team_id, team_name, status, current_round, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false, nullsFirst: false });
  if (error || !data) return EMPTY_PLAYOFF_SUMMARY;

  const rows = data as Array<Pick<Row, "id" | "team_id" | "team_name" | "status" | "current_round" | "completed_at">>;
  const champions = rows.filter((r) => r.status === "champion");
  // 최고 도달: 우승은 5(완주), 그 외엔 도달한 current_round.
  let bestRound = 0;
  for (const r of rows) {
    const reached = r.status === "champion" ? PLAYOFF_TOTAL_ROUNDS + 1 : r.current_round;
    if (reached > bestRound) bestRound = reached;
  }
  return {
    championCount: champions.length,
    bestRound,
    totalRuns: rows.length,
    champions: champions.map((r) => ({
      runId: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      completedAt: r.completed_at
    }))
  };
}
