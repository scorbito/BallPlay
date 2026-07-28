import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { InstallAppBanner } from "@/components/domain/InstallAppBanner";
import { AuthRefreshOnVisible } from "@/components/common/AuthRefreshOnVisible";
import { CustomCursor } from "@/components/common/CustomCursor";
import { AppStateProvider } from "@/lib/state/AppState";
import "./globals.css";
import "@/styles/light-home.css";
import "@/styles/event.css";
import "@/styles/coupons.css";
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
import "@/styles/dark-playoff.css";
import "@/styles/dark-profile-popover.css";
import "@/styles/dark-season-level.css";
import "@/styles/dark-lineup.css";
import "@/styles/lineup-special.css";
import "@/styles/dark-stadium.css";
import "@/styles/dark-records.css";
import "@/styles/dark-lineup-detail.css";
import "@/styles/dark-videos.css";
import "@/styles/dark-predict.css";
import "@/styles/dark-ai-predict.css";
import "@/styles/dark-sim1000.css";
import "@/styles/dark-quiz.css";
import "@/styles/wordle.css";
import "@/styles/admin-events.css";
import "@/styles/light-bp-core.css";
import "@/styles/light-tier-up.css";
import "@/styles/news.css";
import "@/styles/recent10-top.css";
import "@/styles/weekly-report.css";
import "@/styles/daily-report.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballnori.com";
const SITE_TITLE = "야구놀이터";
const SITE_DESCRIPTION = "야구놀이터에서 프로야구 승리팀 예측, AI 승부 맞대결, 경기 리포트와 야구 정보를 확인하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TITLE} - 프로야구 AI 예측·분석`,
    template: `%s | ${SITE_TITLE}`
  },
  description: SITE_DESCRIPTION,
  // 페이지별 canonical은 각 page.tsx에서 alternates.canonical로 덮어씀.
  // 루트는 "/"가 사이트 대표임을 Google에 명시 (중복 클러스터에서 / 가 선택되도록).
  alternates: {
    canonical: "/"
  },
  keywords: [
    "야구놀이터",
    "ballplay",
    "프로야구 예측",
    "승리팀 예측",
    "AI 야구 분석",
    "프로야구 정보",
    "야구 라인업 분석"
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
    title: `${SITE_TITLE} - 프로야구 AI 예측·분석`,
    description: SITE_DESCRIPTION
    // images는 app/opengraph-image.tsx가 자동 제공 (1200x630 PNG 동적 생성)
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_TITLE} - 프로야구 AI 예측·분석`,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 루트 레이아웃은 user 정보를 서버에서 읽지 않는다(headers()/getUser() 제거).
  // 레이아웃이 동적 API를 쓰면 전 페이지가 동적 렌더로 강제돼 정적/ISR 캐시가 불가능해지기 때문.
  // user 의존 데이터(프로필/익명여부/체크인)는 AppStateProvider 가 클라이언트에서 /api/profile/me 로 로드한다.
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
        {/* AppStateProvider 는 클라이언트 컴포넌트 — 마운트 후 /api/profile/me 로 프로필을 로드한다.
            서버 데이터 의존이 없어 children(페이지)은 즉시 렌더되고, initial-loader 는 data-loaded 전까지 노출.
            ErrorBoundary로 감싸 클라이언트 사이드 에러 발생 시 자동 reload로 복구. */}
        <ErrorBoundary>
          <AppStateProvider>
            {children}
            <InstallAppBanner />
            <AuthRefreshOnVisible />
            <CustomCursor />
          </AppStateProvider>
        </ErrorBoundary>
        {/* Vercel 무료 분석 — 페이지뷰/방문자/Web Vitals. 추가 설정 0, env 불필요. */}
        <Analytics />
      </body>
    </html>
  );
}
