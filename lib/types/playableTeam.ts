import type { Player, SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

export type PlayableTeamType = "kbo" | "national" | "custom";

export type PlayableTeamBadge = {
  initials: string;
  color: string;
  style: "circle" | "shield";
  logoUrl?: string | null;
};

export type PlayableTeamMeta = {
  type: PlayableTeamType;
  teamId: string;
  name: string;
  shortName: string;
  ownerUserId?: string | null;
  badge: PlayableTeamBadge;
};

export type PlayableTeamLineup = {
  team: PlayableTeamMeta;
  batting: SavedLineup;
  pitching: SavedPitcherLineup | null;
};

export type PlayableTeamRoster = {
  team: PlayableTeamMeta;
  players: Player[];
  scoutPieces: number;
};

export function isCustomTeamId(teamId: string | null | undefined): teamId is `custom:${string}` {
  return typeof teamId === "string" && teamId.startsWith("custom:");
}

export function getPlayableTeamType(teamId: string): PlayableTeamType {
  if (isCustomTeamId(teamId)) return "custom";
  if (teamId === "national") return "national";
  return "kbo";
}

export function buildCustomTeamMeta(input: {
  id: string;
  ownerUserId: string;
  name: string;
  initials: string;
  color: string;
  badgeStyle: "circle" | "shield";
}): PlayableTeamMeta {
  return {
    type: "custom",
    teamId: input.id,
    name: input.name,
    shortName: input.name,
    ownerUserId: input.ownerUserId,
    badge: {
      initials: input.initials,
      color: input.color,
      style: input.badgeStyle
    }
  };
}
