// 한 타석 결과 추첨. docs/sim-engine-spec.md §4 참조.

import { KBO_ANCHOR, LEAGUE_AVG, BASE_RUNNING_PROB } from "./constants";
import { pickWeighted, coinFlip } from "./rng";
import type { AtBatOutcome, BaseState, Rng, SimBatter, SimPitcher } from "./types";

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

export function drawAtBatOutcome(
  batter: SimBatter,
  pitcher: SimPitcher,
  rng: Rng
): AtBatOutcome {
  const weights: Record<AtBatOutcome, number> = { ...KBO_ANCHOR };
  for (const key of Object.keys(weights) as AtBatOutcome[]) {
    weights[key] = KBO_ANCHOR[key] * batterFactor(batter, key) * pitcherFactor(pitcher, key);
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
