import type { Metadata } from "next";
import { RecordsScreen } from "@/components/domain/RecordsScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 기록",
  description: "야구놀이터에서 짠 라인업과 예측 기록을 한눈에 확인하세요.",
  alternates: { canonical: "/records" }
};

export default function RecordsPage() {
  return <RecordsScreen />;
}
