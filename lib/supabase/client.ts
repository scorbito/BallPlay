"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

// 싱글톤. 호출마다 새 클라이언트를 만들면 각 인스턴스가 동일한 auth 스토리지/락을
// 경쟁해 refreshSession/getUser가 hang하는 케이스가 있음 (특히 Next dev HMR 후).
// 모듈 스코프에 한 번만 만들어서 모든 호출이 공유.
let cached: SupabaseClient | null = null;

// navigator.locks 우회 — Supabase SDK는 토큰 refresh를 origin 단위로 직렬화하려고
// navigator.locks API를 쓰는데, 탭 닫기/네트워크 블립 중에 락이 해제 없이 영구
// 점유되는 케이스가 보고됨 (auth-js #715 등). 그러면 같은 origin의 모든 탭이
// 영원히 hang — 크롬 재시작 외엔 안 풀림.
//
// 트레이드오프: 여러 탭이 동시에 refresh 시도하면 한 쪽이 race로 실패할 수 있음.
// SDK가 자동 재시도하므로 실질 영향 미미. hang 무한 대기보다 훨씬 안전.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export function createSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const { url, anonKey } = getSupabaseBrowserEnv();
  cached = createBrowserClient(url, anonKey, {
    auth: { lock: noopLock }
  });
  return cached;
}
