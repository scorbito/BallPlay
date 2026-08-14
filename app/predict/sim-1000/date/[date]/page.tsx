import { notFound } from "next/navigation";
import { renderSim1000, isValidSimDate } from "@/lib/predict/sim1000Render";
import { recentDateParams } from "@/lib/utils/recentDates";

// 정적/ISR — 날짜별 시뮬 리스트. 각 날짜 URL 을 CDN 이 한 벌씩 캐시.
// params.date 는 라우트 파라미터라 동적 강제하지 않는다(searchParams 와 다름).
export const revalidate = 60;

// 동적 세그먼트를 ISR 로 잡으려면 generateStaticParams 필요(없으면 ƒ 동적 → no-store).
export function generateStaticParams() {
  return recentDateParams(14);
}

export default async function Sim1000DatePage({ params }: { params: { date: string } }) {
  if (!isValidSimDate(params.date)) notFound();
  return renderSim1000(params.date);
}
