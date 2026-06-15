import statsData from "@/data/kbo_players_2026.json";
import { RECENT10_CATEGORIES, type Recent10CategoryId } from "@/lib/recent10/categories";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SnapshotKind = "batter" | "pitcher";

type SnapshotRow = {
  snapshot_date: string;
  player_id: string;
  team_id: string;
  kind: SnapshotKind;
  sim_payload: Record<string, unknown>;
};

type TopRow = {
  snapshot_date: string;
  window_start_date: string;
  category: Recent10CategoryId;
  rank: number;
  player_id: string;
  player_name: string;
  team_id: string;
  kind: SnapshotKind;
  value: number;
  display_value: string;
  sub_text: string;
  stats: Record<string, number>;
  source: string;
};

type PlayerMeta = {
  name: string;
  teamId: string;
};

export type UpsertRecent10TopPlayersResult = {
  snapshotDate: string;
  windowStartDate: string;
  rows: number;
  categoryCounts: Record<Recent10CategoryId, number>;
};

const TARGET_WINDOW_DAYS = 10;
const MIN_WINDOW_DAYS = 7;
const MIN_AVG_ELIGIBLE_PLAYERS = 30;

const playerMetaById = buildPlayerMetaMap();

function buildPlayerMetaMap(): Map<string, PlayerMeta> {
  const map = new Map<string, PlayerMeta>();
  const teams = (statsData as { teams?: Record<string, { batters?: any[]; pitchers?: any[] }> }).teams ?? {};
  for (const [teamId, team] of Object.entries(teams)) {
    for (const batter of team.batters ?? []) {
      map.set(batter.playerId, { name: batter.name, teamId });
    }
    for (const pitcher of team.pitchers ?? []) {
      map.set(pitcher.playerId, { name: pitcher.name, teamId });
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

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00+09:00`).getTime();
  const to = new Date(`${toDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86400000);
}

function playerName(row: SnapshotRow): string {
  const fromPayload = String(row.sim_payload.name ?? row.sim_payload.playerName ?? "").trim();
  if (fromPayload) return fromPayload;
  return playerMetaById.get(row.player_id)?.name ?? row.player_id;
}

function playerTeam(row: SnapshotRow): string {
  return row.team_id || playerMetaById.get(row.player_id)?.teamId || "doosan";
}

function batterDiff(latest: Record<string, unknown>, previous: Record<string, unknown>): Record<string, number> {
  const hits = diffNumber(latest, previous, "hits");
  const doubles = diffNumber(latest, previous, "doubles");
  const triples = diffNumber(latest, previous, "triples");
  const homers = diffNumber(latest, previous, "homers");
  const walks = diffNumber(latest, previous, "walks");
  const hbp = diffNumber(latest, previous, "hbp");
  const ab = diffNumber(latest, previous, "ab");
  const pa = diffNumber(latest, previous, "pa");
  const strikeouts = diffNumber(latest, previous, "strikeouts");
  const sb = diffNumber(latest, previous, "sb");
  const cs = diffNumber(latest, previous, "cs");
  const singles = Math.max(0, hits - doubles - triples - homers);
  const tb = singles + doubles * 2 + triples * 3 + homers * 4;
  const avg = ab > 0 ? hits / ab : 0;
  const obpDenom = ab + walks + hbp;
  const obp = obpDenom > 0 ? (hits + walks + hbp) / obpDenom : 0;
  const slg = ab > 0 ? tb / ab : 0;
  return { pa, ab, hits, doubles, triples, homers, walks, hbp, strikeouts, sb, cs, tb, avg, obp, slg, ops: obp + slg };
}

function pitcherDiff(latest: Record<string, unknown>, previous: Record<string, unknown>): Record<string, number> {
  const ip = diffNumber(latest, previous, "ip");
  const hitsAllowed = diffNumber(latest, previous, "hitsAllowed");
  const homers = diffNumber(latest, previous, "hr");
  const walks = diffNumber(latest, previous, "bb");
  const hbp = diffNumber(latest, previous, "hbp");
  const strikeouts = diffNumber(latest, previous, "k");
  const earnedRuns = diffNumber(latest, previous, "earnedRuns");
  const era = ip > 0 ? (earnedRuns * 9) / ip : 0;
  const whip = ip > 0 ? (hitsAllowed + walks) / ip : 0;
  return { ip, hitsAllowed, homers, walks, hbp, strikeouts, earnedRuns, era, whip };
}

function makeBatterEntry(category: Recent10CategoryId, latest: SnapshotRow, previous: SnapshotRow): Omit<TopRow, "rank"> | null {
  const s = batterDiff(latest.sim_payload, previous.sim_payload);
  const base = {
    snapshot_date: latest.snapshot_date,
    window_start_date: previous.snapshot_date,
    category,
    player_id: latest.player_id,
    player_name: playerName(latest),
    team_id: playerTeam(latest),
    kind: "batter" as const,
    stats: s,
    source: "snapshot-diff"
  };

  if (category === "avg") {
    if (s.pa < 20 || s.ab <= 0 || s.hits <= 0) return null;
    return { ...base, value: s.avg, display_value: fmtRate(s.avg), sub_text: `${s.ab}타수 ${s.hits}안타` };
  }
  if (category === "hr") {
    if (s.homers <= 0) return null;
    return { ...base, value: s.homers, display_value: `${s.homers}홈런`, sub_text: `${s.hits}안타 · OPS ${fmtRate(s.ops)}` };
  }
  if (category === "ops") {
    if (s.pa < 20 || s.ops <= 0) return null;
    return { ...base, value: s.ops, display_value: fmtRate(s.ops), sub_text: `타율 ${fmtRate(s.avg)} · ${s.homers}홈런` };
  }
  if (category === "sb") {
    if (s.sb <= 0) return null;
    return { ...base, value: s.sb, display_value: `${s.sb}도루`, sub_text: `${s.cs}실패 · 출루율 ${fmtRate(s.obp)}` };
  }
  if (category === "hbp") {
    if (s.hbp <= 0) return null;
    return { ...base, value: s.hbp, display_value: `${s.hbp}사구`, sub_text: `${s.pa}타석 · 출루율 ${fmtRate(s.obp)}` };
  }
  return null;
}

function makePitcherEntry(category: Recent10CategoryId, latest: SnapshotRow, previous: SnapshotRow): Omit<TopRow, "rank"> | null {
  const s = pitcherDiff(latest.sim_payload, previous.sim_payload);
  const base = {
    snapshot_date: latest.snapshot_date,
    window_start_date: previous.snapshot_date,
    category,
    player_id: latest.player_id,
    player_name: playerName(latest),
    team_id: playerTeam(latest),
    kind: "pitcher" as const,
    stats: s,
    source: "snapshot-diff"
  };

  if (category === "era") {
    if (s.ip < 5) return null;
    return { ...base, value: s.era, display_value: `ERA ${fmtEra(s.era)}`, sub_text: `${fmtIp(s.ip)}이닝 · ${s.earnedRuns}자책` };
  }
  if (category === "strikeouts") {
    if (s.strikeouts <= 0) return null;
    return { ...base, value: s.strikeouts, display_value: `${s.strikeouts}K`, sub_text: `${fmtIp(s.ip)}이닝 · ERA ${fmtEra(s.era)}` };
  }
  return null;
}

async function loadSnapshotDates(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
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

    if (error) throw new Error(error.message);
    for (const row of data ?? []) seen.add(String(row.snapshot_date));
  }
  return Array.from(seen).sort((a, b) => b.localeCompare(a));
}

async function loadRowsForDates(dates: string[]): Promise<SnapshotRow[]> {
  const supabase = createSupabaseAdminClient();
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

    if (error) throw new Error(error.message);
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

async function loadSnapshotWindow(): Promise<{ latestDate: string; previousDate: string; rows: SnapshotRow[] } | null> {
  const dates = await loadSnapshotDates();
  if (dates.length < 2) return null;

  const latestDate = dates[0];
  const fallbackDate = dates[Math.min(9, dates.length - 1)];
  let fallbackRows: SnapshotRow[] = [];
  const candidates: Array<{ date: string; rows: SnapshotRow[]; eligibleCount: number; days: number }> = [];

  for (const candidateDate of dates.slice(1)) {
    const rows = await loadRowsForDates([latestDate, candidateDate]);
    if (candidateDate === fallbackDate) fallbackRows = rows;
    candidates.push({
      date: candidateDate,
      rows,
      eligibleCount: countAvgEligible(rows, latestDate, candidateDate),
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
  const previousDate = selected?.date ?? fallbackDate;
  const rows = selected?.rows?.length
    ? selected.rows
    : fallbackRows.length
      ? fallbackRows
      : await loadRowsForDates([latestDate, previousDate]);

  if (rows.length === 0) return null;
  return { latestDate, previousDate, rows };
}

function buildRows(window: { latestDate: string; previousDate: string; rows: SnapshotRow[] }): TopRow[] {
  const previousByKey = new Map<string, SnapshotRow>();
  const latestRows: SnapshotRow[] = [];
  for (const row of window.rows) {
    const key = `${row.kind}:${row.player_id}`;
    if (row.snapshot_date === window.latestDate) latestRows.push(row);
    if (row.snapshot_date === window.previousDate) previousByKey.set(key, row);
  }

  const rows: TopRow[] = [];
  for (const category of RECENT10_CATEGORIES) {
    const entries: Omit<TopRow, "rank">[] = [];
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
      return a.player_name.localeCompare(b.player_name, "ko");
    });
    rows.push(...entries.slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 })));
  }
  return rows;
}

export async function upsertRecent10TopPlayers(): Promise<UpsertRecent10TopPlayersResult> {
  const window = await loadSnapshotWindow();
  if (!window) throw new Error("No recent10 snapshot window found");

  const rows = buildRows(window);
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from("bp_recent10_top_players")
    .delete()
    .eq("snapshot_date", window.latestDate);

  if (deleteError) throw new Error(`cleanup failed: ${deleteError.message}`);

  if (rows.length > 0) {
    const { error } = await supabase.from("bp_recent10_top_players").insert(rows);
    if (error) throw new Error(`insert failed: ${error.message}`);
  }

  const categoryCounts = Object.fromEntries(
    RECENT10_CATEGORIES.map((category) => [
      category.id,
      rows.filter((row) => row.category === category.id).length
    ])
  ) as Record<Recent10CategoryId, number>;

  return {
    snapshotDate: window.latestDate,
    windowStartDate: window.previousDate,
    rows: rows.length,
    categoryCounts
  };
}
