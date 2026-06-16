import { parseTeamCode } from "@/lib/server/kbo/teamCode";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.koreabaseball.com";

type KboGame = {
  G_ID: string;
  AWAY_ID?: string;
  HOME_ID?: string;
  AWAY_NM?: string;
  HOME_NM?: string;
  GAME_STATE_SC?: string | number;
  CANCEL_SC_ID?: string | number;
};

type BoxCell = { Text?: string };
type BoxRow = { row?: BoxCell[] };
type GridTable = {
  rows?: BoxRow[];
  tfoot?: BoxRow[];
  headers?: BoxRow[];
};

type BoxScoreScroll = {
  tableEtc?: string;
  arrHitter?: Array<{
    table1?: string;
    table2?: string;
    table3?: string;
  }>;
  arrPitcher?: Array<{
    table?: string;
  }>;
  code?: string;
  msg?: string;
};

type ScoreBoardScroll = {
  table1?: string;
  table2?: string;
  table3?: string;
  code?: string;
  msg?: string;
};

type ScoreSummary = {
  runs: number;
  hits: number;
  errors: number;
  balls: number;
};

type HitterSummary = {
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  sacrificeHits: number;
  sacrificeFlies: number;
};

type PitcherSummary = {
  battersFaced: number;
  pitches: number;
  atBats: number;
  hitsAllowed: number;
  homersAllowed: number;
  walksHbp: number;
  strikeouts: number;
  runsAllowed: number;
  earnedRuns: number;
};

type SideSpecialCounts = {
  doubles: number;
  triples: number;
  homers: number;
  gidp: number;
  stolenBases: number;
  caughtStealing: number;
  errors: number;
  wildPitches: number;
  passedBalls: number;
  pickoffs: number;
  baseRunningOuts: number;
};

type Side = "away" | "home";

type TeamGameStatsRecord = {
  game_id: string;
  game_date: string;
  team_id: string;
  opponent_team_id: string;
  is_home: boolean;
  runs: number;
  hits: number;
  errors: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  rbi: number;
  doubles: number;
  triples: number;
  homers: number;
  total_bases: number;
  gidp: number;
  stolen_bases: number;
  caught_stealing: number;
  sacrifice_hits: number;
  sacrifice_flies: number;
  pitcher_batters_faced: number;
  pitcher_pitches: number;
  pitcher_at_bats: number;
  pitcher_hits_allowed: number;
  pitcher_homers_allowed: number;
  pitcher_walks_hbp: number;
  pitcher_strikeouts: number;
  pitcher_runs_allowed: number;
  pitcher_earned_runs: number;
  late_runs: number;
  late_runs_allowed: number;
  inning_scores: number[];
  special_counts: Record<string, number>;
  raw_scoreboard: Record<string, unknown>;
  raw_box_score: Record<string, unknown>;
  source: string;
  collected_at: string;
};

export type SyncTeamGameStatsResult = {
  date: string;
  finished: number;
  upserted: number;
  dryRunRows: number;
  skipped: number;
  errors: string[];
};

export type BackfillTeamGameStatsOptions = {
  gameDelayMs?: number;
  dateDelayMs?: number;
  restEveryGames?: number;
  restMs?: number;
  dryRun?: boolean;
};

export type BackfillTeamGameStatsResult = {
  from: string;
  to: string;
  dates: SyncTeamGameStatsResult[];
  totals: {
    finished: number;
    upserted: number;
    dryRunRows: number;
    skipped: number;
    errors: number;
  };
};

const EMPTY_SPECIAL_COUNTS: SideSpecialCounts = {
  doubles: 0,
  triples: 0,
  homers: 0,
  gidp: 0,
  stolenBases: 0,
  caughtStealing: 0,
  errors: 0,
  wildPitches: 0,
  passedBalls: 0,
  pickoffs: 0,
  baseRunningOuts: 0
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateToKboDate(dateStr: string): string {
  return dateStr.replaceAll("-", "");
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function post<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `${BASE}/Schedule/GameCenter/Main.aspx`,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE
    },
    body: new URLSearchParams(body).toString()
  });

  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith("<")) throw new Error(`${path} returned HTML`);
  return JSON.parse(text) as T;
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/&nbsp;/g, "").trim();
}

function parseIntSafe(value: unknown): number {
  const text = cleanText(value).replace(/[^\d-]/g, "");
  if (!text) return 0;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

function parseScoreSummary(row: BoxRow | undefined): ScoreSummary {
  const cells = rowCells(row);
  const nums = cells.map(parseIntSafe).filter((value) => Number.isFinite(value));
  const last = nums.slice(-4);
  return {
    runs: last[0] ?? 0,
    hits: last[1] ?? 0,
    errors: last[2] ?? 0,
    balls: last[3] ?? 0
  };
}

function parseInningScores(row: BoxRow | undefined): number[] {
  return rowCells(row).map((cell) => {
    const normalized = cell.replace(/[^0-9-]/g, "");
    return normalized ? parseIntSafe(normalized) : 0;
  });
}

function lateRuns(scores: number[]): number {
  return scores.slice(6).reduce((sum, value) => sum + value, 0);
}

function buildPlayerSideMap(awayTable: GridTable, homeTable: GridTable): Map<string, Side> {
  const map = new Map<string, Side>();
  for (const row of awayTable.rows ?? []) {
    const name = rowCells(row)[2];
    if (name) map.set(name.replace(/\s+/g, ""), "away");
  }
  for (const row of homeTable.rows ?? []) {
    const name = rowCells(row)[2];
    if (name) map.set(name.replace(/\s+/g, ""), "home");
  }
  return map;
}

function parseHitterTotals(table: GridTable): HitterSummary {
  const footer = table.tfoot?.[0];
  const rows = footer ? [footer] : table.rows ?? [];
  const totals = rows.reduce(
    (acc, row) => {
      const cells = rowCells(row);
      const last = cells.slice(-5);
      acc.atBats += parseIntSafe(last[0]);
      acc.hits += parseIntSafe(last[1]);
      acc.rbi += parseIntSafe(last[2]);
      acc.runs += parseIntSafe(last[3]);
      return acc;
    },
    {
      atBats: 0,
      hits: 0,
      rbi: 0,
      runs: 0,
      walks: 0,
      hbp: 0,
      strikeouts: 0,
      sacrificeHits: 0,
      sacrificeFlies: 0
    }
  );
  return totals;
}

function countHitterEvents(table: GridTable): Pick<HitterSummary, "walks" | "hbp" | "strikeouts" | "sacrificeHits" | "sacrificeFlies"> {
  const text = (table.rows ?? []).flatMap(rowCells).join(" ");
  const matchCount = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  return {
    walks: matchCount(/(?:볼넷|4구)/g),
    hbp: matchCount(/(?:사구|死구|몸에맞는공)/g),
    strikeouts: matchCount(/삼진/g),
    sacrificeHits: matchCount(/(?:희번|희생번트)/g),
    sacrificeFlies: matchCount(/(?:희비|희생플라이)/g)
  };
}

function parsePitcherTotals(table: GridTable): PitcherSummary {
  const footer = table.tfoot?.[0];
  const rows = footer ? [footer] : table.rows ?? [];
  return rows.reduce(
    (acc, row) => {
      const cells = rowCells(row);
      const last = cells.slice(-11);
      acc.battersFaced += parseIntSafe(last[1]);
      acc.pitches += parseIntSafe(last[2]);
      acc.atBats += parseIntSafe(last[3]);
      acc.hitsAllowed += parseIntSafe(last[4]);
      acc.homersAllowed += parseIntSafe(last[5]);
      acc.walksHbp += parseIntSafe(last[6]);
      acc.strikeouts += parseIntSafe(last[7]);
      acc.runsAllowed += parseIntSafe(last[8]);
      acc.earnedRuns += parseIntSafe(last[9]);
      return acc;
    },
    {
      battersFaced: 0,
      pitches: 0,
      atBats: 0,
      hitsAllowed: 0,
      homersAllowed: 0,
      walksHbp: 0,
      strikeouts: 0,
      runsAllowed: 0,
      earnedRuns: 0
    }
  );
}

function cloneSpecialCounts(): Record<Side, SideSpecialCounts> {
  return {
    away: { ...EMPTY_SPECIAL_COUNTS },
    home: { ...EMPTY_SPECIAL_COUNTS }
  };
}

function normalizePlayerNameToken(token: string): string {
  return token
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+호/g, "")
    .replace(/\d+회/g, "")
    .replace(/[^가-힣A-Za-z]/g, "")
    .trim();
}

function extractPlayerNames(detail: string): string[] {
  return detail
    .split(/\s+/)
    .map(normalizePlayerNameToken)
    .filter((name) => name.length >= 2);
}

function incrementSpecial(counts: SideSpecialCounts, type: string): void {
  if (type === "2루타") counts.doubles += 1;
  else if (type === "3루타") counts.triples += 1;
  else if (type === "홈런") counts.homers += 1;
  else if (type === "병살타") counts.gidp += 1;
  else if (type === "도루") counts.stolenBases += 1;
  else if (type === "도루자") counts.caughtStealing += 1;
  else if (type === "실책") counts.errors += 1;
  else if (type === "폭투") counts.wildPitches += 1;
  else if (type === "포일") counts.passedBalls += 1;
  else if (type === "견제사") counts.pickoffs += 1;
  else if (type === "주루사") counts.baseRunningOuts += 1;
}

function parseSpecialCounts(table: GridTable, playerSideMap: Map<string, Side>): Record<Side, SideSpecialCounts> {
  const counts = cloneSpecialCounts();
  for (const row of table.rows ?? []) {
    const [type, detail] = rowCells(row);
    if (!type || !detail) continue;
    for (const name of extractPlayerNames(detail)) {
      const side = playerSideMap.get(name.replace(/\s+/g, ""));
      if (!side) continue;
      incrementSpecial(counts[side], type);
    }
  }
  return counts;
}

function totalBases(hits: number, doubles: number, triples: number, homers: number): number {
  return hits + doubles + triples * 2 + homers * 3;
}

function buildRecord(input: {
  gameId: string;
  gameDate: string;
  teamId: string;
  opponentTeamId: string;
  isHome: boolean;
  score: ScoreSummary;
  hitters: HitterSummary;
  pitcher: PitcherSummary;
  special: SideSpecialCounts;
  inningScores: number[];
  opponentInningScores: number[];
  rawScoreboard: Record<string, unknown>;
  rawBoxScore: Record<string, unknown>;
}): TeamGameStatsRecord {
  const walks = input.hitters.walks > 0 || input.hitters.hbp > 0
    ? input.hitters.walks
    : input.score.balls;
  return {
    game_id: input.gameId,
    game_date: input.gameDate,
    team_id: input.teamId,
    opponent_team_id: input.opponentTeamId,
    is_home: input.isHome,
    runs: input.score.runs,
    hits: input.score.hits,
    errors: input.score.errors,
    walks,
    hbp: input.hitters.hbp,
    strikeouts: input.hitters.strikeouts,
    rbi: input.hitters.rbi,
    doubles: input.special.doubles,
    triples: input.special.triples,
    homers: input.special.homers,
    total_bases: totalBases(input.score.hits, input.special.doubles, input.special.triples, input.special.homers),
    gidp: input.special.gidp,
    stolen_bases: input.special.stolenBases,
    caught_stealing: input.special.caughtStealing,
    sacrifice_hits: input.hitters.sacrificeHits,
    sacrifice_flies: input.hitters.sacrificeFlies,
    pitcher_batters_faced: input.pitcher.battersFaced,
    pitcher_pitches: input.pitcher.pitches,
    pitcher_at_bats: input.pitcher.atBats,
    pitcher_hits_allowed: input.pitcher.hitsAllowed,
    pitcher_homers_allowed: input.pitcher.homersAllowed,
    pitcher_walks_hbp: input.pitcher.walksHbp,
    pitcher_strikeouts: input.pitcher.strikeouts,
    pitcher_runs_allowed: input.pitcher.runsAllowed,
    pitcher_earned_runs: input.pitcher.earnedRuns,
    late_runs: lateRuns(input.inningScores),
    late_runs_allowed: lateRuns(input.opponentInningScores),
    inning_scores: input.inningScores,
    special_counts: {
      ...input.special,
      scoreboardBalls: input.score.balls
    },
    raw_scoreboard: input.rawScoreboard,
    raw_box_score: input.rawBoxScore,
    source: "kbo-boxscore-scroll",
    collected_at: new Date().toISOString()
  };
}

async function fetchTeamGameStatsRecords(game: KboGame, dateStr: string): Promise<TeamGameStatsRecord[] | null> {
  const awayTeam = parseTeamCode(game.AWAY_ID || game.AWAY_NM || "");
  const homeTeam = parseTeamCode(game.HOME_ID || game.HOME_NM || "");
  if (!awayTeam || !homeTeam) return null;

  const seasonId = dateStr.slice(0, 4);
  const request = { leId: "1", srId: "0", seasonId, gameId: game.G_ID };
  const [scoreboard, boxScore] = await Promise.all([
    post<ScoreBoardScroll>("/ws/Schedule.asmx/GetScoreBoardScroll", request),
    post<BoxScoreScroll>("/ws/Schedule.asmx/GetBoxScoreScroll", request)
  ]);

  if (scoreboard.code && scoreboard.code !== "100") {
    throw new Error(`GetScoreBoardScroll failed: ${scoreboard.msg ?? scoreboard.code}`);
  }
  if (boxScore.code && boxScore.code !== "100") {
    throw new Error(`GetBoxScoreScroll failed: ${boxScore.msg ?? boxScore.code}`);
  }

  const scoreTable = parseTable(scoreboard.table3);
  const inningTable = parseTable(scoreboard.table2);
  const awayScore = parseScoreSummary(scoreTable.rows?.[0]);
  const homeScore = parseScoreSummary(scoreTable.rows?.[1]);
  const awayInnings = parseInningScores(inningTable.rows?.[0]);
  const homeInnings = parseInningScores(inningTable.rows?.[1]);

  const awayHitterNames = parseTable(boxScore.arrHitter?.[0]?.table1);
  const homeHitterNames = parseTable(boxScore.arrHitter?.[1]?.table1);
  const awayHitterTotals = parseHitterTotals(parseTable(boxScore.arrHitter?.[0]?.table3));
  const homeHitterTotals = parseHitterTotals(parseTable(boxScore.arrHitter?.[1]?.table3));
  const awayHitterEvents = countHitterEvents(parseTable(boxScore.arrHitter?.[0]?.table2));
  const homeHitterEvents = countHitterEvents(parseTable(boxScore.arrHitter?.[1]?.table2));
  const awayPitcherTotals = parsePitcherTotals(parseTable(boxScore.arrPitcher?.[0]?.table));
  const homePitcherTotals = parsePitcherTotals(parseTable(boxScore.arrPitcher?.[1]?.table));
  const playerSideMap = buildPlayerSideMap(awayHitterNames, homeHitterNames);
  const specialCounts = parseSpecialCounts(parseTable(boxScore.tableEtc), playerSideMap);

  return [
    buildRecord({
      gameId: game.G_ID,
      gameDate: dateStr,
      teamId: awayTeam,
      opponentTeamId: homeTeam,
      isHome: false,
      score: awayScore,
      hitters: { ...awayHitterTotals, ...awayHitterEvents },
      pitcher: awayPitcherTotals,
      special: specialCounts.away,
      inningScores: awayInnings,
      opponentInningScores: homeInnings,
      rawScoreboard: scoreboard as Record<string, unknown>,
      rawBoxScore: {
        tableEtc: boxScore.tableEtc,
        hitter: boxScore.arrHitter?.[0] ?? null,
        pitcher: boxScore.arrPitcher?.[0] ?? null
      }
    }),
    buildRecord({
      gameId: game.G_ID,
      gameDate: dateStr,
      teamId: homeTeam,
      opponentTeamId: awayTeam,
      isHome: true,
      score: homeScore,
      hitters: { ...homeHitterTotals, ...homeHitterEvents },
      pitcher: homePitcherTotals,
      special: specialCounts.home,
      inningScores: homeInnings,
      opponentInningScores: awayInnings,
      rawScoreboard: scoreboard as Record<string, unknown>,
      rawBoxScore: {
        tableEtc: boxScore.tableEtc,
        hitter: boxScore.arrHitter?.[1] ?? null,
        pitcher: boxScore.arrPitcher?.[1] ?? null
      }
    })
  ];
}

export async function syncTeamGameStatsForDate(
  dateStr: string,
  options: { gameDelayMs?: number; dryRun?: boolean } = {}
): Promise<SyncTeamGameStatsResult> {
  const yyyymmdd = dateToKboDate(dateStr);
  const errors: string[] = [];
  const listData = await post<{ game?: KboGame[] }>("/ws/Main.asmx/GetKboGameList", {
    leId: "1",
    srId: "0",
    date: yyyymmdd
  });
  const games = listData.game ?? [];
  const finished = games.filter(
    (game) => String(game.GAME_STATE_SC) === "3" && String(game.CANCEL_SC_ID ?? "0") === "0"
  );

  const supabase = createSupabaseAdminClient();
  let upserted = 0;
  let dryRunRows = 0;
  let skipped = 0;

  for (const game of finished) {
    try {
      const records = await fetchTeamGameStatsRecords(game, dateStr);
      if (!records) {
        skipped += 1;
        continue;
      }

      if (options.dryRun) {
        dryRunRows += records.length;
      } else {
        const { error } = await supabase
          .from("bp_team_game_stats")
          .upsert(records, { onConflict: "game_id,team_id" });
        if (error) throw new Error(error.message);
        upserted += records.length;
      }
    } catch (error) {
      errors.push(`${game.G_ID}: ${(error as Error).message}`);
    }

    if (options.gameDelayMs && options.gameDelayMs > 0) {
      await sleep(options.gameDelayMs);
    }
  }

  return {
    date: dateStr,
    finished: finished.length,
    upserted,
    dryRunRows,
    skipped,
    errors
  };
}

export async function backfillTeamGameStats(
  from: string,
  to: string,
  options: BackfillTeamGameStatsOptions = {}
): Promise<BackfillTeamGameStatsResult> {
  const gameDelayMs = options.gameDelayMs ?? 2500;
  const dateDelayMs = options.dateDelayMs ?? 5000;
  const restEveryGames = options.restEveryGames ?? 25;
  const restMs = options.restMs ?? 15000;
  const dryRun = options.dryRun ?? false;
  const dates: SyncTeamGameStatsResult[] = [];
  let processedGames = 0;

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const result = await syncTeamGameStatsForDate(date, { gameDelayMs, dryRun });
    dates.push(result);
    processedGames += result.finished;

    if (restEveryGames > 0 && processedGames >= restEveryGames) {
      processedGames = 0;
      await sleep(restMs);
    }

    if (date < to) await sleep(dateDelayMs);
  }

  return {
    from,
    to,
    dates,
    totals: dates.reduce(
      (acc, result) => ({
        finished: acc.finished + result.finished,
        upserted: acc.upserted + result.upserted,
        dryRunRows: acc.dryRunRows + result.dryRunRows,
        skipped: acc.skipped + result.skipped,
        errors: acc.errors + result.errors.length
      }),
      { finished: 0, upserted: 0, dryRunRows: 0, skipped: 0, errors: 0 }
    )
  };
}
