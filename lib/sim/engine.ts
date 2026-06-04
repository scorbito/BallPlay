// 시뮬레이션 엔진 메인 진입점. docs/sim-engine-spec.md 참조.

import { MAX_INNINGS } from "./constants";
import { canBeSacFly, drawAtBatOutcome, shouldPromoteToDoublePlay } from "./atBat";
import { applyOutcome, EMPTY_BASE } from "./baseRunning";
import { selectMvp } from "./mvp";
import { getParkFactor, type ParkFactor } from "./parkFactors";
import { createBullpenState, tickAndMaybeSwap, type BullpenState } from "./pitcherMgmt";
import { createRng } from "./rng";
import { SIM_ENGINE_VERSION } from "./version";
import type {
  AtBatLog,
  AtBatOutcome,
  BaseState,
  BatterBoxLine,
  GameEvent,
  HalfInningLog,
  InningLog,
  PitcherBoxLine,
  Rng,
  SimBatter,
  SimGameInput,
  SimGameResult,
  SimPitcher
} from "./types";

type Side = "home" | "away";

type LiveState = {
  score: { home: number; away: number };
  batterIdxByTeam: { home: number; away: number };
  bullpenBySide: { home: BullpenState; away: BullpenState };
  innings: InningLog[];
  events: GameEvent[];
  batting: Record<string, BatterBoxLine>;
  pitching: Record<string, PitcherBoxLine>;
  park: ParkFactor;
};

export function simulateGame(input: SimGameInput, seed: number): SimGameResult {
  validateInput(input);
  const rng = createRng(seed);
  const state: LiveState = {
    score: { home: 0, away: 0 },
    batterIdxByTeam: { home: 0, away: 0 },
    bullpenBySide: {
      home: createBullpenState(input.home),
      away: createBullpenState(input.away)
    },
    innings: [],
    events: [],
    batting: {},
    pitching: {},
    // 구장 효과 — context.parkId 가 있으면 KBO 구장 factor, 없으면 neutral 1.0.
    // 공개매치는 parkId 미전달 → 평탄. AI매치/1000판 시뮬은 stadium 을 parkId 로 전달.
    park: getParkFactor(input.context?.parkId)
  };

  // 각 선수 박스라인 초기화
  initBoxLines(input, state);

  for (let inning = 1; inning <= MAX_INNINGS; inning++) {
    const isExtra = inning > 9;

    const top = playHalfInning(input, state, rng, inning, "away");
    state.score.away += top.runs;

    let bottom: HalfInningLog | null = null;
    const homeAlreadyAhead = inning === 9 && state.score.home > state.score.away;
    if (!homeAlreadyAhead) {
      bottom = playHalfInning(input, state, rng, inning, "home");
      state.score.home += bottom.runs;
    }

    state.innings.push({ inning, top, bottom });

    if (inning >= 9 && state.score.home !== state.score.away) break;
    if (isExtra && state.score.home !== state.score.away) break;
  }

  const winner: Side = state.score.home >= state.score.away ? "home" : "away";
  // 무승부는 home 측에 MVP를 잠시 배정 (12회까지 동점 케이스)
  const mvp = selectMvp(input, winner, state.batting, state.pitching);

  return {
    engineVersion: SIM_ENGINE_VERSION,
    seed,
    finalScore: { ...state.score },
    innings: state.innings,
    events: state.events,
    mvp,
    boxScore: {
      batting: state.batting,
      pitching: state.pitching
    }
  };
}

function playHalfInning(
  input: SimGameInput,
  state: LiveState,
  rng: Rng,
  inning: number,
  battingSide: Side
): HalfInningLog {
  const battingTeam = battingSide === "home" ? input.home : input.away;
  const defendingSide: Side = battingSide === "home" ? "away" : "home";
  const bullpen = state.bullpenBySide[defendingSide];

  const atBats: AtBatLog[] = [];
  let base: BaseState = { ...EMPTY_BASE };
  let outs: 0 | 1 | 2 = 0;
  let runs = 0;
  let hits = 0;

  while (outs < 3) {
    const batterIdx = state.batterIdxByTeam[battingSide];
    const batter = battingTeam.batters[batterIdx % battingTeam.batters.length];
    state.batterIdxByTeam[battingSide] = (batterIdx + 1) % battingTeam.batters.length;

    const pitcher = bullpen.currentPitcher;
    let outcome = drawAtBatOutcome(batter, pitcher, rng, state.park);

    // SF는 3루 주자 + 아웃<2 조건일 때만 유지, 아니면 외야 플라이로 강등
    if (outcome === "SF" && !canBeSacFly(base, outs)) {
      outcome = "FO";
    }

    // GO + 1루 주자 + outs<2 → DP로 승급 가능
    if (outcome === "GO" && shouldPromoteToDoublePlay(base, outs, rng)) {
      outcome = "DP";
    }

    // DP 조건 미충족이면 GO로 강등 (drawAtBatOutcome이 직접 DP를 뽑은 경우)
    if (outcome === "DP" && (!base.first || outs >= 2)) {
      outcome = "GO";
    }

    const baseStateBefore = base;
    const outsBefore = outs;
    const result = applyOutcome(outcome, base, batter.playerId, rng, outs);
    base = result.baseAfter;
    const newOuts = Math.min(3, outs + result.outsAdded);
    outs = newOuts >= 3 ? 0 : (newOuts as 0 | 1 | 2);
    const actualOutsAfter = newOuts;
    runs += result.runsScored;
    hits += isHit(outcome) ? 1 : 0;

    // 9회말 끝내기 즉시 종료
    const isWalkOff =
      inning >= 9 &&
      battingSide === "home" &&
      state.score.home + runs > state.score.away;

    // 박스 스코어 누적
    accumulateBatter(state.batting, batter, outcome, result.runsScored, result.rbi);
    accumulatePitcher(state.pitching, pitcher, outcome, result.runsScored, result.outsAdded);

    // 투수 스태미나 차감 + 필요 시 교체 (마무리는 9회 리드 시 자동 투입)
    const defenseScore = defendingSide === "home" ? state.score.home : state.score.away;
    const offenseScore = battingSide === "home"
      ? state.score.home + runs
      : state.score.away + runs;
    tickAndMaybeSwap(bullpen, outcome, {
      inning,
      scoreDiff: defenseScore - offenseScore
    });

    const atBat: AtBatLog = {
      batterId: batter.playerId,
      pitcherId: pitcher.playerId,
      outcome,
      baseStateBefore,
      baseStateAfter: result.baseAfter,
      outsBefore,
      outsAfter: actualOutsAfter as 0 | 1 | 2 | 3,
      runsScored: result.runsScored,
      rbi: result.rbi
    };
    atBats.push(atBat);

    captureEvent(state, atBat, inning, battingSide, isWalkOff);

    if (actualOutsAfter >= 3) break;
    if (isWalkOff) break;
  }

  return { runs, hits, atBats };
}

function isHit(outcome: AtBatOutcome): boolean {
  return outcome === "1B" || outcome === "2B" || outcome === "3B" || outcome === "HR";
}

function initBoxLines(input: SimGameInput, state: LiveState): void {
  for (const team of [input.home, input.away]) {
    for (const batter of team.batters) {
      state.batting[batter.playerId] = {
        pa: 0, ab: 0, hits: 0, homers: 0, rbi: 0, runs: 0, walks: 0, strikeouts: 0
      };
    }
    const pitchers: SimPitcher[] = [team.starter, ...team.bullpen];
    for (const pitcher of pitchers) {
      state.pitching[pitcher.playerId] = {
        ipOuts: 0, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0, homers: 0
      };
    }
  }
}

function accumulateBatter(
  batting: Record<string, BatterBoxLine>,
  batter: SimBatter,
  outcome: AtBatOutcome,
  runsScored: number,
  rbi: number
): void {
  const line = batting[batter.playerId];
  if (!line) return;
  line.pa += 1;
  // AB 정의: BB/HBP/SF는 AB에서 제외
  if (outcome !== "BB" && outcome !== "HBP" && outcome !== "SF") line.ab += 1;
  if (isHit(outcome)) line.hits += 1;
  if (outcome === "HR") line.homers += 1;
  if (outcome === "BB" || outcome === "HBP") line.walks += 1;
  if (outcome === "K") line.strikeouts += 1;
  line.rbi += rbi;
  // 본인 득점 — HR의 타자 본인은 1득점
  if (outcome === "HR") line.runs += 1;
  // 다른 출루 후 득점 누적은 v1.1+ (베이스 추적 필요)
}

function accumulatePitcher(
  pitching: Record<string, PitcherBoxLine>,
  pitcher: SimPitcher,
  outcome: AtBatOutcome,
  runsScored: number,
  outsAdded: number
): void {
  const line = pitching[pitcher.playerId];
  if (!line) return;
  line.ipOuts += outsAdded;
  line.runs += runsScored;
  line.earnedRuns += runsScored; // v1엔 실책 없으므로 ER = R
  if (isHit(outcome)) line.hits += 1;
  if (outcome === "HR") line.homers += 1;
  if (outcome === "BB" || outcome === "HBP") line.walks += 1;
  if (outcome === "K") line.strikeouts += 1;
}

function captureEvent(
  state: LiveState,
  atBat: AtBatLog,
  inning: number,
  battingSide: Side,
  isWalkOff: boolean
): void {
  const half = battingSide === "away" ? "top" : "bottom";

  if (atBat.outcome === "HR") {
    state.events.push({
      inning,
      half,
      kind: "HR",
      description: `${inning}회${half === "top" ? "초" : "말"} 홈런 (+${atBat.runsScored})`,
      refAtBat: atBat
    });
  }

  if (isWalkOff) {
    state.events.push({
      inning,
      half: "bottom",
      kind: "WALK_OFF",
      description: `${inning}회말 끝내기`,
      refAtBat: atBat
    });
  }

  // 만루 진입
  const after = atBat.baseStateAfter;
  if (after.first && after.second && after.third) {
    state.events.push({
      inning,
      half,
      kind: "BASES_LOADED",
      description: `${inning}회${half === "top" ? "초" : "말"} 만루`,
      refAtBat: atBat
    });
  }
}

function validateInput(input: SimGameInput): void {
  for (const side of ["home", "away"] as const) {
    const team = input[side];
    if (team.batters.length !== 9) {
      throw new Error(`[sim] ${side} batters must be exactly 9 (got ${team.batters.length})`);
    }
    if (!team.starter) {
      throw new Error(`[sim] ${side} starter is required`);
    }
  }
}
