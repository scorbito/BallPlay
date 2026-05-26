"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, BarChart3, Bot, CalendarDays, ClipboardCheck, Crown, ExternalLink, History, ListChecks, PlaySquare, Settings, Swords, Target, Trophy } from "lucide-react";
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
};

type HomeSection = {
  id: string;
  label: string;
  cards: HomeCard[];
};

const sections: HomeSection[] = [
  {
    id: "lineup",
    label: "내 라인업 게임",
    cards: [
      {
        id: "lineup",
        href: "/play/lineup",
        title: "팀 라인업 짜기",
        description: "원하는 팀의 9인 타순과 수비 위치를 직접 구성",
        icon: ListChecks,
        available: true
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
        title: "내 기록 보기",
        description: "자동 저장된 공개 매칭·친구 대전 결과와 리플레이",
        icon: History,
        available: true
      }
    ]
  },
  {
    id: "predict",
    label: "예측",
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
        icon: Crown,
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
        title: "경기일정",
        description: "오늘과 이번 주 KBO 경기 일정 확인",
        icon: CalendarDays,
        available: true
      },
      {
        id: "rankings",
        href: "/rankings",
        title: "팀 순위",
        description: "2026 KBO 정규시즌 순위와 최근 5경기",
        icon: BarChart3,
        available: true
      },
      {
        id: "videos",
        href: "/videos",
        title: "재밌는 야구 영상",
        description: "끝내기·호수비·짤방 등 야구 영상 모아 보기",
        icon: PlaySquare,
        available: true
      }
    ]
  },
  {
    id: "coming-soon",
    label: "준비 중",
    cards: [
      {
        id: "more",
        href: "#",
        title: "더 많은 미니게임",
        description: "응원가 맞히기·선수 퀴즈·운세 카드 등 준비 중",
        icon: Trophy,
        available: false,
        badge: "곧 만나요"
      }
    ]
  },
  {
    id: "related",
    label: "함께 보는 야구 앱",
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
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (!openInfoId) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      const t = e.target as Element | null;
      // 같은 카드의 info 버튼/툴팁 클릭은 닫지 않음 — 그 외 어디든 클릭하면 닫음
      if (t?.closest(".play-hub-card-info") || t?.closest(".play-hub-card-tooltip")) return;
      setOpenInfoId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openInfoId]);

  const toggleInfo = (id: string) => (e: ReactMouseEvent) => {
    // 카드 navigation 막기 — info 버튼은 설명만 토글
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
            width={36}
            height={36}
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

      {sections.map((section) => (
        <section className="play-hub-section" key={section.id}>
          <h2 className="play-hub-section-label">{section.label}</h2>
          <div className="play-hub-grid">
            {section.cards.map((card) => {
              const Icon = card.icon;
              const infoOpen = openInfoId === card.id;
              // 우상단 코너: 외부 링크면 ↗, 비활성이면 배지, 그 외엔 ! 버튼
              const cornerNode = card.external ? (
                <span className="play-hub-card-external-mark" aria-hidden="true">
                  <ExternalLink size={14} />
                </span>
              ) : card.available ? (
                <button
                  type="button"
                  className="play-hub-card-info"
                  aria-label={`${card.title} 설명 보기`}
                  aria-expanded={infoOpen}
                  onClick={toggleInfo(card.id)}
                >
                  <AlertCircle size={14} />
                </button>
              ) : card.badge ? (
                <span className="play-hub-card-badge">{card.badge}</span>
              ) : null;
              // 아이콘 영역: iconImage 있으면 이미지, 없으면 lucide
              const iconNode = card.iconImage ? (
                <span className="play-hub-card-icon play-hub-card-icon-image">
                  <Image src={card.iconImage} alt="" width={36} height={36} />
                </span>
              ) : (
                <span className="play-hub-card-icon"><Icon size={22} /></span>
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
                    <Link className="play-hub-card" href={card.href} prefetch>
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
        </section>
      ))}
    </AppShell>
  );
}
