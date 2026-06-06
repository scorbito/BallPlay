import type { Metadata } from "next";
import { LobbyScreen } from "@/components/domain/stadium/LobbyScreen";
import { getCachedSeasonLineupRanking } from "@/lib/supabase/query-parts/bpLineupRankings";
import {
  getCachedFullAccountStatsRanking,
  hydrateAccountStatsNicknames
} from "@/lib/supabase/query-parts/bpAccountStats";

// 랭킹 TOP3 위젯이 60초 캐시 데이터를 쓰므로 ISR(60s)로 전환.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "경기장",
  description: "공개 라인업으로 매치를 진행하고 시즌 랭킹을 확인하세요.",
  alternates: { canonical: "/stadium/lobby" }
};

export default async function StadiumLobbyPage() {
  const [lineupTop, accountFull] = await Promise.all([
    getCachedSeasonLineupRanking(3),
    getCachedFullAccountStatsRanking()
  ]);
  const accountTop = await hydrateAccountStatsNicknames(accountFull.slice(0, 3));

  return <LobbyScreen topLineupRanking={lineupTop} topAccountRanking={accountTop} />;
}
