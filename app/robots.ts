import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oneul-seungyo.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/robots.txt",
          "/sitemap.xml",
          "/login",
          "/my/help",
          "/my/contact",
          "/legal/terms",
          "/legal/privacy"
        ],
        disallow: [
          "/my/",               // 마이 하위 페이지 (auth 필요, 공개 도움말/문의는 allow 우선)
          "/my/notices",
          "/my/settings",
          "/onboarding",
          "/schedule",
          "/community",
          "/rankings",
          "/api/",              // API 라우트 (anon-bootstrap 포함)
          "/auth/"              // OAuth callback
        ]
      },
      {
        // 네이버 크롤러도 동일하게 적용
        userAgent: "Yeti",
        allow: [
          "/",
          "/robots.txt",
          "/sitemap.xml",
          "/login",
          "/my/help",
          "/my/contact",
          "/legal/terms",
          "/legal/privacy"
        ],
        disallow: ["/my/", "/api/", "/auth/", "/community", "/schedule", "/onboarding"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
