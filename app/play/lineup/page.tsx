import type { Metadata } from "next";
import { LineupBuilderScreen } from "@/components/domain/LineupBuilderScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "라인업 분석",
  description: "프로야구 팀 라인업을 구성하고 분석해보세요.",
  alternates: { canonical: "/play/lineup" }
};

export default function LineupPage() {
  return <LineupBuilderScreen />;
}
