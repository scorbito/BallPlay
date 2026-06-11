import type { Player, Position } from "@/lib/types/lineup";
import type { LineupEntry } from "@/lib/types/lineup";
import { getLineupType } from "@/lib/lineup/lineupSource";
import doosanData from "@/data/rosters/doosan.json";
import lgData from "@/data/rosters/lg.json";
import ktData from "@/data/rosters/kt.json";
import samsungData from "@/data/rosters/samsung.json";
import ssgData from "@/data/rosters/ssg.json";
import ncData from "@/data/rosters/nc.json";
import kiaData from "@/data/rosters/kia.json";
import hanwhaData from "@/data/rosters/hanwha.json";
import kiwoomData from "@/data/rosters/kiwoom.json";
import lotteData from "@/data/rosters/lotte.json";
import national2026AsianGamesData from "@/data/rosters/national-2026-asian-games.json";

type RosterFile = {
  teamId: string;
  teamName: string;
  players: Array<{
    id: string;
    name: string;
    jerseyNumber: number;
    primaryPosition: string;
    battingHand?: string;
    throwingHand?: string;
    seasonGames?: number;
  }>;
};

type NationalRosterFile = {
  players: Array<{
    playerId: string;
  }>;
};

const ROSTERS: Record<string, RosterFile> = {
  doosan: doosanData as RosterFile,
  lg: lgData as RosterFile,
  kt: ktData as RosterFile,
  samsung: samsungData as RosterFile,
  ssg: ssgData as RosterFile,
  nc: ncData as RosterFile,
  kia: kiaData as RosterFile,
  hanwha: hanwhaData as RosterFile,
  kiwoom: kiwoomData as RosterFile,
  lotte: lotteData as RosterFile
};

const ALL_TEAM_IDS = Object.keys(ROSTERS);

function normalize(raw: RosterFile): Player[] {
  return raw.players.map((p) => ({
    id: p.id,
    name: p.name,
    teamId: raw.teamId,
    jerseyNumber: p.jerseyNumber,
    primaryPosition: p.primaryPosition as Position,
    battingHand: (p.battingHand as Player["battingHand"]) ?? undefined,
    throwingHand: (p.throwingHand as Player["throwingHand"]) ?? undefined,
    seasonGames: typeof p.seasonGames === "number" ? p.seasonGames : 0
  }));
}

/** 해당 팀의 선수 명단 반환. 시드가 없는 팀이면 빈 배열. */
export function getRoster(teamId: string): Player[] {
  const file = ROSTERS[teamId];
  if (!file) return [];
  return normalize(file);
}

export function getAllRosters(): Player[] {
  return ALL_TEAM_IDS.flatMap((teamId) => getRoster(teamId));
}

export function getNationalRoster(): Player[] {
  const byId = new Map(getAllRosters().map((player) => [player.id, player]));
  return (national2026AsianGamesData as NationalRosterFile).players
    .map((item) => byId.get(item.playerId))
    .filter((player): player is Player => Boolean(player));
}

export function getCustomRoster(_sourceId: string | undefined): Player[] {
  return getAllRosters();
}

export function getEditableRoster(entry: LineupEntry | null, fallbackTeamId: string): Player[] {
  if (!entry) return getRoster(fallbackTeamId);

  const lineupType = getLineupType(entry);
  if (lineupType === "national") return getNationalRoster();
  if (lineupType === "custom") return getCustomRoster(entry.rosterSourceId);

  return getRoster(entry.teamId);
}

/** 시드가 있는 팀 ID 집합. UI에서 "준비 중" 표시에 사용. */
export function getSeededTeamIds(): Set<string> {
  return new Set(ALL_TEAM_IDS);
}
