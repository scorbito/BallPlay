// Maps KBO API/Naver team display names to our internal team IDs.
// Our team IDs (lib/constants/teams.ts): doosan, lg, kt, ssg, nc, kiwoom, samsung, lotte, kia, hanwha

// KBO 레거시 2글자 팀 코드 (박스스코어 AWAY_ID/HOME_ID) — 정확 매칭용.
// 해태=HT(KIA), 우리=WO(키움), SK=SSG, OB=두산 등 구단 역사 코드.
const KBO_TEAM_CODE: Record<string, string> = {
  OB: "doosan", LG: "lg", KT: "kt", SK: "ssg", SSG: "ssg", NC: "nc",
  WO: "kiwoom", SS: "samsung", LT: "lotte", HT: "kia", HH: "hanwha"
};

export function parseTeamCode(name: string): string | null {
  if (!name) return null;
  const up = name.toUpperCase().trim();
  // 2글자 코드 정확 매칭 우선 (AWAY_ID 등)
  if (KBO_TEAM_CODE[up]) return KBO_TEAM_CODE[up];
  // 팀명(한글/영문) fallback
  if (up.includes("LG")) return "lg";
  if (up.includes("KT")) return "kt";
  if (up.includes("SSG") || up.includes("SK")) return "ssg";
  if (up.includes("NC")) return "nc";
  if (up.includes("두산") || up.includes("DOO") || up.includes("OB")) return "doosan";
  if (up.includes("KIA") || up.includes("기아") || up.includes("타이거즈")) return "kia";
  if (up.includes("롯데") || up.includes("LOT")) return "lotte";
  if (up.includes("삼성") || up.includes("SAM")) return "samsung";
  if (up.includes("한화") || up.includes("HAN")) return "hanwha";
  if (up.includes("키움") || up.includes("히어로즈") || up.includes("KIW")) return "kiwoom";
  return null;
}
