// Statiz 시드 JSON에서 선수 스탯을 읽어 시뮬 엔진 어댑터가 쓰는 StatsDirectory로 변환.
// v1: data/kbo_players_2026.json을 직접 import (~400KB).
// v1.1+: 팀별 분할 + 동적 로드로 번들 크기 줄이기.

import statsData from "@/data/kbo_players_2026.json";
import type { SimBatter, SimPitcher } from "./types";
import type { StatsDirectory } from "./lineupAdapter";

type StatsFile = {
  snapshotDate: string;
  source: string;
  teams: Record<string, {
    batters: SimBatter[];
    pitchers: SimPitcher[];
  }>;
};

const FILE = statsData as unknown as StatsFile;

export function getStatsSnapshotDate(): string {
  return FILE.snapshotDate;
}

export function getTeamStats(teamId: string): { batters: SimBatter[]; pitchers: SimPitcher[] } {
  const team = FILE.teams[teamId];
  if (!team) return { batters: [], pitchers: [] };
  return team;
}

// 한 팀의 스탯을 StatsDirectory(Map 기반) 형태로 변환. 어댑터가 직접 lookup 가능.
export function buildStatsDirectory(teamIds: string[]): StatsDirectory {
  const batters = new Map<string, SimBatter>();
  const pitchers = new Map<string, SimPitcher>();
  for (const teamId of teamIds) {
    const t = getTeamStats(teamId);
    for (const b of t.batters) batters.set(b.playerId, b);
    for (const p of t.pitchers) pitchers.set(p.playerId, p);
  }
  return { batters, pitchers };
}
