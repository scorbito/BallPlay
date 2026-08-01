import { loadConsensusPageData } from "@/lib/predict/consensus";
import { ConsensusScreen } from "@/components/domain/ConsensusScreen";

// 종합분석&예측 — 3개 AI 픽 + 불펜/폼 데이터 취합 화면. (기존 1000판 시뮬 메뉴 자리 대체)
// sim-1000 과 동일하게 searchParams 날짜 이동 방식 → 동적 렌더.
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ConsensusPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const today = kstToday();
  const selectedDate =
    searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : today;

  const data = await loadConsensusPageData(selectedDate);

  // 단순 전일/익일 이동 — 경기 없는 날은 화면에서 "경기 없음" 표시.
  const prevDate = addDays(selectedDate, -1);
  const nextDate = selectedDate < today ? addDays(selectedDate, 1) : null;

  return (
    <ConsensusScreen
      data={data}
      prevDate={prevDate}
      nextDate={nextDate}
      isToday={selectedDate === today}
    />
  );
}
