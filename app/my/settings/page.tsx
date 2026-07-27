import { SettingsScreen } from "@/components/domain/SettingsScreen";
import { getUserTier } from "@/lib/auth/userTier";
import { getCurrentAuthAccountInfo } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const [accountInfo, userTier] = await Promise.all([
    getCurrentAuthAccountInfo().catch(() => null),
    getUserTier(supabase).catch(() => ({ tier: "guest" as const, user: null }))
  ]);

  // 안 본 쿠폰 수 — 설정 "내 쿠폰함" 줄의 NEW 배지용 (로그인 계정만).
  let couponUnseen = 0;
  const user = userTier.user;
  if (user && !user.is_anonymous) {
    const { count } = await supabase
      .from("bp_coupons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("viewed_at", null);
    couponUnseen = count ?? 0;
  }

  return (
    <SettingsScreen
      accountInfo={accountInfo}
      isAdmin={userTier.tier === "admin"}
      couponUnseen={couponUnseen}
    />
  );
}
