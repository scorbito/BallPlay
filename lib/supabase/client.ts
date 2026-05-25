"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

// 싱글톤. 호출마다 새 클라이언트를 만들면 각 인스턴스가 동일한 auth 스토리지/락을
// 경쟁해 refreshSession/getUser가 hang하는 케이스가 있음 (특히 Next dev HMR 후).
// 모듈 스코프에 한 번만 만들어서 모든 호출이 공유.
let cached: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const { url, anonKey } = getSupabaseBrowserEnv();
  cached = createBrowserClient(url, anonKey);
  return cached;
}
