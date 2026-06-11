// 관전형 가상경기 — 대전 팀 2개만 정해지면 최신 라인업 + 오늘 선발투수로 매치를 구성한다.
//   - 양쪽 모두 buildFakeOpponentTeam 으로 생성(내 라인업 개입 없음)이라 "AI팀 vs AI팀" 관전 매치.
//   - 예측 데이터에 의존하지 않으므로 AI 승리팀 예측, 주중시리즈 예측, 일정/결과 등
//     "팀 둘이 붙는" 어떤 화면에서도 그대로 재사용 가능.
//   - 라우팅/토스트는 호출부가 처리하도록 결과만 반환한다(UI 비의존).

import { getRoster } from "@/lib/rosters";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildFakeOpponentTeam, type RecentLineupHint } from "@/lib/sim/fakeOpponent";
import {
  getLatestBattingLineupForTeam,
  type RecentLineupRow
} from "@/lib/supabase/query-parts/bpRecentLineups";
import {
  applyBlendedStatsToTeam,
  buildStatsDirectoryWithRecentForm
} from "@/lib/sim/statsLoaderWithRecent";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

/** 가상경기를 돌리는 데 필요한 최소 입력 — 팀 2개와(선택) 선발투수 이름. */
export type SpectatorMatchGame = {
  homeTeamId: string;
  awayTeamId: string;
  /** 오늘 선발 이름. 없으면 최근 라인업 선발 → 폴백(스태미나 상위 SP) 순으로 결정. */
  homeStarter?: string | null;
  awayStarter?: string | null;
};

export type SpectatorMatchResult =
  | { ok: true }
  | { ok: false; reason: string };

type StartSpectatorMatchOptions = {
  returnHref?: string;
};

/** 이름으로 로스터의 rosterId 를 역추적. 정확 일치 → 부분 일치 순. */
function findRosterIdByName(teamId: string, name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const roster = getRoster(teamId);
  const exact = roster.find((p) => p.name === trimmed);
  if (exact) return exact.id;
  const partial = roster.find((p) => p.name.includes(trimmed) || trimmed.includes(p.name));
  return partial?.id ?? null;
}

/** 최근 라인업 row + 오늘 선발 이름 → buildFakeOpponentTeam 이 받는 hint 로 변환. */
function toRecentLineupHint(
  teamId: string,
  row: RecentLineupRow | null,
  starterName: string | null | undefined
): RecentLineupHint | null {
  if (!row || !Array.isArray(row.batting) || row.batting.length < 9) return null;
  return {
    batting: row.batting,
    starter_roster_id: findRosterIdByName(teamId, starterName ?? null) ?? row.starter_roster_id,
    starter_name: starterName ?? row.starter_name
  };
}

/**
 * 대전 팀 2개로 관전형 가상경기 세션을 구성해 sessionStorage 에 저장한다.
 * 성공 시 호출부에서 router.push("/stadium/play") 하면 된다.
 * 실패는 throw 없이 { ok:false, reason } 으로 돌려준다(호출부가 토스트로 노출).
 */
export async function startSpectatorMatch(
  game: SpectatorMatchGame,
  options: StartSpectatorMatchOptions = {}
): Promise<SpectatorMatchResult> {
  try {
    const seed = generateSeed();
    const client = createSupabaseBrowserClient();
    const [statsDir, homeLineupRes, awayLineupRes] = await Promise.all([
      buildStatsDirectoryWithRecentForm(client, [game.homeTeamId, game.awayTeamId]),
      getLatestBattingLineupForTeam(client, game.homeTeamId),
      getLatestBattingLineupForTeam(client, game.awayTeamId)
    ]);
    if (!homeLineupRes.ok || !awayLineupRes.ok) {
      return { ok: false, reason: "최신 라인업을 불러올 수 없어요." };
    }
    const homeHint = toRecentLineupHint(game.homeTeamId, homeLineupRes.row, game.homeStarter);
    const awayHint = toRecentLineupHint(game.awayTeamId, awayLineupRes.row, game.awayStarter);
    if (!homeHint || !awayHint) {
      return { ok: false, reason: "DB에 저장된 최신 라인업이 부족해요." };
    }
    const homeRaw = buildFakeOpponentTeam(game.homeTeamId, seed + 101, homeHint);
    const awayRaw = buildFakeOpponentTeam(game.awayTeamId, seed + 202, awayHint);
    if (!homeRaw || !awayRaw) {
      return { ok: false, reason: "가상 경기 라인업을 만들 수 없어요." };
    }
    const home = applyBlendedStatsToTeam(homeRaw, statsDir);
    const away = applyBlendedStatsToTeam(awayRaw, statsDir);
    saveMatchSession({
      myTeamId: game.homeTeamId,
      opponentTeamId: game.awayTeamId,
      seed,
      input: { home, away, context: {} },
      startedAt: new Date().toISOString(),
      source: "ai",
      returnHref: options.returnHref
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "가상 경기를 준비하는 중 오류가 발생했어요." };
  }
}
