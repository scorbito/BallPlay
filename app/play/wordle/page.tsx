import type { Metadata } from "next";
import { WordleScreen } from "@/components/domain/wordle/WordleScreen";

// 정적 페이지 — 정답 계산과 진행 상태가 모두 클라이언트에 있어서 서버 조회가 없다.
// headers()/cookies() 도 쓰지 않으므로 동적 렌더링으로 승격되지 않는다.
export const metadata: Metadata = {
  title: "선수들 - 선수 이름 맞히기",
  description:
    "하루 한 명, 여섯 번의 기회. KBO 현역 선수 이름을 맞히는 야구놀이터 데일리 퍼즐.",
  alternates: { canonical: "/play/wordle" }
};

export default function WordlePage() {
  return <WordleScreen />;
}
