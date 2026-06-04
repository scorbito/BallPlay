"use client";

// 백그라운드 → 포그라운드 복귀 시 fetch limbo 복구.
//
// 정책 (무조건 probe):
//   visibility가 visible로 돌아올 때마다 (백그라운드 시간 무관) Supabase로
//   가벼운 HEAD 쿼리를 발사. 1.5초 cap.
//   - 응답: 리로드 안 함 (각 화면 핸들러가 refetch)
//   - 타임아웃 또는 실패: iOS fetch limbo (또는 PC 의 hung Supabase 커넥션)
//     으로 추정 → window.location.reload()
//
//   threshold(예: "1초 이상 hidden일 때만 probe")는 사용 안 함 — 사용자 보고로
//   0.5~1초 짧은 백그라운드에서도 limbo가 재현됨.
//
// ⚠️ refreshSession 은 여기서 호출 X — lib/supabase/client.ts 의 전역
//   visibilitychange 핸들러가 single-flight 락으로 직렬화해 처리한다. 여기서
//   다시 호출하면 같은 refresh_token 을 두 번 소비해 invalid_grant(400) 가
//   터지고 세션이 영구 무효화됨 (PC 창 최소화 → 복원 후 쿼리가 모두 죽는 버그).
//
// PC 도 동작: 기존엔 데스크톱에서 매 탭 전환마다 probe→타임아웃→리로드가 터지는
//   문제로 모바일만 활성화했었으나, probe 가 단순 HEAD 쿼리라 PC 에선 사실상
//   항상 통과 (limbo 가 발생할 때만 리로드). PC 의 hung Supabase 연결도 복구되어
//   "불러오는 중..." 무한 대기 케이스를 막는다.
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

    const client = createSupabaseBrowserClient();

    /** 가벼운 HEAD 쿼리 probe — 1.5초 안에 응답 없으면 limbo 로 간주.
     *  refreshSession 은 client.ts 의 전역 핸들러가 처리하므로 여기선 호출 X. */
    const probe = async (): Promise<boolean> => {
      let timedOut = false;
      const tid = setTimeout(() => { timedOut = true; }, PROBE_TIMEOUT_MS);
      try {
        const query = client.from("bp_user_tier").select("user_id", { count: "exact", head: true });
        const result = await Promise.race([
          query.then(() => "ok" as const),
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
