import Link from "next/link";
import { ListChecks } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

const games = [
  {
    id: "lineup",
    href: "/play/lineup",
    title: "팀 라인업 짜기",
    description: "원하는 팀의 9인 타순과 수비 위치를 직접 구성해보기",
    icon: ListChecks,
    available: true
  }
];

export default function PlayHubPage() {
  return (
    <AppShell activeTab="play" title="놀이" theme="dark" hideHeader>
      <header className="play-hub-header">
        <h1>야구놀이터</h1>
        <p>가볍게 즐기는 야구 미니게임 모음</p>
      </header>
      <section className="play-hub-grid">
        {games.map((game) => {
          const Icon = game.icon;
          if (!game.available) {
            return (
              <div className="play-hub-card play-hub-card-disabled" key={game.id}>
                <span className="play-hub-card-icon"><Icon size={22} /></span>
                <div>
                  <strong>{game.title}</strong>
                  <p>{game.description}</p>
                </div>
                <span className="play-hub-card-badge">준비 중</span>
              </div>
            );
          }
          return (
            <Link className="play-hub-card" href={game.href} key={game.id} prefetch>
              <span className="play-hub-card-icon"><Icon size={22} /></span>
              <div>
                <strong>{game.title}</strong>
                <p>{game.description}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
