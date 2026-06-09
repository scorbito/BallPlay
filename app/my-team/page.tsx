import type { Metadata } from "next";
import { MyTeamScreen } from "@/components/domain/MyTeamScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "나만의 팀",
  description: "실제 KBO 선수 데이터 기반으로 나만의 야구 구단을 수집하고 육성하세요.",
  alternates: { canonical: "/my-team" }
};

export default function MyTeamPage() {
  return <MyTeamScreen />;
}
