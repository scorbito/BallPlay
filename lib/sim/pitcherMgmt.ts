// 투수 운용 — 스태미나 추적 + 불펜 교체 + 마무리 투입.
// docs/sim-engine-spec.md §6.2 / §11.오픈이슈 2 참조.

import type { AtBatOutcome, SimPitcher, SimTeamInput } from "./types";

export type PitcherUsage = {
  pitcherId: string;
  pitchesThrown: number;
  battersFaced: number;
};

export type BullpenState = {
  starterUsed: boolean;
  currentPitcher: SimPitcher;
  available: SimPitcher[];   // 아직 등판 안 한 불펜 (순서대로 소진)
  closer: SimPitcher | null; // role==="CL". 9회 리드 시 우선 투입.
  usage: Map<string, PitcherUsage>;
};

const PITCH_COUNT_BY_OUTCOME: Partial<Record<AtBatOutcome, number>> = {
  K: 5,         // 삼진은 풀카운트 가까이 가는 경우 많음
  BB: 5,        // 볼넷도 비슷
  HBP: 2,
  HR: 4,
  "1B": 3,
  "2B": 3,
  "3B": 3,
  GO: 3,
  FO: 3,
  PO: 3,
  LO: 3,
  SF: 3,
  DP: 3,
  E: 3
};

const DEFAULT_PITCHES_PER_AB = 3;

// 교체 임계값. 남은 스태미나가 전체의 이 비율 미만이면 다음 타자 전에 교체.
// 절대값(예: 8) 고정 시 stamina 큰 선발(예: 108)이 한 경기를 다 던져버리는 문제 발생 →
// 비율 기반으로 변경. 0.20 = 80% 소진 시 교체.
// KBO 평균 선발(stamina ~95) → 약 24 PBR (~5~6이닝)에 교체. 마무리(stamina ~20) →
// 약 5 PBR(1이닝)에 교체로 자연스러운 운영.
const SWAP_RATIO = 0.20;

export function createBullpenState(team: SimTeamInput): BullpenState {
  const closer = team.bullpen.find((p) => p.role === "CL") ?? null;
  // 마무리는 일반 교체 풀에서 제외 — 9회 리드 시점에만 투입
  const available = team.bullpen.filter((p) => p.role !== "CL");
  return {
    starterUsed: false,
    currentPitcher: team.starter,
    available,
    closer,
    usage: new Map()
  };
}

// 한 타석 끝난 뒤 호출. 투구수를 차감하고, 필요하면 교체.
export function tickAndMaybeSwap(
  state: BullpenState,
  outcome: AtBatOutcome,
  ctx: { inning: number; scoreDiff: number /* 우리팀 - 상대팀 */ }
): void {
  const current = state.currentPitcher;
  const usage = ensureUsage(state, current);
  const cost = PITCH_COUNT_BY_OUTCOME[outcome] ?? DEFAULT_PITCHES_PER_AB;
  usage.pitchesThrown += cost;
  usage.battersFaced += 1;

  // 9회 + 리드(1~3점) + 마무리 보유 + 아직 등판 안 함 → 마무리 투입
  if (
    ctx.inning >= 9 &&
    ctx.scoreDiff > 0 &&
    ctx.scoreDiff <= 3 &&
    state.closer &&
    !state.usage.get(state.closer.playerId)
  ) {
    state.currentPitcher = state.closer;
    return;
  }

  const remaining = current.staminaPitches - usage.pitchesThrown;
  const swapAt = current.staminaPitches * SWAP_RATIO;
  if (remaining < swapAt && state.available.length > 0) {
    state.currentPitcher = state.available.shift()!;
  }
}

function ensureUsage(state: BullpenState, pitcher: SimPitcher): PitcherUsage {
  let usage = state.usage.get(pitcher.playerId);
  if (!usage) {
    usage = { pitcherId: pitcher.playerId, pitchesThrown: 0, battersFaced: 0 };
    state.usage.set(pitcher.playerId, usage);
  }
  return usage;
}

export function currentPitcher(state: BullpenState): SimPitcher {
  return state.currentPitcher;
}
