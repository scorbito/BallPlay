"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight, List, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import { MyLineupList } from "./MyLineupList";
import { RegisteredLineupList } from "./RegisteredLineupList";
import { LineupDetailModal } from "./LineupDetailModal";
import { AiChallengeModal } from "./AiChallengeModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildFakeOpponentTeam, type RecentLineupHint } from "@/lib/sim/fakeOpponent";
import {
  listLatestLineupsByTeam,
  type RecentLineupRow
} from "@/lib/supabase/query-parts/bpRecentLineups";
import type { SimTeamInput } from "@/lib/sim/types";

type SectionId = "actual" | "mine" | "public";

const PREVIEW_SEED = 0;

export function LobbyScreen() {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    actual: true,
    mine: false,
    public: false
  });
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [simulationTeamId, setSimulationTeamId] = useState<string | null>(null);
  const [recentByTeam, setRecentByTeam] = useState<Record<string, RecentLineupRow>>({});

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void listLatestLineupsByTeam(client, { withinDays: 14 }).then((res) => {
      if (res.ok) setRecentByTeam(res.byTeam);
    });
  }, []);

  const toggleSection = (sectionId: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const openActualPreview = (teamId: string) => {
    const hint: RecentLineupHint | null = recentByTeam[teamId] ?? null;
    const team = buildFakeOpponentTeam(teamId, PREVIEW_SEED, hint);
    if (team) setPreviewTeam(team);
  };

  return (
    <AppShell activeTab="stadium" title="시뮬레이션 로비" backHref="/" theme="light" wide>
      <SimulationSection
        id="actual"
        icon={<BarChart3 size={14} />}
        title="실제 경기 라인업"
        subtitle="최근 실제 팀 경기 라인업 기준"
        isOpen={openSections.actual}
        onToggle={toggleSection}
      >
        <div className="stadium-lobby-grid stadium-sim-team-grid">
          {teams.map((team) => {
            const hasRecentLineup = Boolean(recentByTeam[team.id]);
            return (
              <div key={team.id} className="stadium-lobby-card stadium-sim-team-card">
                <span
                  className="stadium-lobby-card-bar"
                  style={{ background: team.color }}
                  aria-hidden="true"
                />
                <TeamBadge teamId={team.id} size="md" />
                <div className="stadium-lobby-card-body">
                  <strong>{team.name}</strong>
                  <span>{hasRecentLineup ? "최근 경기 라인업" : "기본 라인업"}</span>
                </div>
                <div className="stadium-lobby-card-actions">
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-secondary"
                    onClick={() => openActualPreview(team.id)}
                    aria-label={`${team.name} 라인업 보기`}
                  >
                    <List size={14} />
                    <span>라인업</span>
                  </button>
                  <button
                    type="button"
                    className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                    onClick={() => setSimulationTeamId(team.id)}
                    aria-label={`${team.name} 라인업 비교 시뮬레이션`}
                  >
                    <BarChart3 size={14} />
                    <span>시뮬</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SimulationSection>

      <SimulationSection
        id="mine"
        icon={<Lock size={14} />}
        title="내 팀 라인업"
        subtitle="내가 저장한 라인업"
        isOpen={openSections.mine}
        onToggle={toggleSection}
      >
        <MyLineupList maxItems={10} />
      </SimulationSection>

      <SimulationSection
        id="public"
        icon={<Users size={14} />}
        title="공개 라인업"
        subtitle="다른 사용자가 공개한 라인업"
        isOpen={openSections.public}
        onToggle={toggleSection}
      >
        <RegisteredLineupList sortBy="recent" showHeader={false} />
      </SimulationSection>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />

      <AiChallengeModal
        opponentTeamId={simulationTeamId}
        onClose={() => setSimulationTeamId(null)}
      />
    </AppShell>
  );
}

type SimulationSectionProps = {
  id: SectionId;
  icon: ReactNode;
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: (sectionId: SectionId) => void;
  children: ReactNode;
};

function SimulationSection({
  id,
  icon,
  title,
  subtitle,
  isOpen,
  onToggle,
  children
}: SimulationSectionProps) {
  return (
    <section className={`stadium-lobby-section stadium-sim-section ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="stadium-sim-section-toggle"
        aria-expanded={isOpen}
        onClick={() => onToggle(id)}
      >
        <span className="stadium-sim-section-title-wrap">
          <span className="stadium-sim-section-icon" aria-hidden="true">
            {icon}
          </span>
          <span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </span>
        {isOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
      </button>
      {isOpen ? <div className="stadium-sim-section-body">{children}</div> : null}
    </section>
  );
}
