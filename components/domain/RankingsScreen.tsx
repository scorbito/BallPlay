"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { TeamStanding } from "@/lib/types/domain";

type RankingsScreenProps = {
  standings?: TeamStanding[];
};

export function RankingsScreen({ standings = [] }: RankingsScreenProps) {
  const [currentStandings] = useState(standings);
  const season = useMemo(() => new Date().getFullYear(), []);

  return (
    <AppShell activeTab="home" title="팀순위" theme="light" backHref="/" wide>
      <div className="rankings-title">
        <h1>{season} KBO 정규시즌</h1>
        <span className="rankings-refresh" aria-label="저장된 팀순위">
          저장된 순위
        </span>
      </div>

      <section className="rankings-card">
        <div className="ranking-table">
          <div className="ranking-table-head">
            <span>순위</span>
            <span>팀</span>
            <span>승률</span>
            <span>차</span>
            <span>승-무-패</span>
            <span>최근5</span>
          </div>
          <ol className="ranking-table-body">
            {currentStandings.map((standing) => {
              const team = getTeam(standing.teamId);
              return (
                <li className="ranking-row" key={standing.teamId}>
                  <span className="ranking-rank">{standing.rank}</span>
                  <span className="ranking-team">
                    <TeamBadge teamId={standing.teamId} size="sm" />
                    <strong>{team.shortName}</strong>
                  </span>
                  <span className="ranking-rate">{standing.winRate}</span>
                  <span className="ranking-gap">{standing.gamesBehind === "-" ? "-" : standing.gamesBehind}</span>
                  <span className="ranking-record">{standing.wins}-{standing.draws}-{standing.losses}</span>
                  <span className="ranking-form">
                    {standing.form.slice(-5).map((result, index) => (
                      <i className={`ranking-dot ranking-dot-${result.toLowerCase()}`} key={`${standing.teamId}-${index}`} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </AppShell>
  );
}
