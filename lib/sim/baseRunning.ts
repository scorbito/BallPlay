// 타석 결과를 베이스 상태에 적용. docs/sim-engine-spec.md §5 참조.

import { BASE_RUNNING_PROB } from "./constants";
import { coinFlip } from "./rng";
import type { AtBatOutcome, BaseState, Rng } from "./types";

export const EMPTY_BASE: BaseState = { first: null, second: null, third: null };

export type ApplyOutcomeResult = {
  baseAfter: BaseState;
  runsScored: number;
  outsAdded: number;
  rbi: number;       // 타자에게 귀속될 타점 (실책 득점 제외 v1엔 runs == rbi)
};

// outcome에 따라 베이스 상태 전이. 새 상태와 득점·아웃 증감을 반환.
// outsBefore — 이 타석 직전 아웃 수. 2아웃 땅볼처럼 3아웃이 force/batter-runner로 성립하면
// 룰상 그 이닝의 어떤 주자도 득점할 수 없음. 호출 측에서 outs를 넘겨준다.
export function applyOutcome(
  outcome: AtBatOutcome,
  base: BaseState,
  batterId: string,
  rng: Rng,
  outsBefore: 0 | 1 | 2 = 0
): ApplyOutcomeResult {
  switch (outcome) {
    case "HR":
      return applyHomeRun(base, batterId);
    case "3B":
      return applyTriple(base, batterId);
    case "2B":
      return applyDouble(base, batterId, rng);
    case "1B":
      return applySingle(base, batterId, rng);
    case "BB":
    case "HBP":
      return applyWalk(base, batterId);
    case "SF":
      return applySacFly(base);
    case "DP":
      return applyDoublePlay(base);
    case "K":
    case "FO":
    case "PO":
    case "LO":
      return { baseAfter: base, runsScored: 0, outsAdded: 1, rbi: 0 };
    case "GO":
      return applyGroundOut(base, outsBefore);
    case "E":
      // v1엔 사용 X. 안전망: 단타로 처리.
      return applySingle(base, batterId, rng);
    default:
      return { baseAfter: base, runsScored: 0, outsAdded: 1, rbi: 0 };
  }
}

function applyHomeRun(base: BaseState, batterId: string): ApplyOutcomeResult {
  const runners = countRunners(base);
  return {
    baseAfter: { ...EMPTY_BASE },
    runsScored: runners + 1,
    outsAdded: 0,
    rbi: runners + 1
  };
}

function applyTriple(base: BaseState, batterId: string): ApplyOutcomeResult {
  const runners = countRunners(base);
  return {
    baseAfter: { first: null, second: null, third: batterId },
    runsScored: runners,
    outsAdded: 0,
    rbi: runners
  };
}

function applyDouble(base: BaseState, batterId: string, rng: Rng): ApplyOutcomeResult {
  let runs = 0;
  const after: BaseState = { first: null, second: batterId, third: null };
  if (base.third) runs += 1;
  if (base.second) runs += 1;
  if (base.first) {
    if (coinFlip(BASE_RUNNING_PROB.DOUBLE_SCORE_FROM_1ST, rng)) runs += 1;
    else after.third = base.first;
  }
  return { baseAfter: after, runsScored: runs, outsAdded: 0, rbi: runs };
}

function applySingle(base: BaseState, batterId: string, rng: Rng): ApplyOutcomeResult {
  let runs = 0;
  const after: BaseState = { first: batterId, second: null, third: null };
  if (base.third) runs += 1;
  if (base.second) {
    if (coinFlip(BASE_RUNNING_PROB.SINGLE_SCORE_FROM_2ND, rng)) runs += 1;
    else after.third = base.second;
  }
  if (base.first) {
    after.second = base.first;
  }
  return { baseAfter: after, runsScored: runs, outsAdded: 0, rbi: runs };
}

function applyWalk(base: BaseState, batterId: string): ApplyOutcomeResult {
  // 밀어내기 처리 — 1루부터 순서대로 점유
  const after: BaseState = { first: batterId, second: base.first, third: base.second };
  const runs = base.first && base.second && base.third ? 1 : 0;
  return { baseAfter: after, runsScored: runs, outsAdded: 0, rbi: runs };
}

function applySacFly(base: BaseState): ApplyOutcomeResult {
  // 3루 주자 득점 + 타자 아웃. 다른 주자 유지.
  if (!base.third) {
    // 조건 미충족 시 일반 외야플라이 처리 (안전망 — 호출 측에서 canBeSacFly 체크해야 함)
    return { baseAfter: base, runsScored: 0, outsAdded: 1, rbi: 0 };
  }
  return {
    baseAfter: { ...base, third: null },
    runsScored: 1,
    outsAdded: 1,
    rbi: 1
  };
}

function applyDoublePlay(base: BaseState): ApplyOutcomeResult {
  // 타자 + 1루 주자 둘 다 아웃. 2·3루 주자는 유지.
  return {
    baseAfter: { first: null, second: base.second, third: base.third },
    runsScored: 0,
    outsAdded: 2,
    rbi: 0
  };
}

function applyGroundOut(base: BaseState, outsBefore: 0 | 1 | 2): ApplyOutcomeResult {
  // 1루 주자 있으면 강제진루(단순화: 100% 진루 성공, 타자 아웃)
  if (base.first) {
    // 2아웃 + 1루 주자: 2루 포스아웃이 3아웃 — 룰상 어떤 주자도 득점 불가
    const runs = !base.third || outsBefore >= 2 ? 0 : 1;
    return {
      baseAfter: { first: null, second: base.first, third: base.second },
      runsScored: runs,
      outsAdded: 1,
      rbi: runs
    };
  }
  // 1루 주자 없음 — 타자 1루 송구 아웃. 단순화: 3루 주자 홀딩(시도 안 함).
  return { baseAfter: base, runsScored: 0, outsAdded: 1, rbi: 0 };
}

function countRunners(base: BaseState): number {
  return (base.first ? 1 : 0) + (base.second ? 1 : 0) + (base.third ? 1 : 0);
}
