import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 미들웨어가 검증한 user 정보를 서버 컴포넌트로 전달하는 헤더.
// layout.tsx가 이 헤더를 읽어 중복 auth.getUser() 네트워크 왕복을 제거.
// 클라이언트가 위조 못 하도록 미들웨어에서 항상 delete 후 set.
const HEADER_USER_ID = "x-bp-user-id";
const HEADER_IS_ANON = "x-bp-is-anon";

export async function updateSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  // 들어온 요청에 위조된 x-bp-* 헤더 있으면 제거 (보안). getUser 검증 후 다시 set.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(HEADER_USER_ID);
  requestHeaders.delete(HEADER_IS_ANON);

  // 세션 갱신(getUser)이 set/remove 쿠키를 발생시킬 수 있음 → 모아뒀다가 최종 response에 적용.
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        pendingCookies.push({ name, value, options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        pendingCookies.push({ name, value: "", options });
      }
    }
  });

  const { data } = await supabase.auth.getUser();

  // 익명 세션 자동 부트스트랩 제거(2026-06-02).
  // 이전에는 비인증 사용자가 진입만 해도 /api/anon-bootstrap으로 보내 익명 계정을 만들었으나,
  // 봇(링크 프리뷰·크롤러)까지 매 요청마다 계정을 양산해 DB가 부풀고 방문자 측정이 왜곡됐다.
  // → "보기" 컨텐츠는 비로그인으로 열람하고, 익명 계정은 실제 행동(저장/입장/제출) 시점에
  //   ensureAnonymousSession()으로 lazy 생성한다. 여기선 기존 세션이 있으면 갱신만 한다.

  // 검증된 user 정보를 헤더로 주입 → 서버 컴포넌트(layout)가 getUser 재호출 없이 사용.
  if (data?.user) {
    requestHeaders.set(HEADER_USER_ID, data.user.id);
    requestHeaders.set(HEADER_IS_ANON, data.user.is_anonymous ? "1" : "0");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const c of pendingCookies) {
    response.cookies.set(c.name, c.value, c.options);
  }
  return response;
}
