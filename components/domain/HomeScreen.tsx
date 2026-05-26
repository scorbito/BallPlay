"use client";

import { useEffect, useState, type ElementType, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  FileText,
  History,
  ListChecks,
  Play,
  PlaySquare,
  Settings,
  Star,
  Swords,
  Target,
  Trophy,
  Users
} from "lucide-react";

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
};

type HomeSection = {
  id: string;
  label: string;
  cards: HomeCard[];
  /** "hero": 패턴 배경 + 일러스트 + 부제가 있는 강조 섹션. "standard": 아이콘+라벨 + 카드 그리드. */
  variant: "hero" | "standard";
  /** 섹션 헤더 좌측 아이콘 (standard variant only). lucide 아이콘 또는 size prop을 받는 커스텀 SVG 컴포넌트 모두 허용. */
  sectionIcon?: ElementType;
  /** 히어로 일러스트 경로 (hero variant only) */
  heroIllustration?: string;
  /** 히어로 섹션 부제 (hero variant only) */
  heroSubtitle?: string;
  /** 그리드 열 수 — 기본 3, 콘텐츠는 2, 외부 앱은 1 */
  gridCols?: 1 | 2 | 3;
};

const sections: HomeSection[] = [
  {
    id: "lineup-play",
    label: "내 라인업 플레이",
    variant: "hero",
    heroSubtitle: "나만의 최강 라인업으로 승리를 노려보세요!",
    // 배경(패턴)은 CSS로, 일러스트는 별도 <img>로 렌더 (배경 + 일러스트 분리 자산)
    heroIllustration: "/assets/home-hero-illust.png",
    gridCols: 3,
    cards: [
      {
        id: "lineup",
        href: "/play/lineup",
        title: "팀 라인업 짜기",
        description: "원하는 팀의 9인 타순과 수비 위치를 직접 구성",
        icon: ListChecks,
        available: true,
        featured: true
      },
      {
        id: "stadium",
        href: "/stadium",
        title: "경기장 들어가기",
        description: "내가 만든 라인업으로 경기 시뮬 & 친구 대결",
        icon: Swords,
        available: true
      },
      {
        id: "records",
        href: "/records",
        title: "내 라인업 기록",
        description: "자동 저장된 공개 매칭·친구 대전 결과와 리플레이",
        icon: History,
        available: true
      }
    ]
  },
  {
    id: "predict",
    label: "승부 예측",
    variant: "standard",
    sectionIcon: Trophy,
    gridCols: 3,
    cards: [
      {
        id: "winner-predict",
        href: "/predict/winner",
        title: "승리팀 예측하기",
        description: "오늘 경기 승리팀을 직접 예측. 결과는 경기 끝나고 확인",
        icon: Target,
        available: true
      },
      {
        id: "predict-ranking",
        href: "/predict/ranking",
        title: "적중률 랭킹",
        description: "예측을 잘하는 사람들 순위 (최소 5경기 · 오늘/주/월/시즌)",
        icon: BarChart3,
        available: true
      },
      {
        id: "ai-predict",
        href: "#",
        title: "AI 승리팀 예측",
        description: "AI가 최근 폼·상대 전적·라인업으로 승부 예측",
        icon: Bot,
        available: false,
        badge: "준비중"
      }
    ]
  },
  {
    id: "kbo-info",
    label: "프로야구 정보",
    variant: "standard",
    sectionIcon: BaseballIcon,
    gridCols: 3,
    cards: [
      {
        id: "today-results",
        href: "/schedule?focus=today",
        title: "오늘 경기 결과",
        description: "오늘 KBO 경기 스코어와 진행 상황 한 번에",
        icon: ClipboardCheck,
        available: true
      },
      {
        id: "schedule",
        href: "/schedule",
        title: "경기 일정",
        description: "오늘과 이번 주 KBO 경기 일정 확인",
        icon: CalendarDays,
        available: true
      },
      {
        id: "rankings",
        href: "/rankings",
        title: "팀 순위",
        description: "2026 KBO 정규시즌 순위와 최근 5경기",
        icon: Trophy,
        available: true
      }
    ]
  },
  {
    id: "content",
    label: "야구 콘텐츠",
    variant: "standard",
    sectionIcon: Play,
    gridCols: 2,
    cards: [
      {
        id: "videos",
        href: "/videos",
        title: "재밌는 야구 영상",
        description: "끝내기·호수비·짤방 등 야구 영상 모아 보기",
        icon: PlaySquare,
        available: true
      },
      {
        id: "news",
        href: "#",
        title: "야구 뉴스",
        description: "KBO 헤드라인·트레이드·부상 소식 (준비 중)",
        icon: FileText,
        available: false,
        badge: "준비중"
      }
    ]
  },
  {
    id: "related",
    label: "함께 보는 야구 앱",
    variant: "standard",
    sectionIcon: Users,
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
  }
];

export function HomeScreen() {
  // 카드 설명 팝오버 — 한 번에 하나만 열림. 카드 ID 저장. 다른 데 클릭하면 닫힘.
  // ! 버튼 → 툴팁 (모바일에서만 노출. 태블릿/PC는 CSS로 ! 숨김 + 설명 본문에 항상 표시)
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (!openInfoId) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".play-hub-card-info") || t?.closest(".play-hub-card-tooltip")) return;
      setOpenInfoId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openInfoId]);

  const toggleInfo = (id: string) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenInfoId((prev) => (prev === id ? null : id));
  };

  return (
    <AppShell activeTab="home" title="야구놀이터" theme="light" hideHeader wide>
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
          <span>야구놀이터</span>
          <span className="play-hub-tagline">가볍게 즐기는 야구 놀이 모음</span>
        </h1>
        <Link href="/my/settings" className="play-hub-settings" prefetch aria-label="설정">
          <Settings size={20} />
        </Link>
      </header>

      {sections.map((section) => {
        const SectionIcon = section.sectionIcon;
        // hero 섹션은 카드가 비대칭 그리드 (모바일: 1 big + 2 small, PC: 3-col).
        // standard 섹션은 gridCols에 따라 1/2/3-col.
        const gridClass =
          section.variant === "hero"
            ? "play-hub-grid play-hub-hero-cards"
            : section.gridCols === 1
            ? "play-hub-grid play-hub-grid-1"
            : section.gridCols === 2
            ? "play-hub-grid play-hub-grid-2"
            : "play-hub-grid play-hub-grid-3";

        // 카드 그리드 JSX — hero와 standard에서 동일하게 재사용
        const cardsGrid = (
          <div className={gridClass}>
            {section.cards.map((card) => {
                const Icon = card.icon;
                const infoOpen = openInfoId === card.id;
                // 우상단 코너: featured(★추천) > external(↗) > badge(준비중) > info(!).
                // ! 버튼은 모바일 전용 (CSS @media로 태블릿/PC에선 숨김).
                let cornerNode: React.ReactNode = null;
                if (card.featured) {
                  cornerNode = (
                    <div className="play-hub-card-corner-row">
                      <span className="play-hub-card-featured">
                        <Star size={10} fill="currentColor" strokeWidth={0} />
                        추천
                      </span>
                      <button
                        type="button"
                        className="play-hub-card-info play-hub-card-info-on-featured"
                        aria-label={`${card.title} 설명 보기`}
                        aria-expanded={infoOpen}
                        onClick={toggleInfo(card.id)}
                      >
                        <AlertCircle size={14} />
                      </button>
                    </div>
                  );
                } else if (card.external) {
                  cornerNode = (
                    <span className="play-hub-card-external-mark" aria-hidden="true">
                      <ExternalLink size={14} />
                    </span>
                  );
                } else if (!card.available && card.badge) {
                  cornerNode = <span className="play-hub-card-badge">{card.badge}</span>;
                } else if (card.available) {
                  cornerNode = (
                    <button
                      type="button"
                      className="play-hub-card-info"
                      aria-label={`${card.title} 설명 보기`}
                      aria-expanded={infoOpen}
                      onClick={toggleInfo(card.id)}
                    >
                      <AlertCircle size={14} />
                    </button>
                  );
                }

                // 아이콘 영역: iconImage 있으면 이미지, 없으면 lucide
                const iconNode = card.iconImage ? (
                  <span className="play-hub-card-icon play-hub-card-icon-image">
                    <Image src={card.iconImage} alt="" width={36} height={36} />
                  </span>
                ) : (
                  <span className="play-hub-card-icon">
                    <Icon size={22} />
                  </span>
                );

                const cardInner = (
                  <>
                    {iconNode}
                    <span className="play-hub-card-text">
                      <strong className="play-hub-card-title">{card.title}</strong>
                      {card.subtitle ? (
                        <span className="play-hub-card-subtitle">{card.subtitle}</span>
                      ) : null}
                    </span>
                  </>
                );

                return (
                  <div className="play-hub-card-wrap" key={card.id}>
                    {card.external ? (
                      <a
                        className="play-hub-card play-hub-card-external"
                        href={card.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {cardInner}
                      </a>
                    ) : card.available ? (
                      <Link
                        className={`play-hub-card${card.featured ? " play-hub-card-featured-style" : ""}`}
                        href={card.href}
                        prefetch
                      >
                        {cardInner}
                      </Link>
                    ) : (
                      <div className="play-hub-card play-hub-card-disabled" aria-disabled="true">
                        {cardInner}
                      </div>
                    )}
                    {cornerNode}
                    {infoOpen ? (
                      <div className="play-hub-card-tooltip" role="tooltip">
                        {card.description}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        );

        if (section.variant === "hero") {
          // hero variant: 패턴 배경 + 헤더(텍스트 + 일러스트) + 카드들이 모두 한 컨테이너 안.
          return (
            <section
              className={`play-hub-section play-hub-section-${section.variant}`}
              key={section.id}
            >
              <div className="play-hub-hero">
                <div className="play-hub-hero-header">
                  <div className="play-hub-hero-text">
                    <h2 className="play-hub-hero-title">{section.label}</h2>
                    {section.heroSubtitle ? (
                      <p className="play-hub-hero-subtitle">{section.heroSubtitle}</p>
                    ) : null}
                  </div>
                  {section.heroIllustration ? (
                    <div className="play-hub-hero-illust">
                      <Image
                        src={section.heroIllustration}
                        alt=""
                        width={160}
                        height={160}
                        priority
                      />
                    </div>
                  ) : null}
                </div>
                {cardsGrid}
              </div>
            </section>
          );
        }

        return (
          <section
            className={`play-hub-section play-hub-section-${section.variant}`}
            key={section.id}
          >
            <h2 className="play-hub-section-label">
              {SectionIcon ? (
                <span className="play-hub-section-icon">
                  <SectionIcon size={14} />
                </span>
              ) : null}
              {section.label}
            </h2>
            {cardsGrid}
          </section>
        );
      })}
    </AppShell>
  );
}
