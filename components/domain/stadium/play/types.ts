import type { AtBatLog, AtBatOutcome, BaseState } from "@/lib/sim/types";

export const OUTCOME_LABEL: Record<AtBatOutcome, string> = {
  K: "삼진",
  GO: "땅볼아웃",
  FO: "외야플라이",
  PO: "내야플라이",
  LO: "직선타",
  SF: "희생플라이",
  DP: "병살타",
  BB: "볼넷",
  HBP: "사구",
  "1B": "안타",
  "2B": "2루타",
  "3B": "3루타",
  HR: "홈런!",
  E: "실책 출루"
};

export const EMPTY_BASE: BaseState = { first: null, second: null, third: null };

export type FlatEvent = {
  inning: number;
  half: "top" | "bottom";
  index: number;
  ab: AtBatLog;
  scoreSnapshot: { home: number; away: number };
};
