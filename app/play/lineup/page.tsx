import type { Metadata } from "next";
import { LineupBuilderScreen } from "@/components/domain/LineupBuilderScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "라인업 짜기",
  description: "KBO 10개 구단 선수로 나만의 최강 타순을 직접 구성해보세요.",
  alternates: { canonical: "/play/lineup" }
};

export default function LineupPage() {
  return <LineupBuilderScreen />;
}
