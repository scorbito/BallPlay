"use client";

import { type ElementType, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAppState } from "@/lib/state/AppState";
import {
  BarChart3,
  Bot,
  Brain,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ListChecks,
  Play,
  PlaySquare,
  Swords,
  Target,
  Trophy,
  Users
} from "lucide-react";
import { HomeCardCorner } from "@/components/domain/HomeCardCorner";
import { NoticeButton } from "@/components/domain/NoticeButton";
import { PointBalanceChip } from "@/components/domain/points/PointBalanceChip";
import predictBannerSrc from "@/data/Images/ad-banner/승부예측_배너광고.png";

// 커스텀 야구공 아이콘 — lucide-react 1.14.0에 Baseball이 없어서 직접 SVG로 그림.
// 원형 + 좌우 stitching 곡선으로 야구공 표현. lucide 아이콘과 동일하게 size prop 받음.
function BaseballIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5.5 6.5c1.2 1.6 1.8 3.5 1.8 5.5s-.6 3.9-1.8 5.5" />
      <path d="M18.5 6.5c-1.2 1.6-1.8 3.5-1.8 5.5s.6 3.9 1.8 5.5" />
    </svg>
  );
}

// 큼직한 베이스(루)가 강조된 다이아몬드 SVG 아이콘
function LineupDiamondIcon({ size = 18 }: { size?: number }) {
  // size가 작게 전달되더라도 베이스가 큼직하게 잘 보이도록 크기를 18px로 고정합니다.
  const finalSize = 18;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={finalSize}
      height={finalSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF2A7A"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ overflow: "visible" }}
    >
      <path d="M12 4 L20 12 L12 20 L4 12 Z" />
      {/* 네 모서리의 루(베이스) 크기를 r=4.5로 큼직하게 키움 */}
      <circle cx="12" cy="4" r={4.5} fill="#FF2A7A" stroke="none" />
      <circle cx="20" cy="12" r={4.5} fill="#FF2A7A" stroke="none" />
      <circle cx="12" cy="20" r={4.5} fill="#FF2A7A" stroke="none" />
      <circle cx="4" cy="12" r={4.5} fill="#FF2A7A" stroke="none" />
    </svg>
  );
}

import { AppShell } from "@/components/layout/AppShell";

type HomeCard = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: typeof ListChecks;
  available: boolean;
  badge?: string;
  /** 외부 사이트 링크 — 새 탭으로 열고 우상단 ↗ 표시 */
  external?: boolean;
  /** 아이콘 자리에 lucide 대신 이미지 사용 */
  iconImage?: string;
  /** 제목 아래 작은 부제 — 외부 링크 등 추가 식별이 필요한 경우만 */
  subtitle?: string;
  /** "추천" 등 강조 카드 — 우상단에 핑크 강조 배지 표시 */
  featured?: boolean;
  /** 운영자 전용 카드 — 일반 사용자에게는 렌더링하지 않음 */
  adminOnly?: boolean;
};

type HomeSection = {
  id: string;
  label: string;
  cards: HomeCard[];
  /** "hero": 패턴 배경 + 일러스트 + 부제가 있는 강조 섹션. "standard": 아이콘+라벨 + 카드 그리드. */
  variant: "hero" | "standard";
  /** 섹션 헤더 좌측 아이콘 (standard variant only). lucide 아이콘 또는 size prop을 받는 커스텀 SVG 컴포넌트 모두 허용. */
  sectionIcon?: ElementType;
  /** 섹션 헤더 아이콘을 이미지로 표시. sectionIcon보다 우선 적용. */
  sectionIconImage?: string;
  /** 히어로 일러스트 경로 (hero variant only) */
  heroIllustration?: string;
  /** 히어로 섹션 부제 (hero variant only) */
  heroSubtitle?: string;
  /** 그리드 열 수 — 기본 3, 콘텐츠는 2, 외부 앱은 1 */
  gridCols?: 1 | 2 | 3;
  /** 운영자 전용 섹션 — 일반 사용자에게는 섹션 자체를 렌더링하지 않음 */
  adminOnly?: boolean;
};

const sections: HomeSection[] = [
  {
    id: "ai-analysis",
    label: "프로야구 AI 예측·분석",
    variant: "hero",
    heroSubtitle: "오늘의 프로야구 경기 예측, 승부 맞대결, 리포트를 한눈에 확인하세요.",
    gridCols: 3,
    cards: [
      {
        id: "ai-predict",
        href: "/predict/ai-winner",
        title: "AI 승리팀 예측",
        description: "AI 3사 분석 종합",
        icon: Bot,
        iconImage: "/icons/menu/ai-prediction.png",
        available: true
      },
      {
        id: "ai-battle",
        href: "/predict/battle",
        title: "AI 승부 맞대결",
        description: "Gemini vs GPT 승리 근거 비교",
        icon: Swords,
        iconImage: "/icons/menu/ai-battle.png",
        available: true
      },
      {
        id: "daily-report",
        href: "/daily-report",
        title: "일일 리포트",
        description: "경기 결과와 주요 흐름 요약",
        icon: FileText,
        iconImage: "/icons/menu/daily-report.png",
        available: true
      }
    ]
  },
  {
    id: "predict",
    label: "예측 참여",
    variant: "standard",
    sectionIcon: Trophy,
    sectionIconImage: "/icons/sections/predict.png",
    gridCols: 3,
    cards: [
      {
        id: "winner-predict",
        href: "/predict/winner",
        title: "승리팀 예측하기",
        description: "오늘 경기 승리팀 선택",
        icon: Target,
        iconImage: "/icons/menu/predict-winner.png",
        available: true,
        badge: "EVENT"
      },
      {
        id: "weekly-report",
        href: "/weekly-report",
        title: "주간 리포트",
        description: "한 주간의 프로야구 성적 분석 리포트",
        icon: FileText,
        iconImage: "/icons/menu/weekly-report.png",
        available: true
      },
      {
        id: "sim-1000",
        href: "/predict/sim-1000",
        title: "1000판 시뮬레이션",
        description: "오늘 경기 1000판 결과",
        icon: BarChart3,
        iconImage: "/icons/menu/sim-1000.png",
        available: true
      }
    ]
  },
  {
    id: "kbo-info",
    label: "프로야구 정보",
    variant: "standard",
    sectionIcon: BaseballIcon,
    sectionIconImage: "/icons/sections/kbo-info.png",
    gridCols: 3,
    cards: [
      {
        id: "schedule",
        href: "/schedule",
        title: "경기 일정",
        description: "이번 주 프로야구 일정",
        icon: CalendarDays,
        iconImage: "/icons/menu/schedule.png",
        available: true
      },
      {
        id: "today-results",
        href: "/schedule?focus=today",
        title: "경기 결과",
        description: "오늘 경기 스코어",
        icon: ClipboardCheck,
        iconImage: "/icons/menu/today-results.png",
        available: true
      },
      {
        id: "rankings",
        href: "/rankings",
        title: "팀 순위",
        description: "순위 + 최근 5경기",
        icon: Trophy,
        iconImage: "/icons/menu/team-standings.png",
        available: true
      },
      {
        id: "special-rankings",
        href: "/rankings/special",
        title: "팀 별별랭킹",
        description: "재미있고 독특한 10가지 구단 랭킹",
        icon: Trophy,
        iconImage: "/icons/menu/team-rank.png",
        available: true,
        badge: "NEW"
      },
      {
        id: "player-special-rankings",
        href: "/rankings/player-special",
        title: "선수 별별랭킹",
        description: "선수별 시즌 누적 이색 랭킹",
        icon: Trophy,
        iconImage: "/icons/menu/player-rank.png",
        available: true,
        badge: "NEW"
      },
      {
        id: "recent10-top",
        href: "/recent10-top",
        title: "최근 10경기 TOP",
        description: "타율·홈런·도루·ERA 랭킹",
        icon: BarChart3,
        iconImage: "/icons/menu/10game-top10.png",
        available: true,
        badge: "NEW"
      },
      {
        id: "predict-ranking",
        href: "/predict/ranking",
        title: "승리팀 예측 순위",
        description: "참여 기록과 적중 흐름",
        icon: Trophy,
        iconImage: "/icons/menu/prediction-rank.png",
        available: true
      },
      {
        id: "news",
        href: "/news",
        title: "야구 뉴스",
        description: "프로야구 헤드라인·트레이드",
        icon: FileText,
        iconImage: "/icons/menu/baseball-news.png",
        available: true
      }
    ]
  },
  {
    id: "lineup-tools",
    label: "라인업 분석 도구",
    variant: "standard",
    sectionIcon: LineupDiamondIcon,
    gridCols: 3,
    cards: [
      {
        id: "lineup",
        href: "/play/lineup",
        title: "라인업 분석",
        description: "팀별 타순과 수비 위치 구성",
        icon: ListChecks,
        iconImage: "/icons/tabs/play.png",
        available: true
      },
      {
        id: "stadium",
        href: "/stadium",
        title: "라인업 시뮬레이션",
        description: "라인업 기반 경기 흐름 참고",
        icon: Swords,
        iconImage: "/icons/tabs/stadium.png",
        available: true
      }
    ]
  },
  {
    id: "content",
    label: "야구 콘텐츠",
    variant: "standard",
    sectionIcon: Play,
    sectionIconImage: "/icons/sections/content.png",
    gridCols: 2,
    cards: [
      {
        id: "videos",
        href: "/videos",
        title: "재밌는 야구 영상",
        description: "끝내기·호수비·짤방 모음",
        icon: PlaySquare,
        iconImage: "/icons/menu/fun-videos.png",
        available: true
      },
      {
        id: "quiz",
        href: "/quiz",
        title: "야구 상식 퀴즈",
        description: "랜덤 10문제 도전",
        icon: Brain,
        iconImage: "/icons/menu/baseball-quiz.png",
        available: true
      }
    ]
  },
  {
    id: "related",
    label: "함께 보는 야구 앱",
    variant: "standard",
    sectionIcon: Users,
    sectionIconImage: "/icons/sections/external-apps.png",
    gridCols: 1,
    cards: [
      {
        id: "oneul-seungyo",
        href: "https://oneul-seungyo.vercel.app/",
        title: "오늘은 승요",
        subtitle: "직관 관리 앱",
        description: "직관 기록과 응원팀 관리를 위한 외부 웹앱",
        icon: Trophy,
        iconImage: "/assets/oneul-seungyo-logo.png",
        available: true,
        external: true
      }
    ]
  },
  {
    id: "admin-only",
    label: "운영자 전용",
    variant: "standard",
    sectionIcon: Trophy,
    sectionIconImage: "/icons/menu/team-standings.png",
    gridCols: 3,
    adminOnly: true,
    cards: [
      {
        id: "playoff",
        href: "/stadium/playoff",
        title: "가을야구",
        description: "운영자 가족용 시뮬레이션",
        icon: Trophy,
        iconImage: "/icons/menu/play-off.png",
        available: true
      },
      {
        id: "admin-events",
        href: "/admin/events",
        title: "운영자 이벤트 통계",
        description: "이벤트·포인트·가을야구 현황",
        icon: BarChart3,
        iconImage: "/icons/menu/sim-1000.png",
        available: true
      }
    ]
  }
];

export function HomeScreen() {
  // isAdmin 은 AppState(클라이언트)에서 읽는다 — 홈 페이지를 정적/캐시 가능하게 하기 위해
  // 서버에서 auth 를 읽지 않음. 운영자 전용 카드는 클라이언트 로드 후 노출된다.
  const { isAdmin } = useAppState();
  return (
    <AppShell activeTab="home" title="야구놀이터" theme="light" hideHeader hideFloatingPointChip wide>
      <header className="play-hub-header">
        <h1>
          <Image
            src="/assets/logo.png"
            alt=""
            width={52}
            height={52}
            priority
            className="play-hub-logo"
          />
          <span className="play-hub-title-group">
            <span className="play-hub-title">야구놀이터</span>
            <span className="play-hub-tagline">야구의 모든 재미가 있는 곳</span>
          </span>
        </h1>
        <div className="play-hub-header-actions">
          <NoticeButton />
          <PointBalanceChip />
        </div>
      </header>

      {(() => {
        // 단일 카드 렌더링 헬퍼
        const renderCard = (card: HomeCard) => {
          const Icon = card.icon;
          const available = card.id === "my-team" && isAdmin ? true : card.available;
          const badge = card.id === "my-team" && isAdmin ? undefined : card.badge;
          const displayTitle =
            card.id === "recent10-top"
              ? "최근 경기 TOP10"
              : card.id === "ai-battle"
                ? "AI 승부 맞대결"
                : card.id === "daily-report"
                  ? "일일 리포트"
                  : card.title;
          const displayDescription =
            card.id === "recent10-top" ? "타율·홈런·도루·ERA 랭킹" : card.description;

          const cardDisplayTitle = card.id === "recent10-top" ? "요즘 폼 TOP10" : displayTitle;
          const cardDisplayDescription =
            card.id === "recent10-top" ? "최근 흐름이 좋은 선수들" : displayDescription;

          const iconNode = card.iconImage ? (
            <span className="play-hub-card-icon play-hub-card-icon-image">
              <Image src={card.iconImage} alt="" width={160} height={160} />
            </span>
          ) : (
            <span className="play-hub-card-icon">
              <Icon size={22} />
            </span>
          );

          const showChevron = available && !card.external;
          const cardInner = (
            <>
              {iconNode}
              <span className="play-hub-card-text">
                <strong className="play-hub-card-title">{cardDisplayTitle}</strong>
                {card.subtitle ? (
                  <span className="play-hub-card-subtitle">{card.subtitle}</span>
                ) : null}
                {cardDisplayDescription ? (
                  <span className="play-hub-card-description">{cardDisplayDescription}</span>
                ) : null}
              </span>
              {showChevron ? (
                <ChevronRight className="play-hub-card-chevron" size={18} aria-hidden="true" />
              ) : null}
            </>
          );

          return (
            <div className={`play-hub-card-wrap play-hub-card-wrap-${card.id}`} key={card.id}>
              {card.external ? (
                <a
                  className={`play-hub-card play-hub-card-external play-hub-card-${card.id}`}
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cardInner}
                </a>
              ) : available ? (
                <Link
                  className={`play-hub-card play-hub-card-${card.id}${card.featured ? " play-hub-card-featured-style" : ""}`}
                  href={card.href}
                  prefetch={false}
                >
                  {cardInner}
                </Link>
              ) : (
                <div className={`play-hub-card play-hub-card-disabled play-hub-card-${card.id}`} aria-disabled="true">
                  {cardInner}
                </div>
              )}
              <HomeCardCorner
                cardId={card.id}
                title={cardDisplayTitle}
                description={cardDisplayDescription}
                available={available}
                featured={card.featured}
                external={card.external}
                badge={badge}
              />
            </div>
          );
        };

        // 상단 AI 예측·분석 영역 렌더링
        const aiSection = sections.find((s) => s.id === "ai-analysis");
        const aiSectionNode = aiSection ? (
          <section
            className={`play-hub-section play-hub-section-${aiSection.variant}`}
            key={aiSection.id}
          >
            <div className="play-hub-hero">
              <div className="play-hub-hero-header">
                <div className="play-hub-hero-text">
                  <div className="play-hub-hero-title-row">
                    <h2 className="play-hub-hero-title">{aiSection.label}</h2>
                  </div>
                  {aiSection.heroSubtitle ? (
                    <div className="play-hub-hero-subtitle-row">
                      <p className="play-hub-hero-subtitle">{aiSection.heroSubtitle}</p>
                    </div>
                  ) : null}
                </div>
                {aiSection.heroIllustration ? (
                  <div className="play-hub-hero-illust">
                    <Image
                      src={aiSection.heroIllustration}
                      alt=""
                      width={160}
                      height={160}
                      priority
                    />
                  </div>
                ) : null}
              </div>
              <div className="play-hub-grid play-hub-hero-cards">
                {aiSection.cards.filter((card) => !card.adminOnly || isAdmin).map(renderCard)}
              </div>
            </div>
          </section>
        ) : null;

        // 히어로 카드와 일반 메뉴 사이 배너 광고
        const predictBannerNode = (
          <Link
            className="play-hub-predict-banner"
            href="/event/predict-ai"
            prefetch={false}
            key="predict-banner"
          >
            <Image
              src={predictBannerSrc}
              alt="승부예측 이벤트"
              sizes="(max-width: 640px) 100vw, 640px"
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 14 }}
              priority
            />
          </Link>
        );

        // 하단 플랫 메뉴용 카드들 수집 (ai-analysis, related 제외)
        const otherSections = sections.filter((s) => s.id !== "ai-analysis" && s.id !== "related");
        const bottomCards: HomeCard[] = [];
        otherSections.forEach((section) => {
          if (section.adminOnly && !isAdmin) return;
          section.cards.forEach((card) => {
            if (card.adminOnly && !isAdmin) return;
            bottomCards.push(card);
          });
        });

        // Keep the two highlighted ranking cards first in the visible flat menu.
        const highlightedIds = ["recent10-top", "special-rankings", "player-special-rankings"];
        const highlightedCards: HomeCard[] = [];
        highlightedIds.forEach((id) => {
          const cardIdx = bottomCards.findIndex((c) => c.id === id);
          if (cardIdx > -1) {
            const [card] = bottomCards.splice(cardIdx, 1);
            highlightedCards.push(card);
          }
        });
        if (highlightedCards.length > 0) {
          bottomCards.unshift(...highlightedCards);
        }

        const bottomSectionNode = (
          <section className="play-hub-section play-hub-section-standard" key="bottom-menus">
            <div className="play-hub-grid play-hub-grid-3 play-hub-flexible-grid">
              {bottomCards.map(renderCard)}
            </div>
          </section>
        );

        // 외부 웹앱 추천 배너 (related 섹션)
        const relatedSection = sections.find((s) => s.id === "related");
        const seungyoCard = relatedSection?.cards.find((c) => c.id === "oneul-seungyo");

        const externalBannerNode = seungyoCard ? (
          <div className="play-hub-external-banner-wrap" key="external-banner">
            <span className="play-hub-external-banner-label">함께 보면 좋은 야구 앱</span>
            <a
              className="play-hub-external-banner"
              href={seungyoCard.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="play-hub-external-banner-content">
                {seungyoCard.iconImage ? (
                  <span className="play-hub-external-banner-logo">
                    <Image src={seungyoCard.iconImage} alt="" width={44} height={44} />
                  </span>
                ) : null}
                <div className="play-hub-external-banner-text">
                  <strong className="play-hub-external-banner-title">
                    {seungyoCard.title} <span className="play-hub-external-banner-subtitle">{seungyoCard.subtitle}</span>
                  </strong>
                  <p className="play-hub-external-banner-desc">{seungyoCard.description}</p>
                </div>
              </div>
              <span className="play-hub-external-banner-action">
                바로가기 <ChevronRight size={16} />
              </span>
            </a>
          </div>
        ) : null;

        const footerNode = (
          <footer className="play-hub-footer" key="company-footer">
            <a
              href="https://dae-dan-company.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="play-hub-footer-link"
            >
              Made by 대단컴퍼니
              <Image
                src="/company/logo_alpha.png"
                alt="대단컴퍼니"
                width={38}
                height={16}
                className="play-hub-footer-logo"
              />
            </a>
          </footer>
        );

        return [aiSectionNode, predictBannerNode, bottomSectionNode, externalBannerNode, footerNode];
      })()}
    </AppShell>
  );
}
