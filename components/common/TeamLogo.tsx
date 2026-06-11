import Image from "next/image";
import nationalLogoSrc from "@/data/Images/국가대표팀로고.png";
import type { StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import { getTeam } from "@/lib/constants/teams";

type TeamLogoProps = {
  teamId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
};

const logoSrcByTeamId: Record<string, string | StaticImageData> = {
  doosan: "/team-logos/doosan.png",
  lg: "/team-logos/lg.png",
  kt: "/team-logos/kt.png",
  ssg: "/team-logos/ssg.png",
  nc: "/team-logos/nc.png",
  kiwoom: "/team-logos/kiwoom.png",
  samsung: "/team-logos/samsung.png",
  lotte: "/team-logos/lotte.png",
  kia: "/team-logos/kia.png",
  hanwha: "/team-logos/hanwha.png",
  national: nationalLogoSrc
};

const sizeClass = {
  sm: "team-logo-sm",
  md: "team-logo-md",
  lg: "team-logo-lg"
};

const pixelSize = {
  sm: 30,
  md: 46,
  lg: 64
};

export function TeamLogo({ teamId, size = "md", showName = false }: TeamLogoProps) {
  const team = (() => {
    try {
      return getTeam(teamId);
    } catch {
      if (teamId === "national") {
        return { id: teamId, name: "아시안게임 국가대표팀", shortName: "국가대표", initial: "N", color: "#0f4c81" };
      }
      return { id: teamId, name: teamId, shortName: teamId, initial: "?", color: "#475569" };
    }
  })();
  const src = logoSrcByTeamId[teamId];

  if (!src) {
    return (
      <span className="team-badge-wrap">
        <span
          className={`team-badge team-badge-${size}`}
          style={{ background: team.color } as CSSProperties}
          aria-label={team.name}
        >
          <span className="team-badge-initial">{team.initial}</span>
        </span>
        {showName ? <span className="team-badge-name">{team.shortName}</span> : null}
      </span>
    );
  }

  return (
    <span className="team-logo-wrap">
      <span className={`team-logo ${sizeClass[size]}`} aria-label={team.name}>
        <Image
          src={src}
          alt=""
          width={pixelSize[size]}
          height={pixelSize[size]}
          className="team-logo-img"
          priority={size === "lg"}
        />
      </span>
      {showName ? <span className="team-badge-name">{team.shortName}</span> : null}
    </span>
  );
}
