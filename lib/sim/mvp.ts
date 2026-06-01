// MVP 선정. docs/sim-engine-spec.md §9 참조.

import type { BatterBoxLine, MvpResult, PitcherBoxLine, SimGameInput } from "./types";

type Candidate = {
  playerId: string;
  name: string;
  score: number;
  reason: string;
};

export function selectMvp(
  input: SimGameInput,
  winnerSide: "home" | "away",
  batting: Record<string, BatterBoxLine>,
  pitching: Record<string, PitcherBoxLine>
): MvpResult {
  const winningTeam = winnerSide === "home" ? input.home : input.away;
  const candidates: Candidate[] = [];

  for (const batter of winningTeam.batters) {
    const line = batting[batter.playerId];
    if (!line) continue;
    const score = line.rbi * 2 + line.runs + line.homers * 3 + line.hits;
    if (score <= 0) continue;
    candidates.push({
      playerId: batter.playerId,
      name: batter.name,
      score,
      reason: buildBatterReason(line)
    });
  }

  const allPitchers = [winningTeam.starter, ...winningTeam.bullpen];
  for (const pitcher of allPitchers) {
    const line = pitching[pitcher.playerId];
    if (!line) continue;
    const innings = line.ipOuts / 3;
    const score = innings * 2 + line.strikeouts - line.earnedRuns * 2;
    if (score <= 0) continue;
    candidates.push({
      playerId: pitcher.playerId,
      name: pitcher.name,
      score,
      reason: buildPitcherReason(line)
    });
  }

  if (candidates.length === 0) {
    // 안전망: 1번 타자
    const fallback = winningTeam.batters[0];
    return { playerId: fallback.playerId, reason: "팀 승리" };
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return { playerId: top.playerId, reason: top.reason };
}

function buildBatterReason(line: BatterBoxLine): string {
  const bits: string[] = [];
  if (line.homers > 0) bits.push(`${line.homers}홈런`);
  if (line.hits > 0) bits.push(`${line.hits}안타`);
  if (line.rbi > 0) bits.push(`${line.rbi}타점`);
  return bits.length > 0 ? bits.join(" ") : "안타 활약";
}

function buildPitcherReason(line: PitcherBoxLine): string {
  // ipOuts(아웃수)를 이닝으로 변환. 부분 이닝(0.3/1.3 등)은 올림 처리 — 1아웃이라도 잡았으면 1이닝으로 표기.
  const innings = Math.ceil(line.ipOuts / 3);
  const bits = [`${innings}이닝`, `${line.strikeouts}K`];
  if (line.earnedRuns === 0) bits.push("무실점");
  return bits.join(" ");
}
