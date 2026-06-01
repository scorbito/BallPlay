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
const ANON_BOOTSTRAP_PREFIXES = [
  "/",
  "/play",
  "/predict",
  "/rankings",
  "/records",
  "/stadium"
];

function shouldBootstrapAnonymous(pathname: string): boolean {
  return ANON_BOOTSTRAP_PREFIXES.some((prefix) => {
    if (prefix === "/") return pathname === "/";
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

// 익명 세션을 발급하면 안 되는 자동화 클라이언트 판별.
// 봇은 쿠키를 저장하지 않아 매 요청마다 새 익명 계정을 만들어 DB를 부풀린다.
// 세 부류를 모두 차단한다:
//   1) 검색 크롤러 (Googlebot, naverbot 등)
//   2) SNS 링크 미리보기 봇 (카톡/페북/X/슬랙 등) — 링크 공유 시 동시 다발 호출
//   3) 그 외 일반 봇/스크래퍼 (bot/crawler/spider/scraper 키워드 폴백)
// UA가 비어있는 요청도 정상 브라우저가 아니므로 봇으로 간주한다.
function isBot(userAgent: string | null) {
  if (!userAgent) return true;
  return /googlebot|google-inspectiontool|bingbot|naverbot|yeti|daumoa|duckduckbot|slurp|applebot|petalbot|ahrefsbot|semrushbot|mj12bot|dotbot|bytespider|gptbot|claudebot|kakaotalk-scrap|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|redditbot|skypeuripreview|embedly|bot\b|crawler|spider|scraper|crawl/i.test(
    userAgent
  );
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
    shouldBootstrapAnonymous(request.nextUrl.pathname) &&
    !isBot(request.headers.get("user-agent"))
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
