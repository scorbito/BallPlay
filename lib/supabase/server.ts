import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv, getSupabaseServiceRoleEnv } from "@/lib/supabase/env";

export function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot set cookies. Middleware handles session refresh.
        }
      },
      remove(name: string, options) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Server Components cannot set cookies. Middleware handles session refresh.
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" })
    }
  });
}

// 정적/ISR 렌더 전용 Supabase 클라이언트.
// - cookies() 를 읽지 않음 → 라우트가 동적으로 강제되지 않아 전체 라우트 캐시(ISR) 가능.
// - service_role 키로 RLS 우회 → 페이지 코드가 기대하는 행을 그대로 읽음(공개 게이트는 페이지에서 적용).
// - fetch 에 next.revalidate 를 주입해 Supabase GET 응답을 revalidate 초 동안 데이터 캐시.
// 주의: 이 클라이언트로 읽은 데이터는 공개 캐시에 들어가므로, 호출 페이지는 반드시
//       "발행된(공개) 콘텐츠만" 렌더해야 한다(미발행/유저별 데이터 렌더 금지).
export function createSupabaseCacheClient(revalidateSeconds: number) {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: (input, options) =>
        fetch(input, { ...options, next: { revalidate: revalidateSeconds } })
    }
  });
}
