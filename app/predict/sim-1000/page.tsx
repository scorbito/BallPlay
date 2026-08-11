import { renderSim1000 } from "@/lib/predict/sim1000Render";

// 정적/ISR — 기본 진입(최신 시뮬 날짜). 날짜 지정은 /predict/sim-1000/date/[date] 로 분리.
// searchParams 를 읽지 않아 전체 라우트 캐시 가능(예전엔 ?date= 때문에 동적 강제됐음).
export const revalidate = 60;

export default async function Sim1000ListPage() {
  return renderSim1000(null);
}
