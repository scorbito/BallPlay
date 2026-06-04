// 공용 1000판 시뮬 모듈 — scripts/sim-1000-sample.mts 의 시뮬+집계 로직을 server-side 함수로 추출.
// /api/cron/sim-1000 핸들러가 경기별로 호출.
//
// 입력: gameId + 양팀 ID + 오늘 선발투수 이름.
// 동작:
//   1. bp_team_recent_lineups 에서 양 팀 최신 타순(어제 라인업) 조회.
//   2. 오늘 선발투수 이름 → 로스터 ID 매칭 (실패 시 autoPitcherLineup 폴백).
//   3. 나머지 투수 슬롯은 fillMissingPitcherSlots 자동.
//   4. simulateGame × N(1000) seed 0..N-1.
//   5. 승/패/평균득점/히스토그램/박스스코어/MVP 빈도 집계.
//
// fail 케이스:
//   - 라인업 데이터 없음 → { ok:false, error:"recent_lineups[teamId]: 데이터 없음" }
//   - 타순 9명 미달 → buildSimTeamInput 가 ok:false → throw
//   - 선발 매칭 실패 → autoPitcherLineup 가 stamina 1위 폴백 (성공)
// throw 가 발생하면 핸들러 쪽 try/catch 가 error 문자열로 변환.

import type { SupabaseClient } from "@supabase/supabase-js";

import { simulateGame, buildSimTeamInput, SIM_ENGINE_VERSION } from "@/lib/sim";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { getRoster } from "@/lib/rosters";
import type { SavedLineup, Position, LineupOrder, LineupSlot } from "@/lib/types/lineup";
import type { SimGameResult, SimTeamInput } from "@/lib/sim/types";

const N_DEFAULT = 1000;

export type BatchSimInput = {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeStarter: string | null;
  awayStarter: string | null;
  /** override N (default 1000). 테스트용. */
  n?: number;
};

export type BatchSimBatterAgg = {
  name: string;
  team: string;
  pa: number;
  ab: number;
  hits: number;
  hr: number;
  rbi: number;
  runs: number;
  bb: number;
  k: number;
};

export type BatchSimPitcherAgg = {
  name: string;
  team: string;
  games: number;
  ipOuts: number;
  hits: number;
  runs: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
};

export type BatchSimMvpAgg = {
  name: string;
  team: string;
  count: number;
};

export type BatchSimSuccess = {
  ok: true;
  n: number;
  summary: {
    homeWins: number;
    awayWins: number;
    ties: number;
    homeAvgRuns: number;
    awayAvgRuns: number;
    extraInningCount: number;
  };
  /** diff(홈-원정) → 빈도 */
  diffHist: Record<string, number>;
  /** playerId → 누적 타격 박스라인 */
  batters: Record<string, BatchSimBatterAgg>;
  /** playerId → 누적 투구 박스라인 */
  pitchers: Record<string, BatchSimPitcherAgg>;
  /** playerId → MVP 횟수 */
  mvpFreq: Record<string, BatchSimMvpAgg>;
  engineVersion: string;
  lineupSource: { home: string | null; away: string | null };
  elapsedMs: number;
};

export type BatchSimFailure = { ok: false; error: string };

export type BatchSimResult = BatchSimSuccess | BatchSimFailure;

type RecentBatter = {
  order: number;
  name: string;
  position: string | null;
  rosterId: string | null;
};

type RecentLineupRow = {
  team_id: string;
  game_date: string;
  batting: RecentBatter[];
  starter_name: string | null;
};

async function getLatestLineup(
  client: SupabaseClient,
  teamId: string
): Promise<RecentLineupRow> {
  const { data, error } = await client
    .from("bp_team_recent_lineups")
    .select("team_id, game_date, batting, starter_name")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`recent_lineups[${teamId}]: ${error.message}`);
  if (!data) throw new Error(`recent_lineups[${teamId}]: 데이터 없음`);
  return data as RecentLineupRow;
}

function findRosterIdByName(teamId: string, name: string | null): string | null {
  if (!name) return null;
  const roster = getRoster(teamId);
  if (!roster) return null;
  const trimmed = name.trim();
  const exact = roster.find((p) => p.name === trimmed);
  if (exact) return exact.id;
  const partial = roster.find((p) => p.name.includes(trimmed) || trimmed.includes(p.name));
  return partial?.id ?? null;
}

function buildTeam(
  teamId: string,
  recent: RecentLineupRow,
  todayStarterName: string | null,
  displayName: string
): SimTeamInput {
  // 타순: bp_team_recent_lineups.batting 의 rosterId 우선, 없으면 이름 매칭 폴백.
  const slots: LineupSlot[] = recent.batting.map((b, i) => {
    let pid = b.rosterId;
    if (!pid) {
      pid = findRosterIdByName(teamId, b.name);
    }
    return {
      order: ((b.order ?? i + 1) as LineupOrder),
      playerId: pid ?? "",
      position: (b.position as Position) ?? "DH"
    };
  });
  const batting: SavedLineup = {
    teamId,
    slots,
    useDH: true,
    updatedAt: new Date().toISOString()
  };

  // 투수 슬롯[0] = 오늘 선발(이름 매칭). 실패 시 null → fillMissingPitcherSlots 가 stamina 1위 폴백.
  const starterId = findRosterIdByName(teamId, todayStarterName);
  const initialSlots: (string | null)[] = Array(9).fill(null);
  initialSlots[0] = starterId;
  const roster = getRoster(teamId);
  const validIds = new Set(roster.map((p) => p.id));
  const pitching = fillMissingPitcherSlots(teamId, initialSlots, validIds);
  if (!pitching) {
    throw new Error(`fillMissingPitcherSlots 실패: ${teamId}`);
  }

  const stats = buildStatsDirectory([teamId]);
  const built = buildSimTeamInput(teamId, batting, pitching, stats, displayName);
  if (!built.ok) {
    throw new Error(`buildSimTeamInput 실패[${teamId}]: ${JSON.stringify(built.issues)}`);
  }
  return built.team;
}

export async function runBatchSim(
  client: SupabaseClient,
  input: BatchSimInput
): Promise<BatchSimResult> {
  const N = input.n ?? N_DEFAULT;
  try {
    const [homeRecent, awayRecent] = await Promise.all([
      getLatestLineup(client, input.homeTeamId),
      getLatestLineup(client, input.awayTeamId)
    ]);

    const homeTeam = buildTeam(
      input.homeTeamId,
      homeRecent,
      input.homeStarter,
      `${input.homeTeamId} (홈)`
    );
    const awayTeam = buildTeam(
      input.awayTeamId,
      awayRecent,
      input.awayStarter,
      `${input.awayTeamId} (원정)`
    );

    // ── 1000판 실행 ──
    const t0 = Date.now();
    const results: SimGameResult[] = [];
    for (let seed = 0; seed < N; seed++) {
      results.push(simulateGame({ home: homeTeam, away: awayTeam, context: {} }, seed));
    }
    const elapsedMs = Date.now() - t0;

    // ── 이름 매핑 ──
    const nameMap: Record<string, { name: string; team: string }> = {};
    for (const b of homeTeam.batters) nameMap[b.playerId] = { name: b.name, team: input.homeTeamId };
    for (const b of awayTeam.batters) nameMap[b.playerId] = { name: b.name, team: input.awayTeamId };
    nameMap[homeTeam.starter.playerId] = { name: homeTeam.starter.name, team: input.homeTeamId };
    nameMap[awayTeam.starter.playerId] = { name: awayTeam.starter.name, team: input.awayTeamId };
    for (const p of homeTeam.bullpen) nameMap[p.playerId] = { name: p.name, team: input.homeTeamId };
    for (const p of awayTeam.bullpen) nameMap[p.playerId] = { name: p.name, team: input.awayTeamId };

    // ── 집계 ──
    let homeWins = 0;
    let awayWins = 0;
    let ties = 0;
    let homeRunsSum = 0;
    let awayRunsSum = 0;
    let extraInningCount = 0;
    const diffHist: Record<string, number> = {};

    type BatAgg = { pa: number; ab: number; hits: number; hr: number; rbi: number; runs: number; bb: number; k: number };
    type PitchAgg = { games: number; ipOuts: number; hits: number; runs: number; er: number; bb: number; k: number; hr: number };
    const batAgg: Record<string, BatAgg> = {};
    const pitchAgg: Record<string, PitchAgg> = {};
    const mvpCount: Record<string, number> = {};

    for (const r of results) {
      const h = r.finalScore.home;
      const a = r.finalScore.away;
      if (h > a) homeWins++;
      else if (a > h) awayWins++;
      else ties++;
      homeRunsSum += h;
      awayRunsSum += a;
      const d = h - a;
      const key = String(d);
      diffHist[key] = (diffHist[key] ?? 0) + 1;
      if (r.innings.length > 9) extraInningCount++;

      for (const [pid, b] of Object.entries(r.boxScore.batting)) {
        const acc = (batAgg[pid] ??= { pa: 0, ab: 0, hits: 0, hr: 0, rbi: 0, runs: 0, bb: 0, k: 0 });
        acc.pa += b.pa;
        acc.ab += b.ab;
        acc.hits += b.hits;
        acc.hr += b.homers;
        acc.rbi += b.rbi;
        acc.runs += b.runs;
        acc.bb += b.walks;
        acc.k += b.strikeouts;
      }
      for (const [pid, p] of Object.entries(r.boxScore.pitching)) {
        const acc = (pitchAgg[pid] ??= { games: 0, ipOuts: 0, hits: 0, runs: 0, er: 0, bb: 0, k: 0, hr: 0 });
        acc.games += 1;
        acc.ipOuts += p.ipOuts;
        acc.hits += p.hits;
        acc.runs += p.runs;
        acc.er += p.earnedRuns;
        acc.bb += p.walks;
        acc.k += p.strikeouts;
        acc.hr += p.homers;
      }
      if (r.mvp?.playerId) {
        mvpCount[r.mvp.playerId] = (mvpCount[r.mvp.playerId] ?? 0) + 1;
      }
    }

    // ── 출력용 구조로 변환 (이름·팀 포함) ──
    const batters: Record<string, BatchSimBatterAgg> = {};
    for (const [pid, agg] of Object.entries(batAgg)) {
      const info = nameMap[pid] ?? { name: pid, team: "?" };
      batters[pid] = { name: info.name, team: info.team, ...agg };
    }
    const pitchers: Record<string, BatchSimPitcherAgg> = {};
    for (const [pid, agg] of Object.entries(pitchAgg)) {
      const info = nameMap[pid] ?? { name: pid, team: "?" };
      pitchers[pid] = { name: info.name, team: info.team, ...agg };
    }
    const mvpFreq: Record<string, BatchSimMvpAgg> = {};
    for (const [pid, count] of Object.entries(mvpCount)) {
      const info = nameMap[pid] ?? { name: pid, team: "?" };
      mvpFreq[pid] = { name: info.name, team: info.team, count };
    }

    return {
      ok: true,
      n: N,
      summary: {
        homeWins,
        awayWins,
        ties,
        homeAvgRuns: homeRunsSum / N,
        awayAvgRuns: awayRunsSum / N,
        extraInningCount
      },
      diffHist,
      batters,
      pitchers,
      mvpFreq,
      engineVersion: SIM_ENGINE_VERSION,
      lineupSource: { home: homeRecent.game_date, away: awayRecent.game_date },
      elapsedMs
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
