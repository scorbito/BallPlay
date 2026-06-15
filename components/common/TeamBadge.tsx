import { getTeam } from "@/lib/constants/teams";
import type { CSSProperties } from "react";

type TeamBadgeProps = {
  teamId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  fallbackName?: string;
  fallbackInitial?: string;
  fallbackColor?: string;
};

const sizeClass = {
  sm: "team-badge-sm",
  md: "team-badge-md",
  lg: "team-badge-lg"
};

const trophySize = {
  sm: 15,
  md: 18,
  lg: 22
};

export function TeamBadge({
  teamId,
  size = "md",
  showName = false,
  fallbackName,
  fallbackInitial,
  fallbackColor
}: TeamBadgeProps) {
  const team = getTeamMeta(teamId, { fallbackName, fallbackInitial, fallbackColor });
  const isNational = teamId === "national";
  const badgeColor = isNational ? "linear-gradient(180deg, #d71920 0%, #e84a8a 49%, #1d4ed8 51%, #0f4c81 100%)" : team.color;
  const badgeAccent = isNational ? "#fb7185" : team.accent ?? team.color;

  return (
    <span className="team-badge-wrap">
      <span
        className={`team-badge ${sizeClass[size]}`}
        style={{
          background: badgeColor,
          "--team-color": badgeColor,
          "--team-accent": badgeAccent
        } as CSSProperties}
        aria-label={team.name}
      >
        <span className="team-badge-initial">
          {isNational ? <TrophyIcon size={trophySize[size]} /> : team.initial}
        </span>
      </span>
      {showName ? <span className="team-badge-name">{team.shortName}</span> : null}
    </span>
  );
}

function TrophyIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a2 2 0 0 0 2 4h1" />
      <path d="M17 6h3a2 2 0 0 1-2 4h-1" />
    </svg>
  );
}

function getTeamMeta(
  teamId: string,
  fallback?: { fallbackName?: string; fallbackInitial?: string; fallbackColor?: string }
) {
  try {
    return getTeam(teamId);
  } catch {
    if (teamId === "national") {
      return {
        id: teamId,
        name: "아시안게임 국가대표팀",
        shortName: "국가대표",
        initial: "N",
        color: "#0f4c81",
        accent: "#d71920"
      };
    }
    const name = fallback?.fallbackName?.trim() || teamId;
    const initial = fallback?.fallbackInitial?.trim().slice(0, 2).toUpperCase() || name.slice(0, 1) || "?";
    return {
      id: teamId,
      name,
      shortName: name,
      initial,
      color: fallback?.fallbackColor || "#475569",
      accent: fallback?.fallbackColor || "#94a3b8"
    };
  }
}
