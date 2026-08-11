// 종합분석 렌더 — base(오늘)와 /date/[date] 가 공유.
//
// 예전엔 page 가 searchParams.date 를 읽어서 라우트가 동적 강제(no-store)됐다.
// 3사 AI 취합 데이터는 유저 무관 공개 데이터라, 날짜를 경로 파라미터로 분리하고
// 여기서 렌더를 공유하면 base·각 날짜 URL 이 모두 ISR(전체 라우트 캐시)로 잡힌다.

import { loadConsensusPageData } from "@/lib/predict/consensus";
import { ConsensusScreen } from "@/components/domain/ConsensusScreen";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidConsensusDate(d: string): boolean {
  return DATE_RE.test(d);
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** dateISO=null 이면 오늘을 보여준다. */
export async function renderConsensus(dateISO: string | null) {
  const today = kstToday();
  const selectedDate = dateISO ?? today;

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
