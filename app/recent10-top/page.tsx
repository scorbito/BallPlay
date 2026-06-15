import type { Metadata } from "next";
import { Recent10TopScreen } from "@/components/domain/Recent10TopScreen";
import { getRecent10SnapshotDate, getRecent10TopPlayers } from "@/lib/recent10/topPlayers";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "최근 10경기 TOP",
  description: "KBO 선수들의 최근 10경기 타율, 홈런, OPS, 도루, 평균자책, 탈삼진 TOP 랭킹입니다.",
  alternates: { canonical: "/recent10-top" }
};

export default async function Recent10TopPage() {
  const [initialByCategory, snapshotDate] = await Promise.all([
    getRecent10TopPlayers(10),
    getRecent10SnapshotDate()
  ]);
  return (
    <Recent10TopScreen
      initialByCategory={initialByCategory}
      snapshotDate={snapshotDate}
    />
  );
}
