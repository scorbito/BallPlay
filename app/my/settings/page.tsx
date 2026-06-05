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

  return <SettingsScreen accountInfo={accountInfo} isAdmin={userTier.tier === "admin"} />;
}
