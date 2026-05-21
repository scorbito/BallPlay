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
  P: "투수",
  C: "포수",
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
  /** 이번 시즌 1군 출장 경기수. KBO 선수 상세 페이지의 G 컬럼. 0이면 2군. */
  seasonGames?: number;
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

/** 투수 라인업 — 오늘 경기의 선발 1명 + 불펜 8명 = 9명.
 *  타자 라인업의 9슬롯과 동일한 모양으로 시각 일관성. */
export const PITCHER_SLOTS_COUNT = 9; // 0: 선발, 1~8: 불펜
export const PITCHER_STARTER_INDEX = 0;

export type SavedPitcherLineup = {
  teamId: string;
  slots: (string | null)[]; // playerId × 9, [0]=선발, [1..8]=불펜
  updatedAt: string;
};

export const PITCHER_STORAGE_PREFIX = "ballplay:lineup:pitcher:";

export type LineupMode = "batter" | "pitcher";

/** 대기 풀에 표시할 그룹 라벨 — KBO 명단의 분류(투수/포수/내야수/외야수/지명)
 *  그대로 노출. 세부 포지션은 라인업 슬롯에서만 표시.
 *  내야수/외야수 안의 1루/2루/3루/유격/좌익/중견/우익 중 어느 자리에 들어갈지는
 *  라인업 추가 시 자동 분배 + 사용자가 슬롯의 포지션 모달로 변경. */
export function getPoolGroupLabel(primaryPos: Position): string {
  switch (primaryPos) {
    case "P":
      return "투수";
    case "C":
      return "포수";
    case "1B":
    case "2B":
    case "3B":
    case "SS":
      return "내야";
    case "LF":
    case "CF":
    case "RF":
      return "외야";
    case "DH":
      return "지명";
    default:
      return "";
  }
}

/** 선수의 표시용 투/타 뱃지 정보 — 투수는 throwingHand, 야수는 battingHand 기준.
 *  표시할 정보가 없으면 null. */
export function formatHandBadge(player: Player): { label: string; tone: "L" | "R" | "S" } | null {
  if (player.primaryPosition === "P") {
    if (player.throwingHand === "L") return { label: "좌투", tone: "L" };
    if (player.throwingHand === "R") return { label: "우투", tone: "R" };
    return null;
  }
  if (player.battingHand === "L") return { label: "좌타", tone: "L" };
  if (player.battingHand === "R") return { label: "우타", tone: "R" };
  if (player.battingHand === "S") return { label: "양타", tone: "S" };
  return null;
}
