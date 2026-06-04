"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

// 싱글톤. 호출마다 새 클라이언트를 만들면 각 인스턴스가 동일한 auth 스토리지/락을
// 경쟁해 refreshSession/getUser가 hang하는 케이스가 있음 (특히 Next dev HMR 후).
// 모듈 스코프에 한 번만 만들어서 모든 호출이 공유.
let cached: SupabaseClient | null = null;

// in-memory single-flight 락 — 같은 origin 내에서 토큰 refresh를 직렬화한다.
//
// 배경: 기존 noopLock은 navigator.locks의 dead-lock 위험을 피하려고 도입했지만,
// PC 브라우저 창 최소화/복원 시 여러 컴포넌트가 동시에 refreshSession()을 호출하면
// 같은 refresh_token을 두 번 소비해 한 쪽이 invalid_grant(400)으로 떨어지고
// 회전된 토큰이 영구 무효화돼 이후 모든 쿼리가 실패하는 증상을 유발했다.
//
// 해결: 모듈 스코프에 in-flight Promise를 보관해, 동일 클라이언트 인스턴스가
// 발사하는 refresh를 직렬화한다. navigator.locks가 아니라서 dead-lock도 안 남음
// (탭 닫혀도 메모리 통째로 사라짐).
let inflight: Promise<unknown> | null = null;
const inMemoryLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  while (inflight) {
    try { await inflight; } catch { /* 앞 호출 실패해도 다음 시도는 계속 */ }
  }
  const p = fn();
  inflight = p as Promise<unknown>;
  try {
    return await p;
  } finally {
    if (inflight === p) inflight = null;
  }
};

// PC 브라우저 창을 최소화하거나 탭을 백그라운드로 두면 Chrome 이 setTimeout 을
// 강하게 throttle 해서 Supabase SDK 의 자동 토큰 갱신 타이머가 만료 시점을 놓침.
// 다시 visible 됐을 때 첫 쿼리가 토큰 만료 401/400 으로 떨어지는 증상이 보고됨.
// → visibility 가 visible 로 돌아올 때마다 즉시 세션 재발급을 트리거. 살아있으면
//   SDK 내부에서 no-op, 만료된 경우에만 실제 갱신 1회. 한 origin 당 1번만 등록.
let visibilityHandlerRegistered = false;
function ensureVisibilityHandler(client: SupabaseClient) {
  if (visibilityHandlerRegistered) return;
  if (typeof document === "undefined") return;
  visibilityHandlerRegistered = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    void client.auth.refreshSession().catch(async () => {
      // refresh_token 자체가 죽었으면 (이미 회전되어 invalid_grant) 익명 세션
      // 재발급으로 폴백 — 사용자가 "불러오는 중..." 으로 멈춘 채 방치되는 걸 방지.
      // ensureAnonymousClient 의 로직을 인라인으로 — 이 파일이 그쪽을 import 하면
      // ensureAnonymousClient → ensureProfile (서버 액션) 까지 끌려와 SSR/IIFE 사이클
      // 무거워지므로 최소만 호출.
      try {
        const { data: userData } = await client.auth.getUser();
        if (!userData.user) {
          await client.auth.signInAnonymously();
        }
      } catch { /* swallow — 다음 쿼리가 SIGNED_OUT 으로 흘러감 */ }
    });
  });
}

export function createSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const { url, anonKey } = getSupabaseBrowserEnv();
  cached = createBrowserClient(url, anonKey, {
    auth: { lock: inMemoryLock }
  });
  ensureVisibilityHandler(cached);
  return cached;
}
