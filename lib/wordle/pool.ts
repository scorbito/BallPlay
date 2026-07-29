// 선수명 워들의 선수 풀.
//
// data/wordle/guessable.json 은 scripts/build-wordle-answers.mjs 가 생성한 경량 스냅샷이다.
// lib/rosters/index.ts 를 직접 import 하지 않는 이유: 로스터 원본 10개 파일에는 화면에
// 필요 없는 필드가 많아 클라이언트 번들이 커진다. 워들엔 4개 필드만 필요하다.

import guessableData from "@/data/wordle/guessable.json";
import { matchesQuery } from "./jamo";

export type PositionGroup = "투수" | "포수" | "내야수" | "외야수";

export type WordlePlayer = {
  id: string;
  name: string;
  teamId: string;
  posGroup: PositionGroup;
  jersey: number;
};

const PLAYERS = (guessableData as { players: WordlePlayer[] }).players;

const BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

/** 추측 허용 선수 전원(3음절). 2군·신인 포함 — 정답보다 넓게 열어 탐색 여지를 준다. */
export function getGuessablePlayers(): WordlePlayer[] {
  return PLAYERS;
}

export function findPlayerById(id: string): WordlePlayer | null {
  return BY_ID.get(id) ?? null;
}

/**
 * 검색어로 선수 찾기. 초성("ㄱㄷㅇ")과 조합 중 입력("김ㄷ")도 지원한다.
 * 이미 추측한 이름은 뒤로 밀지 않고 호출부에서 흐리게 처리한다(목록 위치가 흔들리면 오조작).
 */
export function searchPlayers(query: string, limit = 8): WordlePlayer[] {
  const q = query.trim();
  if (!q) return [];
  const hits: WordlePlayer[] = [];
  for (const player of PLAYERS) {
    if (matchesQuery(player.name, q)) {
      hits.push(player);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

/** 이름이 추측 가능한 선수인지. 자동완성을 우회한 입력을 막는 최종 검증. */
export function isGuessableName(name: string): boolean {
  return PLAYERS.some((p) => p.name === name);
}

const NAME_COUNTS = PLAYERS.reduce<Record<string, number>>((acc, player) => {
  acc[player.name] = (acc[player.name] ?? 0) + 1;
  return acc;
}, {});

/**
 * 동명이인이 있는 이름인지.
 *
 * 검색 목록에는 팀·포지션을 노출하지 않는다 — 그걸 보여주면 추측을 쓰지 않고 목록만
 * 훑어서 속성 힌트와 대조해 정답을 골라낼 수 있다(실제 플레이에서 확인된 누출).
 * 다만 3음절 898명 중 43개 이름은 동명이인이라, 그 경우에만 구분용으로 팀을 보여준다.
 */
export function isAmbiguousName(name: string): boolean {
  return (NAME_COUNTS[name] ?? 0) > 1;
}
