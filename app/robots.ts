import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballnori.com";

// 정책: 공개 메뉴는 모두 색인 허용, 인증/내부 라우트만 차단.
//   - allow "/"로 기본 전면 허용 → disallow 에서 사적 영역만 명시.
//   - /my/ 하위 중 공개 정적 페이지(help/contact)는 allow 로 disallow 를 덮어씀.
//   - /schedule, /rankings, /predict/*, /news, /videos, /play/*, /stadium/*, /records 는
//     자연히 "/" 아래라 별도 명시 없이 허용됨.
const PUBLIC_ALLOW = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/my/help",
  "/my/contact"
];
const PRIVATE_DISALLOW = [
  "/my/",          // 마이 하위(설정·공지 등 개인 영역). help/contact 는 allow 우선.
  "/onboarding",   // 로그인 직후 단발성 동선
  "/community",    // 미사용
  "/api/",         // 모든 API 라우트
  "/auth/"         // OAuth 콜백
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: PUBLIC_ALLOW, disallow: PRIVATE_DISALLOW },
      // 네이버 크롤러 (Yeti)도 동일 정책.
      { userAgent: "Yeti", allow: PUBLIC_ALLOW, disallow: PRIVATE_DISALLOW }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
