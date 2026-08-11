import { notFound } from "next/navigation";
import { renderWinner, isValidWinnerDate } from "@/lib/predict/winnerRender";

// 정적/ISR — 날짜별 승리팀 예측. 각 날짜 URL 을 CDN 이 한 벌씩 캐시.
// params.date 는 라우트 파라미터라 동적 강제하지 않는다(searchParams 와 다름).
export const revalidate = 60;

export default async function WinnerPredictDatePage({ params }: { params: { date: string } }) {
  if (!isValidWinnerDate(params.date)) notFound();
  return renderWinner(params.date);
}
