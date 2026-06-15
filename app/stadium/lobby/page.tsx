import type { Metadata } from "next";
import { LobbyScreen } from "@/components/domain/stadium/LobbyScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "시뮬레이션 로비",
  description: "실제 경기 라인업과 공개 라인업을 확인하고 비교 시뮬레이션을 실행해보세요.",
  alternates: { canonical: "/stadium/lobby" }
};

export default async function StadiumLobbyPage() {
  return <LobbyScreen />;
}
