// 결과 공유 텍스트.
//
// 자모 9칸 + 음절 사이 공백 포맷을 쓴다. 음절 단위로 요약(완전히 맞으면 초록, 일부라도
// 맞으면 노랑)하면 서로 다른 판이 같은 격자로 찍히는 문제가 있다. 실제로 시뮬레이션에서
// "초록 1개 + 노랑 배치가 전혀 다른 두 줄"이 똑같이 나왔다. 워들 공유의 재미는 좁혀가는
// 과정이 격자에 드러나는 데 있어서, 뭉개면 공유 동기 자체가 사라진다.
//
// 정답 이름은 절대 넣지 않는다(스포일러 방지). 속성 힌트 결과도 넣지 않는다.

import { MAX_ATTEMPTS } from "./daily";
import { JAMO_KINDS } from "./jamo";
import type { CellState, GuessResult } from "./judge";

const EMOJI: Record<CellState, string> = {
  hit: "🟩",
  near: "🟨",
  miss: "⬜",
  empty: "⬛"
};

const SHARE_TITLE = "오늘의 선수를 맞혀라!";
const SHARE_URL = "ballnori.com/play/wordle";

export function buildShareText(params: {
  dateISO: string;
  results: GuessResult[];
  solved: boolean;
}): string {
  const { dateISO, results, solved } = params;
  const score = solved ? `${results.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  const grid = results
    .map((result) =>
      result.syllables
        .map((syllable) => JAMO_KINDS.map((kind) => EMOJI[syllable[kind]]).join(""))
        .join(" ")
    )
    .join("\n");

  // 게임명이 느낌표로 끝나므로 날짜·점수를 같은 줄에 붙이면 어색하다. 제목을 독립 줄로
  // 두면 도전을 던지는 문장으로 읽혀 받는 사람을 끌어들인다.
  return `${SHARE_TITLE}\n${dateISO}  ${score}\n\n${grid}\n\n${SHARE_URL}`;
}
