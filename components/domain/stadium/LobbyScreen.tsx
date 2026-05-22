"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronRight, KeyRound, List, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import { PublishedLineupList } from "./PublishedLineupList";
import { LineupDetailModal } from "./LineupDetailModal";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import type { SimTeamInput } from "@/lib/sim/types";

// 경기장 메인 — 공개 라인업이 메인 콘텐츠.
//   1) 친구와 대결 (작은 진입점 2-up)
//   2) 공개 라인업 풀 (메인, 상위 6개 미리보기)
//   3) AI와 대결 (하단 그리드)
// 라인업 미리보기용 고정 seed — preview는 항상 같은 결과 나오게.
// 실제 경기 진입 시는 새 seed로 다시 생성되어 본 경기에 영향 X.
const PREVIEW_SEED = 0;

export function LobbyScreen() {
  const router = useRouter();
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  const openAiPreview = (teamId: string) => {
    const team = buildFakeOpponentTeam(teamId, PREVIEW_SEED);
    if (team) setPreviewTeam(team);
  };

  return (
    <AppShell activeTab="stadium" title="경기장" backHref="/" theme="dark">
      {/* 1. 친구와 대결 — 컴팩트 2-up */}
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

      {/* 2. 공개 라인업 풀 — 메인 영역 */}
      <section className="stadium-lobby-section stadium-lobby-section-main">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">공개 라인업</h2>
          <Link href="/stadium/discover" className="stadium-lobby-section-more" prefetch>
            전체 보기
            <ChevronRight size={14} />
          </Link>
        </header>
        <PublishedLineupList maxItems={6} showHeader={false} />
      </section>

      {/* 3. AI와 대결 — 하단 그리드 */}
      <section className="stadium-lobby-section">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">
            <Bot size={14} />
            AI와 대결
          </h2>
          <span className="stadium-lobby-section-sub">자동 생성된 팀 라인업과 시뮬</span>
        </header>
        <div className="stadium-lobby-grid">
          {teams.map((team) => (
            <div key={team.id} className="stadium-lobby-card">
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
              <div className="stadium-lobby-card-actions">
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-secondary"
                  onClick={() => openAiPreview(team.id)}
                  aria-label={`${team.name} 라인업 보기`}
                >
                  <List size={14} />
                  <span>라인업</span>
                </button>
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                  onClick={() => router.push(`/stadium/enter?opponent=${team.id}`)}
                  aria-label={`${team.name}과 대결`}
                >
                  <Swords size={14} />
                  <span>도전</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
    </AppShell>
  );
}
