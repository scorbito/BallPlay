// 첫 추측 유도용 추천 선수.
//
// 빈 격자만 보고 "뭘 입력해야 하지?"에서 멈추는 걸 막는 장치다. 워들에서 첫 수는
// 정답을 노리는 게 아니라 단서를 뽑는 프로브라, 아무 선수나 넣어도 되는데
// 처음 접하는 사람은 그걸 모른다. 탭 한 번으로 시작되게 만든다.
//
// ── 난이도 균일화가 이 모듈의 핵심 ──
// 초기 구현은 "정답과 동일한 선수"만 제외했다. 그 결과 실제 플레이에서
//   정답 박시후(SSG) + 추천 박성한(SSG) → 첫 음절 완전 일치 + 팀 일치 (근접도 10점)
//   정답 박시후      + 추천 김도영      → 노랑 1개만 (근접도 1점)
// 처럼 어떤 추천을 누르느냐에 따라 난이도가 극단적으로 갈렸다.
//
// 그래서 추천을 "정답과 적당히 겹치는" 밴드로 제한한다. 너무 가까우면 퍼즐이 끝나고,
// 너무 멀면 아무 단서도 없어서 유도 장치 역할을 못 한다.

import answerlessPool from "@/data/wordle/starters.json";
import { dayIndexFor } from "./daily";
import { JAMO_KINDS } from "./jamo";
import { judgeGuess } from "./judge";
import { findPlayerById, type WordlePlayer } from "./pool";

const STARTER_IDS = (answerlessPool as { ids: string[] }).ids;

/**
 * 근접도 = 정확 자모 x2 + 포함 자모 x1 (최대 18).
 * 밴드 [3, 6] 은 201일 전량에 대해 후보 3명 확보가 가능한 구간으로 실측해서 잡았다.
 * 위로 넓히면(예: 7 이상) 어떤 날은 거의 정답이 되고, 아래로 좁히면 단서가 없어진다.
 */
const MIN_CLOSENESS = 3;
const MAX_CLOSENESS = 6;

type Closeness = {
  score: number;
  /** 같은 자리에 같은 음절이 몇 개인지 */
  exactSyllables: number;
};

function measureCloseness(guessName: string, answerName: string): Closeness | null {
  const result = judgeGuess(guessName, answerName);
  if (!result) return null;

  let hits = 0;
  let nears = 0;
  for (const syllable of result.syllables) {
    for (const kind of JAMO_KINDS) {
      if (syllable[kind] === "hit") hits += 1;
      else if (syllable[kind] === "near") nears += 1;
    }
  }

  const guessChars = Array.from(guessName);
  const answerChars = Array.from(answerName);
  const exactSyllables =
    guessChars.length === answerChars.length
      ? guessChars.filter((char, index) => char === answerChars[index]).length
      : 0;

  return { score: hits * 2 + nears, exactSyllables };
}

function isUsableStarter(player: WordlePlayer, answer: WordlePlayer): boolean {
  if (player.id === answer.id) return false;
  // 팀이 같으면 탭 한 번에 팀 힌트가 확정된다(10팀 중 1개).
  if (player.teamId === answer.teamId) return false;

  const closeness = measureCloseness(player.name, answer.name);
  if (!closeness) return false;
  // 같은 자리 음절이 통째로 겹치면(박시후 vs 박성한의 "박") 초록 3개가 한 번에 나온다.
  if (closeness.exactSyllables > 0) return false;
  return closeness.score >= MIN_CLOSENESS && closeness.score <= MAX_CLOSENESS;
}

/**
 * 해당 날짜의 추천 선수 3명.
 *
 * 정답을 참조하지만 좁혀주는 방향이 아니라 **난이도를 고르게 맞추는 방향**으로만 쓴다.
 * 후보 목록은 날짜별로 회전해서 매일 같은 이름이 뜨지 않는다.
 */
export function getStarterSuggestions(
  dateISO: string,
  answer: WordlePlayer | null,
  count = 3
): WordlePlayer[] {
  const candidates: WordlePlayer[] = [];
  for (const id of STARTER_IDS) {
    const player = findPlayerById(id);
    // 로스터에서 빠진 선수(이적·은퇴)는 조용히 건너뛴다.
    if (!player) continue;
    if (answer && !isUsableStarter(player, answer)) continue;
    candidates.push(player);
  }
  if (candidates.length === 0) return [];

  // 회전 간격을 1로 두면 인접한 날이 후보 목록의 거의 같은 구간을 뽑아 같은 이름이
  // 반복된다(14일 기준 서로 다른 이름 26개). 소수 간격으로 흩으면 34개까지 늘어난다.
  const STRIDE = 37;
  const dayIndex = dayIndexFor(dateISO) * STRIDE;
  const offset = ((dayIndex % candidates.length) + candidates.length) % candidates.length;
  const picked: WordlePlayer[] = [];
  for (let step = 0; step < candidates.length && picked.length < count; step++) {
    picked.push(candidates[(offset + step) % candidates.length]);
  }
  return picked;
}
