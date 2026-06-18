import statsData from "@/data/kbo_players_2026.json";
import { cache } from "react";
import {
  RECENT10_CATEGORIES,
  type Recent10CategoryId,
  type Recent10TopPlayer
} from "@/lib/recent10/categories";
import { createSupabaseCacheClient } from "@/lib/supabase/server";

type SnapshotKind = "batter" | "pitcher";

type SnapshotRow = {
  snapshot_date: string;
  player_id: string;
  team_id: string;
  kind: SnapshotKind;
  sim_payload: Record<string, unknown>;
};

type SnapshotWindow = {
  latestDate: string;
  previousDate: string;
  rows: SnapshotRow[];
};

type PrecomputedRecent10Row = {
  snapshot_date: string;
  window_start_date: string | null;
  category: string;
  rank: number;
  player_id: string;
  player_name: string;
  team_id: string;
  kind: "batter" | "pitcher";
  value: number | string;
  display_value: string;
  sub_text: string;
  stats: Record<string, number> | null;
};

type PrecomputedRecent10 = {
  snapshotDate: string;
  windowStartDate: string | null;
  byCategory: Record<Recent10CategoryId, Recent10TopPlayer[]>;
};

type PlayerMeta = {
  playerId: string;
  name: string;
  teamId: string;
  kind: SnapshotKind;
};

type BatterDiff = {
  games: number;
  pa: number;
  ab: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homers: number;
  walks: number;
  intentionalWalks: number;
  hbp: number;
  strikeouts: number;
  rbi: number;
  sac: number;
  sf: number;
  gidp: number;
  sb: number;
  cs: number;
  tb: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
};

type PitcherDiff = {
  games: number;
  ip: number;
  hitsAllowed: number;
  homers: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  runsAllowed: number;
  earnedRuns: number;
  saves: number;
  holds: number;
  wins: number;
  losses: number;
  completeGames: number;
  shutouts: number;
  qualityStarts: number;
  blownSaves: number;
  battersFaced: number;
  pitches: number;
  era: number;
  whip: number;
};

const TARGET_WINDOW_DAYS = 10;
const MIN_WINDOW_DAYS = 7;
const MIN_AVG_ELIGIBLE_PLAYERS = 30;

const playerMetaById = buildPlayerMetaMap();

function createEmptyResult(): Record<Recent10CategoryId, Recent10TopPlayer[]> {
  return {
    avg: [],
    obp: [],
    slg: [],
    ops: [],
    hr: [],
    sb: [],
    era: [],
    strikeouts: [],
    saves: [],
    holds: []
  };
}

function buildPlayerMetaMap(): Map<string, PlayerMeta> {
  const map = new Map<string, PlayerMeta>();
  const teams = (statsData as { teams?: Record<string, { batters?: any[]; pitchers?: any[] }> }).teams ?? {};
  for (const [teamId, team] of Object.entries(teams)) {
    for (const batter of team.batters ?? []) {
      map.set(batter.playerId, {
        playerId: batter.playerId,
        name: batter.name,
        teamId,
        kind: "batter"
      });
    }
    for (const pitcher of team.pitchers ?? []) {
      map.set(pitcher.playerId, {
        playerId: pitcher.playerId,
        name: pitcher.name,
        teamId,
        kind: "pitcher"
      });
    }
  }
  return map;
}

function n(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function diffNumber(latest: Record<string, unknown>, previous: Record<string, unknown>, key: string): number {
  return Math.max(0, n(latest[key]) - n(previous[key]));
}

function fmtRate(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(3).replace(/^0/, "");
}

function fmtEra(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function fmtIp(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const outs = Math.round(value * 3);
  const whole = Math.floor(outs / 3);
  const remain = outs % 3;
  if (remain === 0) return String(whole);
  if (whole === 0) return `${remain}/3`;
  return `${whole} ${remain}/3`;
}

function playerName(row: SnapshotRow): string {
  const fromPayload = String(row.sim_payload.name ?? row.sim_payload.playerName ?? "").trim();
  if (fromPayload) return fromPayload;
  return playerMetaById.get(row.player_id)?.name ?? row.player_id;
}

function playerTeam(row: SnapshotRow): string {
  return row.team_id || playerMetaById.get(row.player_id)?.teamId || "doosan";
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00+09:00`).getTime();
  const to = new Date(`${toDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86400000);
}

function batterDiff(latest: Record<string, unknown>, previous: Record<string, unknown>): BatterDiff {
  const games = diffNumber(latest, previous, "games");
  const hits = diffNumber(latest, previous, "hits");
  const runs = diffNumber(latest, previous, "runs");
  const doubles = diffNumber(latest, previous, "doubles");
  const triples = diffNumber(latest, previous, "triples");
  const homers = diffNumber(latest, previous, "homers");
  const walks = diffNumber(latest, previous, "walks");
  const intentionalWalks = diffNumber(latest, previous, "intentionalWalks");
  const hbp = diffNumber(latest, previous, "hbp");
  const ab = diffNumber(latest, previous, "ab");
  const pa = diffNumber(latest, previous, "pa");
  const strikeouts = diffNumber(latest, previous, "strikeouts");
  const rbi = diffNumber(latest, previous, "rbi");
  const sac = diffNumber(latest, previous, "sac");
  const sf = diffNumber(latest, previous, "sf");
  const gidp = diffNumber(latest, previous, "gidp");
  const sb = diffNumber(latest, previous, "sb");
  const cs = diffNumber(latest, previous, "cs");
  const singles = Math.max(0, hits - doubles - triples - homers);
  const tb = singles + doubles * 2 + triples * 3 + homers * 4;
  const avg = ab > 0 ? hits / ab : 0;
  const obpDenom = ab + walks + hbp;
  const obp = obpDenom > 0 ? (hits + walks + hbp) / obpDenom : 0;
  const slg = ab > 0 ? tb / ab : 0;
  return {
    pa,
    ab,
    games,
    runs,
    hits,
    doubles,
    triples,
    homers,
    walks,
    intentionalWalks,
    hbp,
    strikeouts,
    rbi,
    sac,
    sf,
    gidp,
    sb,
    cs,
    tb,
    avg,
    obp,
    slg,
    ops: obp + slg
  };
}

function pitcherDiff(latest: Record<string, unknown>, previous: Record<string, unknown>): PitcherDiff {
  const games = diffNumber(latest, previous, "games");
  const ip = diffNumber(latest, previous, "ip");
  const hitsAllowed = diffNumber(latest, previous, "hitsAllowed");
  const homers = diffNumber(latest, previous, "hr");
  const walks = diffNumber(latest, previous, "bb");
  const hbp = diffNumber(latest, previous, "hbp");
  const strikeouts = diffNumber(latest, previous, "k");
  const runsAllowed = diffNumber(latest, previous, "runsAllowed");
  const earnedRuns = diffNumber(latest, previous, "earnedRuns");
  const saves = diffNumber(latest, previous, "saves");
  const holds = diffNumber(latest, previous, "holds");
  const wins = diffNumber(latest, previous, "wins");
  const losses = diffNumber(latest, previous, "losses");
  const completeGames = diffNumber(latest, previous, "completeGames");
  const shutouts = diffNumber(latest, previous, "shutouts");
  const qualityStarts = diffNumber(latest, previous, "qualityStarts");
  const blownSaves = diffNumber(latest, previous, "blownSaves");
  const battersFaced = diffNumber(latest, previous, "battersFaced");
  const pitches = diffNumber(latest, previous, "pitches");
  const era = ip > 0 ? (earnedRuns * 9) / ip : 0;
  const whip = ip > 0 ? (hitsAllowed + walks) / ip : 0;
  return {
    games,
    ip,
    hitsAllowed,
    homers,
    walks,
    hbp,
    strikeouts,
    runsAllowed,
    earnedRuns,
    saves,
    holds,
    wins,
    losses,
    completeGames,
    shutouts,
    qualityStarts,
    blownSaves,
    battersFaced,
    pitches,
    era,
    whip
  };
}

function makeBatterEntry(
  category: Recent10CategoryId,
  latest: SnapshotRow,
  previous: SnapshotRow
): Omit<Recent10TopPlayer, "rank"> | null {
  const s = batterDiff(latest.sim_payload, previous.sim_payload);
  const base = {
    category,
    playerId: latest.player_id,
    playerName: playerName(latest),
    teamId: playerTeam(latest),
    kind: "batter" as const,
    stats: s
  };

  if (category === "avg") {
    if (s.pa < 20 || s.ab <= 0 || s.hits <= 0) return null;
    return {
      ...base,
      value: s.avg,
      displayValue: fmtRate(s.avg),
      subText: `${s.ab}타수 ${s.hits}안타`
    };
  }

  if (category === "obp") {
    if (s.pa < 20 || s.obp <= 0) return null;
    return {
      ...base,
      value: s.obp,
      displayValue: fmtRate(s.obp),
      subText: `출루 ${s.hits + s.walks + s.hbp}회 · ${s.pa}타석`
    };
  }

  if (category === "slg") {
    if (s.pa < 20 || s.ab <= 0 || s.slg <= 0) return null;
    return {
      ...base,
      value: s.slg,
      displayValue: fmtRate(s.slg),
      subText: `총루타 ${s.tb} · ${s.homers}홈런`
    };
  }

  if (category === "ops") {
    if (s.pa < 20 || s.ops <= 0) return null;
    return {
      ...base,
      value: s.ops,
      displayValue: fmtRate(s.ops),
      subText: `타율 ${fmtRate(s.avg)} · ${s.homers}홈런`
    };
  }

  if (category === "hr") {
    if (s.homers <= 0) return null;
    return {
      ...base,
      value: s.homers,
      displayValue: `${s.homers}홈런`,
      subText: `${s.hits}안타 · OPS ${fmtRate(s.ops)}`
    };
  }

  if (category === "sb") {
    if (s.sb <= 0) return null;
    return {
      ...base,
      value: s.sb,
      displayValue: `${s.sb}도루`,
      subText: `${s.cs}실패 · 출루율 ${fmtRate(s.obp)}`
    };
  }

  return null;
}

function makePitcherEntry(
  category: Recent10CategoryId,
  latest: SnapshotRow,
  previous: SnapshotRow
): Omit<Recent10TopPlayer, "rank"> | null {
  const s = pitcherDiff(latest.sim_payload, previous.sim_payload);
  const base = {
    category,
    playerId: latest.player_id,
    playerName: playerName(latest),
    teamId: playerTeam(latest),
    kind: "pitcher" as const,
    stats: s
  };

  if (category === "era") {
    if (s.ip < 5) return null;
    return {
      ...base,
      value: s.era,
      displayValue: `ERA ${fmtEra(s.era)}`,
      subText: `${fmtIp(s.ip)}이닝 · ${s.earnedRuns}자책`
    };
  }

  if (category === "strikeouts") {
    if (s.strikeouts <= 0) return null;
    return {
      ...base,
      value: s.strikeouts,
      displayValue: `${s.strikeouts}K`,
      subText: `${fmtIp(s.ip)}이닝 · ERA ${fmtEra(s.era)}`
    };
  }

  if (category === "saves") {
    if (s.saves <= 0) return null;
    return {
      ...base,
      value: s.saves,
      displayValue: `${s.saves}세이브`,
      subText: `${fmtIp(s.ip)}이닝 · ERA ${fmtEra(s.era)}`
    };
  }

  if (category === "holds") {
    if (s.holds <= 0) return null;
    return {
      ...base,
      value: s.holds,
      displayValue: `${s.holds}홀드`,
      subText: `${fmtIp(s.ip)}이닝 · ERA ${fmtEra(s.era)}`
    };
  }

  return null;
}

function applyCompetitionRanks(
  entries: Omit<Recent10TopPlayer, "rank">[],
  limit: number
): Recent10TopPlayer[] {
  let previousDisplayValue = "";
  let currentRank = 0;

  return entries.slice(0, limit).map((entry, index) => {
    if (index === 0 || entry.displayValue !== previousDisplayValue) {
      currentRank = index + 1;
      previousDisplayValue = entry.displayValue;
    }

    return {
      ...entry,
      rank: currentRank
    };
  });
}

async function loadSnapshotDates(): Promise<string[]> {
  const supabase = createSupabaseCacheClient(3600);
  const { count, error: countError } = await supabase
    .from("bp_player_stats_snapshots")
    .select("*", { count: "exact", head: true });

  if (countError || !count) return [];

  const seen = new Set<string>();
  for (let from = 0; from < count; from += 1000) {
    const to = Math.min(from + 999, count - 1);
    const { data, error } = await supabase
      .from("bp_player_stats_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .range(from, to);

    if (error) return [];
    for (const row of data ?? []) {
      seen.add(String(row.snapshot_date));
    }
  }

  return Array.from(seen).sort((a, b) => b.localeCompare(a));
}

async function loadRowsForDates(dates: string[]): Promise<SnapshotRow[]> {
  const supabase = createSupabaseCacheClient(3600);
  const { count, error: countError } = await supabase
    .from("bp_player_stats_snapshots")
    .select("*", { count: "exact", head: true })
    .in("snapshot_date", dates);

  if (countError || !count) return [];

  const rows: SnapshotRow[] = [];
  for (let from = 0; from < count; from += 1000) {
    const to = Math.min(from + 999, count - 1);
    const { data, error } = await supabase
      .from("bp_player_stats_snapshots")
      .select("snapshot_date, player_id, team_id, kind, sim_payload")
      .in("snapshot_date", dates)
      .order("team_id", { ascending: true })
      .range(from, to);

    if (error) return [];
    rows.push(...((data ?? []) as SnapshotRow[]));
  }

  return rows;
}

function countAvgEligible(rows: SnapshotRow[], latestDate: string, previousDate: string): number {
  const previousByKey = new Map<string, SnapshotRow>();
  for (const row of rows) {
    if (row.snapshot_date === previousDate && row.kind === "batter") {
      previousByKey.set(`${row.kind}:${row.player_id}`, row);
    }
  }

  let count = 0;
  for (const latest of rows) {
    if (latest.snapshot_date !== latestDate || latest.kind !== "batter") continue;
    const previous = previousByKey.get(`${latest.kind}:${latest.player_id}`);
    if (!previous) continue;
    const s = batterDiff(latest.sim_payload, previous.sim_payload);
    if (s.pa >= 20 && s.ab > 0 && s.hits > 0) count++;
  }
  return count;
}

const loadSnapshotWindow = cache(async (): Promise<SnapshotWindow | null> => {
  const dates = await loadSnapshotDates();

  if (dates.length < 2) return null;
  const latestDate = dates[0];
  const fallbackDate = dates[Math.min(9, dates.length - 1)];

  let selectedDate = fallbackDate;
  let selectedRows: SnapshotRow[] = [];
  let fallbackRows: SnapshotRow[] = [];
  const candidates: Array<{
    date: string;
    rows: SnapshotRow[];
    eligibleCount: number;
    days: number;
  }> = [];

  for (const candidateDate of dates.slice(1)) {
    const rows = await loadRowsForDates([latestDate, candidateDate]);
    if (candidateDate === fallbackDate) fallbackRows = rows;
    const eligibleCount = countAvgEligible(rows, latestDate, candidateDate);
    candidates.push({
      date: candidateDate,
      rows,
      eligibleCount,
      days: diffDays(candidateDate, latestDate)
    });
  }

  const validCandidates = candidates.filter((candidate) => candidate.eligibleCount >= MIN_AVG_ELIGIBLE_PLAYERS);
  const preferredCandidates = validCandidates
    .filter((candidate) => candidate.days >= MIN_WINDOW_DAYS)
    .sort((a, b) => {
      const aWithinTarget = a.days <= TARGET_WINDOW_DAYS;
      const bWithinTarget = b.days <= TARGET_WINDOW_DAYS;
      if (aWithinTarget !== bWithinTarget) return aWithinTarget ? -1 : 1;
      if (aWithinTarget && bWithinTarget) return b.days - a.days;
      return a.days - b.days;
    });

  const selected = preferredCandidates[0] ?? validCandidates[0] ?? null;
  if (selected) {
    selectedDate = selected.date;
    selectedRows = selected.rows;
  }

  if (selectedRows.length === 0) {
    selectedRows = fallbackRows.length > 0 ? fallbackRows : await loadRowsForDates([latestDate, selectedDate]);
  }

  if (selectedRows.length === 0) return null;

  return {
    latestDate,
    previousDate: selectedDate,
    rows: selectedRows
  };
});

function isRecent10CategoryId(value: string): value is Recent10CategoryId {
  return RECENT10_CATEGORIES.some((category) => category.id === value);
}

const loadPrecomputedRecent10 = cache(async (): Promise<PrecomputedRecent10 | null> => {
  const supabase = createSupabaseCacheClient(3600);
  const { data: latestRows, error: latestError } = await supabase
    .from("bp_recent10_top_players")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (latestError || !latestRows?.[0]?.snapshot_date) return null;

  const snapshotDate = String(latestRows[0].snapshot_date);
  const { data, error } = await supabase
    .from("bp_recent10_top_players")
    .select("snapshot_date, window_start_date, category, rank, player_id, player_name, team_id, kind, value, display_value, sub_text, stats")
    .eq("snapshot_date", snapshotDate)
    .order("category", { ascending: true })
    .order("rank", { ascending: true });

  if (error || !data?.length) return null;

  const byCategory = createEmptyResult();
  let windowStartDate: string | null = null;
  const seenCategories = new Set<Recent10CategoryId>();

  for (const row of data as PrecomputedRecent10Row[]) {
    if (!isRecent10CategoryId(row.category)) continue;
    windowStartDate = windowStartDate ?? row.window_start_date ?? null;
    seenCategories.add(row.category);
    byCategory[row.category].push({
      category: row.category,
      rank: row.rank,
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      kind: row.kind,
      value: n(row.value),
      displayValue: row.display_value,
      subText: row.sub_text,
      stats: row.stats ?? {}
    });
  }

  if (["obp", "slg", "saves", "holds"].some((category) => !seenCategories.has(category as Recent10CategoryId))) {
    return null;
  }

  return {
    snapshotDate,
    windowStartDate,
    byCategory
  };
});

export async function getRecent10TopPlayers(limit = 10): Promise<Record<Recent10CategoryId, Recent10TopPlayer[]>> {
  const precomputed = await loadPrecomputedRecent10();
  if (precomputed) {
    return Object.fromEntries(
      RECENT10_CATEGORIES.map((category) => [
        category.id,
        precomputed.byCategory[category.id].slice(0, limit)
      ])
    ) as Record<Recent10CategoryId, Recent10TopPlayer[]>;
  }

  const window = await loadSnapshotWindow();
  const empty = createEmptyResult();

  if (!window) return empty;

  const previousByKey = new Map<string, SnapshotRow>();
  const latestRows: SnapshotRow[] = [];
  for (const row of window.rows) {
    const key = `${row.kind}:${row.player_id}`;
    if (row.snapshot_date === window.latestDate) latestRows.push(row);
    if (row.snapshot_date === window.previousDate) previousByKey.set(key, row);
  }

  return Object.fromEntries(
    RECENT10_CATEGORIES.map((category) => {
      const entries: Omit<Recent10TopPlayer, "rank">[] = [];
      for (const latest of latestRows) {
        if (latest.kind !== category.kind) continue;
        const previous = previousByKey.get(`${latest.kind}:${latest.player_id}`);
        if (!previous) continue;
        const entry =
          category.kind === "batter"
            ? makeBatterEntry(category.id, latest, previous)
            : makePitcherEntry(category.id, latest, previous);
        if (entry) entries.push(entry);
      }

      entries.sort((a, b) => {
        const primary = category.sort === "asc" ? a.value - b.value : b.value - a.value;
        if (primary !== 0) return primary;
        if (category.id === "era") {
          const aStats = a.stats as Partial<PitcherDiff>;
          const bStats = b.stats as Partial<PitcherDiff>;
          const ipDiff = (bStats.ip ?? 0) - (aStats.ip ?? 0);
          if (ipDiff !== 0) return ipDiff;
          const whipDiff = (aStats.whip ?? 0) - (bStats.whip ?? 0);
          if (whipDiff !== 0) return whipDiff;
          const strikeoutDiff = (bStats.strikeouts ?? 0) - (aStats.strikeouts ?? 0);
          if (strikeoutDiff !== 0) return strikeoutDiff;
        }
        return a.playerName.localeCompare(b.playerName, "ko");
      });

      return [
        category.id,
        applyCompetitionRanks(entries, limit)
      ];
    })
  ) as Record<Recent10CategoryId, Recent10TopPlayer[]>;
}

export async function getRecent10SnapshotDate(): Promise<string> {
  const precomputed = await loadPrecomputedRecent10();
  if (precomputed) {
    return precomputed.windowStartDate
      ? `${precomputed.windowStartDate} ~ ${precomputed.snapshotDate}`
      : precomputed.snapshotDate;
  }

  const window = await loadSnapshotWindow();
  if (!window) return "";
  return `${window.previousDate} ~ ${window.latestDate}`;
}
