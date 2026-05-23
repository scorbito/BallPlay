"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, ListChecks, Settings, Sparkles, Swords, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

type HomeCard = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: typeof ListChecks;
  available: boolean;
  badge?: string;
};

const cards: HomeCard[] = [
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
    id: "prediction",
    href: "#",
    title: "오늘 경기 예측",
    description: "승부·점수·MVP 예측. 결과는 경기 끝나고 확인",
    icon: Sparkles,
    available: false,
    badge: "공사중"
  },
  {
    id: "more",
    href: "#",
    title: "더 많은 미니게임",
    description: "응원가 맞히기·선수 퀴즈·운세 카드 등 준비 중",
    icon: Trophy,
    available: false,
    badge: "곧 만나요"
  }
];

export function HomeScreen() {
  return (
    <AppShell activeTab="home" title="야구놀이터" theme="light" hideHeader wide>
      <header className="play-hub-header">
        <h1>야구놀이터</h1>
        <p>가볍게 즐기는 야구 미니게임 모음</p>
        <Link href="/my/settings" className="play-hub-settings" prefetch aria-label="설정">
          <Settings size={20} />
        </Link>
      </header>
      <section className="play-hub-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          if (!card.available) {
            return (
              <div className="play-hub-card play-hub-card-disabled" key={card.id} aria-disabled="true">
                <span className="play-hub-card-icon"><Icon size={22} /></span>
                <div>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                </div>
                {card.badge ? <span className="play-hub-card-badge">{card.badge}</span> : null}
              </div>
            );
          }
          return (
            <Link className="play-hub-card" href={card.href} key={card.id} prefetch>
              <span className="play-hub-card-icon"><Icon size={22} /></span>
              <div>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
