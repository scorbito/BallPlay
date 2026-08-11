import { notFound } from "next/navigation";
import { renderConsensus, isValidConsensusDate } from "@/lib/predict/consensusRender";

// 정적/ISR — 날짜별 종합분석. 각 날짜 URL 을 CDN 이 한 벌씩 캐시.
// params.date 는 라우트 파라미터라 동적 강제하지 않는다(searchParams 와 다름).
export const revalidate = 60;

export default async function ConsensusDatePage({ params }: { params: { date: string } }) {
  if (!isValidConsensusDate(params.date)) notFound();
  return renderConsensus(params.date);
}
