import type { Metadata } from "next";
import { VideosScreen } from "@/components/domain/VideosScreen";

export const metadata: Metadata = {
  title: "야구 영상",
  description: "KBO 프로야구 하이라이트와 추천 영상을 모아봅니다.",
  alternates: { canonical: "/videos" }
};

export default function VideosPage() {
  return <VideosScreen />;
}
