import type { Metadata } from "next";
import { LineupRankingScreen } from "@/components/domain/LineupRankingScreen";
import {
  getCachedSeasonLineupRanking,
  getCachedWeeklyLineupRanking
} from "@/lib/supabase/query-parts/bpLineupRankings";

// 동적 렌더 유지 — 쿼리 결과는 내부 unstable_cache(60초)로 전체 공유라 DB 부하는 낮다.
// (라우트 정적화는 내부 admin 클라가 no-store 라 빌드 때 빈 데이터로 구워질 위험이 있어 보류.
//  추후 캐시 가능 클라이언트로 바꾸면 ISR(○) 전환 가능.)
export const dynamic = "force-dynamic";

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
