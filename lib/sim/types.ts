// 시뮬레이션 엔진 타입. 상위 스펙: docs/sim-engine-spec.md

// ============================================================
// 타석 결과 (AtBatOutcome)
// ============================================================

export const AT_BAT_OUTCOMES = [
  "K",   // 삼진
  "GO",  // 땅볼아웃
  "FO",  // 외야 플라이아웃
  "PO",  // 내야 플라이아웃
  "LO",  // 직선타 아웃
  "SF",  // 희생플라이
  "DP",  // 병살타
  "BB",  // 볼넷
  "HBP", // 사구
  "1B",  // 1루타
  "2B",  // 2루타
  "3B",  // 3루타
  "HR",  // 홈런
  "E"    // 실책 출루 (v1엔 0)
] as const;

export type AtBatOutcome = (typeof AT_BAT_OUTCOMES)[number];

// ============================================================
// 선수 (Batter / Pitcher)
// ============================================================

export type SimBatter = {
  playerId: string;
  name: string;
  battingHand: "L" | "R" | "S";
  /** 사용자가 라인업에서 지정한 포지션 (표시용). 엔진 시뮬에는 사용되지 않음.
   *  AI 자동 생성팀처럼 포지션 정보 없으면 undefined. */
  position?: string;

  pa: number;
  ab: number;
  hits: number;
  doubles: number;
  triples: number;
  homers: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  sb?: number;
  cs?: number;
  sba?: number;

  avg: number;
  obp: number;
  slg: number;
  iso: number;
  babip: number;
  bbRate: number;
  kRate: number;
  contactScore: number;

  wrcPlus?: number;

  /** 좌투 상대 OPS — 있으면 platoon 매치업 계산에 사용. 없으면 리그 평균 split 폴백. */
  vsLhpOps?: number;
  /** 우투 상대 OPS — 있으면 platoon 매치업 계산에 사용. 없으면 리그 평균 split 폴백. */
  vsRhpOps?: number;
};

export type PitcherRole = "SP" | "RP" | "CL";

export type SimPitcher = {
  playerId: string;
  name: string;
  throwingHand: "L" | "R";
  role: PitcherRole;

  ip: number;
  k: number;
  bb: number;
  hr: number;
  hitsAllowed: number;
  earnedRuns: number;
  saves: number;        // 세이브 수 — 라인업→엔진 변환 시 마무리 식별에 사용
  holds?: number;       // 홀드 (셋업맨 식별, v1.1+)
  wins?: number;
  losses?: number;

  era: number;
  whip: number;
  k9: number;
  bb9: number;
  hr9: number;
  fip?: number;

  staminaPitches: number;
};

// ============================================================
// 입력 (SimGameInput)
// ============================================================

export type SimTeamInput = {
  teamId: string;
  /** 사용자 지정 팀명(라인업 슬롯 이름). 비어있으면 표시 측에서 KBO 공식 팀명으로 폴백.
   *  엔진 로직과는 무관 — 표시용. */
  displayName?: string;
  batters: SimBatter[];      // 타순 1~9 순서, 정확히 9명
  starter: SimPitcher;
  bullpen: SimPitcher[];
};

export type GameContext = {
  parkId?: string;
  weather?: "clear" | "rain" | "wind";
};

export type SimGameInput = {
  home: SimTeamInput;
  away: SimTeamInput;
  context: GameContext;
};

// ============================================================
// 베이스 상태 / 타석 로그
// ============================================================

export type BaseState = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export type AtBatLog = {
  batterId: string;
  pitcherId: string;
  preEvents?: SimPreAtBatEvent[];
  outcome: AtBatOutcome;
  baseStateBefore: BaseState;
  baseStateAfter: BaseState;
  outsBefore: 0 | 1 | 2;
  outsAfter: 0 | 1 | 2 | 3;
  runsScored: number;
  rbi: number;
};

export type SimPreAtBatEvent = {
  kind: "STEAL_2B";
  runnerId: string;
  success: boolean;
  baseStateBefore: BaseState;
  baseStateAfter: BaseState;
  outsBefore: 0 | 1 | 2;
  outsAfter: 0 | 1 | 2 | 3;
};

export type HalfInningLog = {
  runs: number;
  hits: number;
  atBats: AtBatLog[];
};

export type InningLog = {
  inning: number;
  top: HalfInningLog;
  bottom: HalfInningLog | null; // 9회말 미실시(끝내기 조건) 시 null
};

// ============================================================
// 결과 (SimGameResult)
// ============================================================

export type GameEvent = {
  inning: number;
  half: "top" | "bottom";
  kind: "HR" | "GO_AHEAD" | "TIE" | "BASES_LOADED" | "WALK_OFF";
  description: string;       // 한 줄 텍스트 (예: "7회초 김도영의 3점 홈런")
  refAtBat?: AtBatLog;
};

export type BatterBoxLine = {
  pa: number;
  ab: number;
  hits: number;
  homers: number;
  rbi: number;
  runs: number;
  walks: number;
  strikeouts: number;
};

export type PitcherBoxLine = {
  ipOuts: number;      // 1/3 이닝 단위 (3 = 1이닝)
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homers: number;
};

export type MvpResult = {
  playerId: string;
  reason: string;
};

export type SimGameResult = {
  engineVersion: string;
  seed: number;
  finalScore: { home: number; away: number };
  innings: InningLog[];
  events: GameEvent[];
  mvp: MvpResult;
  boxScore: {
    batting: Record<string, BatterBoxLine>;
    pitching: Record<string, PitcherBoxLine>;
  };
};

// ============================================================
// 내부 RNG 인터페이스 (테스트 가능성 위해 추상화)
// ============================================================

export type Rng = () => number; // [0, 1) uniform
