// 시즌 baseline JSON에 DB의 주간 스냅샷을 얹어 "최근 폼 반영 능력치"를 만드는 헬퍼.
//
// 사용 시나리오:
//   - AI 대결 매치 시작 시: 출전 선수 ~30명만 fetch → 시즌·최근 블렌드 → 시뮬
//   - AI 승리팀 예측 시: 양팀 전체 fetch → 매 시뮬 시 같은 디렉터리 재사용
//
// 흐름:
//   1. 기존 buildStatsDirectory(JSON baseline)으로 출발점 디렉터리 만듦
//   2. DB에서 해당 player_id들의 최신 2개 스냅샷 받음
//   3. 시즌 stat을 "DB latest 스냅샷"으로 갱신 (JSON baseline보다 신선)
//   4. 두 스냅샷 차분으로 주간 델타 계산
//   5. 시즌(0.7) + 최근(0.3) 블렌드 → 디렉터리에 덮어쓰기
//
// DB 호출이 실패하거나 스냅샷이 없으면 baseline JSON 그대로 사용(graceful fallback).

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStatsDirectory } from "./statsLoader";
import {
  blendBatter,
  blendPitcher,
  computeBatterDelta,
  computePitcherDelta
} from "./recentFormLoader";
import {
  getPlayerSnapshotsForIds,
  getPlayerSnapshotsForTeams,
  type PlayerSnapshots
} from "@/lib/supabase/query-parts/bpPlayerStatsSnapshots";
import type { SimBatter, SimPitcher, SimTeamInput } from "./types";
import type { StatsDirectory } from "./lineupAdapter";

type Options = {
  /** 최근 비중. 기본 0.3 = 시즌:최근 = 0.7:0.3. */
  recentWeight?: number;
};

/** 팀 ID 기준 — 그 팀의 모든 선수에 대해 시즌+최근 블렌드 적용. */
export async function buildStatsDirectoryWithRecentForm(
  client: SupabaseClient,
  teamIds: string[],
  opts?: Options
): Promise<StatsDirectory> {
  const baseline = buildStatsDirectory(teamIds);
  const res = await getPlayerSnapshotsForTeams(client, teamIds);
  if (!res.ok) {
    // DB 실패 시 baseline 그대로 (게임은 진행 가능해야 함)
    if (typeof console !== "undefined") {
      console.warn("[statsLoaderWithRecent] snapshot fetch failed, using baseline:", res.error);
    }
    return baseline;
  }
  applyBlend(baseline, res.byPlayer, opts);
  return baseline;
}

/** Player ID 목록 기준 — 매치에 출전하는 ~30명만 fetch.
 *  AI 대결처럼 라인업이 확정된 후 호출. */
export async function enhanceStatsDirectoryByPlayerIds(
  client: SupabaseClient,
  directory: StatsDirectory,
  playerIds: string[],
  opts?: Options
): Promise<StatsDirectory> {
  const res = await getPlayerSnapshotsForIds(client, playerIds);
  if (!res.ok) {
    if (typeof console !== "undefined") {
      console.warn("[statsLoaderWithRecent] snapshot fetch failed, using directory as-is:", res.error);
    }
    return directory;
  }
  applyBlend(directory, res.byPlayer, opts);
  return directory;
}

/** 이미 만들어진 SimTeamInput의 batters/starter/bullpen을 디렉터리의 블렌드된 값으로 swap.
 *  - 디렉터리에 해당 playerId가 있으면 교체, 없으면 원본 유지(부드러운 폴백).
 *  - buildFakeOpponentTeam 같은 기존 함수의 출력에 후처리 적용용. */
export function applyBlendedStatsToTeam(team: SimTeamInput, directory: StatsDirectory): SimTeamInput {
  return {
    ...team,
    batters: team.batters.map((b) => directory.batters.get(b.playerId) ?? b),
    starter: directory.pitchers.get(team.starter.playerId) ?? team.starter,
    bullpen: team.bullpen.map((p) => directory.pitchers.get(p.playerId) ?? p)
  };
}

// ============================================================
// 내부 — DB 스냅샷을 디렉터리에 머지
// ============================================================

function applyBlend(
  directory: StatsDirectory,
  byPlayer: Map<string, PlayerSnapshots>,
  opts?: Options
): void {
  const weight = opts?.recentWeight ?? 0.3;

  byPlayer.forEach((snap) => {
    if (snap.kind === "batter") {
      const season = snap.latest as SimBatter;
      const delta =
        snap.previous != null
          ? computeBatterDelta(snap.latest as SimBatter, snap.previous as SimBatter)
          : null;
      const blended = blendBatter(season, delta, weight);
      directory.batters.set(snap.playerId, blended);
    } else {
      const season = snap.latest as SimPitcher;
      const delta =
        snap.previous != null
          ? computePitcherDelta(snap.latest as SimPitcher, snap.previous as SimPitcher)
          : null;
      const blended = blendPitcher(season, delta, weight);
      directory.pitchers.set(snap.playerId, blended);
    }
  });
}
