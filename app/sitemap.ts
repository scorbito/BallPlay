import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballnori.com";

// 공개 크롤링 가능한 페이지만 sitemap에 포함.
//   - 메인("/")은 진입점(priority 1).
//   - 공개 게임/콘텐츠 메뉴(라인업/경기장/예측/뉴스/일정/순위/영상/기록)는 priority 0.6~0.9.
//   - 보조 페이지(로그인/도움말/문의/약관)는 priority 0.3~0.6.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },

    // 공개 게임 메뉴
    { url: `${SITE_URL}/play/lineup`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/play/lineup/ranking`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/play/wordle`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/stadium/lobby`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/predict/winner`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/predict/ranking`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/records`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },

    // 공개 콘텐츠 메뉴 (정보성, KBO 검색 노출 강화)
    { url: `${SITE_URL}/news`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/schedule`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/rankings`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/videos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },

    // 보조 페이지
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/my/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/my/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 }
  ];
}
