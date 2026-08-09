import type { Metadata } from "next";
import { FaceMatchScreen } from "@/components/domain/face/FaceMatchScreen";

// 정적 페이지 — 얼굴 분석과 비교가 모두 클라이언트에서 끝나 서버 조회가 없다.
// headers()/cookies() 도 쓰지 않으므로 동적 렌더링으로 승격되지 않는다.
export const metadata: Metadata = {
  title: "나와 닮은 선수는? - KBO 선수 닮은꼴 찾기",
  description:
    "사진을 올리면 얼굴이 가장 닮은 KBO 1군 선수를 찾아드립니다. 사진은 기기 안에서만 분석되며 서버로 전송되지 않습니다.",
  alternates: { canonical: "/play/face" },
  robots: { index: false, follow: false }
};

export default function FaceMatchPage() {
  return <FaceMatchScreen />;
}
