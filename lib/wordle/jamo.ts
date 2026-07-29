// 한글 자모 분해 / 초성 검색.
//
// 선수명 워들의 채점 단위는 음절이 아니라 자모(초성·중성·종성)다.
// 음절 단위로 채점하면 "김도영" vs "박재현" 처럼 겹치는 게 없을 때 정보가 0이 되어
// 추리가 성립하지 않는다.
//
// 겹받침(ㄳ, ㄻ...)과 복합 중성(ㅘ, ㅙ...)은 더 쪼개지 않고 단일 자모로 취급한다.
// 판정 규칙이 단순해지고, 선수 이름에서 등장 빈도가 낮다.

/** 초성 19자 — 호환 자모(U+3131~) 기준. */
export const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".split("");

/** 중성 21자. */
export const JUNG_LIST = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".split("");

/** 종성 27자 (받침 없음은 별도 표현하므로 목록에서 제외). */
export const JONG_LIST = "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ".split("");

/** 종성 인덱스 테이블 — 0은 받침 없음. */
const JONG_TABLE = ["", ...JONG_LIST];

const HANGUL_FIRST = 0xac00; // '가'
const HANGUL_LAST = 0xd7a3; // '힣'

export type JamoKind = "cho" | "jung" | "jong";

/** 자모 종류 3개 — 판정·렌더 루프에서 순서를 고정해 쓰기 위한 상수. */
export const JAMO_KINDS: readonly JamoKind[] = ["cho", "jung", "jong"];

/** 음절 1개의 자모. 종성이 없으면 jong = null. */
export type SyllableJamo = {
  cho: string;
  jung: string;
  jong: string | null;
};

/** 완성형 한글 음절인지. (조합 중인 낱자 'ㄱ', 'ㅏ' 는 false) */
export function isCompleteHangul(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= HANGUL_FIRST && code <= HANGUL_LAST;
}

/** 완성형 음절 1개를 자모로 분해. 완성형이 아니면 null. */
export function decomposeSyllable(ch: string): SyllableJamo | null {
  if (!isCompleteHangul(ch)) return null;
  const offset = (ch.codePointAt(0) as number) - HANGUL_FIRST;
  return {
    cho: CHO_LIST[Math.floor(offset / 588)],
    jung: JUNG_LIST[Math.floor((offset % 588) / 28)],
    jong: JONG_TABLE[offset % 28] || null
  };
}

/** 이름 전체를 음절별 자모 배열로. 완성형이 아닌 글자가 섞이면 null. */
export function decomposeName(name: string): SyllableJamo[] | null {
  const chars = Array.from(name);
  const out: SyllableJamo[] = [];
  for (const ch of chars) {
    const jamo = decomposeSyllable(ch);
    if (!jamo) return null;
    out.push(jamo);
  }
  return out.length > 0 ? out : null;
}

/** 이름의 초성 문자열. "김도영" → "ㄱㄷㅇ" (초성 검색용) */
export function getChoseong(name: string): string {
  return Array.from(name)
    .map((ch) => decomposeSyllable(ch)?.cho ?? ch)
    .join("");
}

/**
 * 검색어 한 글자가 이름 한 글자와 맞는지.
 *   - 완전 일치: "김" = "김"
 *   - 초성만 입력: "ㄱ" → "김"
 *   - 조합 중(받침 없는 상태): "기" → "김"  (한글 IME 로 타이핑하는 중간 상태)
 */
function charMatches(nameCh: string, queryCh: string): boolean {
  if (nameCh === queryCh) return true;
  const nameJamo = decomposeSyllable(nameCh);
  if (!nameJamo) return false;

  if (CHO_LIST.includes(queryCh)) return nameJamo.cho === queryCh;

  const queryJamo = decomposeSyllable(queryCh);
  // 받침까지 입력됐는데 다르면 불일치. 받침이 없으면 초성+중성만 비교(조합 중).
  if (queryJamo && queryJamo.jong === null) {
    return nameJamo.cho === queryJamo.cho && nameJamo.jung === queryJamo.jung;
  }
  return false;
}

/** 이름의 특정 위치부터 검색어가 이어지는지. */
export function matchesQueryFrom(name: string, query: string, start: number): boolean {
  const q = Array.from(query.replace(/\s+/g, ""));
  if (q.length === 0) return false;
  const chars = Array.from(name);
  if (start < 0 || start + q.length > chars.length) return false;
  for (let i = 0; i < q.length; i++) {
    if (!charMatches(chars[start + i], q[i])) return false;
  }
  return true;
}

/**
 * 선수 검색 매칭. 이름의 어느 위치에서 시작해도 되고, 초성·조합 중 입력도 허용한다.
 *   "김도" / "ㄱㄷㅇ" / "도영" / "김ㄷ" 모두 "김도영" 을 찾는다.
 *
 * 위치를 가리지 않으므로 "ㅇ" 하나로도 "최우인"(우), "김지윤"(윤)이 걸린다.
 * 그래서 호출부(searchPlayers)는 첫 글자부터 맞는 결과를 먼저 보여준다.
 */
export function matchesQuery(name: string, query: string): boolean {
  const q = Array.from(query.replace(/\s+/g, ""));
  if (q.length === 0) return false;
  const chars = Array.from(name);
  if (q.length > chars.length) return false;

  for (let start = 0; start + q.length <= chars.length; start++) {
    if (matchesQueryFrom(name, query, start)) return true;
  }
  return false;
}
