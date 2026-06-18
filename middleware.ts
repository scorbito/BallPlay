import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    // /api 는 제외 — API 라우트는 각자 auth.getUser()로 인증을 처리하므로
    // 미들웨어가 한 번 더 getUser() 하는 건 순수 낭비(요청당 함수 호출/CPU 중복).
    // 세션 쿠키 갱신은 페이지 내비게이션 시 미들웨어가 처리한다.
    "/((?!api|_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};

