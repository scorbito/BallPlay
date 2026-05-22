// 시뮬 엔진 상수. 베타 트래픽으로 튜닝 예정.
// 상위 스펙: docs/sim-engine-spec.md §4, §6.3

import type { AtBatOutcome } from "./types";

// KBO 리그 평균 — 타석당 결과 확률 (anchor). 합 = 1.000
export const KBO_ANCHOR: Record<AtBatOutcome, number> = {
  K: 0.220,
  GO: 0.240,
  FO: 0.130,
  PO: 0.050,
  LO: 0.030,
  SF: 0.010,
  DP: 0.020,
  BB: 0.090,
  HBP: 0.010,
  "1B": 0.130,
  "2B": 0.040,
  "3B": 0.003,
  HR: 0.027,
  E: 0.000
};

// KBO 리그 평균 지표
export const LEAGUE_AVG = {
  AVG: 0.270,
  OBP: 0.345,
  SLG: 0.395,
  ISO: 0.125,
  BABIP: 0.310,
  BB_RATE: 0.090,
  K_RATE: 0.220,
  K9: 7.5,
  BB9: 3.5,
  HR9: 1.0,
  HIT_RATE: 0.270
} as const;

// 베이스 전이 확률 (단순화 모델, §5.1)
export const BASE_RUNNING_PROB = {
  // 1루타: 2루 주자가 득점할 확률 (아니면 3루)
  SINGLE_SCORE_FROM_2ND: 0.5,
  // 2루타: 1루 주자가 득점할 확률 (아니면 3루)
  DOUBLE_SCORE_FROM_1ST: 0.4,
  // 땅볼아웃 + 1루 주자 + 아웃<2 → 병살타 승급 확률
  GROUNDOUT_TO_DP: 0.3
} as const;

// 연장 한계. KBO 정규시즌은 12회가 아니라 11회까지 → 동점이면 무승부.
export const MAX_INNINGS = 11;
