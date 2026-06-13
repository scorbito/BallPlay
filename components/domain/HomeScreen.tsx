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
import { HomeRecordBadge } from "@/components/domain/HomeRecordBadge";
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
import { getAccountTierByWins } from "@/lib/tiers/accountTier";

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
  /** 섹션 헤더 아이콘을 이미지로 표시. sectionIcon보다 우선 적용. */
  sectionIconImage?: string;
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
    heroSubtitle: "나만의 라인업으로 승부하세요!",
    heroIllustration: "/assets/home-hero-illust.png",
    gridCols: 3,
    cards: [
      {
        id: "stadium",
        href: "/stadium",
        title: "경기장 들어가기",
        description: "라인업 경기 시뮬 + 친구 대결",
        icon: Swords,
        iconImage: "/icons/tabs/stadium.png",
        available: true
      },
      {
        id: "lineup",
        href: "/play/lineup",
        title: "팀 라인업 짜기",
        description: "9인 타순 + 수비 위치 구성",
        icon: ListChecks,
        iconImage: "/icons/tabs/play.png",
        available: true,
        featured: true
      },
      {
        id: "practice-stadium",
        href: "/play/practice",
        title: "연습경기장",
        description: "AI · 친구 · 내 라인업 자유 대결",
        icon: Swords,
        iconImage: "/icons/menu/practice-stadium.png",
        available: true
      }
    ]
  },
  {
    id: "predict",
    label: "승부 예측",
    variant: "standard",
    sectionIcon: Trophy,
    sectionIconImage: "/icons/sections/predict.png",
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
        description: "Gemini vs GPT 승리 근거 대결",
        icon: Swords,
        iconImage: "/icons/menu/ai-battle.png",
        available: true
      },
      {
        id: "winner-predict",
        href: "/predict/winner",
        title: "승리팀 예측하기",
        description: "다음 경기 승리팀",
        icon: Target,
        iconImage: "/icons/menu/predict-winner.png",
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
        description: "이번 주 KBO 일정",
        icon: CalendarDays,
        iconImage: "/icons/menu/schedule.png",
        available: true
      },
      {
        id: "daily-report",
        href: "/daily-report",
        title: "일일 리포트",
        description: "어제 경기 결과 및 AI 종합 요약 리포트",
        icon: FileText,
        iconImage: "/icons/menu/daily-report.png",
        available: true
      },
      {
        id: "weekly-report",
        href: "/weekly-report",
        title: "주간 리포트",
        description: "한 주간의 KBO 성적 분석 리포트",
        icon: FileText,
        iconImage: "/icons/menu/weekly-report.png",
        available: true
      },
      {
        id: "today-results",
        href: "/schedule?focus=today",
        title: "오늘 경기 결과",
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
        id: "news",
        href: "/news",
        title: "야구 뉴스",
        description: "KBO 헤드라인·트레이드",
        icon: FileText,
        iconImage: "/icons/menu/baseball-news.png",
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
    gridCols: 3,
    cards: [
      {
        id: "sim-1000",
        href: "/predict/sim-1000",
        title: "1000판 시뮬레이션",
        description: "오늘 경기 1000판 결과",
        icon: BarChart3,
        iconImage: "/icons/menu/sim-1000.png",
        available: true
      },
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
  }
];

type HomeScreenProps = {
  /** Supabase Auth User 객체 */
  user?: any;
  /** 현재 사용자의 공개 매치 누적 전적 (히어로 뱃지용). 미로그인 시 zeros. */
  userRecord?: UserPublicMatchRecord;
  /** 익명 로그인 상태 여부 — 현재는 마크업 변화 없지만 추후 분기용. */
  isAnonymous?: boolean;
  /** 첫 화면에서 BP 뱃지를 바로 표시하기 위한 서버 계산값. */
  initialPointAvailability?: HomePointAvailability;
};

export function HomeScreen({
  user = null,
  userRecord = { wins: 0, losses: 0, total: 0, winRate: 0 },
  isAnonymous = false,
  initialPointAvailability = {}
}: HomeScreenProps = {}) {
  // ESLint/TS 미사용 경고 회피용 — 현재는 마크업에 직접 반영하지 않지만 향후 분기 대비 prop 유지.
  void isAnonymous;
  void user;
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
                ) : card.available ? (
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
                  available={card.available}
                  featured={card.featured}
                  external={card.external}
                  badge={card.badge}
                />
                <HomePointBadge
                  cardId={card.id}
                  initialAvailable={initialPointAvailability[card.id]}
                />
                {/* 가을야구 모드 오픈 — 경기장 카드 상단에 겹쳐 강조. 카드 링크와 별도(형제)
                    Link 라 뱃지 탭은 가을야구, 카드 나머지 탭은 경기장 로비로. */}
                {card.id === "stadium" ? (
                  <Link
                    href="/stadium/playoff"
                    className="home-fall-badge"
                    aria-label="가을야구 모드 오픈 — 도전하러 가기"
                    prefetch={false}
                  >
                    <Image
                      src="/badges/fall-baseball-open.png"
                      alt="가을야구 모드 오픈"
                      width={1117}
                      height={223}
                      className="home-fall-badge-img"
                      priority
                    />
                  </Link>
                ) : null}
                {card.id === "lineup" ? (
                  <Link
                    href="/play/lineup"
                    className="home-fall-badge home-lineup-badge"
                    aria-label="국가대표 라인업 추가"
                    prefetch={false}
                  >
                    <Image
                      src="/badges/국가대표라인업추가.png"
                      alt="국가대표 라인업 추가"
                      width={695}
                      height={359}
                      className="home-fall-badge-img"
                      priority
                    />
                  </Link>
                ) : null}
              </div>
            );
          };

          // 카드 그리드 JSX — standard 섹션에서 사용 (hero는 좌우 컬럼 분리 렌더링)
          const cardsGrid = (
            <div className={gridClass}>
              {section.cards.map(renderCard)}
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
                      {/* 부제 + 매치 기록 뱃지를 한 줄 flex row로 묶음 — 좁은 화면에서는 flex-wrap으로 뱃지가 다음 줄로 떨어짐. */}
                      {section.heroSubtitle || section.id === "lineup-play" ? (
                        <div className="play-hub-hero-subtitle-row">
                          {section.heroSubtitle ? (
                            <p className="play-hub-hero-subtitle">{section.heroSubtitle}</p>
                          ) : null}
                          {section.id === "lineup-play" ? (
                            // 클라이언트 island — 경기 후 라우터 캐시가 옛 전적을 보여줘도
                            // mount/focus/pageshow 마다 bp_account_stats 재조회해 최신화.
                            <HomeRecordBadge
                              initialWins={userRecord.wins}
                              initialLosses={userRecord.losses}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {section.heroIllustration ? (() => {
                      // 등급 모자 일러스트 — 사용자 현재 등급에 맞춰 cap 이미지 선택.
                      // 등급 없음(0승) 케이스는 기본 일러스트 그대로.
                      const tier = section.id === "lineup-play"
                        ? getAccountTierByWins(userRecord.wins)
                        : null;
                      const illustSrc = tier?.capPath ?? section.heroIllustration;
                      return (
                        <div className="play-hub-hero-illust">
                          <Image
                            src={illustSrc}
                            alt=""
                            width={160}
                            height={160}
                            priority
                          />
                        </div>
                      );
                    })() : null}
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
