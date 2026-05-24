"use client";

// 모바일 백그라운드 → 포그라운드 복귀 시 Supabase 세션을 강제 갱신.
// 백그라운드 동안 JS 타이머가 throttle 되어 토큰 auto-refresh가 못 돌아가
// 만료된 토큰으로 API 호출 → 401 발생. 이걸 한 곳에서 일괄 방지.
//
// app/layout.tsx에 1회 마운트. UI 렌더 없음.

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthRefreshOnVisible() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const client = createSupabaseBrowserClient();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void client.auth.refreshSession().catch(() => {
        // refresh 실패해도 무시 — 다음 명시적 액션에서 실패 처리될 것
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
