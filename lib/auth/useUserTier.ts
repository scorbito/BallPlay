"use client";

// 사용자 등급 React 훅 — 컴포넌트에서 useUserTier()로 한 줄.
// auth 상태 변경 시 자동 재조회 (onAuthStateChange 구독).

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUserTier, type UserTierResult } from "./userTier";

const INITIAL: UserTierResult = { tier: "guest", user: null };

export function useUserTier(): {
  tier: UserTierResult["tier"];
  result: UserTierResult;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [result, setResult] = useState<UserTierResult>(INITIAL);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const client = createSupabaseBrowserClient();
    const next = await getUserTier(client);
    setResult(next);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const next = await getUserTier(client);
      if (!cancelled) {
        setResult(next);
        setLoading(false);
      }
    })();

    // auth 상태 변경 시 재조회 (로그인/로그아웃)
    const client = createSupabaseBrowserClient();
    const { data: sub } = client.auth.onAuthStateChange(async () => {
      if (cancelled) return;
      const next = await getUserTier(client);
      setResult(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { tier: result.tier, result, loading, refresh };
}
