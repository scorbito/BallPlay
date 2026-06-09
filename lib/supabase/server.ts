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
