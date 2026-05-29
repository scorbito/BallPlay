import { HomeScreen } from "@/components/domain/HomeScreen";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 홈 진입 시 일일 데이터 sync 트리거. throttle 로 보호되므로 매 요청 부담 없음.
  // cascade: 오늘 모든 게임 finished 면 라인업/순위/AI 채점도 자동 트리거.
  void triggerDailyDataSync();
  return <HomeScreen />;
}
