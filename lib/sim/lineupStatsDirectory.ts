import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomRoster, getEditableRoster, getNationalRoster, getRoster } from "@/lib/rosters";
import type { LineupEntry, SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";
import type { LineupType } from "@/lib/types/lineup";
import type { StatsDirectory } from "./lineupAdapter";
import { buildStatsDirectory } from "./statsLoader";
import {
  buildStatsDirectoryWithRecentForm,
  enhanceStatsDirectoryByPlayerIds
} from "./statsLoaderWithRecent";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function teamIdFromPlayerId(playerId: string): string | null {
  const idx = playerId.indexOf("-");
  if (idx <= 0) return null;
  return playerId.slice(0, idx);
}

export function getLineupPlayerIds(
  batting: SavedLineup,
  pitching?: SavedPitcherLineup | null
): string[] {
  return unique([
    ...batting.slots.map((slot) => slot.playerId),
    ...(pitching?.slots ?? []).filter((id): id is string => Boolean(id))
  ]);
}

export function getSourceTeamIdsForPlayerIds(playerIds: string[]): string[] {
  return unique(playerIds.map(teamIdFromPlayerId).filter((id): id is string => Boolean(id)));
}

export function getEntryValidPlayerIds(entry: LineupEntry): Set<string> {
  return new Set(getEditableRoster(entry, entry.teamId).map((player) => player.id));
}

export function getLineupValidPlayerIds(teamId: string, batting: SavedLineup): Set<string> {
  const lineupType: LineupType = batting.lineupType ?? "kbo";
  if (lineupType === "national") return new Set(getNationalRoster().map((player) => player.id));
  if (lineupType === "custom") return new Set(getCustomRoster(batting.rosterSourceId).map((player) => player.id));
  return new Set(getRoster(teamId).map((player) => player.id));
}

export async function buildStatsDirectoryWithRecentFormForEntries(
  client: SupabaseClient,
  entries: LineupEntry[],
  extraTeamIds: string[] = []
): Promise<StatsDirectory> {
  const playerIds = unique(
    entries.flatMap((entry) => [
      ...getLineupPlayerIds(entry.batting, entry.pitching),
      ...getEditableRoster(entry, entry.teamId).map((player) => player.id)
    ])
  );
  const teamIds = unique([...getSourceTeamIdsForPlayerIds(playerIds), ...extraTeamIds]);
  const directory = await buildStatsDirectoryWithRecentForm(client, teamIds);
  return enhanceStatsDirectoryByPlayerIds(client, directory, playerIds);
}

export async function buildStatsDirectoryWithRecentFormForLineups(
  client: SupabaseClient,
  lineups: Array<{
    teamId: string;
    batting: SavedLineup;
    pitching?: SavedPitcherLineup | null;
  }>,
  extraTeamIds: string[] = []
): Promise<StatsDirectory> {
  const playerIds = unique(
    lineups.flatMap((lineup) => [
      ...getLineupPlayerIds(lineup.batting, lineup.pitching),
      ...Array.from(getLineupValidPlayerIds(lineup.teamId, lineup.batting))
    ])
  );
  const teamIds = unique([...getSourceTeamIdsForPlayerIds(playerIds), ...extraTeamIds]);
  const directory = await buildStatsDirectoryWithRecentForm(client, teamIds);
  return enhanceStatsDirectoryByPlayerIds(client, directory, playerIds);
}

export function buildStatsDirectoryForLineups(
  lineups: Array<{
    teamId: string;
    batting: SavedLineup;
    pitching?: SavedPitcherLineup | null;
  }>,
  extraTeamIds: string[] = []
): StatsDirectory {
  const playerIds = unique(
    lineups.flatMap((lineup) => [
      ...getLineupPlayerIds(lineup.batting, lineup.pitching),
      ...Array.from(getLineupValidPlayerIds(lineup.teamId, lineup.batting))
    ])
  );
  const teamIds = unique([...getSourceTeamIdsForPlayerIds(playerIds), ...extraTeamIds]);
  return buildStatsDirectory(teamIds);
}
