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

// ── 속성 힌트 단계 개방 (1-based 시도 번호) ──
//
// 실측: 자모 제약만으로 1수 후 후보가 평균 3.2명까지 좁혀지고, 여기에 팀·포지션이
// 붙으면 2.0명이 된다. 즉 속성은 "마지막 한 명을 고르는" 역할이다.
// 1시도부터 다 열어두면 첫 수에 자모 3개 + 팀 + 포지션이 한 번에 들어와
// 글자 추리 없이 검색 목록에서 골라내는 흐름이 된다(실제 플레이에서 2수에 풀렸다).
//
// 약한 힌트(포지션, 4분류)부터 열고 강한 힌트(팀, 10분류)를 뒤로 미룬다.
// 개방은 소급 적용한다 — 3시도에 도달하면 1·2시도 줄에도 팀이 표시된다.
// 그렇지 않으면 어느 줄에 어떤 칩이 있었는지 외워야 해서 기억력 게임이 된다.
/** 포지션 힌트가 열리는 시도 번호. */
export const POSITION_HINT_FROM_ATTEMPT = 2;
/** 팀 힌트가 열리는 시도 번호. */
export const TEAM_HINT_FROM_ATTEMPT = 3;
/** 등번호 힌트가 열리는 시도 번호. */
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

/**
 * 연습 모드용 랜덤 정답.
 *
 * excludeIds 로 오늘의 정답과 이미 푼 선수를 제외한다. 오늘의 정답을 빼는 건
 * 연습이 데일리를 스포일러하지 않게 하기 위함이고, 이미 푼 선수를 빼는 건
 * 연달아 같은 사람이 나오는 걸 막기 위함이다.
 *
 * Math.random 을 쓰므로 클라이언트 이벤트 핸들러에서만 호출한다(SSR 불일치 방지).
 */
export function getRandomAnswer(excludeIds: readonly string[] = []): WordlePlayer | null {
  if (ENCODED_ANSWERS.length === 0) return null;
  const excluded = new Set(excludeIds);

  const candidates: WordlePlayer[] = [];
  for (const encoded of ENCODED_ANSWERS) {
    let player: WordlePlayer | null = null;
    try {
      player = findPlayerById(decodeId(encoded));
    } catch {
      player = null;
    }
    if (!player) continue;
    if (excluded.has(player.id)) continue;
    candidates.push(player);
  }
  // 풀을 다 돌았으면 제외 목록을 무시하고 다시 고른다(무한 연습 대비).
  // excluded 가 비어 있는데도 후보가 없으면 데이터 자체가 깨진 것이므로 재귀하지 않는다.
  if (candidates.length === 0) {
    return excluded.size > 0 ? getRandomAnswer([]) : null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
