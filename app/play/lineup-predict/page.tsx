import type { Metadata } from "next";
import { LineupPredictScreen } from "@/components/domain/lineupPredict/LineupPredictScreen";

// 정적 페이지 — 경기 목록과 내 예측은 /api/play/lineup-predict 에서 클라이언트가 받는다.
// 유저별 데이터를 서버에서 읽으면 전 페이지가 동적 렌더링으로 승격돼 CPU를 쓴다.
export const metadata: Metadata = {
  title: "오늘의 라인업 예측 - KBO 선발 라인업 맞히기",
  description:
    "오늘 경기 선발 9명과 타순을 예측해보세요. 경기가 끝나면 실제 라인업과 대조해 몇 명이나 맞혔는지 알려드립니다.",
  alternates: { canonical: "/play/lineup-predict" },
  robots: { index: false, follow: false }
};

export default function LineupPredictPage() {
  return <LineupPredictScreen />;
}
