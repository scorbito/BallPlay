import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/actions/ensureProfile";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next");
  const isUpgrade = searchParams.get("upgrade") === "1";

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 익명 → 정식 전환 후엔 홈으로 + 성공 토스트
  if (isUpgrade) {
    return NextResponse.redirect(`${origin}/?notice=upgraded`);
  }

  // 온보딩 스킵 — profile row 없으면 디폴트로 자동 생성하고 홈으로
  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user) {
    await ensureProfile(authData.user.id).catch(() => {});
  }
  return NextResponse.redirect(`${origin}/`);
}
