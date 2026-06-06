import { MyScreen } from "@/components/domain/MyScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAccountStats } from "@/lib/supabase/query-parts/bpAccountStats";
import { getMyTeamSummary, EMPTY_TEAM_SUMMARY } from "@/lib/supabase/query-parts/bpLineups";
import { getPlayoffSummary, EMPTY_PLAYOFF_SUMMARY } from "@/lib/supabase/query-parts/bpPlayoff";
import { getUserTier } from "@/lib/auth/userTier";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createSupabaseAdminClient();

  // 계정 누적 전적 + 등급 + 팀 요약을 한 번에 (force-dynamic).
  const [accountStats, tierResult, teamSummary, playoffSummary] = await Promise.all([
    getAccountStats(admin, user?.id),
    getUserTier(supabase),
    user ? getMyTeamSummary(admin, user.id) : Promise.resolve(EMPTY_TEAM_SUMMARY),
    user ? getPlayoffSummary(admin, user.id) : Promise.resolve(EMPTY_PLAYOFF_SUMMARY)
  ]);

  return (
    <MyScreen
      accountStats={accountStats}
      tier={tierResult.tier}
      teamSummary={teamSummary}
      playoffSummary={playoffSummary}
    />
  );
}
