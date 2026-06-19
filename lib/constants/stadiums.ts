const UNKNOWN_STADIUM_VALUES = new Set(["미정", "未定", "TBD", "-"]);

export const HOME_STADIUM_BY_TEAM_ID: Record<string, string> = {
  doosan: "잠실",
  lg: "잠실",
  kiwoom: "고척",
  ssg: "문학",
  nc: "창원",
  kia: "광주",
  samsung: "대구",
  lotte: "사직",
  kt: "수원",
  hanwha: "대전"
};

export function isKnownStadium(stadium: string | null | undefined): stadium is string {
  const normalized = stadium?.trim();
  return Boolean(normalized && !UNKNOWN_STADIUM_VALUES.has(normalized));
}

export function resolveDisplayStadium(stadium: string | null | undefined, homeTeamId: string | null | undefined): string {
  if (isKnownStadium(stadium)) return stadium.trim();
  return homeTeamId ? HOME_STADIUM_BY_TEAM_ID[homeTeamId] ?? "" : "";
}
