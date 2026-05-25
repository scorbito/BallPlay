// KBO 리그 평균 스탯 — 시즌 기록이 없는 선수(부상 장기 결장, 신인 데뷔 전, 시즌 개막 직후 등)에
// 적용되는 fallback. 정확도는 떨어지지만 시뮬은 동작.
//
// 추후 [[project-season-stats-archive]] 방침대로 작년 시즌 final 데이터가 생기면
// fallback chain: 올해 데이터 → 작년 데이터 → 리그 평균 순.

import type { PitcherRole, SimBatter, SimPitcher } from "./types";

// 평균 타율 0.250 기준으로 비례 조정한 휴리스틱 평균값.
// 사용자 결정 (2026-05-25): 정확한 1군 평균보단 타율 0.25에 맞춘 일관된 고정값 사용.
const LEAGUE_AVG_BATTER = {
  pa: 300,
  ab: 270,
  hits: 68,        // AB 270 × 0.250
  doubles: 12,
  triples: 1,
  homers: 6,
  walks: 26,
  hbp: 3,
  strikeouts: 58,
  avg: 0.25,
  obp: 0.325,      // AVG + BB rate ≈ 0.087
  slg: 0.37,       // AVG + ISO
  iso: 0.12,
  babip: 0.29,
  bbRate: 0.087,
  kRate: 0.193,
  contactScore: 0.807
} as const;

// 투수 평균도 타자 AVG 0.250에 대응되도록 비례 조정 (피안타·자책점·WHIP↓).
// K/9, BB/9, HR/9는 타율과 독립이라 그대로 유지.
const LEAGUE_AVG_PITCHER = {
  ip: 50,
  k: 42,
  bb: 19,
  hr: 5,
  hitsAllowed: 44, // IP 50 기준 피안타율 0.250 가정
  earnedRuns: 23,
  saves: 0,
  era: 4.2,        // 23 × 9 / 50 ≈ 4.14
  whip: 1.26,      // (44 + 19) / 50
  k9: 7.56,
  bb9: 3.42,
  hr9: 0.9,
  staminaPitches: 70
} as const;

export function makeFallbackBatter(
  playerId: string,
  name: string,
  battingHand: SimBatter["battingHand"]
): SimBatter {
  return {
    playerId,
    name,
    battingHand,
    ...LEAGUE_AVG_BATTER
  };
}

export function makeFallbackPitcher(
  playerId: string,
  name: string,
  throwingHand: SimPitcher["throwingHand"],
  role: PitcherRole = "RP"
): SimPitcher {
  return {
    playerId,
    name,
    throwingHand,
    role,
    ...LEAGUE_AVG_PITCHER
  };
}
