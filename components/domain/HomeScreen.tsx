import { type ElementType, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { HomePointBadge } from "@/components/domain/points/HomePointBadge";
import { type UserPublicMatchRecord } from "@/lib/supabase/query-parts/bpUserRecords";
import type { HomePointAvailability } from "@/lib/server/homePointAvailability";

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
import { TierUpHost } from "@/components/common/TierUpHost";

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
        available: true
      },
      {
        id: "predict-ranking",
        href: "/predict/ranking",
        title: "예측 기록",
        description: "참여 기록과 적중 흐름",
        icon: Trophy,
        iconImage: "/icons/menu/team-standings.png",
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
        id: "weekly-report",
        href: "/weekly-report",
        title: "주간 리포트",
        description: "한 주간의 프로야구 성적 분석 리포트",
        icon: FileText,
        iconImage: "/icons/menu/weekly-report.png",
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
    sectionIcon: ListChecks,
    sectionIconImage: "/icons/tabs/play.png",
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

type HomeScreenProps = {
  /** Supabase Auth User 객체 */
  user?: any;
  /** 현재 사용자의 공개 매치 누적 전적 (히어로 뱃지용). 미로그인 시 zeros. */
  userRecord?: UserPublicMatchRecord;
  /** 익명 로그인 상태 여부 — 현재는 마크업 변화 없지만 추후 분기용. */
  isAnonymous?: boolean;
  /** 관리자 여부 — 향후 홈 분기용. */
  isAdmin?: boolean;
  /** 첫 화면에서 BP 뱃지를 바로 표시하기 위한 서버 계산값. */
  initialPointAvailability?: HomePointAvailability;
};

export function HomeScreen({
  user = null,
  userRecord = { wins: 0, losses: 0, total: 0, winRate: 0 },
  isAnonymous = false,
  isAdmin = false,
  initialPointAvailability = {}
}: HomeScreenProps = {}) {
  // ESLint/TS 미사용 경고 회피용 — 현재는 마크업에 직접 반영하지 않지만 향후 분기 대비 prop 유지.
  void isAnonymous;
  void user;
  void userRecord;
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
        // Section 렌더링 함수 — pair wrapper 안에서 재사용하기 위해 추출.
        const renderSection = (section: HomeSection) => {
          const SectionIcon = section.sectionIcon;
          const visibleCards = section.cards.filter((card) => !card.adminOnly || isAdmin);
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

          // 단일 카드 렌더링 헬퍼 — hero의 좌우 컬럼 분리 배치 + standard 그리드에서 공통 사용.
          const renderCard = (card: HomeCard) => {
            const Icon = card.icon;
            const available = card.id === "my-team" && isAdmin ? true : card.available;
            const badge = card.id === "my-team" && isAdmin ? undefined : card.badge;

            // 아이콘 영역: iconImage 있으면 이미지, 없으면 lucide.
            // width/height는 next/image의 intrinsic 힌트일 뿐 — 실제 크기는 CSS의 컨테이너(.play-hub-card-icon) + img { width:100% } 가 결정.
            const iconNode = card.iconImage ? (
              <span className="play-hub-card-icon play-hub-card-icon-image">
                <Image src={card.iconImage} alt="" width={160} height={160} />
              </span>
            ) : (
              <span className="play-hub-card-icon">
                <Icon size={22} />
              </span>
            );

            // Chevron(>) — 클릭 가능한 내부 메뉴에만 노출. 외부 링크(↗ 별도)와 비활성(준비중)은 제외.
            const showChevron = available && !card.external;
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
                  title={card.title}
                  description={card.description}
                  available={available}
                  featured={card.featured}
                  external={card.external}
                  badge={badge}
                />
                <HomePointBadge
                  cardId={card.id}
                  initialAvailable={initialPointAvailability[card.id]}
                />
              </div>
            );
          };

          // 카드 그리드 JSX — standard 섹션에서 사용 (hero는 좌우 컬럼 분리 렌더링)
          const cardsGrid = (
            <div className={gridClass}>
              {visibleCards.map(renderCard)}
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
                      <div className="play-hub-hero-title-row">
                        <h2 className="play-hub-hero-title">{section.label}</h2>
                      </div>
                      {/* 부제 + 매치 기록 뱃지를 한 줄 flex row로 묶음 — 좁은 화면에서는 flex-wrap으로 뱃지가 다음 줄로 떨어짐. */}
                      {section.heroSubtitle ? (
                        <div className="play-hub-hero-subtitle-row">
                          {section.heroSubtitle ? (
                            <p className="play-hub-hero-subtitle">{section.heroSubtitle}</p>
                          ) : null}
                        </div>
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
                {section.sectionIconImage ? (
                  <span className="play-hub-section-icon play-hub-section-icon-image">
                    <Image src={section.sectionIconImage} alt="" width={20} height={20} />
                  </span>
                ) : SectionIcon ? (
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
          if (section.adminOnly && !isAdmin) return;
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
      {/* 승급 모달 — 홈 진입 시 자동 감지. 익명/0승은 detector 내부에서 no-op. */}
      <TierUpHost wins={userRecord.wins} />
    </AppShell>
  );
}
