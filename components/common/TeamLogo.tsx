import Image from "next/image";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";

type TeamLogoProps = {
  teamId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
};

const logoSrcByTeamId: Record<string, string> = {
  doosan: "/team-logos/doosan.png",
  lg: "/team-logos/lg.png",
  kt: "/team-logos/kt.png",
  ssg: "/team-logos/ssg.png",
  nc: "/team-logos/nc.png",
  kiwoom: "/team-logos/kiwoom.png",
  samsung: "/team-logos/samsung.png",
  lotte: "/team-logos/lotte.png",
  kia: "/team-logos/kia.png",
  hanwha: "/team-logos/hanwha.png"
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
  const team = getTeam(teamId);
  const src = logoSrcByTeamId[teamId];

  if (!src) {
    return <TeamBadge teamId={teamId} size={size} showName={showName} />;
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
