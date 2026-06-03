import type { Metadata } from "next";
import { PracticeStadiumScreen } from "@/components/domain/PracticeStadiumScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "연습경기장",
  description: "친구 매치, 내 라인업 대결, AI 대결을 한 곳에서.",
  alternates: { canonical: "/play/practice" }
};

export default function PracticeStadiumPage() {
  return <PracticeStadiumScreen />;
}
