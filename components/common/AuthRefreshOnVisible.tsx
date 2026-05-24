"use client";

// 모바일 백그라운드 → 포그라운드 복귀 처리.
//
// 정책 (스마트 리로드):
//   1초+ 백그라운드 후 복귀 시 Supabase SDK로 가벼운 쿼리 1회 (2초 cap).
//   - 응답 도착: 네트워크+SDK 둘 다 OK → 리로드 안 함 (각 화면 핸들러가 refetch)
//   - 타임아웃: iOS fetch limbo로 추정 → window.location.reload()
//
//   raw fetch ping 대신 SDK 쿼리를 쓰는 이유: ping은 새 연결로 빠지면서 OK여도
//   SDK가 쓰는 기존 연결이 limbo면 후속 쿼리가 hang하는 케이스가 있음.
//   같은 SDK 경로로 probe해야 실제 쿼리 경로 상태가 검출됨.
//
// visibilitychange 외 pageshow(persisted=true)도 같이 듣는 이유:
//   iOS PWA에서 visibilitychange가 누락되는 케이스 백업 (bfcache 복원).
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PROBE_HIDDEN_MS = 1_000;
const PROBE_TIMEOUT_MS = 1_500;
// probingRef가 stale 락된 케이스 대비 — 이 시간 지나면 새 probe 허용
const PROBE_STALE_MS = 5_000;

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);
  const probingAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const client = createSupabaseBrowserClient();

    /** 엄격 probe — auth.refreshSession + 실제 쿼리 둘 다 1.5초 안에 성공해야 true.
     *  단일 probe만 통과하고 다음 fetch가 hang하는 케이스를 잡기 위해 2단계 검사. */
    const probe = async (): Promise<boolean> => {
      let timedOut = false;
      const tid = setTimeout(() => { timedOut = true; }, PROBE_TIMEOUT_MS);
      try {
        const combined = Promise.all([
          client.auth.refreshSession(),
          client.from("bp_user_tier").select("user_id", { count: "exact", head: true })
        ]);
        const result = await Promise.race([
          combined.then(() => "ok" as const),
          new Promise<"timeout">((resolve) =>
            setTimeout(() => resolve("timeout"), PROBE_TIMEOUT_MS)
          )
        ]);
        clearTimeout(tid);
        if (result === "timeout" || timedOut) return false;
        return true;
      } catch {
        clearTimeout(tid);
        return false;
      }
    };

    const handleResume = (hiddenFor: number) => {
      if (hiddenFor < PROBE_HIDDEN_MS) return;
      const now = Date.now();
      // 이미 probe 중이고 stale 시간 안이면 skip — 그 외엔 새 probe 시작 (락 누락 보호)
      if (probingAtRef.current && now - probingAtRef.current < PROBE_STALE_MS) return;
      probingAtRef.current = now;
      void (async () => {
        const ok = await probe();
        probingAtRef.current = 0;
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
