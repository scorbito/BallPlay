// AI 상대 라인업 생성.
//   - 최근 라인업(bp_team_recent_lineups)이 있으면 그걸 기준으로 실제 팀에 가깝게 구성.
//   - 없으면 시즌 스탯 OPS 상위 9명으로 합리적 베스트 라인업 구성.
//
// 라인업이 결정적(최근 라인업 또는 시즌 스탯)이라 같은 teamId → 같은 결과.

import { getRoster } from "@/lib/rosters";
import { normalizeKboPosition } from "@/lib/types/lineup";
import { getTeamStats } from "./statsLoader";
import type { SimBatter, SimPitcher, SimTeamInput } from "./types";

/** bp_team_recent_lineups에서 받아 넘기는 최소 정보. 외부 의존 줄이려 작게 정의. */
export type RecentLineupHint = {
  batting: Array<{ order: number; rosterId: string | null; name: string; position: string | null }>;
  starter_roster_id: string | null;
  starter_name: string | null;
};

type FakeOpponentOptions = {
  elite?: boolean;
};

function batterOps(b: SimBatter): number {
  return (b.obp ?? 0) + (b.slg ?? 0);
}

function batterEliteScore(b: SimBatter, recentIds: Set<string>, topPaIds: Set<string>): number {
  const pa = b.pa ?? 0;
  const sampleBonus = Math.min(pa, 350) / 350;
  const recentBonus = recentIds.has(b.playerId) ? 0.08 : 0;
  const regularBonus = topPaIds.has(b.playerId) ? 0.06 : 0;
  return batterOps(b) + (b.obp ?? 0) * 0.18 + sampleBonus * 0.08 + recentBonus + regularBonus;
}

function isReliableBatter(b: SimBatter, recentIds: Set<string>, topPaIds: Set<string>): boolean {
  return (b.pa ?? 0) >= 80 || topPaIds.has(b.playerId) || recentIds.has(b.playerId);
}

function optimizeEliteBattingOrder(batters: SimBatter[], recentIds: Set<string>, topPaIds: Set<string>): SimBatter[] {
  const pool = [...batters];
  const takeBest = (score: (b: SimBatter) => number, count: number): SimBatter[] => {
    const picked = pool
      .sort((a, b) => score(b) - score(a))
      .slice(0, count);
    for (const p of picked) {
      const idx = pool.findIndex((b) => b.playerId === p.playerId);
      if (idx >= 0) pool.splice(idx, 1);
    }
    return picked;
  };

  const tableSetters = takeBest((b) => (b.obp ?? 0) * 1.4 + (b.contactScore ?? 0) * 0.003, 2);
  const core = takeBest((b) => batterEliteScore(b, recentIds, topPaIds) + (b.slg ?? 0) * 0.25, 3);
  const lower = takeBest((b) => batterEliteScore(b, recentIds, topPaIds), 4);
  return [...tableSetters, ...core, ...lower].slice(0, 9);
}

function buildEliteBatters(
  statsBatters: SimBatter[],
  recentResolved: SimBatter[],
  recentIds: Set<string>
): SimBatter[] {
  const topPaIds = new Set(
    [...statsBatters]
      .sort((a, b) => (b.pa ?? 0) - (a.pa ?? 0))
      .slice(0, 15)
      .map((b) => b.playerId)
  );
  const eligible = statsBatters
    .filter((b) => isReliableBatter(b, recentIds, topPaIds))
    .sort((a, b) => batterEliteScore(b, recentIds, topPaIds) - batterEliteScore(a, recentIds, topPaIds));

  const used = new Set<string>();
  const selected: SimBatter[] = [];
  for (const b of recentResolved) {
    if (selected.length >= 9) break;
    if (used.has(b.playerId)) continue;
    if (!isReliableBatter(b, recentIds, topPaIds)) continue;
    selected.push(b);
    used.add(b.playerId);
  }
  for (const b of eligible) {
    if (selected.length >= 9) break;
    if (used.has(b.playerId)) continue;
    selected.push(b);
    used.add(b.playerId);
  }

  const fallback = selected.length >= 9
    ? selected
    : [...selected, ...statsBatters.filter((b) => !used.has(b.playerId)).sort((a, b) => batterOps(b) - batterOps(a))]
      .slice(0, 9);
  return optimizeEliteBattingOrder(fallback, recentIds, topPaIds);
}

function pitcherScore(p: SimPitcher): number {
  const era = p.era || 9.99;
  const whip = p.whip || 2.5;
  const ipBonus = Math.min(p.ip ?? 0, 80) / 80;
  return 10 - era * 0.75 - whip * 1.2 + (p.k9 ?? 0) * 0.08 - (p.bb9 ?? 0) * 0.08 + ipBonus;
}

export function buildFakeOpponentTeam(
  teamId: string,
  seed: number,
  recentLineup?: RecentLineupHint | null,
  options: FakeOpponentOptions = {}
): SimTeamInput | null {
  const roster = getRoster(teamId);
  if (roster.length === 0) return null;
  const stats = getTeamStats(teamId);
  if (stats.batters.length < 9 || stats.pitchers.length < 1) return null;

  const batterById = new Map(stats.batters.map((b) => [b.playerId, b]));
  const pitcherById = new Map(stats.pitchers.map((p) => [p.playerId, p]));

  // ── 타순 구성 ────────────────────────────────────────────
  let batters: SimBatter[];
  let recentResolvedBatters: SimBatter[] = [];
  const recentIds = new Set<string>();
  if (recentLineup && recentLineup.batting.length === 9) {
    // 최근 라인업의 9명을 stats에서 찾아 매핑. roster_id 매칭 실패한 자리는 시즌 stats 상위로 채움.
    const used = new Set<string>();
    const resolved: (SimBatter | null)[] = recentLineup.batting
      .sort((a, b) => a.order - b.order)
      .map((b) => {
        if (b.rosterId && batterById.has(b.rosterId)) {
          used.add(b.rosterId);
          recentIds.add(b.rosterId);
          const stat = batterById.get(b.rosterId)!;
          // 최근 라인업에서 가져온 실제 포지션을 표시용으로 부여(없으면 stats 기본값 유지).
          const pos = normalizeKboPosition(b.position);
          return pos ? { ...stat, position: pos } : stat;
        }
        return null;
      });
    // 빈자리는 시즌 stats에서 안 쓴 타자 중 OPS 높은 순으로 보강
    const fillPool = stats.batters
      .filter((b) => !used.has(b.playerId))
      .sort((a, b) => (b.obp + b.slg) - (a.obp + a.slg));
    let fillIdx = 0;
    batters = resolved.map((b) => {
      if (b) return b;
      return fillPool[fillIdx++] ?? stats.batters[0];
    });
    recentResolvedBatters = batters;
  } else {
    // 폴백 — 최근 라인업 없으면 OPS(출루율+장타율) 상위 9명.
    // (랜덤 9명은 벤치 선수까지 섞여 "이상한 라인업"으로 보였던 문제 해결)
    batters = [...stats.batters]
      .sort((a, b) => (b.obp + b.slg) - (a.obp + a.slg))
      .slice(0, 9);
  }
  if (options.elite) {
    batters = buildEliteBatters(stats.batters, recentResolvedBatters, recentIds);
  }

  // ── 선발투수 ────────────────────────────────────────────
  let starter: SimPitcher | null = null;
  if (recentLineup?.starter_roster_id) {
    starter = pitcherById.get(recentLineup.starter_roster_id) ?? null;
  }
  if (!starter) {
    // 폴백 — staminaPitches 큰 SP 우선
    const starterCandidates = [...stats.pitchers].filter((p) => p.staminaPitches >= 80);
    starter = (starterCandidates[0] ?? stats.pitchers[0]) as SimPitcher;
  }
  if (options.elite) {
    const eliteStarterCandidates = [...stats.pitchers]
      .filter((p) => p.staminaPitches >= 80 && (p.ip ?? 0) >= 20)
      .sort((a, b) => pitcherScore(b) - pitcherScore(a));
    starter = eliteStarterCandidates[0] ?? starter;
  }

  // ── 불펜 — 선발 제외, ERA 낮은 순(낮을수록 좋음). saves 많으면 마무리(CL) 표기. ──
  const bullpenPool = stats.pitchers
    .filter((p) => p.playerId !== starter!.playerId)
    .slice() // 원본 보호
    .sort((a, b) => {
      // ERA 낮은 순. ERA가 같거나 매우 작은 표본이면 WHIP로 tiebreak.
      const ea = a.era || 99;
      const eb = b.era || 99;
      if (ea !== eb) return ea - eb;
      return (a.whip || 99) - (b.whip || 99);
    });
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
