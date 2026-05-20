import type { Player, Position } from "@/lib/types/lineup";
import doosanData from "@/data/rosters/doosan.json";

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
  }>;
};

const ROSTERS: Record<string, RosterFile> = {
  doosan: doosanData as RosterFile
};

function normalize(raw: RosterFile): Player[] {
  return raw.players.map((p) => ({
    id: p.id,
    name: p.name,
    teamId: raw.teamId,
    jerseyNumber: p.jerseyNumber,
    primaryPosition: p.primaryPosition as Position,
    battingHand: (p.battingHand as Player["battingHand"]) ?? undefined,
    throwingHand: (p.throwingHand as Player["throwingHand"]) ?? undefined
  }));
}

/** 해당 팀의 선수 명단 반환. 시드가 없는 팀이면 빈 배열. */
export function getRoster(teamId: string): Player[] {
  const file = ROSTERS[teamId];
  if (!file) return [];
  return normalize(file);
}

/** 시드가 있는 팀 ID 집합. UI에서 "준비 중" 표시에 사용. */
export function getSeededTeamIds(): Set<string> {
  return new Set(Object.keys(ROSTERS));
}
