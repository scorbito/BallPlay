"use client";

import { useEffect } from "react";
import { ChevronLeft, Trophy, Swords, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { AiWinnerBattleTab, type BattlePredictionRow } from "./AiWinnerBattleTab";
import { VirtualMatchButton } from "@/components/domain/stadium/VirtualMatchButton";
import type { GameStatus } from "@/lib/types/api-contracts";
import { PageViewCounter } from "@/components/domain/PageViewCounter";


type GameInfo = {
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  homeStarter: string | null;
  awayStarter: string | null;
};

type Props = {
  gameId: string;
  game: GameInfo;
  predictions: BattlePredictionRow[];
};

export function AiBattleRevealScreen({ gameId, game, predictions }: Props) {
  const home = getTeam(game.homeTeamId);
  const away = getTeam(game.awayTeamId);

  const finished = game.status === "finished";
  const actualWinnerId =
    finished && game.homeScore !== null && game.awayScore !== null
      ? game.homeScore > game.awayScore
        ? game.homeTeamId
        : game.awayScore > game.homeScore
          ? game.awayTeamId
          : null
      : null;

  return (
    <AppShell
      activeTab="home"
      title="AI 맞대결"
      backHref="/predict/battle"
      theme="light"
    >
      <section className="ai-reveal-screen">
        {/* ── 매치업 헤더 ── */}
        <header className="ai-reveal-matchup" style={{ background: "linear-gradient(135deg, rgba(232, 74, 138, 0.08), rgba(29, 78, 216, 0.04))" }}>
          <div className="ai-reveal-matchup-meta">
            {game.gameTime ?? "18:30"} · {game.stadium}
          </div>
          <div className="ai-reveal-matchup-teams">
            <div className="ai-reveal-team">
              <TeamBadge teamId={game.homeTeamId} size="md" />
              <div className="ai-reveal-team-info">
                <span className="ai-reveal-team-name">{home.shortName}</span>
                {game.homeStarter ? (
                  <span className="ai-reveal-team-starter">{game.homeStarter}</span>
                ) : null}
              </div>
              {finished ? <span className="ai-reveal-team-score">{game.homeScore ?? 0}</span> : null}
            </div>
            <span className="ai-reveal-vs">VS</span>
            <div className="ai-reveal-team">
              {finished ? <span className="ai-reveal-team-score">{game.awayScore ?? 0}</span> : null}
              <div className="ai-reveal-team-info">
                <span className="ai-reveal-team-name">{away.shortName}</span>
                {game.awayStarter ? (
                  <span className="ai-reveal-team-starter">{game.awayStarter}</span>
                ) : null}
              </div>
              <TeamBadge teamId={game.awayTeamId} size="md" />
            </div>
          </div>
          {finished && actualWinnerId ? (
            <div className="ai-reveal-actual-result">
              <Trophy size={12} strokeWidth={2.5} />
              {getTeam(actualWinnerId).shortName} 승리!
            </div>
          ) : null}
        </header>

        {/* ── 돌려보기 버튼 ── */}
        <VirtualMatchButton
          game={{
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
            homeStarter: game.homeStarter,
            awayStarter: game.awayStarter
          }}
          className="ai-reveal-sim-btn"
          idleLabel="경기 시뮬"
          busyLabel="준비 중"
        />

        {/* ── 배틀 탭 영역 (탭 없이 직접 즉각 렌더링!) ── */}
        <div style={{ marginTop: "8px" }}>
          <AiWinnerBattleTab
            homeTeamId={game.homeTeamId}
            awayTeamId={game.awayTeamId}
            homeTeamName={home.shortName}
            awayTeamName={away.shortName}
            predictions={predictions}
            gameStatus={game.status}
          />
        </div>
      </section>
      <PageViewCounter pullUp />
    </AppShell>
  );
}
