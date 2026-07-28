// 선수명 워들 채점 — 워들 표준 2패스 알고리즘을 자모 단위로 적용.
//
// 슬롯 식별자는 (음절 인덱스, 자모 종류) 이므로 3음절 이름은 최대 9칸이다.
//
// 핵심 규칙: "포함(near)" 판정은 같은 종류(초성/중성/종성) 안에서만 성립한다.
//   추측 0번 음절의 초성 ㄴ 과 정답 2번 음절의 종성 ㄴ 은 near 가 아니다.
//   한글에서 초성과 종성은 역할이 다르고, 교차를 허용하면 노랑이 남발되어
//   오히려 정보량이 떨어진다. (중성은 자모 집합 자체가 달라 애초에 교차하지 않는다)

import { JAMO_KINDS, decomposeName, type JamoKind } from "./jamo";

export type CellState =
  /** 같은 슬롯에 같은 자모 */
  | "hit"
  /** 정답에 있지만 다른 음절 위치 */
  | "near"
  /** 정답에 없음 */
  | "miss"
  /** 해당 슬롯이 비어 있음(추측에 종성이 없음) */
  | "empty";

export type SyllableResult = Record<JamoKind, CellState>;

export type GuessResult = {
  /** 추측한 이름 */
  name: string;
  /** 음절별 자모 채점 */
  syllables: SyllableResult[];
  /** 전부 hit 인지 */
  solved: boolean;
};

/**
 * 추측을 정답과 비교해 채점. 둘 다 완성형이고 음절 수가 같아야 하며,
 * 아니면 null(호출부에서 입력 검증 실패로 취급).
 */
export function judgeGuess(guess: string, answer: string): GuessResult | null {
  const guessJamo = decomposeName(guess);
  const answerJamo = decomposeName(answer);
  if (!guessJamo || !answerJamo) return null;
  if (guessJamo.length !== answerJamo.length) return null;

  const length = guessJamo.length;
  // 정답 쪽 자모 소진 표시 — 중복 자모를 두 번 노랑으로 세지 않기 위함.
  const consumed: Record<JamoKind, boolean>[] = answerJamo.map(() => ({
    cho: false,
    jung: false,
    jong: false
  }));
  const syllables: SyllableResult[] = answerJamo.map(() => ({
    cho: "miss",
    jung: "miss",
    jong: "miss"
  }));

  // 1패스 — 같은 슬롯 정확 일치를 먼저 확정한다.
  for (let i = 0; i < length; i++) {
    for (const kind of JAMO_KINDS) {
      const g = guessJamo[i][kind];
      if (g !== null && g === answerJamo[i][kind]) {
        syllables[i][kind] = "hit";
        consumed[i][kind] = true;
      }
    }
  }

  // 2패스 — 남은 자모를 같은 종류 안에서만 다른 위치에서 찾는다.
  for (let i = 0; i < length; i++) {
    for (const kind of JAMO_KINDS) {
      if (syllables[i][kind] === "hit") continue;
      const g = guessJamo[i][kind];
      if (g === null) {
        syllables[i][kind] = "empty";
        continue;
      }
      let found = false;
      for (let j = 0; j < length; j++) {
        if (consumed[j][kind]) continue;
        if (answerJamo[j][kind] === g) {
          consumed[j][kind] = true;
          found = true;
          break;
        }
      }
      syllables[i][kind] = found ? "near" : "miss";
    }
  }

  return { name: guess, syllables, solved: guess === answer };
}

/** 자모별 최고 상태 — 자모 현황 패널에 쓸 누적 맵. hit > near > miss 순으로 유지. */
export type JamoStatusMap = Record<JamoKind, Record<string, CellState>>;

const RANK: Record<CellState, number> = { hit: 3, near: 2, miss: 1, empty: 0 };

/** 지금까지의 추측 결과를 자모별 상태로 누적. */
export function buildJamoStatus(results: GuessResult[]): JamoStatusMap {
  const map: JamoStatusMap = { cho: {}, jung: {}, jong: {} };
  for (const result of results) {
    const jamo = decomposeName(result.name);
    if (!jamo) continue;
    for (let i = 0; i < jamo.length; i++) {
      for (const kind of JAMO_KINDS) {
        const ch = jamo[i][kind];
        if (ch === null) continue;
        const state = result.syllables[i]?.[kind];
        if (!state || state === "empty") continue;
        const prev = map[kind][ch];
        if (!prev || RANK[state] > RANK[prev]) map[kind][ch] = state;
      }
    }
  }
  return map;
}
