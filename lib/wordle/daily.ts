// 오늘의 정답 산출 — 서버 호출 없이 결정론적으로.
//
// 미리 셔플해 파일에 고정한 배열을 dayIndex 로 순환하므로 모든 유저·모든 기기에서
// 같은 정답이 나온다. API 도 DB 도 필요 없어 페이지를 정적으로 유지할 수 있다
// (Vercel Hobby 의 Fluid Active CPU 를 태우지 않는 게 이 프로젝트의 기본 제약).

import answersData from "@/data/wordle/answers.json";
import { findPlayerById, type WordlePlayer } from "./pool";

/**
 * 서비스 시작일(KST) = 정답 배열의 0번째 날.
 *
 * 정답을 특정 날짜에 못 박아둔 게 아니라 answers 배열은 "순서"만 갖고 있고,
 * 이 상수가 그 순서의 시작점을 잡는다. 한 번 정하면 다시 손댈 일이 없다 —
 * 바꾸면 그날 이후 모든 날짜의 정답이 밀리므로 운영 중에는 고정한다.
 */
export const WORDLE_DAY0 = "2026-07-29";

/** 하루 시도 횟수. */
export const MAX_ATTEMPTS = 6;

/** 격자 칸 수 = 정답 음절 수. */
export const SYLLABLE_COUNT = 3;

/** 등번호 힌트가 열리는 시도 번호(1-based). 그 전에는 팀·포지션만 공개. */
export const JERSEY_HINT_FROM_ATTEMPT = 4;

const ENCODED_ANSWERS = (answersData as { answers: string[] }).answers;

/** base64 → 원문. Buffer 없이 브라우저에서도 동작. */
function decodeId(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** KST 기준 YYYY-MM-DD. */
export function kstDateString(now: Date = new Date()): string {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** DAY0 기준 경과 일수. DAY0 이전이면 음수가 나올 수 있어 호출부에서 0으로 클램프한다. */
export function dayIndexFor(dateISO: string): number {
  const target = Date.parse(`${dateISO}T00:00:00+09:00`);
  const base = Date.parse(`${WORDLE_DAY0}T00:00:00+09:00`);
  if (Number.isNaN(target) || Number.isNaN(base)) return 0;
  return Math.floor((target - base) / 86_400_000);
}

/** 해당 날짜의 정답 선수. 정답 풀이 비었으면 null. */
export function getAnswerForDate(dateISO: string): WordlePlayer | null {
  if (ENCODED_ANSWERS.length === 0) return null;
  const index = dayIndexFor(dateISO);
  // 음수(서비스 시작 전 날짜)도 항상 유효한 인덱스로 접히도록 정규화.
  const normalized = ((index % ENCODED_ANSWERS.length) + ENCODED_ANSWERS.length) % ENCODED_ANSWERS.length;
  try {
    return findPlayerById(decodeId(ENCODED_ANSWERS[normalized]));
  } catch {
    return null;
  }
}

/** 정답 풀 크기 — "며칠치 문제가 있는지" 안내용. */
export function getAnswerPoolSize(): number {
  return ENCODED_ANSWERS.length;
}
