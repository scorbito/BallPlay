"use client";

// 모바일 백그라운드 → 포그라운드 복귀 처리.
//
// 정책 (스마트 리로드):
//   1초+ 백그라운드 후 복귀 시 Supabase 헬스 ping 1회 (2초 cap, no-cache).
//   - ping 성공: 네트워크 정상 → 리로드 안 함 (각 화면 핸들러가 알아서 refetch)
//   - ping 타임아웃/실패: iOS fetch limbo로 추정 → window.location.reload()로 완전 복구
//
//   기존 "무조건 리로드"는 매번 splash 깜빡임이 있었음 → 95% 케이스(정상 네트워크)에선
//   ping이 50~300ms에 OK 떨어져 리로드 없음. 진짜 limbo일 때만 리로드.
//
// visibilitychange 외 pageshow(persisted=true)도 같이 듣는 이유:
//   iOS PWA에서 visibilitychange가 누락되는 케이스 백업 (bfcache 복원).
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect, useRef } from "react";

const PROBE_HIDDEN_MS = 1_000;   // 1초 미만 hidden은 무시 (알림 센터 살짝 내림 등)
const PROBE_TIMEOUT_MS = 2_000;  // ping이 이 시간 안에 응답 없으면 limbo로 간주

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);
  const probingRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const probeUrl = supabaseUrl ? `${supabaseUrl}/auth/v1/health` : null;

    /** Supabase 헬스 엔드포인트에 2초 ping. true=네트워크 OK, false=limbo/실패. */
    const probe = async (): Promise<boolean> => {
      if (!probeUrl) return true; // env 없으면 ping 못 함 → 리로드 안 함
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      try {
        const resp = await fetch(probeUrl, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal
        });
        // 응답 도착 자체가 네트워크 OK 신호 (status는 2xx/4xx 무관)
        return resp.ok || (resp.status >= 400 && resp.status < 500);
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    };

    const handleResume = (hiddenFor: number) => {
      if (hiddenFor < PROBE_HIDDEN_MS) return;
      if (probingRef.current) return; // 동시 중복 방지
      probingRef.current = true;
      void (async () => {
        const ok = await probe();
        probingRef.current = false;
        if (!ok && typeof window !== "undefined") {
          window.location.reload();
        }
      })();
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
      handleResume(hiddenFor);
    };

    // pageshow persisted=true → bfcache에서 복원. 보통 visibilitychange도 같이
    // 발생하지만 iOS PWA에서 안 오는 케이스가 있어 백업.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      const hiddenFor = hiddenAt !== null ? Date.now() - hiddenAt : PROBE_HIDDEN_MS;
      handleResume(hiddenFor);
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
