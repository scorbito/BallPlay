import type { Metadata } from "next";
import { WordleScreen } from "@/components/domain/wordle/WordleScreen";

// 정적 페이지 — 정답 계산과 진행 상태가 모두 클라이언트에 있어서 서버 조회가 없다.
// headers()/cookies() 도 쓰지 않으므로 동적 렌더링으로 승격되지 않는다.
// 표시명은 설명형("선수 맞히기")으로 두고, 검색 유입용 "워들"은 메타데이터에만 넣는다.
// 화면에서는 누구나 바로 이해하고, "야구 워들" 같은 검색으로도 닿을 수 있게 하는 분리.
export const metadata: Metadata = {
  title: "선수 맞히기 - KBO 선수 워들",
  description:
    "하루 한 명, 여섯 번의 기회. KBO 현역 선수 이름을 맞히는 야구 워들 데일리 퍼즐. 매일 자정에 새 문제가 열립니다.",
  alternates: { canonical: "/play/wordle" }
};

export default function WordlePage() {
  return <WordleScreen />;
}
