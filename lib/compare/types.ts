// /compare(팀 전력비교) API ↔ 클라이언트 공유 타입.

import type { SimBatter, SimPitcher } from "@/lib/sim/types";

/** 타순 슬롯 — 최근 라인업 9인 표시/편집용. rosterId 로 스탯 조회. */
export type CompareLineupSlot = {
  order: number;
  rosterId: string;
  name: string;
  position: string | null;
};

/** 선발 후보(오늘/최근 등판) — 드롭다운 표시용. */
export type CompareStarterOption = {
  rosterId: string;
  name: string;
  lastDate: string | null;
};

export type CompareStanding = {
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  form: Array<"W" | "L" | "D">;
};

/** 한 팀의 전력비교 원천 데이터. 클라이언트가 이걸로 지수를 계산/재계산한다. */
export type CompareTeamData = {
  teamId: string;
  season: number;
  standing: CompareStanding | null;
  /** 오늘/최근 경기 선발 (없으면 null) */
  recentStarter: CompareStarterOption | null;
  /** 최근 등판 선발 후보 목록(로테이션) */
  starterOptions: CompareStarterOption[];
  /** 최근 경기 타순 9인 */
  battingLineup: CompareLineupSlot[];
  /** 교체용 — 팀 로스터 전체 타자 스탯 (rosterId 키) */
  rosterBatters: SimBatter[];
  /** 교체용 — 팀 로스터 전체 투수 스탯 (rosterId 키) */
  rosterPitchers: SimPitcher[];
};

export type CompareTeamResponse =
  | ({ ok: true } & CompareTeamData)
  | { ok: false; error: string };

/** 두 팀 시즌 맞대결 전적. teamA 기준 승수. */
export type CompareH2H = {
  teamA: string;
  teamB: string;
  aWins: number;
  bWins: number;
  draws: number;
  games: number;
};

export type CompareH2HResponse =
  | ({ ok: true } & CompareH2H)
  | { ok: false; error: string };
