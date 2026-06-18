import { HomeScreen } from "@/components/domain/HomeScreen";

// 정적(○) — 홈은 누구에게나 동일한 메뉴 셸. 서버에서 user/auth 를 읽지 않는다.
// 운영자 전용 카드 등 user 의존 분기는 HomeScreen 이 AppState(클라이언트 로드)에서 처리.
export default function HomePage() {
  return <HomeScreen />;
}
