// 뉴스 제목 ↔ KBO 팀 매칭 — 서버 쿼리·클라이언트 필터 양쪽에서 재사용.
// teams 상수만 의존하므로 client-safe (서버 전용 import 없음).

import { teams, getTeam } from "@/lib/constants/teams";

/** 팀 매칭 키워드 — 풀네임 토큰("두산","베어스") + shortName. */
export function teamKeywords(teamId: string): string[] {
  const team = getTeam(teamId);
  const set = new Set<string>();
  team.name.split(/\s+/).forEach((t) => {
    if (t) set.add(t);
  });
  if (team.shortName) set.add(team.shortName);
  return Array.from(set);
}

/** 제목에 해당 팀 키워드가 하나라도 포함되는지 (대소문자 무시). */
export function titleMatchesTeam(title: string, teamId: string): boolean {
  const lower = title.toLowerCase();
  return teamKeywords(teamId).some((k) => lower.includes(k.toLowerCase()));
}

/** 필터 UI용 — 전체 팀 목록 (id + 짧은 이름). */
export const TEAM_FILTER_OPTIONS = teams.map((t) => ({
  id: t.id,
  label: t.shortName
}));
