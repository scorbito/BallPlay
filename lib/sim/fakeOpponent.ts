// 가짜 상대 라인업 생성. v1 스캐폴드 단계에선 다른 사용자가 짠 라인업이
// 아직 없으므로, 해당 팀의 로스터에서 랜덤하게 9타순 + 선발 + 불펜 8명을 뽑는다.
//
// 시드 기반이라 같은 (teamId, seed) → 같은 라인업이 나옴 (재현 가능).

import { getRoster } from "@/lib/rosters";
import { createRng } from "./rng";
import { getTeamStats } from "./statsLoader";
import type { SimBatter, SimPitcher, SimTeamInput } from "./types";

export function buildFakeOpponentTeam(teamId: string, seed: number): SimTeamInput | null {
  const roster = getRoster(teamId);
  if (roster.length === 0) return null;
  const stats = getTeamStats(teamId);
  if (stats.batters.length < 9 || stats.pitchers.length < 1) return null;

  const rng = createRng(seed);

  const batterStats = [...stats.batters];
  const pitcherStats = [...stats.pitchers];
  shuffle(batterStats, rng);
  shuffle(pitcherStats, rng);

  const batters: SimBatter[] = batterStats.slice(0, 9);

  // 선발 선택 — staminaPitches가 100인 선수(SP 표식) 우선, 없으면 첫 투수
  const starterCandidates = pitcherStats.filter((p) => p.staminaPitches >= 80);
  const starter: SimPitcher = (starterCandidates[0] ?? pitcherStats[0]) as SimPitcher;
  const bullpenPool = pitcherStats.filter((p) => p.playerId !== starter.playerId);
  const bullpen: SimPitcher[] = bullpenPool.slice(0, 8);

  return {
    teamId,
    batters,
    starter: {
      ...starter,
      role: "SP",
      staminaPitches: Math.max(starter.staminaPitches, 90)
    },
    bullpen: bullpen.map((p) => ({ ...p, role: p.saves > 20 ? "CL" : "RP" }))
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
