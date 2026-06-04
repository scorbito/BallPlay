// 한 타석 결과 추첨. docs/sim-engine-spec.md §4 참조.

import { KBO_ANCHOR, LEAGUE_AVG, BASE_RUNNING_PROB } from "./constants";
import { NEUTRAL_PARK, type ParkFactor } from "./parkFactors";
import { pickWeighted, coinFlip } from "./rng";
import type { AtBatOutcome, BaseState, Rng, SimBatter, SimPitcher } from "./types";

// 리그 평균 platoon 효과 (split 데이터 없는 경우 폴백).
// 같은 손 매치업이면 타자 불리, 다른 손이면 타자 유리. KBO 평균 OPS gap ~5%.
const LEAGUE_PLATOON_SAME_HAND = 0.95;
const LEAGUE_PLATOON_OPPOSITE_HAND = 1.05;

// 타자 factor 계산. anchor를 곱연산으로 조정.
function batterFactor(batter: SimBatter, outcome: AtBatOutcome): number {
  switch (outcome) {
    case "K":
      // contactScore가 높을수록 삼진 감소
      return Math.max(0.3, (1 - batter.kRate) / (1 - LEAGUE_AVG.K_RATE));
    case "BB":
      return safeRatio(batter.bbRate, LEAGUE_AVG.BB_RATE);
    case "HR":
      return safeRatio(batter.iso, LEAGUE_AVG.ISO);
    case "1B":
    case "2B":
    case "3B":
      return safeRatio(batter.babip, LEAGUE_AVG.BABIP);
    case "HBP":
      return 1.0; // v1엔 리그 평균 그대로
    default:
      return 1.0; // 아웃 계열은 잔여 분포로 정규화에서 흡수
  }
}

function pitcherFactor(pitcher: SimPitcher, outcome: AtBatOutcome): number {
  switch (outcome) {
    case "K":
      return safeRatio(pitcher.k9, LEAGUE_AVG.K9);
    case "BB":
      return safeRatio(pitcher.bb9, LEAGUE_AVG.BB9);
    case "HR":
      return safeRatio(pitcher.hr9, LEAGUE_AVG.HR9);
    case "1B":
    case "2B":
    case "3B": {
      // WHIP에서 BB 기여분을 빼면 피안타율 근사. 리그 평균 ~0.96/이닝.
      const hitsPerInning = Math.max(0, pitcher.whip - pitcher.bb9 / 9);
      return safeRatio(hitsPerInning, 0.96);
    }
    default:
      return 1.0;
  }
}

function safeRatio(value: number, baseline: number): number {
  if (!isFinite(value) || baseline <= 0) return 1.0;
  // 극단값 클램프 — 분포 안정성을 위해 ±60% 이내로 제한.
  // 너무 넓으면 출루 인플레이션이 누적돼 점수가 폭발(20+점)함.
  const ratio = value / baseline;
  return Math.min(1.6, Math.max(0.6, ratio));
}

/**
 * Platoon multiplier — 좌/우 매치업 효과.
 *
 * 1) 타자에 split OPS (vsLhpOps / vsRhpOps) 가 있으면: 실제 split / 시즌 OPS 비율을
 *    클램프(0.75~1.3) 해 정확한 platoon 가산을 산출.
 * 2) split 데이터가 없으면: 리그 평균 platoon 폴백 (같은 손 0.95, 다른 손 1.05).
 * 3) 스위치 타자(S) 는 항상 1.0 (양손 동등).
 *
 * 반환값은 "타자에게 좋은 결과(BB/안타/HR)" 에 곱하는 multiplier. K 같이 타자에게
 * 나쁜 결과에는 1/multiplier 로 적용한다.
 */
function batterPlatoonMultiplier(batter: SimBatter, pitcher: SimPitcher): number {
  if (batter.battingHand === "S") return 1.0;

  // 1) 실제 split 데이터 우선
  const relevantSplitOps =
    pitcher.throwingHand === "L" ? batter.vsLhpOps : batter.vsRhpOps;
  const seasonOps = batter.obp + batter.slg;
  if (relevantSplitOps && seasonOps > 0 && isFinite(relevantSplitOps)) {
    const ratio = relevantSplitOps / seasonOps;
    return Math.min(1.3, Math.max(0.75, ratio));
  }

  // 2) split 없으면 리그 평균 폴백
  const sameHand =
    (batter.battingHand === "L" && pitcher.throwingHand === "L") ||
    (batter.battingHand === "R" && pitcher.throwingHand === "R");
  return sameHand ? LEAGUE_PLATOON_SAME_HAND : LEAGUE_PLATOON_OPPOSITE_HAND;
}

/** 구장 효과 — HR / 안타 outcome 에만 곱셈 적용. 그 외는 1.0. */
function parkFactor(park: ParkFactor, outcome: AtBatOutcome): number {
  if (outcome === "HR") return park.hr;
  if (outcome === "1B" || outcome === "2B" || outcome === "3B") return park.hits;
  return 1.0;
}

/** 결과 종류별 platoon 적용 방향. 타자 우호적 outcome 은 곱, K 는 역수, 그 외는 1.0. */
function platoonFactorForOutcome(multiplier: number, outcome: AtBatOutcome): number {
  switch (outcome) {
    case "BB":
    case "HBP":
    case "1B":
    case "2B":
    case "3B":
    case "HR":
      return multiplier;
    case "K":
      return multiplier === 0 ? 1.0 : 1 / multiplier;
    default:
      return 1.0;
  }
}

export function drawAtBatOutcome(
  batter: SimBatter,
  pitcher: SimPitcher,
  rng: Rng,
  park: ParkFactor = NEUTRAL_PARK
): AtBatOutcome {
  const platoon = batterPlatoonMultiplier(batter, pitcher);
  const weights: Record<AtBatOutcome, number> = { ...KBO_ANCHOR };
  for (const key of Object.keys(weights) as AtBatOutcome[]) {
    weights[key] =
      KBO_ANCHOR[key] *
      batterFactor(batter, key) *
      pitcherFactor(pitcher, key) *
      platoonFactorForOutcome(platoon, key) *
      parkFactor(park, key);
  }
  return pickWeighted(weights, rng);
}

// 땅볼아웃 후 DP 승급 여부. baseState에 1루 주자 있고 outs < 2일 때만.
export function shouldPromoteToDoublePlay(
  base: BaseState,
  outs: 0 | 1 | 2,
  rng: Rng
): boolean {
  if (outs >= 2) return false;
  if (!base.first) return false;
  return coinFlip(BASE_RUNNING_PROB.GROUNDOUT_TO_DP, rng);
}

// 희생플라이 가능 조건 — 3루 주자 있고 외야 플라이.
export function canBeSacFly(base: BaseState, outs: 0 | 1 | 2): boolean {
  if (outs >= 2) return false;
  return base.third !== null;
}
