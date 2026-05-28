// AI 상대 라인업 생성.
//   - 최근 라인업(bp_team_recent_lineups)이 있으면 그걸 기준으로 실제 팀에 가깝게 구성.
//   - 없으면 기존 폴백(시즌 스탯에서 랜덤 9명).
//
// 시드 기반이라 같은 (teamId, seed) → 같은 결과 (재현 가능). 라인업 데이터 있으면 시드 영향 줄어듦.

import { getRoster } from "@/lib/rosters";
import { createRng } from "./rng";
import { getTeamStats } from "./statsLoader";
import type { SimBatter, SimPitcher, SimTeamInput } from "./types";

/** bp_team_recent_lineups에서 받아 넘기는 최소 정보. 외부 의존 줄이려 작게 정의. */
export type RecentLineupHint = {
  batting: Array<{ order: number; rosterId: string | null; name: string; position: string | null }>;
  starter_roster_id: string | null;
  starter_name: string | null;
};

export function buildFakeOpponentTeam(
  teamId: string,
  seed: number,
  recentLineup?: RecentLineupHint | null
): SimTeamInput | null {
  const roster = getRoster(teamId);
  if (roster.length === 0) return null;
  const stats = getTeamStats(teamId);
  if (stats.batters.length < 9 || stats.pitchers.length < 1) return null;

  const batterById = new Map(stats.batters.map((b) => [b.playerId, b]));
  const pitcherById = new Map(stats.pitchers.map((p) => [p.playerId, p]));

  const rng = createRng(seed);

  // ── 타순 구성 ────────────────────────────────────────────
  let batters: SimBatter[];
  if (recentLineup && recentLineup.batting.length === 9) {
    // 최근 라인업의 9명을 stats에서 찾아 매핑. roster_id 매칭 실패한 자리는 시즌 stats 상위로 채움.
    const used = new Set<string>();
    const resolved: (SimBatter | null)[] = recentLineup.batting
      .sort((a, b) => a.order - b.order)
      .map((b) => {
        if (b.rosterId && batterById.has(b.rosterId)) {
          used.add(b.rosterId);
          return batterById.get(b.rosterId)!;
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
  } else {
    // 폴백 — 시즌 stats에서 랜덤 9명
    const batterStats = [...stats.batters];
    shuffle(batterStats, rng);
    batters = batterStats.slice(0, 9);
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

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
