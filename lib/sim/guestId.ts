// 익명 게스트 ID — localStorage에 영속. 정식 로그인 없이도
// bp_matches의 슬롯 점유자를 식별하기 위함.
//
// Supabase의 익명 sign-in과는 별개의 클라이언트 식별자.
// v2에서 정식 로그인 도입 시 guest_id → user_id 매핑 마이그 필요.

const GUEST_ID_KEY = "ballplay:guest-id";

export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "ssr-no-guest";
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const fresh = newGuestId();
    window.localStorage.setItem(GUEST_ID_KEY, fresh);
    return fresh;
  } catch {
    // localStorage 차단 환경 — 세션 한정 임시 ID
    return newGuestId();
  }
}

function newGuestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `g-${crypto.randomUUID()}`;
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
