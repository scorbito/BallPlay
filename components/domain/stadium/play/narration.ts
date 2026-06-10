import type { SimGameInput, SimPitcher } from "@/lib/sim/types";
import {
  getSituationText,
  getBatterText,
  getOutcomeText,
  getHomerunText,
  getScoreText
} from "@/lib/sim/narration";
import { OUTCOME_LABEL, type FlatEvent } from "./types";

type Phase = "SITUATION" | "BATTER" | "OUTCOME" | "INNING_END" | "PITCHER_CHANGE" | "GAME_END";
type Mode = "normal" | "fast" | "superfast" | "live";
type Variant = "default" | "inning" | "pitcher" | "walkoff";

export type NarrationResult = { text: string; variant: Variant };

export type BuildNarrationArgs = {
  phase: Phase;
  cursor: number;
  events: FlatEvent[];
  mode: Mode;
  outcomeStep: 0 | 1 | 2;
  input: SimGameInput;
  pitcherById: Map<string, SimPitcher>;
  linescore: { totalInnings: number };
};

// 1줄 상황판 텍스트 + variant 결정
export function buildNarration(args: BuildNarrationArgs): NarrationResult {
  const { phase, cursor, events, mode, outcomeStep, input, pitcherById, linescore } = args;

  // playerId → 이름 lookup (홈인 주자 텍스트용)
  const playerNameById = (playerId: string): string | null => {
    const allBatters = [...input.home.batters, ...input.away.batters];
    return allBatters.find((b) => b.playerId === playerId)?.name ?? null;
  };

  if (cursor === 0) return { text: "플레이볼!", variant: "default" };
  const current = events[cursor - 1];
  if (!current) {
    return { text: "경기 준비 중...", variant: "default" };
  }
  const battingTeamBatters = current.half === "top" ? input.away.batters : input.home.batters;
  const orderIdx = battingTeamBatters.findIndex((b) => b.playerId === current.ab.batterId);
  const orderPrefix = orderIdx >= 0 ? `${orderIdx + 1}번 타자 ` : "";
  const batter = battingTeamBatters.find((b) => b.playerId === current.ab.batterId);
  const batterName = batter?.name ?? "타자";
  const outcomeLabel =
    OUTCOME_LABEL[current.ab.outcome] +
    (current.ab.runsScored > 0 ? ` (+${current.ab.runsScored})` : "");

  // ───────── SITUATION: 풍부한 멘트 풀 (live 모드만) ─────────
  if (phase === "SITUATION") {
    return {
      text: getSituationText({
        cursor,
        inning: current.inning,
        half: current.half,
        outsBefore: current.ab.outsBefore,
        baseStateBefore: current.ab.baseStateBefore,
        scoreBefore: current.scoreSnapshot,
        totalInnings: linescore.totalInnings
      }),
      variant: "default"
    };
  }

  // ───────── BATTER: 타순·이름 (+ live면 스탯) ─────────
  if (phase === "BATTER") {
    return {
      text: getBatterText({
        cursor,
        orderIdx,
        batter: batter ?? null,
        withStats: mode === "live"
      }),
      variant: "default"
    };
  }

  // ───────── OUTCOME: 결과 / live 단계 narration ─────────
  if (phase === "OUTCOME") {
    // live 모드 + 점수 들어옴 → outcomeStep에 따라 단계 narration
    if (mode === "live" && current.ab.runsScored > 0) {
      if (outcomeStep === 0) {
        return {
          text: `${orderPrefix}${batterName} — ${getOutcomeText(current.ab.outcome, cursor)}`,
          variant: "default"
        };
      }
      if (outcomeStep === 1) {
        // 홈인 주자 식별
        const homedRunners: string[] = [];
        const before = current.ab.baseStateBefore;
        const after = current.ab.baseStateAfter;
        const isHR = current.ab.outcome === "HR";
        if (isHR) {
          if (before.third) homedRunners.push(playerNameById(before.third) ?? "3루주자");
          if (before.second) homedRunners.push(playerNameById(before.second) ?? "2루주자");
          if (before.first) homedRunners.push(playerNameById(before.first) ?? "1루주자");
          homedRunners.push(batterName);
        } else {
          if (before.third && before.third !== after.first && before.third !== after.second && before.third !== after.third) {
            homedRunners.push(playerNameById(before.third) ?? "3루주자");
          }
          if (before.second && before.second !== after.first && before.second !== after.second && before.second !== after.third) {
            homedRunners.push(playerNameById(before.second) ?? "2루주자");
          }
          if (before.first && before.first !== after.first && before.first !== after.second && before.first !== after.third) {
            homedRunners.push(playerNameById(before.first) ?? "1루주자");
          }
        }
        const isBasesLoadedHR =
          isHR && !!before.first && !!before.second && !!before.third;
        return {
          text: getHomerunText({
            cursor,
            outcome: current.ab.outcome,
            runners: homedRunners,
            runsScored: current.ab.runsScored,
            isBasesLoadedHR
          }),
          variant: "default"
        };
      }
      if (outcomeStep === 2) {
        const after = {
          home: current.scoreSnapshot.home + (current.half === "bottom" ? current.ab.runsScored : 0),
          away: current.scoreSnapshot.away + (current.half === "top" ? current.ab.runsScored : 0)
        };
        return {
          text: getScoreText({ cursor, scoreBefore: current.scoreSnapshot, scoreAfter: after }),
          variant: "default"
        };
      }
    }
    // 일반/빠른 모드 또는 점수 없는 결과 — 풍부한 결과 멘트 + 점수 정보 + 주자 진루
    const outcomeNarr = getOutcomeText(current.ab.outcome, cursor);
    // 주자 진루 — before/after 비교로 같은 playerId가 어느 베이스로 이동했는지 추적.
    // 홈인은 +N으로 이미 표시되므로 진루(2루/3루)만 모음.
    const before = current.ab.baseStateBefore;
    const after = current.ab.baseStateAfter;
    const movements: string[] = [];
    if (before.first) {
      if (after.second === before.first) movements.push("1루주자 2루로");
      else if (after.third === before.first) movements.push("1루주자 3루까지");
    }
    if (before.second) {
      if (after.third === before.second) movements.push("2루주자 3루로");
    }
    const movementText = movements.length > 0 ? ` · ${movements.join(", ")}` : "";
    const runsText = current.ab.runsScored > 0 ? ` (+${current.ab.runsScored})` : "";
    return {
      text: `${orderPrefix}${batterName} — ${outcomeNarr}${runsText}${movementText}`,
      variant: "default"
    };
  }

  if (phase === "INNING_END") {
    return { text: "쓰리아웃 · 공수교대", variant: "inning" };
  }
  if (phase === "GAME_END") {
    const isWalkOff =
      current.inning >= 9 &&
      current.half === "bottom" &&
      current.ab.outsAfter < 3;
    if (isWalkOff) return { text: "🏆 끝내기!", variant: "walkoff" };
    return { text: "경기 종료", variant: "walkoff" };
  }
  if (phase === "PITCHER_CHANGE") {
    const next = events[cursor];
    const prevName =
      pitcherById.get(current.ab.pitcherId)?.name ?? "투수";
    const nextName = next ? pitcherById.get(next.ab.pitcherId)?.name ?? "투수" : "투수";
    return { text: `투수 교체: ${prevName} → ${nextName}`, variant: "pitcher" };
  }
  return { text: "", variant: "default" };
}
