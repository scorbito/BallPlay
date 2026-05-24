import type { Team } from "@/lib/types/domain";

export const teams: Team[] = [
  { id: "doosan", name: "두산 베어스", shortName: "두산", initial: "D", color: "#1d3470", accent: "#ED1C24" },
  { id: "lg", name: "LG 트윈스", shortName: "LG", initial: "L", color: "#c2185b", accent: "#000000" },
  { id: "kt", name: "KT 위즈", shortName: "KT", initial: "K", color: "#262626", accent: "#EB1C24" },
  { id: "ssg", name: "SSG 랜더스", shortName: "SSG", initial: "S", color: "#ce0e2d", accent: "#FFB81C" },
  { id: "nc", name: "NC 다이노스", shortName: "NC", initial: "N", color: "#1c4b6e", accent: "#A77C40" },
  { id: "kiwoom", name: "키움 히어로즈", shortName: "키움", initial: "K", color: "#7c2737" },
  { id: "samsung", name: "삼성 라이온즈", shortName: "삼성", initial: "S", color: "#1d4e8c" },
  { id: "lotte", name: "롯데 자이언츠", shortName: "롯데", initial: "L", color: "#0e1a36", accent: "#ED1C24" },
  { id: "kia", name: "KIA 타이거즈", shortName: "KIA", initial: "K", color: "#c8102e", accent: "#06141F" },
  { id: "hanwha", name: "한화 이글스", shortName: "한화", initial: "H", color: "#d6671a", accent: "#07274C" }
];

export function getTeam(teamId: string): Team {
  const team = teams.find((item) => item.id === teamId);
  if (!team) {
    throw new Error(`Unknown team id: ${teamId}`);
  }
  return team;
}
