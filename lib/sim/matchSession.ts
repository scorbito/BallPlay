// 경기장 4단계 흐름 동안 매치 컨텍스트를 sessionStorage에 보존.
// v1 스캐폴드 단계. v2에서 bp_matches 테이블로 이관.

import type { SimGameInput, SimGameResult } from "./types";
import { ensureNamespacedInput } from "./namespace";

const KEY = "ballplay:match:current";

function currentReturnHref(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href.startsWith("/stadium/play") || href.startsWith("/stadium/result")) return undefined;
  return href;
}

export type MatchSession = {
  myTeamId: string;
  opponentTeamId: string;
  seed: number;
  input?: SimGameInput;
  result?: SimGameResult;
  startedAt: string;
  // 매치 출처 — 기록 저장 가능 여부 판단. "ai"/"self"/"playoff"는 저장 X, "public"/"friend"만 저장.
  // 미설정(undefined)이면 AI로 간주 (백워드 호환).
  // "self": 본인이 만든 라인업끼리 대결 (양쪽 다 본인이라 공개 기록 의미 약해 저장 X).
  // "playoff": 가을야구 솔로 PvE — 공식 전적 미집계, 결과는 bp_playoff_runs 에만 기록.
  source?: "ai" | "public" | "friend" | "self" | "playoff";
  // 플레이오프 매치일 때 — 결과 화면에서 어느 run/라운드 결과인지 식별해 대진표에 기록.
  playoffRunId?: string;
  playoffRound?: number;
  // 한국시리즈 시리즈에서 이 경기를 이기면 우승 확정(2승째)인지 — 결과 화면 우승 연출 트리거용.
  playoffClinch?: boolean;
  // 실시간 매치 진입 시에만 세팅 — PlayScreen이 wall-clock 동기화에 사용
  liveMatchId?: string;
  liveStartAt?: string; // ISO 시각. 현재 시각 < liveStartAt이면 그때까지 대기 후 진행
  liveMode?: "fast" | "normal" | "live"; // 매치 생성자가 선택한 진행 모드. 양쪽 클라이언트 동일.
  // 친구 대전이면 사용자 측 (home/away) — 기록 저장 시 user_side로 사용.
  userSide?: "home" | "away";
  // 등록된 라인업(bp_lineups.id status='registered') ID — 매치 종료 시 라인업 전적 집계에 사용.
  // 슬롯끼리/슬롯vs등록 매치도 가능하므로 둘 다 옵션. 등록 카드 ID인 경우만 채움.
  myLineupId?: string;
  opponentLineupId?: string;
  // 기록에서 재생 중이면 원본 record id. 결과 화면에서 중복 저장 방지에 사용.
  replayOfRecordId?: string;
  // 경기 종료 시 PlayScreen에서 저장한 record id. ResultScreen 중복 저장 방지에 사용.
  savedRecordId?: string;
  // 관전/시뮬레이션 진입 전 페이지. 결과보기와 결과 화면 뒤로가기에 사용.
  returnHref?: string;
  // 기록 저장 시 opponent_nickname 스냅샷 — 공개 매칭 owner / 친구 대전 profiles lookup.
  opponentNickname?: string;
};

export function loadMatchSession(): MatchSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchSession;
  } catch {
    return null;
  }
}

export function saveMatchSession(session: MatchSession): void {
  if (typeof window === "undefined") return;
  // 양쪽 팀이 같은 KBO 팀일 때 playerId 충돌 방지 — input의 모든 playerId에 H:/A: prefix.
  // idempotent라 중복 save 호출에도 안전.
  const withReturnHref: MatchSession =
    session.returnHref || session.result
      ? session
      : { ...session, returnHref: currentReturnHref() };
  const normalized: MatchSession = withReturnHref.input
    ? { ...withReturnHref, input: ensureNamespacedInput(withReturnHref.input) }
    : withReturnHref;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    // ignore quota
  }
}

export function clearMatchSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
