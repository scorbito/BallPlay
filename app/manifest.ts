import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "야구놀이터",
    short_name: "야구놀이터",
    description: "야구 미니 게임 & 예측 콘텐츠 웹앱",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06101e",
    theme_color: "#06101e",
    lang: "ko",
    icons: [
      {
        src: "/assets/mascot-default.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/mascot-default.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
