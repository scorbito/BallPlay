// 경기장 4단계 흐름 동안 매치 컨텍스트를 sessionStorage에 보존.
// v1 스캐폴드 단계. v2에서 bp_matches 테이블로 이관.

import type { SimGameInput, SimGameResult } from "./types";
import { ensureNamespacedInput } from "./namespace";

const KEY = "ballplay:match:current";

export type MatchSession = {
  myTeamId: string;
  opponentTeamId: string;
  seed: number;
  input?: SimGameInput;
  result?: SimGameResult;
  startedAt: string;
  // 매치 출처 — 기록 저장 가능 여부 판단. "ai"는 저장 X, "public"/"friend"만 저장.
  // 미설정(undefined)이면 AI로 간주 (백워드 호환).
  source?: "ai" | "public" | "friend";
  // 실시간 매치 진입 시에만 세팅 — PlayScreen이 wall-clock 동기화에 사용
  liveMatchId?: string;
  liveStartAt?: string; // ISO 시각. 현재 시각 < liveStartAt이면 그때까지 대기 후 진행
  liveMode?: "normal" | "live"; // 매치 생성자가 선택한 진행 모드. 양쪽 클라이언트 동일.
  // 친구 대전이면 사용자 측 (home/away) — 기록 저장 시 user_side로 사용.
  userSide?: "home" | "away";
  // 기록에서 재생 중이면 원본 record id. 결과 화면에서 중복 저장 방지에 사용.
  replayOfRecordId?: string;
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
  const normalized: MatchSession = session.input
    ? { ...session, input: ensureNamespacedInput(session.input) }
    : session;
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
