"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { refreshStandingsAction } from "@/lib/actions/standings";
import { useAppState } from "@/lib/state/AppState";
import type { TeamStanding } from "@/lib/types/domain";

type RankingsScreenProps = {
  standings?: TeamStanding[];
};

export function RankingsScreen({ standings = [] }: RankingsScreenProps) {
  const { profile, showToast } = useAppState();
  const [currentStandings, setCurrentStandings] = useState(standings);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  const season = useMemo(() => new Date().getFullYear(), []);
  const isCoolingDown = cooldownTick < cooldownUntil;

  useEffect(() => {
    if (!isCoolingDown) return;
    const timeout = window.setTimeout(() => {
      setCooldownTick(Date.now());
    }, Math.max(250, cooldownUntil - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [cooldownUntil, cooldownTick, isCoolingDown]);

  const handleRefresh = () => {
    if (isPending || isCoolingDown) return;
    const now = Date.now();
    setCooldownTick(now);
    setCooldownUntil(now + 60_000);
    startTransition(async () => {
      try {
        const result = await refreshStandingsAction(season);
        if (result.standings.length > 0) {
          setCurrentStandings(result.standings);
        }
        showToast(result.ok ? "팀순위를 갱신했어요." : result.reason);
      } catch (err) {
        setCooldownUntil(0);
        showToast(err instanceof Error ? err.message : "팀순위 갱신에 실패했어요.");
      }
    });
  };

  return (
    <AppShell activeTab="schedule" title="팀순위" theme="light" backHref="/schedule" wide>
      <div className="rankings-title">
        <h1>{season} KBO 정규시즌</h1>
        <button
          type="button"
          className="rankings-refresh"
          disabled={isPending || isCoolingDown}
          onClick={handleRefresh}
          aria-label="팀순위 수동 갱신"
          title="팀순위 수동 갱신"
        >
          <RefreshCw size={14} className={isPending ? "rankings-refresh-spin" : undefined} />
          <span>{isPending ? "갱신 중" : "갱신"}</span>
        </button>
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
              const isMine = standing.teamId === profile.mainTeamId;
              return (
                <li className={isMine ? "ranking-row ranking-row-highlighted" : "ranking-row"} key={standing.teamId}>
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
