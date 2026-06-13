import { HomeScreen } from "@/components/domain/HomeScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAccountStats } from "@/lib/supabase/query-parts/bpAccountStats";
import { getHomePointAvailability } from "@/lib/server/homePointAvailability";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  const [record, pointAvailability] = await Promise.all([
    user
      ? getAccountStats(adminClient, user.id)
      : Promise.resolve({ wins: 0, losses: 0, total: 0, winRate: 0 }),
    user
      ? getHomePointAvailability(user.id, adminClient, user.created_at)
      : Promise.resolve({})
  ]);
  const isAnonymous = Boolean(user?.is_anonymous);

  return (
    <HomeScreen
      user={user}
      userRecord={record}
      isAnonymous={isAnonymous}
      initialPointAvailability={pointAvailability}
    />
  );
}
