// 라인업 빌더의 저장 데이터(SavedLineup, SavedPitcherLineup) +
// Statiz 시드(SimBatter/SimPitcher) → 시뮬 엔진 입력(SimTeamInput) 변환.
//
// 마무리 식별 룰 (docs/sim-engine-spec.md §12.3):
//   1) 불펜 8명 중 saves 최댓값 보유 → role: "CL"
//   2) 세이브 0이거나 동률이면 slot[8] 컨벤션으로 폴백
//   3) 둘 다 불가능하면 마무리 없음 (일반 불펜 풀로 동작)

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

  // 2. 투수 — 선발 + 불펜
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

  // 3. 불펜 8명 (1..8 슬롯). null/누락은 건너뜀.
  const bullpenRaw: { stat: SimPitcher; slot: number }[] = [];
  for (let slot = 1; slot < pitching.slots.length; slot++) {
    const pid = pitching.slots[slot];
    if (!pid) continue;
    const stat = stats.pitchers.get(pid);
    if (!stat) {
      issues.push({ kind: "missing_pitcher", playerId: pid, slot });
      continue;
    }
    bullpenRaw.push({ stat, slot });
  }

  // 4. 마무리 식별 — saves 최댓값. 동률 시 slot[8] 우선, 그래도 동률이면 slot 번호 작은 쪽.
  const closerIdx = pickCloserIndex(bullpenRaw);

  const bullpen: SimPitcher[] = bullpenRaw.map((entry, idx) => ({
    ...entry.stat,
    role: idx === closerIdx ? "CL" : "RP"
  }));

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

function pickCloserIndex(bullpen: { stat: SimPitcher; slot: number }[]): number {
  if (bullpen.length === 0) return -1;
  const maxSaves = Math.max(...bullpen.map((b) => b.stat.saves ?? 0));
  if (maxSaves <= 0) {
    // 세이브 없음 — slot[8] 컨벤션 폴백
    const idx = bullpen.findIndex((b) => b.slot === PITCHER_CLOSER_INDEX);
    return idx >= 0 ? idx : bullpen.length - 1;
  }
  // 세이브 최댓값 후보들 중 slot[8]에 가장 가까운(컨벤션 우선) 쪽
  const candidates = bullpen
    .map((b, idx) => ({ idx, slot: b.slot, saves: b.stat.saves ?? 0 }))
    .filter((c) => c.saves === maxSaves);
  candidates.sort((a, b) => {
    // slot[8]에 정확히 위치한 후보 최우선, 그 외엔 slot 번호 작은 순
    if (a.slot === PITCHER_CLOSER_INDEX) return -1;
    if (b.slot === PITCHER_CLOSER_INDEX) return 1;
    return a.slot - b.slot;
  });
  return candidates[0].idx;
}
