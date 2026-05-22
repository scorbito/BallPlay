"use client";

import Link from "next/link";
import { KeyRound, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";

// v1 스캐폴드: 매칭풀에 실제 다른 사용자 라인업이 없으므로 10팀 자체를 도전 대상으로 표시.
// 각 팀의 로스터에서 자동으로 라인업이 짜여 상대로 등장.
export function LobbyScreen() {
  return (
    <AppShell activeTab="stadium" title="경기장" backHref="/" theme="dark">
      <header className="stadium-lobby-header">
        <h1 className="stadium-h1">매칭풀</h1>
        <p className="stadium-sub">도전할 팀을 골라 내 라인업을 붙여보세요.</p>
      </header>

      <div className="stadium-lobby-live-row">
        <Link href="/stadium/live/new" className="stadium-lobby-live" prefetch>
          <div className="stadium-lobby-live-icon" aria-hidden="true">
            <Users size={18} />
          </div>
          <div className="stadium-lobby-live-body">
            <strong>매치 만들기</strong>
            <span>초대 코드 발급</span>
          </div>
        </Link>
        <Link href="/stadium/live/join" className="stadium-lobby-live stadium-lobby-live-secondary" prefetch>
          <div className="stadium-lobby-live-icon" aria-hidden="true">
            <KeyRound size={18} />
          </div>
          <div className="stadium-lobby-live-body">
            <strong>코드로 참여</strong>
            <span>친구 매치 입장</span>
          </div>
        </Link>
      </div>

      <section className="stadium-lobby-grid">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/stadium/enter?opponent=${team.id}`}
            className="stadium-lobby-card"
            prefetch
          >
            <span
              className="stadium-lobby-card-bar"
              style={{ background: team.color }}
              aria-hidden="true"
            />
            <TeamBadge teamId={team.id} size="md" />
            <div className="stadium-lobby-card-body">
              <strong>{team.name}</strong>
              <span>자동 생성 라인업</span>
            </div>
            <Swords size={16} className="stadium-lobby-card-icon" />
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
