// 선수명 워들의 선수 풀.
//
// data/wordle/guessable.json 은 scripts/build-wordle-answers.mjs 가 생성한 경량 스냅샷이다.
// lib/rosters/index.ts 를 직접 import 하지 않는 이유: 로스터 원본 10개 파일에는 화면에
// 필요 없는 필드가 많아 클라이언트 번들이 커진다. 워들엔 4개 필드만 필요하다.

import guessableData from "@/data/wordle/guessable.json";
import { matchesQuery, matchesQueryFrom } from "./jamo";

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
 *
 * 정렬은 2단계다.
 *   1) 첫 글자부터 맞는 결과 — "ㅇ" 이면 "양의지"(양) 가 "최우인"(우) 보다 먼저.
 *      위치 무관 매칭이라 이게 없으면 관련성 낮은 결과가 앞에 온다.
 *   2) 그 안에서는 파일 순서 = 출장 수 내림차순(= 인지도). 예전엔 id 문자열 순이라
 *      "doosan-" 이 알파벳상 맨 앞이어서 모든 검색에 두산 선수가 먼저 나왔다.
 */
export function searchPlayers(query: string, limit = 8): WordlePlayer[] {
  const q = query.trim();
  if (!q) return [];

  const leading: WordlePlayer[] = [];
  const trailing: WordlePlayer[] = [];
  for (const player of PLAYERS) {
    if (matchesQueryFrom(player.name, q, 0)) {
      leading.push(player);
      if (leading.length >= limit) break;
    } else if (trailing.length < limit && matchesQuery(player.name, q)) {
      trailing.push(player);
    }
  }
  return [...leading, ...trailing].slice(0, limit);
}

/** 이름이 추측 가능한 선수인지. 자동완성을 우회한 입력을 막는 최종 검증. */
export function isGuessableName(name: string): boolean {
  return PLAYERS.some((p) => p.name === name);
}
