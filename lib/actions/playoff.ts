"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { teams } from "@/lib/constants/teams";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { getLatestBattingLineupForTeam } from "@/lib/supabase/query-parts/bpRecentLineups";
import type { RecentLineupHint } from "@/lib/sim/fakeOpponent";
import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";
import {
  insertPlayoffRun,
  getActivePlayoffRun,
  getPlayoffRunById,
  updatePlayoffRun,
  PLAYOFF_TOTAL_ROUNDS,
  PLAYOFF_FINAL_WINS_NEEDED,
  PLAYOFF_ROUND_LABEL,
  type PlayoffRun,
  type PlayoffRunState,
  type PlayoffOpponent,
  type PlayoffGame,
  type PlayoffStatus
} from "@/lib/supabase/query-parts/bpPlayoff";
import { POINT_REWARDS } from "@/lib/points/config";
import { awardPoints, kstDateString } from "@/lib/server/points";

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** 우승 시점 닉네임 조회 — 명예의 전당 박제용. 실패 시 "익명". */
async function fetchNickname(userId: string): Promise<string> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("profiles").select("nickname").eq("id", userId).maybeSingle();
    const nick = (data as { nickname: string | null } | null)?.nickname?.trim();
    return nick || "익명";
  } catch {
    return "익명";
  }
}

/** 우승 확정 시 명예의 전당(bp_playoff_champions) 행 추가.
 *  myLineup 이 없으면 batting/pitching 은 null 로 두되 행은 남긴다.
 *  실패해도 우승 처리 자체는 진행해야 하므로 에러는 무시한다. */
async function recordChampion(
  run: PlayoffRun,
  userId: string,
  completedAt: string
): Promise<{ awarded: boolean; amount: number; balance: number } | null> {
  try {
    const client = createSupabaseServerClient();
    const nickname = await fetchNickname(userId);
    await client.from("bp_playoff_champions").insert({
      user_id: userId,
      nickname,
      team_id: run.teamId,
      team_name: run.teamName,
      batting: run.state.myLineup?.batting ?? null,
      pitching: run.state.myLineup?.pitching ?? null,
      run_id: run.id,
      completed_at: completedAt
    });
    const rewardDate = kstDateString(new Date(completedAt));
    const pointAward = await awardPoints({
      userId,
      amount: POINT_REWARDS.playoffChampion,
      reason: "playoff_champion",
      referenceType: "playoff_run",
      referenceId: run.id,
      rewardKey: "playoff_champion",
      rewardDate,
      metadata: { teamId: run.teamId, teamName: run.teamName }
    });
    return {
      awarded: pointAward.awarded,
      amount: pointAward.awarded ? pointAward.amount : 0,
      balance: pointAward.balance
    };
  } catch (e) {
    console.warn("[playoff] recordChampion 실패(무시):", (e as Error).message);
    return null;
  }
}

async function authed() {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return { client, userId: user?.id ?? null };
}

/** 가을야구 경기 1건을 공식 누적 전적(bp_records)에도 기록 — 경기장 경기는 모두 공식 인정.
 *  source='public' 이면 z_bp_account_stats 트리거가 final_score+owner 로 자동 +1 한다.
 *  상대가 AI(상대 라인업 id 없음)라 mirror 트리거는 안전하게 skip.
 *  멱등: unique(owner_user_id, source, seed) 인덱스가 같은 playSeed 재기록을 23505 로 거부.
 *  best-effort — 실패해도 가을야구 결과 자체(state)는 유지해야 하므로 에러는 무시한다. */
async function recordPlayoffGameAsOfficial(params: {
  userId: string;
  myTeamId: string;
  myTeamName: string;
  oppTeamId: string;
  oppTeamName: string;
  round: number;
  scoreMe: number;
  scoreOpp: number;
  playSeed: number;
}): Promise<void> {
  try {
    // RLS 우회(트리거가 SECURITY DEFINER 라 admin 불필요하지만, 본인 row 라 server client 로 충분).
    const client = createSupabaseServerClient();
    const { error } = await client.from("bp_records").insert({
      owner_user_id: params.userId,
      source: "public",
      user_side: "home",
      engine_version: SIM_ENGINE_VERSION,
      seed: params.playSeed,
      // 재생 데이터는 가을야구 자체 시스템(playSeed)에 있으므로 bp_records 엔 비워둔다.
      input: null,
      result: null,
      home_team_id: params.myTeamId,
      away_team_id: params.oppTeamId,
      home_label: params.myTeamName,
      away_label: params.oppTeamName,
      final_score: { home: params.scoreMe, away: params.scoreOpp },
      is_walkoff: false,
      total_innings: 9,
      name: `가을야구 ${PLAYOFF_ROUND_LABEL[params.round] ?? ""}`.trim()
    });
    // 23505 = 이미 기록됨(멱등) → 정상. 그 외 에러도 누적은 best-effort 라 무시.
    if (error && error.code !== "23505") {
      console.warn("[playoff] bp_records 누적 실패(무시):", error.message);
    }
  } catch (e) {
    console.warn("[playoff] bp_records 누적 예외(무시):", (e as Error).message);
  }
}

/** 도전 시작 — 내 구단 제외 4팀 랜덤 배정. 기존 진행 중 도전은 종료. */
export async function startPlayoffRun(input: {
  entryId: string;
  teamId: string;
  teamName: string;
}): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  // 진행 중 도전이 있으면 종료(새 도전 시작)
  const existing = await getActivePlayoffRun(client, userId);
  if (existing) {
    await updatePlayoffRun(client, existing.id, userId, {
      status: "abandoned",
      completed_at: new Date().toISOString()
    });
  }

  // 내 구단 제외 4팀 랜덤 (Fisher-Yates 부분 셔플)
  const pool = teams.map((t) => ({ teamId: t.id, teamName: t.name })).filter((t) => t.teamId !== input.teamId);
  if (pool.length < PLAYOFF_TOTAL_ROUNDS) return { ok: false, error: "상대 팀이 부족해요." };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // 각 상대 팀의 DB 최신 실제 라인업을 가져와 박제(없으면 시즌 스탯 폴백).
  const opponents: PlayoffOpponent[] = await Promise.all(
    pool.slice(0, PLAYOFF_TOTAL_ROUNDS).map(async (t, idx) => {
      const res = await getLatestBattingLineupForTeam(client, t.teamId);
      const row = res.ok ? res.row : null;
      const lineupHint: RecentLineupHint | null = row
        ? {
            batting: row.batting,
            starter_roster_id: row.starter_roster_id,
            starter_name: row.starter_name
          }
        : null;
      return {
        round: idx + 1,
        teamId: t.teamId,
        teamName: t.teamName,
        lineupSeed: randomSeed(),
        lineupHint
      };
    })
  );

  const state: PlayoffRunState = { myEntryId: input.entryId, opponents, games: [] };
  return insertPlayoffRun(client, {
    userId,
    teamId: input.teamId,
    teamName: input.teamName,
    state
  });
}

/** 경기 결과 기록 — 승: 다음 라운드(4R승=우승) / 패: 탈락. */
export async function beginPlayoffGame(input: {
  runId: string;
  round: number;
  oppTeamId: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup;
  myDisplayName?: string;
  oppLineupHint?: RecentLineupHint | null;
}): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const run = await getPlayoffRunById(client, input.runId, userId);
  if (!run) return { ok: false, error: "가을야구 도전을 찾을 수 없어요." };
  if (run.status !== "active") return { ok: false, error: "이미 종료된 도전이에요." };
  if (run.state.pendingGame) return { ok: true, run };
  // 단판 라운드(1~3)는 라운드당 1경기 — 이미 있으면 막음. 한국시리즈(시리즈)는 여러 경기 허용.
  if (input.round < PLAYOFF_TOTAL_ROUNDS && run.state.games.some((g) => g.round === input.round)) {
    return { ok: true, run };
  }
  if (input.round !== run.currentRound) return { ok: false, error: "현재 라운드와 맞지 않아요." };

  const opp = run.state.opponents.find((o) => o.round === input.round);
  if (!opp || opp.teamId !== input.oppTeamId) {
    return { ok: false, error: "상대 팀 정보가 맞지 않아요." };
  }

  const nextState: PlayoffRunState = {
    ...run.state,
    myLineup: { batting: input.batting, pitching: input.pitching },
    pendingGame: {
      round: input.round,
      oppTeamId: input.oppTeamId,
      playSeed: randomSeed(),
      startedAt: new Date().toISOString(),
      myDisplayName: input.myDisplayName?.trim() || run.teamName,
      oppLineupHint: input.oppLineupHint ?? null
    }
  };
  const updated = await updatePlayoffRun(client, input.runId, userId, { state: nextState });
  revalidatePath("/stadium/playoff");
  return updated;
}

export async function recordPlayoffGame(input: {
  runId: string;
  round: number;
  win: boolean;
  scoreMe: number;
  scoreOpp: number;
  playSeed: number;
  oppTeamId: string;
}): Promise<{
  ok: true;
  run: PlayoffRun;
  pointAward?: { awarded: boolean; amount: number; balance: number } | null;
} | { ok: false; error: string }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const run = await getPlayoffRunById(client, input.runId, userId);
  if (!run) return { ok: false, error: "도전을 찾을 수 없어요." };
  if (run.status !== "active") return { ok: false, error: "이미 종료된 도전이에요." };
  // 중복 기록 방지 — 같은 경기(라운드+seed)가 이미 있으면 현재 run 반환.
  // (한국시리즈 시리즈는 라운드당 여러 경기라 round만으로는 막으면 안 됨 → seed까지 본다.)
  if (run.state.games.some((g) => g.round === input.round && g.playSeed === input.playSeed)) {
    return { ok: true, run };
  }
  const pending = run.state.pendingGame;
  if (pending) {
    if (
      pending.round !== input.round ||
      pending.oppTeamId !== input.oppTeamId ||
      pending.playSeed !== input.playSeed
    ) {
      return { ok: false, error: "진행 중인 경기 정보와 결과가 맞지 않아요." };
    }
  }

  const game: PlayoffGame = {
    round: input.round,
    oppTeamId: input.oppTeamId,
    playSeed: input.playSeed,
    score: { me: input.scoreMe, opp: input.scoreOpp },
    win: input.win,
    playedAt: new Date().toISOString()
  };
  const nextState: PlayoffRunState = { ...run.state, games: [...run.state.games, game] };
  delete nextState.pendingGame;

  let status: PlayoffStatus = run.status;
  let currentRound = run.currentRound;
  let completedAt: string | null = null;
  const now = new Date().toISOString();
  if (input.round >= PLAYOFF_TOTAL_ROUNDS) {
    // 한국시리즈 3전 2선승 — 방금 추가한 경기 포함해 시리즈 집계.
    const finalGames = nextState.games.filter((g) => g.round === PLAYOFF_TOTAL_ROUNDS);
    const wins = finalGames.filter((g) => g.win).length;
    const losses = finalGames.filter((g) => !g.win).length;
    if (wins >= PLAYOFF_FINAL_WINS_NEEDED) {
      status = "champion";
      completedAt = now;
    } else if (losses >= PLAYOFF_FINAL_WINS_NEEDED) {
      status = "eliminated";
      completedAt = now;
    }
    // 그 외(1-0/0-1/1-1) → 시리즈 진행 중: currentRound(4)·active 유지.
  } else if (!input.win) {
    status = "eliminated";
    completedAt = now;
  } else {
    currentRound = input.round + 1;
  }

  const updated = await updatePlayoffRun(client, input.runId, userId, {
    state: nextState,
    current_round: currentRound,
    status,
    completed_at: completedAt
  });

  // 경기장 경기는 모두 공식 인정 — 이 가을야구 경기도 공식 누적 전적에 기록.
  if (updated.ok) {
    const opp = run.state.opponents.find((o) => o.round === input.round);
    await recordPlayoffGameAsOfficial({
      userId,
      myTeamId: run.teamId,
      myTeamName: run.teamName,
      oppTeamId: input.oppTeamId,
      oppTeamName: opp?.teamName ?? input.oppTeamId,
      round: input.round,
      scoreMe: input.scoreMe,
      scoreOpp: input.scoreOpp,
      playSeed: input.playSeed
    });
  }

  // 우승 확정이면 명예의 전당에 박제. INSERT 실패해도 우승 처리는 유지(에러 무시).
  let pointAward: { awarded: boolean; amount: number; balance: number } | null = null;
  if (updated.ok && status === "champion" && completedAt) {
    pointAward = await recordChampion(updated.run, userId, completedAt);
  }

  // 허브 캐시 무효화 — 결과 후 대진표 진입 시 갱신된 run(라운드/탈락/우승) 반영.
  revalidatePath("/stadium/playoff");
  return updated.ok ? { ...updated, pointAward } : updated;
}

/** 플레이오프 전용 임시 라인업 저장 — 실제 팀 무영향. */
export async function updatePlayoffLineup(input: {
  runId: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup;
}): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };
  const run = await getPlayoffRunById(client, input.runId, userId);
  if (!run) return { ok: false, error: "도전을 찾을 수 없어요." };
  if (run.status !== "active") return { ok: false, error: "이미 종료된 도전이에요." };
  if (run.state.pendingGame) {
    return { ok: false, error: "\uC9C4\uD589 \uC911\uC778 \uACBD\uAE30\uAC00 \uC788\uC5B4 \uB77C\uC778\uC5C5\uC744 \uC218\uC815\uD560 \uC218 \uC5C6\uC5B4\uC694." };
  }
  const nextState: PlayoffRunState = {
    ...run.state,
    myLineup: { batting: input.batting, pitching: input.pitching }
  };
  const updated = await updatePlayoffRun(client, input.runId, userId, { state: nextState });
  // 허브 캐시 무효화 — 편집 저장 후 대진표로 돌아갈 때 갱신된 myLineup 반영
  // (안 하면 stale run 으로 startGame 이 편집을 기본 라인업으로 덮어씀).
  revalidatePath("/stadium/playoff");
  return updated;
}

/** 도전 포기(새 도전 시작 등 내부용). */
export async function abandonPlayoffRun(runId: string): Promise<{ ok: boolean }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false };
  await updatePlayoffRun(client, runId, userId, {
    status: "abandoned",
    completed_at: new Date().toISOString()
  });
  return { ok: true };
}

/** 진행 중 이탈 = 패배(탈락) 처리. 뒤로가기로 나가면 호출. */
export async function forfeitPlayoffRun(runId: string): Promise<{ ok: boolean }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false };
  await updatePlayoffRun(client, runId, userId, {
    status: "eliminated",
    completed_at: new Date().toISOString()
  });
  revalidatePath("/stadium/playoff");
  return { ok: true };
}
