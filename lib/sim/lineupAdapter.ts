// 라인업 빌더의 저장 데이터(SavedLineup, SavedPitcherLineup) +
// Statiz 시드(SimBatter/SimPitcher) → 시뮬 엔진 입력(SimTeamInput) 변환.
//
// 투수 슬롯 룰:
//   slot[0] = 선발(SP), slot[1] = 마무리(CL), slot[2..8] = 일반 불펜(RP)

import { PITCHER_CLOSER_INDEX, PITCHER_STARTER_INDEX } from "@/lib/types/lineup";
import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";
import type { SimBatter, SimPitcher, SimTeamInput } from "./types";

export type StatsDirectory = {
  batters: Map<string, SimBatter>;   // playerId → stats
  pitchers: Map<string, SimPitcher>;
};

export type AdapterIssue =
  | { kind: "missing_batter"; playerId: string; order: number }
  | { kind: "missing_pitcher"; playerId: string; slot: number }
  | { kind: "incomplete_batting_lineup"; filledSlots: number }
  | { kind: "no_starter" };

export type AdapterResult =
  | { ok: true; team: SimTeamInput; issues: AdapterIssue[] }
  | { ok: false; issues: AdapterIssue[] };

export function buildSimTeamInput(
  teamId: string,
  batting: SavedLineup,
  pitching: SavedPitcherLineup,
  stats: StatsDirectory,
  displayName?: string
): AdapterResult {
  const issues: AdapterIssue[] = [];

  // 1. 타순 9명 — 누락 시 issue 기록, 그래도 가능하면 진행
  const orderedBatters: SimBatter[] = [];
  const slotsByOrder = [...batting.slots].sort((a, b) => a.order - b.order);
  for (const slot of slotsByOrder) {
    const stat = stats.batters.get(slot.playerId);
    if (!stat) {
      issues.push({ kind: "missing_batter", playerId: slot.playerId, order: slot.order });
      continue;
    }
    // 사용자 지정 포지션을 SimBatter에 함께 담아 표시용 데이터 유지
    orderedBatters.push({ ...stat, position: slot.position });
  }
  if (orderedBatters.length !== 9) {
    issues.push({ kind: "incomplete_batting_lineup", filledSlots: orderedBatters.length });
    return { ok: false, issues };
  }

  // 2. 투수 — 선발 + 마무리 + 불펜
  const starterId = pitching.slots[PITCHER_STARTER_INDEX];
  if (!starterId) {
    issues.push({ kind: "no_starter" });
    return { ok: false, issues };
  }
  const starterStat = stats.pitchers.get(starterId);
  if (!starterStat) {
    issues.push({ kind: "missing_pitcher", playerId: starterId, slot: PITCHER_STARTER_INDEX });
    return { ok: false, issues };
  }
  // 선발은 stamina 최소 90 보장 — 가짜 데이터에서 RP로 시드된 진짜 선발급 투수가
  // slot[0]에 들어왔을 때 1~2이닝에 강제 교체되는 문제 방지.
  const starter: SimPitcher = {
    ...starterStat,
    role: "SP",
    staminaPitches: Math.max(starterStat.staminaPitches, 90)
  };

  // 3. 마무리 1명 + 불펜 7명. null/누락은 건너뜀.
  const bullpen: SimPitcher[] = [];
  for (let slot = PITCHER_CLOSER_INDEX; slot < pitching.slots.length; slot++) {
    const pid = pitching.slots[slot];
    if (!pid) continue;
    const stat = stats.pitchers.get(pid);
    if (!stat) {
      issues.push({ kind: "missing_pitcher", playerId: pid, slot });
      continue;
    }
    bullpen.push({
      ...stat,
      role: slot === PITCHER_CLOSER_INDEX ? "CL" : "RP"
    });
  }

  return {
    ok: true,
    issues,
    team: {
      teamId,
      displayName,
      batters: orderedBatters,
      starter,
      bullpen
    }
  };
}
