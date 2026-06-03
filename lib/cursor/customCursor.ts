// 커스텀 마우스 커서 토글. PC 전용 효과 — 모바일은 영향 없음.
// localStorage "ballplay:cursor:enabled" === "1" 이면 body.has-custom-cursor 클래스 부여.
// CSS 가 body.has-custom-cursor 일 때만 cursor: url(...) 적용.

const STORAGE_KEY = "ballplay:cursor:enabled";
const BODY_CLASS = "has-custom-cursor";

export function getCustomCursorEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCustomCursorEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  applyCustomCursorClass(enabled);
}

export function applyCustomCursorClass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.body.classList.add(BODY_CLASS);
  } else {
    document.body.classList.remove(BODY_CLASS);
  }
}

/** 앱 진입 시 1회 호출 — localStorage 값 기준으로 body 클래스 부여. */
export function initCustomCursor(): void {
  applyCustomCursorClass(getCustomCursorEnabled());
}
