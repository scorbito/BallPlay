import type { Metadata } from "next";
import { RankingsScreen } from "@/components/domain/RankingsScreen";
import { listStandingsFromDb } from "@/lib/supabase/queries";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "팀 순위",
  description: "KBO 프로야구 10개 구단 실시간 팀 순위와 승률을 확인하세요.",
  alternates: { canonical: "/rankings" }
};

export default async function RankingsPage() {
  // 5분 ISR. 캐시 만료 시점에 sync 트리거 → 다음 방문자가 최신 순위.
  void triggerDailyDataSync();
  const standings = await listStandingsFromDb(new Date().getFullYear()).catch(() => []);

  return <RankingsScreen standings={standings} />;
}
