import { HomeScreen } from "@/components/domain/HomeScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 미들웨어가 이미 검증한 식별자를 헤더로 받아 재사용 → 페이지에서 auth.getUser() 재호출 안 함.
  // 비로그인(방문자 다수)은 Supabase 호출 0회로 렌더 — tier 조회도 로그인 사용자만.
  const identity = getRequestIdentity();
  const isAdmin = identity.userId
    ? (await getUserTierByIdentity(createSupabaseServerClient(), identity)).tier === "admin"
    : false;

  return (
    <HomeScreen
      isAnonymous={identity.isAnonymous}
      isAdmin={isAdmin}
    />
  );
}
