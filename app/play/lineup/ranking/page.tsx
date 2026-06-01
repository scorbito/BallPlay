import type { Metadata } from "next";
import { LineupRankingScreen } from "@/components/domain/LineupRankingScreen";
import {
  listSeasonLineupRanking,
  listWeeklyLineupRanking
} from "@/lib/supabase/query-parts/bpLineupRankings";

// 공개 매치 결과가 누적되는 동안 자주 갱신되므로 짧은 ISR.
// 5분 캐시 → 사용자 부담 적고, 결과 직후 즉시 반영 안 돼도 OK.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "라인업 랭킹",
  description: "공개 매치 전적으로 매기는 KBO 라인업 시즌/주간 랭킹.",
  alternates: { canonical: "/play/lineup/ranking" }
};

export default async function LineupRankingPage() {
  const [seasonRanking, weeklyRanking] = await Promise.all([
    listSeasonLineupRanking(100),
    listWeeklyLineupRanking(100)
  ]);

  return <LineupRankingScreen seasonRanking={seasonRanking} weeklyRanking={weeklyRanking} />;
}
