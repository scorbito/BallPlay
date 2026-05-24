"use client";

// 모바일 백그라운드 → 포그라운드 복귀 시 Supabase 세션을 강제 갱신.
// 백그라운드 동안 JS 타이머가 throttle 되어 토큰 auto-refresh가 못 돌아가
// 만료된 토큰으로 API 호출 → 401 발생. 이걸 한 곳에서 일괄 방지.
//
// 추가로 watchdog 기능 — 30초+ 백그라운드 후 복귀했는데 refresh가 5초 안에
// 응답 안 하면 iOS Safari가 fetch를 limbo로 묶었다는 신호. window.location.reload()로
// 강제 복구 (사용자가 동기화 아이콘만 무한히 보는 상황 방지).
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils/withTimeout";

const LONG_HIDDEN_MS = 30_000;    // 이만큼 배경에 있다가 돌아오면 watchdog 발동
const REFRESH_TIMEOUT_MS = 5_000; // refresh가 이 시간 안에 안 끝나면 hang으로 간주

export function AuthRefreshOnVisible() {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const client = createSupabaseBrowserClient();

    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      const hiddenFor = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      const longHidden = hiddenFor >= LONG_HIDDEN_MS;

      void (async () => {
        try {
          await withTimeout(client.auth.refreshSession(), REFRESH_TIMEOUT_MS);
          // 정상 — 다른 화면들의 visibility 핸들러가 알아서 refetch
        } catch {
          // 타임아웃 또는 실패. 짧게 백그라운드였으면 그냥 무시 (다음 fetch에서 SDK 재시도).
          // 오래(30초+) 백그라운드였으면 iOS limbo 가능성 높음 → 페이지 리로드로 완전 복구.
          if (longHidden && typeof window !== "undefined") {
            window.location.reload();
          }
        }
      })();
    };

    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return null;
}
