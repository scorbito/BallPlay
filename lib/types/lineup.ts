export const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  P: "투수",
  C: "포수",
  "1B": "1루수",
  "2B": "2루수",
  "3B": "3루수",
  SS: "유격수",
  LF: "좌익수",
  CF: "중견수",
  RF: "우익수",
  DH: "지명타자"
};

export const POSITION_SHORT: Record<Position, string> = {
  P: "투",
  C: "포",
  "1B": "1루",
  "2B": "2루",
  "3B": "3루",
  SS: "유격",
  LF: "좌익",
  CF: "중견",
  RF: "우익",
  DH: "지명"
};

export type Player = {
  id: string;
  name: string;
  teamId: string;
  jerseyNumber: number;
  primaryPosition: Position;
  battingHand?: "L" | "R" | "S";
  throwingHand?: "L" | "R";
};

export type LineupOrder = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type LineupSlot = {
  order: LineupOrder;
  playerId: string;
  position: Position;
};

export type SavedLineup = {
  teamId: string;
  slots: LineupSlot[];
  useDH: boolean;
  updatedAt: string;
};

export const LINEUP_STORAGE_PREFIX = "ballplay:lineup:";
