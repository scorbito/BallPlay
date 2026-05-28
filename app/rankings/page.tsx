import type { Metadata } from "next";
import { RankingsScreen } from "@/components/domain/RankingsScreen";
import { listStandingsFromDb } from "@/lib/supabase/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "팀 순위",
  description: "KBO 프로야구 10개 구단 실시간 팀 순위와 승률을 확인하세요.",
  alternates: { canonical: "/rankings" }
};

export default async function RankingsPage() {
  const standings = await listStandingsFromDb(new Date().getFullYear()).catch(() => []);

  return <RankingsScreen standings={standings} />;
}
