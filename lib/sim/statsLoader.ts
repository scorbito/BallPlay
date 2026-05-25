// Statiz 시드 JSON에서 선수 스탯을 읽어 시뮬 엔진 어댑터가 쓰는 StatsDirectory로 변환.
// v1: data/kbo_players_2026.json을 직접 import (~400KB).
// v1.1+: 팀별 분할 + 동적 로드로 번들 크기 줄이기.
//
// 시즌 출장 0인 선수(부상/신인)는 stats 시드에 없음. 그래도 라인업에 들어갈 수 있으므로
// 로스터를 참고해서 리그 평균값으로 자동 보강. [[project-season-stats-archive]] 참고.

import statsData from "@/data/kbo_players_2026.json";
import { getRoster } from "@/lib/rosters";
import { makeFallbackBatter, makeFallbackPitcher } from "./leagueAverage";
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

// 시즌 기록 없는 선수 ID 모음 — 라인업 빌더 UI에서 "기록 없음" 배지 표시에 사용.
const FALLBACK_PLAYER_IDS = new Set<string>();

/** 특정 선수가 fallback(시즌 기록 없음 → 평균값 적용) 처리됐는지 확인. */
export function isFallbackPlayer(playerId: string): boolean {
  return FALLBACK_PLAYER_IDS.has(playerId);
}

// 시드 데이터에 ID가 존재하는 선수 set — 1군+2군 통합 시드 기준이라
// 1군 출장 0이라도 2군 기록 있으면 여기 포함됨. 라인업 빌더 "기록없음" 배지 정확도 향상.
const SEEDED_PLAYER_IDS: Set<string> = (() => {
  const set = new Set<string>();
  for (const team of Object.values(FILE.teams)) {
    for (const b of team.batters) set.add(b.playerId);
    for (const p of team.pitchers) set.add(p.playerId);
  }
  return set;
})();

/** 시드 데이터에 해당 선수의 스탯 기록이 있는지 (1군+2군 통합 기준). */
export function hasStatsForPlayer(playerId: string): boolean {
  return SEEDED_PLAYER_IDS.has(playerId);
}

/** 팀 ID 기준으로 stats 시드에 없는 로스터 선수를 평균값으로 보강하고 fallback 셋에 등록.
 *  2군 기록은 1군과 경기 수준이 달라 그대로 쓰면 부정확하므로,
 *  1군 출장(seasonGames)이 0인 선수는 stats 시드에 있더라도 평균값으로 덮어씀.
 *  추후 scraper에서 1군/2군 분리 저장하면 1군 데이터만 쓰는 방식으로 전환 예정. */
function ensureFallbacksForTeam(
  teamId: string,
  batters: Map<string, SimBatter>,
  pitchers: Map<string, SimPitcher>
): void {
  const roster = getRoster(teamId);
  for (const player of roster) {
    const noFirstTeamPlay = (player.seasonGames ?? 0) === 0;
    if (player.primaryPosition === "P") {
      // stats에 있고 1군 출장도 있으면 자기 기록 유지
      if (pitchers.has(player.id) && !noFirstTeamPlay) continue;
      pitchers.set(
        player.id,
        makeFallbackPitcher(player.id, player.name, player.throwingHand ?? "R")
      );
      FALLBACK_PLAYER_IDS.add(player.id);
    } else {
      if (batters.has(player.id) && !noFirstTeamPlay) continue;
      batters.set(
        player.id,
        makeFallbackBatter(player.id, player.name, player.battingHand ?? "R")
      );
      FALLBACK_PLAYER_IDS.add(player.id);
    }
  }
}

// 한 팀의 스탯을 StatsDirectory(Map 기반) 형태로 변환. 어댑터가 직접 lookup 가능.
// 로스터에는 있지만 stats에 없는 선수는 평균값 fallback으로 자동 보강.
export function buildStatsDirectory(teamIds: string[]): StatsDirectory {
  const batters = new Map<string, SimBatter>();
  const pitchers = new Map<string, SimPitcher>();
  for (const teamId of teamIds) {
    const t = getTeamStats(teamId);
    for (const b of t.batters) batters.set(b.playerId, b);
    for (const p of t.pitchers) pitchers.set(p.playerId, p);
    ensureFallbacksForTeam(teamId, batters, pitchers);
  }
  return { batters, pitchers };
}
