import { PITCHER_SLOTS_COUNT, type LineupEntry, type Position, type SavedLineup, type SavedPitcherLineup } from "@/lib/types/lineup";
import { SIM_ENGINE_VERSION } from "./version";
import { getStatsSnapshotDate } from "./statsLoader";
import { buildSimTeamInput, type StatsDirectory } from "./lineupAdapter";
import { fillMissingPitcherSlotsFromStatsDirectory } from "./autoPitcherLineup";
import {
  buildStatsDirectoryForLineups,
  getEntryValidPlayerIds,
  getSourceTeamIdsForPlayerIds
} from "./lineupStatsDirectory";
import type { SimGameInput, SimTeamInput } from "./types";

export type SharedBatter = {
  p: string;
  o: number;
  pos: Position;
};

export type SharedTeam = {
  t: string;
  n?: string;
  b: SharedBatter[];
  ps: (string | null)[];
};

export type SharedMatch = {
  v: string;
  s: string;
  seed: number;
  home: SharedTeam;
  away: SharedTeam;
};

export type DecodeResult =
  | { ok: true; input: SimGameInput; seed: number; meta: { v: string; s: string } }
  | { ok: false; reason: string };

export function encodeMatchToToken(input: SimGameInput, seed: number): string {
  const shared: SharedMatch = {
    v: SIM_ENGINE_VERSION,
    s: getStatsSnapshotDate(),
    seed,
    home: encodeTeam(input.home),
    away: encodeTeam(input.away)
  };
  return base64UrlEncode(JSON.stringify(shared));
}

export function encodeTeam(team: SimTeamInput): SharedTeam {
  const batters: SharedBatter[] = team.batters.map((batter, idx) => ({
    p: batter.playerId,
    o: idx + 1,
    pos: (batter.position ?? "DH") as Position
  }));
  const ps: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  ps[0] = team.starter.playerId;
  team.bullpen.forEach((pitcher, idx) => {
    if (idx + 1 < PITCHER_SLOTS_COUNT) ps[idx + 1] = pitcher.playerId;
  });
  return { t: team.teamId, n: team.displayName, b: batters, ps };
}

export function decodeTokenToMatch(token: string): DecodeResult {
  let parsed: SharedMatch;
  try {
    parsed = JSON.parse(base64UrlDecode(token)) as SharedMatch;
  } catch {
    return { ok: false, reason: "잘못된 공유 링크입니다." };
  }
  if (!parsed || typeof parsed !== "object" || !parsed.home || !parsed.away) {
    return { ok: false, reason: "공유 링크가 손상되었습니다." };
  }
  if (parsed.v !== SIM_ENGINE_VERSION) {
    return {
      ok: false,
      reason: `엔진 버전이 다릅니다 (링크 ${parsed.v} / 현재 ${SIM_ENGINE_VERSION}).`
    };
  }
  const currentSnapshot = getStatsSnapshotDate();
  if (parsed.s !== currentSnapshot) {
    return {
      ok: false,
      reason: `선수 데이터 스냅샷이 다릅니다 (링크 ${parsed.s} / 현재 ${currentSnapshot}).`
    };
  }

  const stats = buildStatsDirectoryForLineups([
    sharedToSavedLineups(parsed.home),
    sharedToSavedLineups(parsed.away)
  ]);
  const home = restoreTeam(parsed.home, stats);
  const away = restoreTeam(parsed.away, stats);
  if (!home.ok) return { ok: false, reason: `홈 ${home.reason}` };
  if (!away.ok) return { ok: false, reason: `원정 ${away.reason}` };

  return {
    ok: true,
    seed: parsed.seed,
    meta: { v: parsed.v, s: parsed.s },
    input: { home: home.team, away: away.team, context: {} }
  };
}

function sharedToSavedLineups(shared: SharedTeam): {
  teamId: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup;
} {
  return {
    teamId: shared.t,
    batting: {
      teamId: shared.t,
      slots: shared.b.map((batter) => ({
        order: batter.o as SavedLineup["slots"][number]["order"],
        playerId: batter.p,
        position: batter.pos
      })),
      useDH: true,
      updatedAt: new Date().toISOString()
    },
    pitching: {
      teamId: shared.t,
      slots: shared.ps.slice(0, PITCHER_SLOTS_COUNT),
      updatedAt: new Date().toISOString()
    }
  };
}

function restoreTeam(
  shared: SharedTeam,
  stats: StatsDirectory
): { ok: true; team: SimTeamInput } | { ok: false; reason: string } {
  const lineups = sharedToSavedLineups(shared);
  const adapt = buildSimTeamInput(shared.t, lineups.batting, lineups.pitching, stats, shared.n);
  if (!adapt.ok) {
    const kinds = adapt.issues.map((issue) => issue.kind).join(", ");
    return { ok: false, reason: `라인업 변환 실패 (${kinds})` };
  }
  return { ok: true, team: adapt.team };
}

function base64UrlEncode(value: string): string {
  const utf8 = unescape(encodeURIComponent(value));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const utf8 = atob(padded);
  return decodeURIComponent(escape(utf8));
}

export function buildShareUrl(input: SimGameInput, seed: number): string {
  const token = encodeMatchToToken(input, seed);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/stadium/replay?m=${token}`;
}

export function buildSharedTeamFromEntry(
  entry: LineupEntry
): { ok: true; team: SharedTeam } | { ok: false; error: string } {
  if (entry.batting.slots.length !== 9) {
    return { ok: false, error: "타자 9명이 모두 채워져 있지 않습니다." };
  }

  const stats = buildStatsDirectoryForLineups([
    { teamId: entry.teamId, batting: entry.batting, pitching: entry.pitching }
  ]);
  const pitching = fillMissingPitcherSlotsFromStatsDirectory(
    entry.teamId,
    entry.pitching?.slots ?? [],
    stats,
    getEntryValidPlayerIds(entry)
  );
  if (!pitching) {
    return { ok: false, error: "투수 라인업을 자동 생성하지 못했습니다." };
  }

  const adapt = buildSimTeamInput(entry.teamId, entry.batting, pitching, stats, entry.name);
  if (!adapt.ok) {
    const kinds = adapt.issues.map((issue) => issue.kind).join(", ");
    return { ok: false, error: `라인업 변환 실패 (${kinds})` };
  }
  return { ok: true, team: encodeTeam(adapt.team) };
}

export function restoreSimTeamFromShared(
  shared: SharedTeam
): { ok: true; team: SimTeamInput } | { ok: false; reason: string } {
  const lineups = sharedToSavedLineups(shared);
  const stats = buildStatsDirectoryForLineups(
    [lineups],
    getSourceTeamIdsForPlayerIds([
      ...shared.b.map((batter) => batter.p),
      ...shared.ps.filter((id): id is string => Boolean(id))
    ])
  );
  return restoreTeam(shared, stats);
}
