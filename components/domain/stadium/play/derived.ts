import type { BaseState, SimGameInput, SimPitcher } from "@/lib/sim/types";
import type { MatchSession } from "@/lib/sim/matchSession";
import { EMPTY_BASE, type FlatEvent } from "./types";

// 사용자 지정 팀명(라인업 이름) 우선, 없으면 KBO 정식 팀명 폴백
export function deriveTeamLabel(displayName: string | undefined, fallbackShortName: string): string {
  return displayName?.trim() || fallbackShortName;
}

// 닉네임 표시 — 친구/공개 매치에서 양쪽 사람 닉네임을 팀뱃지 위에 노출.
// AI/self 매치는 닉네임 자체가 의미 없어 표시 안 함.
export function formatNickname(
  side: "home" | "away",
  session: MatchSession,
  myNickname: string,
  oppNickname: string
): string | null {
  const showNicknames = session.source === "friend" || session.source === "public";
  if (!showNicknames) return null;
  return session.userSide === side ? myNickname : oppNickname;
}

// 현재 타석 인덱스 — visible 마지막 타석 batterId 로 라인업에서 위치 찾기.
export function deriveCurrentBatterIdx(
  events: FlatEvent[],
  cursor: number,
  half: "top" | "bottom",
  batters: { playerId: string }[]
): number {
  const visible = events.slice(0, cursor);
  const lastBatterId = [...visible].reverse().find((ev) => ev.half === half)?.ab.batterId ?? null;
  return lastBatterId ? batters.findIndex((b) => b.playerId === lastBatterId) : -1;
}

// 현재 등판 투수 — 그 팀이 수비할 때(상대 공격) 가장 최근 던진 투수.
// away팀 수비 = home 공격 = bottom half / home팀 수비 = away 공격 = top half
export function deriveCurrentPitcher(
  events: FlatEvent[],
  cursor: number,
  defensiveHalf: "top" | "bottom",
  pitcherById: Map<string, SimPitcher>,
  starter: SimPitcher
): SimPitcher {
  const visible = events.slice(0, cursor);
  const lastPitcherId =
    [...visible].reverse().find((ev) => ev.half === defensiveHalf)?.ab.pitcherId ?? null;
  return lastPitcherId ? pitcherById.get(lastPitcherId) ?? starter : starter;
}

// 다이아몬드/아웃카운트 — 현재 이닝의 visible 마지막 타석에서 가져옴. 비었으면 0 outs/empty.
// showOutcome이 false면 "타석 진행 중" 상태 — 이전 타석의 baseStateAfter 사용 (이 타석 결과는 아직 미반영)
export function deriveBaseState(
  currentInningEvents: FlatEvent[],
  showOutcome: boolean
): { baseState: BaseState; outs: 0 | 1 | 2 | 3 } {
  const lastInInning = currentInningEvents[currentInningEvents.length - 1];
  const hasCurrentPreEvent = !showOutcome && !!lastInInning?.ab.preEvents?.length;
  if (hasCurrentPreEvent) {
    return {
      baseState: lastInInning.ab.baseStateBefore,
      outs: lastInInning.ab.outsBefore
    };
  }
  const stateRefAb =
    !showOutcome && currentInningEvents.length >= 2
      ? currentInningEvents[currentInningEvents.length - 2].ab
      : lastInInning?.ab;
  const baseState: BaseState =
    !showOutcome && currentInningEvents.length === 1
      ? EMPTY_BASE
      : stateRefAb?.baseStateAfter ?? EMPTY_BASE;
  const outsValue =
    !showOutcome && currentInningEvents.length === 1
      ? 0
      : stateRefAb?.outsAfter ?? 0;
  const outs = Math.min(3, outsValue) as 0 | 1 | 2 | 3;
  return { baseState, outs };
}

// 상단 헤더 타이틀 — 진행 중엔 이닝 정보, 종료 시엔 "경기 종료"
export function deriveHeaderTitle(isDone: boolean, latest: FlatEvent | undefined): string {
  if (isDone) return "경기 종료";
  if (latest) return `${latest.inning}회 ${latest.half === "top" ? "초" : "말"}`;
  return "경기 시작";
}

// 매치 종류 — 모든 경기에서 표시. 양쪽 lineup_id 있으면 정식(전적 집계), 아니면 연습.
// public: 항상 양쪽 lineup_id 있음 → 정식
// 공식 매치 판정 — source='public' (공개 매치 도전) 이면서 양쪽 라인업 ID 둘 다 있을 때만.
// friend/ai/self 는 무조건 연습 (랭킹·전적 집계 안 됨).
export function deriveIsOfficial(session: MatchSession | null | undefined): boolean {
  return session?.source === "public" && !!session?.myLineupId && !!session?.opponentLineupId;
}
