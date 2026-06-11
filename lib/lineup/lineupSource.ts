import type { LineupEntry, LineupType } from "@/lib/types/lineup";

export const NATIONAL_LINEUP_ENTRY_ID = "special:national-team";
export const NATIONAL_LINEUP_TEAM_ID = "national";
export const NATIONAL_LINEUP_ROSTER_SOURCE_ID = "national";

export function getLineupType(entry: Pick<LineupEntry, "lineupType" | "batting">): LineupType {
  return entry.lineupType ?? entry.batting.lineupType ?? "kbo";
}

export function getRosterSourceId(entry: Pick<LineupEntry, "teamId" | "rosterSourceId" | "batting">): string {
  return entry.rosterSourceId ?? entry.batting.rosterSourceId ?? entry.teamId;
}

export function isMultiTeamLineup(entry: Pick<LineupEntry, "lineupType" | "batting">): boolean {
  const type = getLineupType(entry);
  return type === "national" || type === "custom";
}
