import type { CSSProperties } from "react";

import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { Game } from "@/lib/types/domain";

type GameCardProps = {
  game: Game;
  compact?: boolean;
  highlighted?: boolean;
};

export function GameCard({ game, compact = false, highlighted = false }: GameCardProps) {
  const home = getTeam(game.homeTeamId);
  const away = getTeam(game.awayTeamId);

  return (
    <div
      className={`game-card ${compact ? "game-card-compact" : ""} ${highlighted ? "game-card-highlighted" : ""}`}
      style={{
        "--home-team-color": home.color,
        "--away-team-color": away.color
      } as CSSProperties}
    >
      <div className="game-card-meta">
        <span>{game.time}</span>
        <em>{game.stadium}</em>
      </div>
      <div className="game-card-main">
        <span className="game-card-team game-card-team-home">
          <TeamBadge teamId={game.homeTeamId} size="sm" />
          <strong>{home.shortName}</strong>
        </span>
        <b>{game.status === "finished" ? `${game.homeScore} : ${game.awayScore}` : "VS"}</b>
        <span className="game-card-team game-card-team-away">
          <strong>{away.shortName}</strong>
          <TeamBadge teamId={game.awayTeamId} size="sm" />
        </span>
      </div>
      <div className="game-card-status">
        {game.status === "scheduled" ? <span className="status-muted">경기전</span> : null}
      </div>
    </div>
  );
}
