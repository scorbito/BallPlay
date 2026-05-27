import { type ElementType, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  History,
  ListChecks,
  Play,
  PlaySquare,
  Settings,
  Swords,
  Target,
  Trophy,
  Users
} from "lucide-react";
import { HomeCardCorner } from "@/components/domain/HomeCardCorner";
import { NoticeButton } from "@/components/domain/NoticeButton";
import { getLatestNoticePublishedAt } from "@/lib/supabase/query-parts/notices";

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
        description: "9인 타순 + 수비 위치 구성",
        icon: ListChecks,
        available: true,
        featured: true
      },
      {
        id: "stadium",
        href: "/stadium",
        title: "경기장 들어가기",
        description: "라인업 경기 시뮬 + 친구 대결",
        icon: Swords,
        available: true
      },
      {
        id: "records",
        href: "/records",
        title: "내 라인업 기록",
        description: "공개 매칭·친구 대전 기록",
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
        description: "오늘 승리팀 예측",
        icon: Target,
        available: true
      },
      {
        id: "predict-ranking",
        href: "/predict/ranking",
        title: "적중률 랭킹",
        description: "예측 적중률 순위",
        icon: BarChart3,
        available: true
      },
      {
        id: "ai-predict",
        href: "#",
        title: "AI 승리팀 예측",
        description: "AI 기반 승부 예측",
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
        description: "오늘 경기 스코어",
        icon: ClipboardCheck,
        available: true
      },
      {
        id: "schedule",
        href: "/schedule",
        title: "경기 일정",
        description: "이번 주 KBO 일정",
        icon: CalendarDays,
        available: true
      },
      {
        id: "rankings",
        href: "/rankings",
        title: "팀 순위",
        description: "순위 + 최근 5경기",
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
    // 카드 2개지만 3열 그리드에 배치 — 왼쪽 2칸 채우고 오른쪽 1칸은 비움.
    // 다른 메뉴(3열)와 동일한 카드 크기·형식 유지.
    gridCols: 3,
    cards: [
      {
        id: "videos",
        href: "/videos",
        title: "재밌는 야구 영상",
        description: "끝내기·호수비·짤방 모음",
        icon: PlaySquare,
        available: true
      },
      {
        id: "news",
        href: "/news",
        title: "야구 뉴스",
        description: "KBO 헤드라인·트레이드",
        icon: FileText,
        available: true
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

export async function HomeScreen() {
  // 정적 카드 그리드만 렌더하는 Server Component. 인터랙티브 영역(공지 빨간점)은
  // NoticeButton client island가 담당 → 홈 진입 시 클라이언트 JS/hydration 최소화.
  // 최신 공지 시각을 서버에서 받아 client 배지 판정에 넘긴다.
  const latestNoticeAt = await getLatestNoticePublishedAt();
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
          <span className="play-hub-title-group">
            <span className="play-hub-title">야구놀이터</span>
            <span className="play-hub-tagline">가볍게 즐기는 야구 놀이 모음</span>
          </span>
        </h1>
        <div className="play-hub-header-actions">
          <NoticeButton latestPublishedAt={latestNoticeAt} />
          <Link href="/my/settings" className="play-hub-settings" prefetch aria-label="설정">
            <Settings size={20} />
          </Link>
        </div>
      </header>

      {(() => {
        // Section 렌더링 함수 — pair wrapper 안에서 재사용하기 위해 추출.
        const renderSection = (section: HomeSection) => {
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

                // Chevron(>) — 클릭 가능한 내부 메뉴에만 노출. 외부 링크(↗ 별도)와 비활성(준비중)은 제외.
                // PC(≥1025px)에서만 시각적으로 노출 — 모바일/태블릿은 CSS @media에서 숨김.
                const showChevron = card.available && !card.external;
                const cardInner = (
                  <>
                    {iconNode}
                    <span className="play-hub-card-text">
                      <strong className="play-hub-card-title">{card.title}</strong>
                      {card.subtitle ? (
                        <span className="play-hub-card-subtitle">{card.subtitle}</span>
                      ) : null}
                      {/* description은 PC(≥1025px)에서만 노출 — CSS @media에서 처리 */}
                      {card.description ? (
                        <span className="play-hub-card-description">{card.description}</span>
                      ) : null}
                    </span>
                    {showChevron ? (
                      <ChevronRight className="play-hub-card-chevron" size={18} aria-hidden="true" />
                    ) : null}
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
                    <HomeCardCorner
                      cardId={card.id}
                      title={card.title}
                      description={card.description}
                      available={card.available}
                      featured={card.featured}
                      external={card.external}
                      badge={card.badge}
                    />
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
        };

        // 섹션 렌더링 — predict + kbo-info는 PC에서 한 줄 배치 위해 .play-hub-section-pair로 묶음.
        const out: ReactNode[] = [];
        let skip: string | null = null;
        sections.forEach((section, idx) => {
          if (skip === section.id) {
            skip = null;
            return;
          }
          // predict + kbo-info 연속이면 pair wrapper로 묶기
          if (section.id === "predict" && sections[idx + 1]?.id === "kbo-info") {
            const next = sections[idx + 1];
            out.push(
              <div className="play-hub-section-pair" key="pair-predict-info">
                {renderSection(section)}
                {renderSection(next)}
              </div>
            );
            skip = "kbo-info";
            return;
          }
          out.push(renderSection(section));
        });
        return out;
      })()}
    </AppShell>
  );
}
