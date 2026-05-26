import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 비인증 사용자가 메인 진입 시 익명 세션을 자동 생성하기 위한 부트스트랩 경로 매칭.
// 서버 컴포넌트의 redirect() 호출이 Next.js App Router의 React #310 버그를 트리거하므로
// (https://github.com/vercel/next.js/issues/78396), 미들웨어에서 HTTP 레벨로 처리.
const ANON_BOOTSTRAP_PATHS = ["/"];

function isSearchCrawler(userAgent: string | null) {
  if (!userAgent) return false;
  return /googlebot|google-inspectiontool|bingbot|naverbot|yeti|daumoa|duckduckbot|slurp/i.test(userAgent);
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options });
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

  return response;
}
