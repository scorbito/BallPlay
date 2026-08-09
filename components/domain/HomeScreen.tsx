"use client";

import { type ElementType, type ReactNode, useState } from "react";
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
  Grid3X3,
  ListChecks,
  Play,
  PlaySquare,
  ScanFace,
  Swords,
  Target,
  Trophy,
  Users
} from "lucide-react";
import { BaseballIcon } from "@/components/common/BaseballIcon";
import { HomeCardCorner } from "@/components/domain/HomeCardCorner";
import { NoticeButton } from "@/components/domain/NoticeButton";
import { WinnerPrizeModal } from "@/components/domain/predict/WinnerPrizeModal";
import { PointBalanceChip } from "@/components/domain/points/PointBalanceChip";
import { WEEKLY_EVENT_ACTIVE } from "@/lib/predict/eventConfig";
import predictBannerSrc from "@/data/Images/ad-banner/예측왕이벤트.png";
import { LatestWinnerStrip } from "@/components/domain/predict/LatestWinnerStrip";

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
  /** lucide 아이콘 또는 size prop을 받는 커스텀 SVG 컴포넌트 모두 허용 (sectionIcon과 동일). */
  icon: ElementType;
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

/**
 * 히어로(상단 강조 배치)에 올릴 카드 3장. **배치일 뿐 카테고리가 아니다** —
 * 각 카드는 아래 sections 에서 자기 카테고리(칩)에 그대로 소속돼 있고,
 * 여기서는 id 로만 참조한다. 그래서 칩을 눌렀을 때도 정상적으로 찾을 수 있다.
 *
 * 순서가 배치를 결정한다: 1번 = 왼쪽 큰 카드, 2·3번 = 오른쪽 상·하.
 * CSS(.play-hub-hero-cards)가 3장 배치를 못 박아 두었으므로 정확히 3개여야 한다.
 *
 * 3번 슬롯은 "신규 메뉴 전용"으로 운영한다. 새 기능이 나오면 이 한 줄만 교체하면 되고,
 * 졸업한 메뉴는 원래 카테고리에 그대로 남아 있으므로 옮길 것이 없다.
 * 유저도 "새 기능은 저 자리"를 한 번 학습하면 이후 교체가 예상 범위 안이 된다.
 */
const HERO_CARD_IDS: readonly string[] = ["ai-predict", "ai-battle", "wordle"];

const sections: HomeSection[] = [
  {
    id: "predict",
    label: "예측 참여",
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
        id: "winner-predict",
        href: "/predict/winner",
        title: "승리팀 예측",
        description: "오늘 경기 승리팀 선택",
        icon: Target,
        iconImage: "/icons/menu/predict-winner.png",
        available: true,
        badge: WEEKLY_EVENT_ACTIVE ? "EVENT" : undefined
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
        id: "predict-ranking",
        href: "/predict/ranking",
        title: "예측 순위",
        description: "참여 기록과 적중 흐름",
        icon: Trophy,
        iconImage: "/icons/menu/prediction-rank.png",
        available: true
      },
      {
        id: "sim-1000",
        href: "/predict/sim-1000",
        title: "1000판 시뮬",
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
        // 히어로에서 내려온 카드. Vercel 통계상 39명/재방문 1.4 로 히어로 3장 중 최하위였다.
        // 리포트 2형제를 나란히 두어 찾을 때 추론이 되게 한다.
        id: "daily-report",
        href: "/daily-report",
        title: "일일 리포트",
        description: "경기 결과와 주요 흐름 요약",
        icon: FileText,
        iconImage: "/icons/menu/daily-report.png",
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
    id: "star-rankings",
    label: "랭킹",
    variant: "standard",
    sectionIcon: Trophy,
    gridCols: 3,
    cards: [
      {
        id: "recent10-top",
        href: "/recent10-top",
        title: "최근 10경기 TOP",
        description: "타율·홈런·도루·ERA 랭킹",
        icon: BarChart3,
        iconImage: "/icons/menu/10game-top10.png",
        available: true
      },
      {
        id: "special-rankings",
        href: "/rankings/special",
        title: "팀 별별랭킹",
        description: "재미있고 독특한 10가지 구단 랭킹",
        icon: Trophy,
        iconImage: "/icons/menu/team-rank.png",
        available: true
      },
      {
        id: "player-special-rankings",
        href: "/rankings/player-special",
        title: "선수 별별랭킹",
        description: "선수별 시즌 누적 이색 랭킹",
        icon: Trophy,
        iconImage: "/icons/menu/player-rank.png",
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
        title: "라인업 시뮬",
        description: "라인업 기반 경기 흐름 참고",
        icon: Swords,
        iconImage: "/icons/tabs/stadium.png",
        available: true
      },
      {
        id: "compare",
        href: "/compare",
        title: "팀 전력비교",
        description: "두 팀 전적·선발·타선 전력지수 비교",
        icon: BarChart3,
        iconImage: "/icons/menu/team-compare.png",
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
        title: "야구 영상",
        description: "끝내기·호수비·짤방 모음",
        icon: PlaySquare,
        iconImage: "/icons/menu/fun-videos.png",
        available: true
      },
      {
        id: "quiz",
        href: "/quiz",
        title: "야구 퀴즈",
        description: "랜덤 10문제 도전",
        icon: Brain,
        iconImage: "/icons/menu/baseball-quiz.png",
        available: true
      },
      {
        // 현재 히어로 3번(신규 슬롯)에 배치돼 있지만 카테고리 소속은 여기다.
        // "콘텐츠" 칩에서 정상적으로 찾을 수 있고, 신규 슬롯에서 졸업하면 이 자리에 남는다.
        id: "wordle",
        href: "/play/wordle",
        title: "오늘의 선수를 맞혀라!",
        description: "하루 한 명, 6번의 기회",
        // icon 은 iconImage 로드 실패 시를 위한 폴백.
        icon: BaseballIcon,
        iconImage: "/icons/menu/선수맞추기.png",
        available: true,
        badge: "NEW"
      },
      {
        id: "grid",
        href: "/play/grid",
        title: "퍼펙트 그리드",
        description: "두 팀을 모두 거친 선수 찾기",
        icon: Grid3X3,
        iconImage: "/icons/menu/perfect-grid-icon-players.png",
        available: true,
        badge: "NEW"
      },
      {
        // 카테고리는 "콘텐츠"(미니게임). 전체 목록에서의 위치는 FLAT_PLACEMENT 에서
        // 승리팀 예측 뒤로 올린다 — 카테고리와 순서는 서로 무관하다.
        id: "face",
        href: "/play/face",
        // 카드 폭이 좁아 "나와 / 닮은 / 선수는?" 세 줄로 끊긴다. "나와"와 "닮은" 사이를
        // 줄바꿈 없는 공백(U+00A0)으로 묶어 "나와 닮은 / 선수는?" 두 줄이 되게 한다.
        title: "나와 닮은 선수는?",
        description: "사진 속 얼굴과 가장 닮은 선수",
        // icon 은 iconImage 로드 실패 시를 위한 폴백.
        icon: ScanFace,
        iconImage: "/icons/menu/lookalike-player-icon-final.png",
        available: true,
        badge: "NEW"
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
        title: "운영자 전용",
        description: "이벤트·포인트·가을야구 현황",
        icon: BarChart3,
        iconImage: "/icons/menu/admin-menu.png",
        available: true,
        adminOnly: true
      }
    ]
  }
];

export function HomeScreen() {
  // isAdmin 은 AppState(클라이언트)에서 읽는다 — 홈 페이지를 정적/캐시 가능하게 하기 위해
  // 서버에서 auth 를 읽지 않음. 운영자 전용 카드는 클라이언트 로드 후 노출된다.
  const { isAdmin } = useAppState();
  // 하단 플랫 메뉴 카테고리 필터 — 기본 "all"(전체 표시). 칩 선택 시 해당 카테고리만 노출.
  const [activeCategory, setActiveCategory] = useState<string>("all");
  return (
    <AppShell activeTab="home" title="야구놀이터" theme="light" hideHeader hideFloatingPointChip wide>
      <WinnerPrizeModal />
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

          const cardDisplayTitle = card.id === "recent10-top" ? "요즘 폼 탑10" : displayTitle;
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
        // 히어로 = 배치 전용. HERO_CARD_IDS 순서대로 카드를 찾아 3장을 올린다.
        const allCards = sections.flatMap((s) => s.cards);
        const heroCards = HERO_CARD_IDS.map((id) => allCards.find((c) => c.id === id)).filter(
          (c): c is HomeCard => Boolean(c) && (!c!.adminOnly || isAdmin)
        );
        // "전체"에서만 히어로 3장을 하단 그리드에서 걷어낸다 — 바로 위에 같은 카드가
        // 있어서 중복이 눈에 띈다. 반면 카테고리 칩을 누른 화면은 "그 분류를 통째로
        // 보는 것"이므로 히어로에 올라간 카드도 목록에 함께 나오는 게 맞다.
        const heroCardIdSet = new Set(heroCards.map((c) => c.id));

        // 화면에는 제목·부제를 두지 않는다. 3번 슬롯이 신규 메뉴 전용이라 주제를 명명하면
        // 슬롯이 교체될 때마다 라벨이 틀리게 된다. 대신 sr-only 헤딩으로 스크린리더용
        // 영역 이름과 문서 헤딩 구조는 남긴다(이 페이지의 유일한 헤딩).
        //
        // 카테고리 칩을 눌러도 히어로는 그대로 둔다 — 상단에 고정된 바로가기 묶음처럼
        // 동작해야 하고, 필터를 옮길 때마다 화면 위쪽이 사라지면 위치 감각이 흔들린다.
        const heroNode =
          heroCards.length > 0 ? (
            <section className="play-hub-section play-hub-section-hero" key="hero">
              <h2 className="sr-only">주요 메뉴</h2>
              <div className="play-hub-hero">
                <div className="play-hub-grid play-hub-hero-cards">
                  {heroCards.map(renderCard)}
                </div>
              </div>
            </section>
          ) : null;

        // 히어로 카드와 일반 메뉴 사이 배너 광고 — 이벤트 진행 중일 때만 노출.
        const predictBannerNode = WEEKLY_EVENT_ACTIVE ? (
          <Link
            className="play-hub-predict-banner"
            href="/event/predict-ai"
            prefetch={false}
            key="predict-banner"
          >
            <Image
              src={predictBannerSrc}
              alt="주간 예측왕 이벤트 — 1등 하고 치킨 먹자"
              sizes="(max-width: 640px) 100vw, 640px"
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 14 }}
              priority
            />
          </Link>
        ) : null;

        // 하단 플랫 메뉴용 카드들 수집. related(외부 앱)만 제외 — 별도 배너로 렌더된다.
        // 히어로 카드도 여기 포함된다. 히어로는 배치일 뿐이고 카테고리 소속은 유지되므로,
        // 칩을 눌렀을 때 정상적으로 나와야 한다. "전체"에서만 중복을 걷어낸다(아래).
        const otherSections = sections.filter((s) => s.id !== "related");
        const bottomCards: HomeCard[] = [];
        const categoryOfCard = new Map<string, string>(); // cardId → sectionId (칩 필터용)
        otherSections.forEach((section) => {
          if (section.adminOnly && !isAdmin) return;
          section.cards.forEach((card) => {
            if (card.adminOnly && !isAdmin) return;
            bottomCards.push(card);
            categoryOfCard.set(card.id, section.id);
          });
        });

        // 하단 메뉴 맨 앞에 고정할 카드(배열 순서 = 화면 순서).
        // 승리팀 예측하기는 앱의 핵심 기능이라 항상 1번이다. 이 순서는 "전체"뿐 아니라
        // 카테고리 칩 화면에도 그대로 적용된다(필터가 이 순서를 유지하므로).
        const highlightedIds = ["winner-predict", "predict-ranking", "compare"];
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

        // "전체" 목록에서의 자유 배치 — 카드의 섹션(탭 분류)과 무관하게 위치만 조정.
        //   섹션(카테고리)은 categoryOfCard 로 유지되므로 탭 필터는 그대로,
        //   전체 화면에서만 원하는 자리에 놓는다. [placeAfter card id]
        const FLAT_PLACEMENT: Array<{ id: string; after: string }> = [
          { id: "sim-1000", after: "news" }, // 1000판: 예측 탭 소속 + 전체에선 야구 뉴스 뒤
          { id: "face", after: "winner-predict" } // 닮은 선수: 콘텐츠 탭 소속 + 전체에선 승리팀 예측 뒤
        ];
        FLAT_PLACEMENT.forEach(({ id, after }) => {
          const idx = bottomCards.findIndex((c) => c.id === id);
          if (idx < 0) return;
          const [card] = bottomCards.splice(idx, 1);
          const afterIdx = bottomCards.findIndex((c) => c.id === after);
          if (afterIdx > -1) bottomCards.splice(afterIdx + 1, 0, card);
          else bottomCards.push(card);
        });

        // 카테고리 칩 정의 — 짧은 라벨로 축약. adminOnly 섹션은 운영자에게만.
        const CHIP_LABELS: Record<string, string> = {
          predict: "예측",
          "kbo-info": "정보",
          "star-rankings": "랭킹",
          "lineup-tools": "분석",
          content: "콘텐츠",
          "admin-only": "운영자"
        };
        const chipDefs = [
          { id: "all", label: "전체" },
          ...otherSections
            .filter((s) => !s.adminOnly || isAdmin)
            .filter((s) => s.cards.some((c) => categoryOfCard.get(c.id) === s.id))
            .map((s) => ({ id: s.id, label: CHIP_LABELS[s.id] ?? s.label }))
        ];

        const visibleBottomCards =
          activeCategory === "all"
            ? bottomCards.filter((c) => !heroCardIdSet.has(c.id))
            : bottomCards.filter((c) => categoryOfCard.get(c.id) === activeCategory);

        const bottomSectionNode = (
          <section className="play-hub-section play-hub-section-standard" key="bottom-menus">
            <div className="play-hub-cat-chips" role="tablist" aria-label="메뉴 카테고리">
              {chipDefs.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === chip.id}
                  className={`play-hub-cat-chip${activeCategory === chip.id ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="play-hub-grid play-hub-grid-3 play-hub-flexible-grid">
              {visibleBottomCards.map(renderCard)}
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

        // 지난주 예측왕 스트립 — 이벤트 진행 중일 때만, 배너 바로 아래.
        const winnerStripNode = WEEKLY_EVENT_ACTIVE ? <LatestWinnerStrip key="winner-strip" /> : null;

        return [heroNode, predictBannerNode, winnerStripNode, bottomSectionNode, externalBannerNode, footerNode];
      })()}
    </AppShell>
  );
}
