import { notFound } from "next/navigation";
import {
  renderAiWinnerList,
  recentAiWinnerDates,
  isValidDate,
  AI_WINNER_REVALIDATE
} from "@/lib/predict/aiWinnerList";

// 정적/ISR — 날짜별 AI 예측 리스트. 각 날짜 URL 을 CDN 이 한 벌씩 캐시.
export const revalidate = AI_WINNER_REVALIDATE;

// 최근 예측이 있는 날짜들을 미리 생성(warm). 나머지는 on-demand 로 렌더 후 ISR 캐시.
export async function generateStaticParams() {
  const dates = await recentAiWinnerDates(30);
  return dates.map((date) => ({ date }));
}

export default async function AiWinnerDatePage({ params }: { params: { date: string } }) {
  if (!isValidDate(params.date)) notFound();
  return renderAiWinnerList(params.date);
}
