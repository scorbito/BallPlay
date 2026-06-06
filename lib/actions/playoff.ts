"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teams } from "@/lib/constants/teams";
import {
  insertPlayoffRun,
  getActivePlayoffRun,
  getPlayoffRunById,
  updatePlayoffRun,
  PLAYOFF_TOTAL_ROUNDS,
  type PlayoffRun,
  type PlayoffRunState,
  type PlayoffOpponent,
  type PlayoffGame,
  type PlayoffStatus
} from "@/lib/supabase/query-parts/bpPlayoff";

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

async function authed() {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return { client, userId: user?.id ?? null };
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
  const opponents: PlayoffOpponent[] = pool.slice(0, PLAYOFF_TOTAL_ROUNDS).map((t, idx) => ({
    round: idx + 1,
    teamId: t.teamId,
    teamName: t.teamName,
    lineupSeed: randomSeed()
  }));

  const state: PlayoffRunState = { myEntryId: input.entryId, opponents, games: [] };
  return insertPlayoffRun(client, {
    userId,
    teamId: input.teamId,
    teamName: input.teamName,
    state
  });
}

/** 경기 결과 기록 — 승: 다음 라운드(4R승=우승) / 패: 탈락. */
export async function recordPlayoffGame(input: {
  runId: string;
  round: number;
  win: boolean;
  scoreMe: number;
  scoreOpp: number;
  playSeed: number;
  oppTeamId: string;
}): Promise<{ ok: true; run: PlayoffRun } | { ok: false; error: string }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const run = await getPlayoffRunById(client, input.runId, userId);
  if (!run) return { ok: false, error: "도전을 찾을 수 없어요." };
  if (run.status !== "active") return { ok: false, error: "이미 종료된 도전이에요." };
  // 중복 기록 방지 — 같은 라운드 결과가 이미 있으면 현재 run 반환
  if (run.state.games.some((g) => g.round === input.round)) {
    return { ok: true, run };
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

  let status: PlayoffStatus = run.status;
  let currentRound = run.currentRound;
  let completedAt: string | null = null;
  if (!input.win) {
    status = "eliminated";
    completedAt = new Date().toISOString();
  } else if (input.round >= PLAYOFF_TOTAL_ROUNDS) {
    status = "champion";
    completedAt = new Date().toISOString();
  } else {
    currentRound = input.round + 1;
  }

  return updatePlayoffRun(client, input.runId, userId, {
    state: nextState,
    current_round: currentRound,
    status,
    completed_at: completedAt
  });
}

/** 도전 포기. */
export async function abandonPlayoffRun(runId: string): Promise<{ ok: boolean }> {
  const { client, userId } = await authed();
  if (!userId) return { ok: false };
  await updatePlayoffRun(client, runId, userId, {
    status: "abandoned",
    completed_at: new Date().toISOString()
  });
  return { ok: true };
}
