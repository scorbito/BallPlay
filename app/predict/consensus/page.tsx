import { renderConsensus } from "@/lib/predict/consensusRender";

// 정적/ISR — 기본 진입(오늘). 날짜 지정은 /predict/consensus/date/[date] 로 분리.
// searchParams 를 읽지 않아 전체 라우트 캐시 가능(예전엔 ?date= 때문에 동적 강제됐음).
export const revalidate = 60;

export default async function ConsensusPage() {
  return renderConsensus(null);
}
