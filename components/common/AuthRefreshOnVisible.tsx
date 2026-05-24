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
const PROBE_TIMEOUT_MS = 2_000;
// probingRef가 stale 락된 케이스 대비 — 이 시간 지나면 새 probe 허용
const PROBE_STALE_MS = 6_000;

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);
  const probingAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const client = createSupabaseBrowserClient();

    /** Supabase SDK 경유 가벼운 쿼리. 2초 안에 응답이 오면 true, 타임아웃이면 false.
     *  RLS 에러·404 등 서버 응답이면 OK 처리 — "네트워크/SDK 통신 자체"만 보는 지표. */
    const probe = async (): Promise<boolean> => {
      let timedOut = false;
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve("timeout");
        }, PROBE_TIMEOUT_MS);
      });
      // bp_user_tier — 가벼움(인덱스만 hit), 로그인 안 됐어도 RLS 에러로 정상 응답.
      // limit(0)이라 row 안 받음. count: 'exact', head: true로 헤더만.
      const queryPromise = client
        .from("bp_user_tier")
        .select("user_id", { count: "exact", head: true });
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        if (result === "timeout" || timedOut) return false;
        // 응답이 왔다 = SDK→Supabase 왕복 OK. RLS/PGRST 에러도 OK.
        return true;
      } catch {
        return !timedOut;
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
