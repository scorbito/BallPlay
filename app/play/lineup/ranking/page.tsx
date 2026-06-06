import type { Metadata } from "next";
import { LineupRankingScreen } from "@/components/domain/LineupRankingScreen";
import {
  getCachedSeasonLineupRanking,
  getCachedWeeklyLineupRanking
} from "@/lib/supabase/query-parts/bpLineupRankings";

// 공개 매치 결과가 누적되는 동안 자주 갱신되므로 짧은 ISR.
// 라우트 차원의 revalidate 와 별개로, 실제 쿼리 결과는 unstable_cache(60초)로
// 사용자 전체가 공유한다. 본인 user_id 종속 로직이 라인업 랭킹엔 없음 → 단순 캐시 OK.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "출전팀 랭킹",
  description: "공식 경기 전적으로 매기는 KBO 팀 시즌/주간 랭킹.",
  alternates: { canonical: "/play/lineup/ranking" }
};

export default async function LineupRankingPage() {
  const [seasonRanking, weeklyRanking] = await Promise.all([
    getCachedSeasonLineupRanking(100),
    getCachedWeeklyLineupRanking(100)
  ]);

  return <LineupRankingScreen seasonRanking={seasonRanking} weeklyRanking={weeklyRanking} />;
}
