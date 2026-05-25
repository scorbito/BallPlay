"use client";

// 모바일 백그라운드 → 포그라운드 복귀 처리.
//
// 정책 (무조건 probe):
//   visibility가 visible로 돌아올 때마다 (백그라운드 시간 무관) Supabase로
//   refresh + 쿼리 동시 발사. 1.5초 cap.
//   - 둘 다 응답: 리로드 안 함 (각 화면 핸들러가 refetch)
//   - 타임아웃 또는 실패: iOS fetch limbo로 추정 → window.location.reload()
//
//   threshold(예: "1초 이상 hidden일 때만 probe")는 사용 안 함 — 사용자 보고로
//   0.5~1초 짧은 백그라운드에서도 limbo가 재현됨. 무조건 probe로 빠짐없이 검출.
//
//   정상 네트워크에선 probe가 ~300ms에 OK 떨어져 리로드 없음. probe 자체는
//   가벼움(HEAD 쿼리 + 토큰 refresh) — 알림센터 슬쩍 내림에도 호출되지만
//   사용자가 못 느낌.
//
// visibilitychange 외 pageshow(persisted=true)도 같이 듣는 이유:
//   iOS PWA에서 visibilitychange가 누락되는 케이스 백업 (bfcache 복원).
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PROBE_TIMEOUT_MS = 1_500;
// probingRef가 stale 락된 케이스 대비 — 이 시간 지나면 새 probe 허용
const PROBE_STALE_MS = 5_000;

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);
  const probingAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    // probe + reload 폴백은 iOS Safari/PWA의 fetch limbo 버그 대응. 데스크톱
    // 브라우저는 같은 증상이 없는데도 매 탭 전환마다 probe→타임아웃→리로드가
    // 터져서 사용자가 "네트워크 끊김"으로 인지함. 모바일에서만 활성화.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (!isMobile) return;

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

    const handleResume = () => {
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
      hiddenAtRef.current = null;
      handleResume();
    };

    // pageshow persisted=true → bfcache에서 복원. iOS PWA에서 visibilitychange가
    // 누락되는 케이스 백업.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      hiddenAtRef.current = null;
      handleResume();
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
