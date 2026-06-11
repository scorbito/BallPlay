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

// KBO 박스스코어의 포지션 표기(한자) → 시뮬 포지션 코드.
// 경기 중 포지션 교체 시 박스스코어가 "三一"(3B→1B) 같은 두 자리 값을 주는데,
// 우리 라인업은 선발 시점만 의미가 있으므로 첫 글자(선발 포지션)만 사용한다.
const KBO_POSITION_HANJA: Record<string, Position> = {
  "투": "P", "포": "C",
  "一": "1B", "二": "2B", "三": "3B", "유": "SS",
  "좌": "LF", "중": "CF", "우": "RF",
  "지": "DH"
};

/** 박스스코어 포지션 원문(혹은 이미 정규화된 "1B" 같은 값)을 시뮬 Position 코드로.
 *  매핑 실패 시 null. 신규/구 데이터 양쪽에서 안전하게 사용 가능. */
export function normalizeKboPosition(raw: string | null | undefined): Position | null {
  if (!raw) return null;
  if ((POSITIONS as readonly string[]).includes(raw)) return raw as Position;
  const first = raw.charAt(0);
  return KBO_POSITION_HANJA[first] ?? KBO_POSITION_HANJA[raw] ?? null;
}

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
  lineupType?: LineupType;
  rosterSourceId?: string;
};

export const LINEUP_STORAGE_PREFIX = "ballplay:lineup:";

/** 투수 라인업 — 오늘 경기의 선발 1명 + 마무리 1명 + 불펜 7명 = 9명.
 *  타자 라인업의 9슬롯과 동일한 모양으로 시각 일관성.
 *  슬롯 컨벤션 (시뮬레이션 엔진에서 역할로 매핑):
 *    0     : 선발 (SP)
 *    1     : 마무리 (CL) — 9회 1~3점 리드 시 자동 투입
 *    2..8  : 불펜 (RP) — 교체 시 순서대로 등판 */
export const PITCHER_SLOTS_COUNT = 9;
export const PITCHER_STARTER_INDEX = 0;
export const PITCHER_CLOSER_INDEX = 1;
export const PITCHER_REQUIRED_BULLPEN_INDEX = 2;

export type SavedPitcherLineup = {
  teamId: string;
  slots: (string | null)[]; // playerId × 9, [0]=선발, [1]=마무리, [2..8]=불펜
  updatedAt: string;
  lineupType?: LineupType;
  rosterSourceId?: string;
};

export const PITCHER_STORAGE_PREFIX = "ballplay:lineup:pitcher:";

/** 사용자 팀 슬롯 — 한 슬롯 = 한 팀 + 그 팀의 타자/투수 라인업.
 *  신규 생성에서는 같은 KBO 팀을 중복 선택하지 못하게 막지만,
 *  기존에 이미 만들어진 중복 슬롯은 별도 팀으로 유지한다. */
export type LineupEntry = {
  entryId: string;
  name: string;             // 사용자 지정 (또는 기본값: KBO 정식 팀명)
  teamId: string;
  lineupType?: LineupType;
  rosterSourceId?: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup | null;
  updatedAt: string;
  /** 공개 풀 매칭 대상으로 노출 (로그인 사용자만 / 9명 완성된 라인업만).
   *  localStorage에도 캐시되지만 source of truth는 bp_lineups.is_published. */
  isPublished?: boolean;
};

export const MY_LINEUPS_STORAGE_KEY = "ballplay:my-lineups";
// 절대 상한 — admin 등급 최대치. 등급별 실제 한도는 lib/auth/tierLimits.ts에서 동적 결정.
// 이 상수는 storage가 안전망으로 자르는 ceiling 역할.
export const MAX_LINEUP_ENTRIES = 50;

export type LineupMode = "batter" | "pitcher";

export type LineupType = "kbo" | "national" | "custom";

export const DEFAULT_LINEUP_TYPE: LineupType = "kbo";

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
