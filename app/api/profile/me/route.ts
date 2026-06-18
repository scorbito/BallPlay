import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfileFromDb } from "@/lib/supabase/queries";
import { getUserTierByIdentity } from "@/lib/auth/userTier";

// 클라이언트(AppStateProvider)가 마운트 후 호출해 현재 user 프로필/익명여부를 받는다.
// 루트 레이아웃에서 서버측 headers()/getUser() 를 없애 전 페이지가 정적/ISR 캐시 가능해지도록,
// user 의존 데이터는 이 동적 API 로 분리한다. (미들웨어는 /api 제외라 여기서 자체 auth.)
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { profile: null, isAnonymous: false, isAdmin: false, authenticated: false },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const [profile, tier] = await Promise.all([
    getCurrentProfileFromDb(user.id).catch(() => null),
    getUserTierByIdentity(supabase, { userId: user.id, isAnonymous: Boolean(user.is_anonymous) }).catch(() => null)
  ]);

  return NextResponse.json(
    {
      profile,
      isAnonymous: Boolean(user.is_anonymous),
      isAdmin: tier?.tier === "admin",
      authenticated: true
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
