"use client";

import { TeamBadge } from "@/components/common/TeamBadge";
import type { BaseState } from "@/lib/sim/types";
import { Diamond, OutDots } from "./Diamond";

export function Scoreboard({
  awayTeamId,
  homeTeamId,
  awayLabel,
  homeLabel,
  totalAway,
  totalHome,
  awayNickname,
  homeNickname,
  baseState,
  outs
}: {
  awayTeamId: string;
  homeTeamId: string;
  awayLabel: string;
  homeLabel: string;
  totalAway: number;
  totalHome: number;
  awayNickname: string | null;
  homeNickname: string | null;
  baseState: BaseState;
  outs: 0 | 1 | 2 | 3;
}) {
  return (
    // 스코어보드 + 다이아몬드 + 아웃카운트
    // 팀별 레이아웃: [큰 팀 배지] [팀명 + 큰 점수] (반대편은 거울)
    <header className="stadium-play-scoreboard">
      <div className="stadium-play-team">
        <div className="stadium-play-team-badge-col">
          {awayNickname ? (
            <span className="stadium-play-team-nickname" title={awayNickname}>{awayNickname}</span>
          ) : null}
          <TeamBadge teamId={awayTeamId} size="lg" />
        </div>
        <div className="stadium-play-team-info">
          <span className="stadium-play-team-name">{awayLabel}</span>
          <strong className="stadium-play-team-score">{totalAway}</strong>
        </div>
      </div>
      <div className="stadium-play-state">
        <Diamond base={baseState} />
        <OutDots outs={outs} />
      </div>
      <div className="stadium-play-team stadium-play-team-right">
        <div className="stadium-play-team-info">
          <span className="stadium-play-team-name">{homeLabel}</span>
          <strong className="stadium-play-team-score">{totalHome}</strong>
        </div>
        <div className="stadium-play-team-badge-col">
          {homeNickname ? (
            <span className="stadium-play-team-nickname" title={homeNickname}>{homeNickname}</span>
          ) : null}
          <TeamBadge teamId={homeTeamId} size="lg" />
        </div>
      </div>
    </header>
  );
}
