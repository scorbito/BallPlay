// 그리드 게임의 선수 풀.
//
// data/grid/players.json 은 scripts/build-grid-data.mjs 가 생성한다.
// 1982~현재 KBO 1군 출장자 전원(은퇴 포함) 중 현존 10구단 이력이 있는 선수.

import playersData from "@/data/grid/players.json";
import { matchesQuery, matchesQueryFrom } from "@/lib/wordle/jamo";
import { GRID_TEAMS, TEAM_BIT, type GridTeamId } from "./teams";

/** [이름, 팀비트마스크, 투수여부, 데뷔연도, 마지막연도, 시즌수] */
type PlayerTuple = [string, number, number, number, number, number];

export type GridPlayer = {
  name: string;
  /** 뛴 팀 비트마스크 */
  mask: number;
  isPitcher: boolean;
  debut: number;
  last: number;
  seasons: number;
};

// JSON 은 (string|number)[][] 로 추론된다 — 튜플 형태는 빌드 스크립트가 보장하므로
// unknown 을 거쳐 단언한다.
const PLAYERS: GridPlayer[] = (playersData as unknown as { players: PlayerTuple[] }).players.map(
  ([name, mask, kind, debut, last, seasons]) => ({
    name,
    mask,
    isPitcher: kind === 1,
    debut,
    last,
    seasons
  })
);

/**
 * 이름 → 동명이인 목록.
 *
 * 정답 판정은 이름으로 받되 "그 이름을 가진 사람 중 한 명이라도 셀 조건을 전부
 * 만족하면 정답"으로 처리한다. 조건별로 따로 평가하면 서로 다른 동명이인이 조건을
 * 나눠 만족해 오답이 정답이 된다(김현수 A는 두산, 김현수 B는 좌완 → "두산 좌완" 통과).
 */
const BY_NAME = new Map<string, GridPlayer[]>();
for (const player of PLAYERS) {
  const list = BY_NAME.get(player.name);
  if (list) list.push(player);
  else BY_NAME.set(player.name, [player]);
}

/** 이름 목록 — 검색 정렬용. 최근 활동 순(= 인지도 근사)으로 고정한다. */
const NAMES: { name: string; recency: number }[] = [];
BY_NAME.forEach((list, name) => {
  NAMES.push({ name, recency: Math.max(...list.map((p: GridPlayer) => p.last)) });
});
NAMES.sort((a, b) => b.recency - a.recency || a.name.localeCompare(b.name, "ko"));

export function getPlayerCount(): number {
  return PLAYERS.length;
}

export function getNameCount(): number {
  return BY_NAME.size;
}

export function findPlayersByName(name: string): GridPlayer[] {
  return BY_NAME.get(name) ?? [];
}

export function isKnownName(name: string): boolean {
  return BY_NAME.has(name);
}

/** 선수가 해당 팀에서 1군 출장한 적이 있는지. */
export function playedFor(player: GridPlayer, teamId: GridTeamId): boolean {
  return (player.mask & TEAM_BIT[teamId]) !== 0;
}

/** 선수가 뛴 팀 목록. 정답 공개 화면에서 쓴다. */
export function teamsOf(player: GridPlayer): GridTeamId[] {
  return GRID_TEAMS.filter((id) => playedFor(player, id));
}

/**
 * 검색. 초성("ㄱㄷㅇ")과 조합 중 입력("김ㄷ")을 지원한다 — 워들의 자모 매처를 그대로 쓴다.
 * 동명이인은 하나로 합쳐서 돌려준다(판정이 이름 단위라 목록에서 나눌 이유가 없다).
 */
export function searchNames(query: string, limit = 8): string[] {
  const q = query.trim();
  if (!q) return [];

  // 첫 글자부터 맞는 결과를 앞에 둔다 — "ㅇ"이면 "양준혁"이 "최영필"보다 먼저.
  const leading: string[] = [];
  const trailing: string[] = [];
  for (const { name } of NAMES) {
    if (matchesQueryFrom(name, q, 0)) {
      leading.push(name);
      if (leading.length >= limit) break;
    } else if (trailing.length < limit && matchesQuery(name, q)) {
      trailing.push(name);
    }
  }
  return [...leading, ...trailing].slice(0, limit);
}

/** 활동 기간 표기 — "1993–2010". 동명이인 구분과 정답 공개에 쓴다. */
export function careerSpan(player: GridPlayer): string {
  return player.debut === player.last ? `${player.debut}` : `${player.debut}–${player.last}`;
}

export function getAllPlayers(): readonly GridPlayer[] {
  return PLAYERS;
}
