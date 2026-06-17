import { HomeScreen } from "@/components/domain/HomeScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAccountStats } from "@/lib/supabase/query-parts/bpAccountStats";
import { getUserTier } from "@/lib/auth/userTier";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userTier = await getUserTier(supabase);
  const adminClient = createSupabaseAdminClient();
  const record = user
    ? await getAccountStats(adminClient, user.id)
    : { wins: 0, losses: 0, total: 0, winRate: 0 };
  const isAnonymous = Boolean(user?.is_anonymous);

  return (
    <HomeScreen
      user={user}
      userRecord={record}
      isAnonymous={isAnonymous}
      isAdmin={userTier.tier === "admin"}
    />
  );
}
