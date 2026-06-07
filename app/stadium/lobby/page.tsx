import type { Metadata } from "next";
import { LobbyScreen } from "@/components/domain/stadium/LobbyScreen";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlayoffSummary, EMPTY_PLAYOFF_SUMMARY } from "@/lib/supabase/query-parts/bpPlayoff";
import { getCachedSeasonLineupRanking } from "@/lib/supabase/query-parts/bpLineupRankings";
import {
  getCachedFullAccountStatsRanking,
  hydrateAccountStatsNicknames
} from "@/lib/supabase/query-parts/bpAccountStats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "경기장",
  description: "공개 라인업으로 매치를 진행하고 시즌 랭킹을 확인하세요.",
  alternates: { canonical: "/stadium/lobby" }
};

export default async function StadiumLobbyPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createSupabaseAdminClient();

  const [lineupTop, accountFull] = await Promise.all([
    getCachedSeasonLineupRanking(3),
    getCachedFullAccountStatsRanking()
  ]);
  const [accountTop, playoffSummary] = await Promise.all([
    hydrateAccountStatsNicknames(accountFull.slice(0, 3)),
    user ? getPlayoffSummary(admin, user.id) : Promise.resolve(EMPTY_PLAYOFF_SUMMARY)
  ]);

  return (
    <LobbyScreen
      topLineupRanking={lineupTop}
      topAccountRanking={accountTop}
      playoffSummary={playoffSummary}
    />
  );
}
