import { renderAiWinnerList, AI_WINNER_REVALIDATE } from "@/lib/predict/aiWinnerList";

// 정적/ISR — 기본 진입(최신 경기). 날짜 지정은 /predict/ai-winner/date/[date] 로 분리.
// user/auth 를 읽지 않아 전체 라우트 캐시 가능.
export const revalidate = AI_WINNER_REVALIDATE;

export default async function AiWinnerPredictPage() {
  return renderAiWinnerList(null);
}
