import { createSupabaseAdminClient } from "@/lib/supabase/server";

type BoxCell = { Text?: string };
type BoxRow = { row?: BoxCell[] };
type GridTable = { rows?: BoxRow[] };

type TeamGameStatsRow = {
  game_id: string;
  game_date: string;
  team_id: string;
  opponent_team_id: string;
  is_home: boolean;
  raw_box_score: {
    pitcher?: {
      table?: unknown;
    } | null;
  } | null;
  collected_at: string | null;
};

type PitcherGameLogRow = {
  game_id: string;
  game_date: string;
  team_id: string;
  opponent_team_id: string;
  is_home: boolean;
  pitcher_name: string;
  pitcher_order: string;
  result: string | null;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  outs: number;
  innings_text: string;
  batters_faced: number;
  pitches: number;
  at_bats: number;
  hits_allowed: number;
  homers_allowed: number;
  walks_hbp: number;
  strikeouts: number;
  runs_allowed: number;
  earned_runs: number;
  era_after: number | null;
  raw_cells: string[];
  source: string;
  collected_at: string;
};

export type PitcherGameLogBackfillResult = {
  from: string;
  to: string;
  sourceRows: number;
  parsedLogs: number;
  upsertedLogs: number;
  aggregateRows: number;
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/&nbsp;/g, "").trim();
}

function parseIntSafe(value: unknown): number {
  const text = cleanText(value).replace(/[^\d-]/g, "");
  if (!text) return 0;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumberSafe(value: unknown): number | null {
  const text = cleanText(value).replace(/,/g, "");
  if (!text || text === "-") return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTable(value: unknown): GridTable {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as GridTable;
    } catch {
      return {};
    }
  }
  return value as GridTable;
}

function rowCells(row: BoxRow | undefined): string[] {
  return (row?.row ?? []).map((cell) => cleanText(cell.Text));
}

function parseOuts(inningsText: string): number {
  const normalized = cleanText(inningsText).replace(/\s+/g, " ");
  if (!normalized || normalized === "-") return 0;

  const mixedMatch = normalized.match(/^(\d+)\s+([012])\/3$/);
  if (mixedMatch) {
    return Number.parseInt(mixedMatch[1], 10) * 3 + Number.parseInt(mixedMatch[2], 10);
  }

  const fractionMatch = normalized.match(/^([012])\/3$/);
  if (fractionMatch) return Number.parseInt(fractionMatch[1], 10);

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return 0;

  const fullInnings = Math.trunc(numeric);
  const decimal = Math.round((numeric - fullInnings) * 10);
  if (decimal === 1 || decimal === 2) return fullInnings * 3 + decimal;
  return Math.round(numeric * 3);
}

function decimalInnings(outs: number): number {
  return Math.round((outs / 3) * 1000) / 1000;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

function parsePitcherRows(row: TeamGameStatsRow): PitcherGameLogRow[] {
  const table = parseTable(row.raw_box_score?.pitcher?.table);
  const logs: PitcherGameLogRow[] = [];

  for (let index = 0; index < (table.rows ?? []).length; index++) {
    const tableRow = table.rows?.[index];
    const cells = rowCells(tableRow);
    const name = cells[0];
    if (!name || name === "TOTAL") continue;

    const last = cells.slice(-11);
    if (last.length < 11) continue;

    const result = cells[2] || null;
    const inningsText = last[0] || "0";
    const outs = parseOuts(inningsText);

    logs.push({
      game_id: row.game_id,
      game_date: row.game_date,
      team_id: row.team_id,
      opponent_team_id: row.opponent_team_id,
      is_home: row.is_home,
      pitcher_name: name,
      pitcher_order: String(index + 1),
      result,
      wins: result === "승" ? 1 : 0,
      losses: result === "패" ? 1 : 0,
      saves: result === "세" ? 1 : 0,
      holds: result === "홀" ? 1 : 0,
      outs,
      innings_text: inningsText,
      batters_faced: parseIntSafe(last[1]),
      pitches: parseIntSafe(last[2]),
      at_bats: parseIntSafe(last[3]),
      hits_allowed: parseIntSafe(last[4]),
      homers_allowed: parseIntSafe(last[5]),
      walks_hbp: parseIntSafe(last[6]),
      strikeouts: parseIntSafe(last[7]),
      runs_allowed: parseIntSafe(last[8]),
      earned_runs: parseIntSafe(last[9]),
      era_after: parseNumberSafe(last[10]),
      raw_cells: cells,
      source: "bp-team-game-stats-raw-box-score",
      collected_at: row.collected_at ?? new Date().toISOString()
    });
  }

  return logs;
}

type Aggregate = {
  pitcher_name: string;
  team_id: string;
  opponent_team_id: string;
  games: number;
  starts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  outs: number;
  innings: number;
  batters_faced: number;
  pitches: number;
  hits_allowed: number;
  homers_allowed: number;
  walks_hbp: number;
  strikeouts: number;
  runs_allowed: number;
  earned_runs: number;
  era: number | null;
  whip: number | null;
  k9: number | null;
  bb9: number | null;
  last_game_date: string;
};

function buildAggregates(logs: PitcherGameLogRow[]): Aggregate[] {
  const groups = new Map<string, Aggregate>();

  for (const log of logs) {
    const key = `${log.pitcher_name}|${log.team_id}|${log.opponent_team_id}`;
    const current = groups.get(key) ?? {
      pitcher_name: log.pitcher_name,
      team_id: log.team_id,
      opponent_team_id: log.opponent_team_id,
      games: 0,
      starts: 0,
      wins: 0,
      losses: 0,
      saves: 0,
      holds: 0,
      outs: 0,
      innings: 0,
      batters_faced: 0,
      pitches: 0,
      hits_allowed: 0,
      homers_allowed: 0,
      walks_hbp: 0,
      strikeouts: 0,
      runs_allowed: 0,
      earned_runs: 0,
      era: null,
      whip: null,
      k9: null,
      bb9: null,
      last_game_date: log.game_date
    };

    current.games += 1;
    current.starts += log.pitcher_order === "1" ? 1 : 0;
    current.wins += log.wins;
    current.losses += log.losses;
    current.saves += log.saves;
    current.holds += log.holds;
    current.outs += log.outs;
    current.batters_faced += log.batters_faced;
    current.pitches += log.pitches;
    current.hits_allowed += log.hits_allowed;
    current.homers_allowed += log.homers_allowed;
    current.walks_hbp += log.walks_hbp;
    current.strikeouts += log.strikeouts;
    current.runs_allowed += log.runs_allowed;
    current.earned_runs += log.earned_runs;
    if (log.game_date > current.last_game_date) current.last_game_date = log.game_date;

    groups.set(key, current);
  }

  return Array.from(groups.values()).map((aggregate) => {
    const innings = decimalInnings(aggregate.outs);
    const era = rate(aggregate.earned_runs * 27, aggregate.outs);
    const whip = rate((aggregate.hits_allowed + aggregate.walks_hbp) * 3, aggregate.outs);
    const k9 = rate(aggregate.strikeouts * 27, aggregate.outs);
    const bb9 = rate(aggregate.walks_hbp * 27, aggregate.outs);
    return { ...aggregate, innings, era, whip, k9, bb9 };
  });
}

export async function backfillPitcherGameLogsFromTeamStats(
  from: string,
  to: string
): Promise<PitcherGameLogBackfillResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bp_team_game_stats")
    .select("game_id,game_date,team_id,opponent_team_id,is_home,raw_box_score,collected_at")
    .gte("game_date", from)
    .lte("game_date", to)
    .order("game_date", { ascending: true });

  if (error) throw new Error(error.message);

  const sourceRows = (data ?? []) as TeamGameStatsRow[];
  const logs = sourceRows.flatMap(parsePitcherRows);

  let upsertedLogs = 0;
  if (logs.length > 0) {
    const { error: logError } = await supabase
      .from("bp_pitcher_game_logs")
      .upsert(logs, { onConflict: "game_id,team_id,pitcher_name,pitcher_order" });
    if (logError) throw new Error(logError.message);
    upsertedLogs = logs.length;
  }

  const aggregates = buildAggregates(logs);
  if (aggregates.length > 0) {
    const { error: aggregateError } = await supabase
      .from("bp_pitcher_vs_team_stats")
      .upsert(aggregates, { onConflict: "pitcher_name,team_id,opponent_team_id" });
    if (aggregateError) throw new Error(aggregateError.message);
  }

  return {
    from,
    to,
    sourceRows: sourceRows.length,
    parsedLogs: logs.length,
    upsertedLogs,
    aggregateRows: aggregates.length
  };
}
