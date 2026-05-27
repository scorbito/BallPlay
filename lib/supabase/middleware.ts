import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 미들웨어가 검증한 user 정보를 서버 컴포넌트로 전달하는 헤더.
// layout.tsx가 이 헤더를 읽어 중복 auth.getUser() 네트워크 왕복을 제거.
// 클라이언트가 위조 못 하도록 미들웨어에서 항상 delete 후 set.
const HEADER_USER_ID = "x-bp-user-id";
const HEADER_IS_ANON = "x-bp-is-anon";

// 비인증 사용자가 메인 진입 시 익명 세션을 자동 생성하기 위한 부트스트랩 경로 매칭.
// 서버 컴포넌트의 redirect() 호출이 Next.js App Router의 React #310 버그를 트리거하므로
// (https://github.com/vercel/next.js/issues/78396), 미들웨어에서 HTTP 레벨로 처리.
const ANON_BOOTSTRAP_PATHS = ["/"];

function isSearchCrawler(userAgent: string | null) {
  if (!userAgent) return false;
  return /googlebot|google-inspectiontool|bingbot|naverbot|yeti|daumoa|duckduckbot|slurp/i.test(userAgent);
}

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

  // 비인증 사용자가 메인 진입 시 익명 세션 부트스트랩 라우트로 보낸다.
  // 부트스트랩이 익명 가입 + 기본 프로필 생성 후 다시 "/"(혹은 next)로 복귀시키므로,
  // 사용자는 랜딩 페이지 없이 곧장 메인으로 진입하게 됨.
  if (
    !data?.user &&
    ANON_BOOTSTRAP_PATHS.includes(request.nextUrl.pathname) &&
    !isSearchCrawler(request.headers.get("user-agent"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/api/anon-bootstrap";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

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
