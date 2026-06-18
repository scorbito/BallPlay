import { notFound } from "next/navigation";
import {
  renderBattleList,
  recentBattleDates,
  isValidDate,
  BATTLE_REVALIDATE
} from "@/lib/predict/battleList";

// 정적/ISR — 날짜별 배틀 리스트. 각 날짜 URL 을 CDN 이 한 벌씩 캐시.
export const revalidate = BATTLE_REVALIDATE;

export async function generateStaticParams() {
  const dates = await recentBattleDates(30);
  return dates.map((date) => ({ date }));
}

export default async function AiBattleDatePage({ params }: { params: { date: string } }) {
  if (!isValidDate(params.date)) notFound();
  return renderBattleList(params.date);
}
