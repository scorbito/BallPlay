"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, KeyRound, List, Lock, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import { MyLineupList } from "@/components/domain/stadium/MyLineupList";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import { AiChallengeModal } from "@/components/domain/stadium/AiChallengeModal";
import { buildFakeOpponentTeam, type RecentLineupHint } from "@/lib/sim/fakeOpponent";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listLatestLineupsByTeam,
  type RecentLineupRow
} from "@/lib/supabase/query-parts/bpRecentLineups";
import type { SimTeamInput } from "@/lib/sim/types";

// 연습경기장 — 친구 매치(만들기/코드 참여) + 내 라인업 vs 내 라인업 + AI 대결.
// 공개 매치(랭킹 집계 대상)는 /stadium/lobby 로 분리되어 있음.

const PREVIEW_SEED = 0;

export function PracticeStadiumScreen() {
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [aiOpponentTeamId, setAiOpponentTeamId] = useState<string | null>(null);
  const [recentByTeam, setRecentByTeam] = useState<Record<string, RecentLineupRow>>({});

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void listLatestLineupsByTeam(client, { withinDays: 14 }).then((res) => {
      if (res.ok) setRecentByTeam(res.byTeam);
    });
  }, []);

  const openAiPreview = (teamId: string) => {
    const hint: RecentLineupHint | null = recentByTeam[teamId] ?? null;
    const team = buildFakeOpponentTeam(teamId, PREVIEW_SEED, hint);
    if (team) setPreviewTeam(team);
  };

  return (
    <AppShell activeTab="play" title="연습경기장" backHref="/" theme="light" wide>
      {/* 1. 친구 매치 진입 — 매치 만들기 + 코드 참여 */}
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
        <Link
          href="/stadium/live/join"
          className="stadium-lobby-live stadium-lobby-live-secondary"
          prefetch
        >
          <div className="stadium-lobby-live-icon" aria-hidden="true">
            <KeyRound size={18} />
          </div>
          <div className="stadium-lobby-live-body">
            <strong>코드로 참여</strong>
            <span>친구 매치 입장</span>
          </div>
        </Link>
      </div>

      {/* 2. 내 라인업 vs 내 라인업 */}
      <section className="stadium-lobby-section">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">
            <Lock size={14} />
            내 라인업
          </h2>
          <span className="stadium-lobby-section-sub">나만 볼 수 있어요</span>
        </header>
        <MyLineupList maxItems={10} />
      </section>

      {/* 3. AI와 대결 */}
      <section className="stadium-lobby-section">
        <header className="stadium-lobby-section-head">
          <h2 className="stadium-lobby-section-title">
            <Bot size={14} />
            AI와 대결
          </h2>
          <span className="stadium-lobby-section-sub">팀별 최신 라인업으로 시뮬 대결</span>
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
                  onClick={() => setAiOpponentTeamId(team.id)}
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

      <AiChallengeModal
        opponentTeamId={aiOpponentTeamId}
        onClose={() => setAiOpponentTeamId(null)}
      />
    </AppShell>
  );
}
