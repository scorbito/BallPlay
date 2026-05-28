import type { Metadata } from "next";
import { LobbyScreen } from "@/components/domain/stadium/LobbyScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "경기장",
  description: "내가 짠 라인업으로 가상 경기를 돌리고 결과를 확인해보세요.",
  alternates: { canonical: "/stadium/lobby" }
};

export default function StadiumLobbyPage() {
  return <LobbyScreen />;
}
