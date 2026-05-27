import { Suspense } from "react";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { InstallAppBanner } from "@/components/domain/InstallAppBanner";
import { AuthRefreshOnVisible } from "@/components/common/AuthRefreshOnVisible";
import { AppStateLoader } from "./app-state-loader";
import "./globals.css";
import "@/styles/light-home.css";
import "@/styles/light-auth-onboarding.css";
import "@/styles/light-components-schedule.css";
import "@/styles/light-rank-detail.css";
import "@/styles/community.css";
import "@/styles/profile-ticket.css";
import "@/styles/modals-core-review.css";
import "@/styles/modals-share-actions.css";
import "@/styles/dark-core-home.css";
import "@/styles/dark-home-more.css";
import "@/styles/dark-schedule.css";
import "@/styles/dark-community.css";
import "@/styles/dark-review-modal.css";
import "@/styles/dark-attendance-modal.css";
import "@/styles/dark-my.css";
import "@/styles/dark-series-attendance.css";
import "@/styles/dark-detail-modals.css";
import "@/styles/dark-share.css";
import "@/styles/dark-review-detail.css";
import "@/styles/dark-match-talk.css";
import "@/styles/dark-match-talk-timeline.css";
import "@/styles/dark-friends-settings.css";
import "@/styles/dark-onboarding.css";
import "@/styles/dark-login.css";
import "@/styles/dark-ranking-anonymous.css";
import "@/styles/dark-notices-help.css";
import "@/styles/dark-contact-settings.css";
import "@/styles/interactions-loading.css";
import "@/styles/live-result.css";
import "@/styles/dark-install.css";
import "@/styles/dark-profile-popover.css";
import "@/styles/dark-season-level.css";
import "@/styles/dark-lineup.css";
import "@/styles/dark-stadium.css";
import "@/styles/dark-records.css";
import "@/styles/dark-lineup-detail.css";
import "@/styles/dark-videos.css";
import "@/styles/dark-predict.css";
import "@/styles/light-bp-core.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballnori.com";
const SITE_TITLE = "야구놀이터";
const SITE_DESCRIPTION = "야구놀이터에서 승리팀 예측, 라인업 짜기 등 야구 미니 게임을 가볍게 즐겨보세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TITLE} - 야구 미니 게임 & 예측`,
    template: `%s | ${SITE_TITLE}`
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "야구놀이터",
    "ballplay",
    "KBO 예측",
    "승리팀 예측",
    "야구 라인업",
    "야구 미니게임",
    "프로야구 놀이"
  ],
  authors: [{ name: "야구놀이터" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_TITLE,
    statusBarStyle: "black-translucent"
  },
  // apple-mobile-web-app-capable의 표준 후속 태그 — Chrome/Edge 콘솔 경고 해소.
  other: {
    "mobile-web-app-capable": "yes"
  },
  icons: {
    icon: "/assets/mascot-default.png",
    apple: { url: "/assets/mascot-default.png", sizes: "180x180", type: "image/png" }
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: `${SITE_TITLE} - 야구 미니 게임 & 예측`,
    description: SITE_DESCRIPTION
    // images는 app/opengraph-image.tsx가 자동 제공 (1200x630 PNG 동적 생성)
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_TITLE} - 야구 미니 게임 & 예측`,
    description: SITE_DESCRIPTION
    // images는 app/twitter-image.tsx가 자동 제공
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06101e"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  noStore();

  // 미들웨어가 이미 getUser()로 검증하고 헤더로 user 정보를 넘겨줌 → 여기서 재호출 안 함.
  // (auth.getUser()는 Supabase Auth 서버 네트워크 왕복이라 페이지마다 비용 큼)
  // 헤더 없을 때만(미들웨어 미경유 등 예외) fallback으로 getUser 1회.
  const hdrs = headers();
  const headerUserId = hdrs.get("x-bp-user-id");
  const headerIsAnon = hdrs.get("x-bp-is-anon");

  let userId: string | null;
  let isAnonymous: boolean;
  if (headerUserId !== null || headerIsAnon !== null) {
    userId = headerUserId && headerUserId.length > 0 ? headerUserId : null;
    isAnonymous = headerIsAnon === "1";
  } else {
    const ssr = createSupabaseServerClient();
    const { data: authData } = await ssr.auth.getUser();
    userId = authData?.user?.id ?? null;
    isAnonymous = Boolean(authData?.user?.is_anonymous);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="ko">
      <head>
        {supabaseUrl ? (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        ) : null}
        {/* 스플래시 마스코트는 첫 페인트 직후 보여야 해서 highest priority preload */}
        <link rel="preload" as="image" href="/assets/mascot-cheer.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/assets/stadium-hero-vertical.png" fetchPriority="high" />
      </head>
      <body>
        <div className="initial-loader" aria-hidden="true">
          <div className="initial-loader-mascot-wrap">
            <div className="initial-loader-mascot" />
            <div className="initial-loader-shadow" aria-hidden="true" />
          </div>
          <span className="initial-loader-text">야구놀이터</span>
          <span className="initial-loader-dots" aria-hidden="true">
            <span className="initial-loader-dot" />
            <span className="initial-loader-dot" />
            <span className="initial-loader-dot" />
          </span>
        </div>
        {/* AppState 데이터 페치를 Suspense로 감싸 — 페치 중에도 위의 initial-loader가 즉시 노출됨.
            fallback은 null이라 추가 빈 화면 없음 (loader가 그대로 유지).
            ErrorBoundary로 감싸 클라이언트 사이드 에러 발생 시 자동 reload로 복구. */}
        <ErrorBoundary>
          <Suspense fallback={null}>
            <AppStateLoader isAnonymous={isAnonymous} userId={userId}>
              {children}
              <InstallAppBanner />
              <AuthRefreshOnVisible />
            </AppStateLoader>
          </Suspense>
        </ErrorBoundary>
        {/* Vercel 무료 분석 — 페이지뷰/방문자/Web Vitals. 추가 설정 0, env 불필요. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
