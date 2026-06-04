// bp_sim_results 조회 헬퍼 — 1000판 시뮬 결과.
// 매일 09시 KST cron 이 채우는 캐시 (app/api/cron/sim-1000). /predict/sim-1000 페이지가 조회.
// 읽기는 RLS 로 anon 모두 허용 — 클라이언트 supabase 인스턴스로 직접 호출 가능.

import type { SupabaseClient } from "@supabase/supabase-js";

/** 점수차 → 발생 횟수. 예: { "+1": 162, "-1": 160, "0": 18 } (홈 기준). */
export type SimDiffHist = Record<string, number>;

/** 시뮬 누적 타자 박스스코어 (1000판 합계). */
export type SimBatterAggregate = {
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

/** 시뮬 누적 투수 박스스코어 (1000판 합계). ipOuts = 아웃카운트 누적. */
export type SimPitcherAggregate = {
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

/** MVP 빈도 (1000판 중 해당 선수가 MVP로 뽑힌 횟수). */
export type SimMvpFreq = {
  name: string;
  team: string;
  count: number;
};

export type BpSimResultRow = {
  id: string;
  game_id: string;
  game_date: string;
  run_at: string;
  home_team_id: string;
  away_team_id: string;
  home_starter: string | null;
  away_starter: string | null;
  lineup_source_home: string | null;
  lineup_source_away: string | null;
  n: number;
  home_wins: number;
  away_wins: number;
  ties: number;
  home_avg_runs: number;
  away_avg_runs: number;
  extra_inning_count: number;
  diff_hist: SimDiffHist;
  batters: Record<string, SimBatterAggregate>;
  pitchers: Record<string, SimPitcherAggregate>;
  mvp_freq: Record<string, SimMvpFreq>;
  engine_version: string;
};

/** 새 백엔드 명세상의 별칭 — UI 는 BpSimResultRow 를 그대로 쓰지만, 명세서엔 SimResultRow 로 등장. */
export type SimResultRow = BpSimResultRow;

const TABLE = "bp_sim_results";

const SELECT_COLS =
  "id,game_id,game_date,run_at,home_team_id,away_team_id,home_starter,away_starter,lineup_source_home,lineup_source_away,n,home_wins,away_wins,ties,home_avg_runs,away_avg_runs,extra_inning_count,diff_hist,batters,pitchers,mvp_freq,engine_version";

/** 특정 날짜의 1000판 시뮬 결과 목록. 카드 리스트용. */
export async function listSimResultsForDate(
  client: SupabaseClient,
  dateISO: string
): Promise<{ ok: true; rows: BpSimResultRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("game_date", dateISO)
    .order("game_id", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as BpSimResultRow[] };
}

/** 단일 경기의 1000판 시뮬 결과. 상세 페이지용.
 *  gameDate 인자가 있으면 (game_id, game_date) 정확 매칭 — cron UPSERT 의 unique 키와 일치.
 *  생략 시 game_id 만으로 maybeSingle — 동일 game_id 가 여러 날짜에 걸쳐 있을 일이 없다는 가정.
 *  (game_id 는 uuid pk 라 사실상 충돌 0)
 */
export async function getSimResultByGameId(
  client: SupabaseClient,
  gameId: string,
  gameDate?: string
): Promise<{ ok: true; row: BpSimResultRow | null } | { ok: false; error: string }> {
  let q = client.from(TABLE).select(SELECT_COLS).eq("game_id", gameId);
  if (gameDate) q = q.eq("game_date", gameDate);
  const { data, error } = await q.maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data ?? null) as unknown as BpSimResultRow | null };
}

/** 시뮬 결과가 존재하는 날짜 목록 (prev/next 네비게이션용).
 *  opts.from / opts.to 가 주어지면 그 범위에서, opts.limit 만 주어지면 최신 N건.
 *  둘 다 없으면 최근 30일 윈도우. distinct 는 클라이언트 측 dedupe (supabase-js 미지원). */
export async function listSimResultDates(
  client: SupabaseClient,
  opts?: { from?: string; to?: string; limit?: number }
): Promise<{ ok: true; dates: string[] } | { ok: false; error: string }> {
  const limit = opts?.limit ?? 60;

  let q = client.from(TABLE).select("game_date").order("game_date", { ascending: false });
  if (opts?.from) q = q.gte("game_date", opts.from);
  if (opts?.to) q = q.lte("game_date", opts.to);
  // limit 은 distinct 이전이라 여유롭게.
  q = q.limit(Math.max(limit * 10, 100));

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const seen = new Set<string>();
  const dates: string[] = [];
  for (const row of (data ?? []) as Array<{ game_date: string }>) {
    if (seen.has(row.game_date)) continue;
    seen.add(row.game_date);
    dates.push(row.game_date);
    if (dates.length >= limit) break;
  }
  return { ok: true, dates };
}
