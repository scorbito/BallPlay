import { renderWinner } from "@/lib/predict/winnerRender";

// 정적/ISR — 기본 진입(오늘, 경기 없으면 다음 경기일). 날짜 지정은 /predict/winner/date/[date] 로 분리.
// 유저별(내 픽·통계)은 클라에서 /api/predict/winner/my 로 하이드레이션 → 전체 라우트 캐시 가능.
// (예전엔 auth.getUser + searchParams 때문에 매 요청 동적 렌더였음 — 최다 트래픽 CPU 스파이크의 핵심.)
export const revalidate = 60;

export default async function WinnerPredictPage() {
  return renderWinner(null);
}
