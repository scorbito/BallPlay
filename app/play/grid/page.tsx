import type { Metadata } from "next";
import { GridScreen } from "@/components/domain/grid/GridScreen";

export const metadata: Metadata = {
  title: "퍼펙트 그리드 - KBO 이매큘럿 그리드",
  description: "두 팀에서 모두 뛴 KBO 선수를 찾아 9칸을 채우세요. 하루 한 판, 9번의 기회.",
  alternates: { canonical: "/play/grid" },
  robots: { index: false, follow: false }
};

export default function GridPage() {
  return <GridScreen />;
}
