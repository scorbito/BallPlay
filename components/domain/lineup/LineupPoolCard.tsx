"use client";

import type { ReactNode } from "react";
import { formatHandBadge, getPoolGroupLabel, type Player } from "@/lib/types/lineup";

type LineupPoolCardProps = {
  poolPlayers: Player[];
  isLocked: boolean;
  onAddPlayer: (player: Player) => void;
  onLockedClick: () => void;
  /** 헤더 우측 액션(예: 최근 라인업 불러오기). 넘기지 않으면 아무것도 렌더하지 않는다. */
  headerAction?: ReactNode;
};

/** 대기 선수 풀 카드 — 모드(타자/투수)에 따라 풀이 달라짐 */
export function LineupPoolCard({
  poolPlayers,
  isLocked,
  onAddPlayer,
  onLockedClick,
  headerAction
}: LineupPoolCardProps) {
  return (
    <section
      className="lineup-pool-card lineup-pool-card-side"
      aria-label="대기 선수"
      onClick={isLocked ? onLockedClick : undefined}
    >
      <div className="lineup-section-head">
        <strong>대기</strong>
        <span className="lineup-section-count">{poolPlayers.length}</span>
        {headerAction}
      </div>
      {poolPlayers.length === 0 ? (
        <p className="lineup-pool-empty">전원 출장 중</p>
      ) : (
        <ul className="lineup-pool-list">
          {poolPlayers.map((player) => {
            const hand = formatHandBadge(player);
            return (
              <li key={player.id}>
                <button
                  type="button"
                  className="lineup-pool-row"
                  onClick={() => onAddPlayer(player)}
                >
                  <span className="lineup-pool-pos">{getPoolGroupLabel(player.primaryPosition)}</span>
                  <span className="lineup-pool-row-name">{player.name}</span>
                  {hand ? (
                    <span className={`lineup-hand-badge lineup-hand-${hand.tone}`}>{hand.label}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
