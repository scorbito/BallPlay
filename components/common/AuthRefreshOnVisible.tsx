"use client";

// 모바일 백그라운드 → 포그라운드 복귀 처리.
//
// 정책: 1초 이상 백그라운드였다가 복귀하면 무조건 window.location.reload().
//   iOS Safari/PWA는 짧은 백그라운드(1~2초)에도 fetch를 limbo로 묶어버려
//   refresh·동기화·데이터 fetch까지 모두 hang시킴. refresh 결과로 판단하려
//   해도 refresh 자체가 캐시로 빠르게 성공해 false-negative가 나옴 → 결국
//   "동기화 아이콘만 돌고 화면 빈 상태" 재현. 신뢰할 수 있는 유일한 신호는
//   "백그라운드 다녀왔다" 자체이므로 그걸로 트리거.
//
// 1초 미만은 무시 — 알림 센터 살짝 내렸다 올린 정도의 false-positive 방지.
//
// visibilitychange 외 pageshow(persisted=true)도 같이 듣는 이유:
//   iOS PWA에서 visibilitychange가 누락되는 케이스 백업 (bfcache 복원).
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect, useRef } from "react";

const RELOAD_HIDDEN_MS = 1_000;

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const tryReload = (hiddenFor: number) => {
      if (hiddenFor < RELOAD_HIDDEN_MS) return;
      if (typeof window === "undefined") return;
      window.location.reload();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      const hiddenFor = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      tryReload(hiddenFor);
    };

    // pageshow persisted=true → bfcache에서 복원. 보통 visibilitychange도 같이
    // 발생하지만 iOS PWA에서 안 오는 케이스가 있어 백업.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      const hiddenFor = hiddenAt !== null ? Date.now() - hiddenAt : RELOAD_HIDDEN_MS;
      tryReload(hiddenFor);
    };

    const onPageHide = () => {
      if (hiddenAtRef.current === null) {
        hiddenAtRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
