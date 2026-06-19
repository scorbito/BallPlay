import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SnapshotKind = "batter" | "pitcher";

type SnapshotRow = {
  snapshot_date: string;
  player_id: string;
  team_id: string;
  kind: SnapshotKind;
  sim_payload: Record<string, unknown>;
};

type PlayerRankingRow = {
  player_id: string;
  player_name: string;
  team_id: string;
  kind: SnapshotKind;
  snapshot_date: string;
  games: number;
  starts: number;
  pa: number;
  ab: number;
  ip: number;
  hits: number;
  homers: number;
  rbi: number;
  doubles: number;
  triples: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  sb: number;
  cs: number;
  total_bases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  era: number;
  whip: number;
  pitcher_strikeouts: number;
  wins: number;
  saves: number;
  holds: number;
  bb9: number;
  hr9: number;
  pitcher_homers_allowed: number;
};

function n(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getName(payload: Record<string, unknown>, fallback: string) {
  return String(payload.name ?? payload.playerName ?? fallback).trim() || fallback;
}

type StarterLogRow = {
  team_id: string;
  pitcher_name: string;
};

function normalizeName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function starterKey(teamId: string, playerName: string) {
  return `${teamId}::${normalizeName(playerName)}`;
}

function buildBatterRow(row: SnapshotRow): PlayerRankingRow {
  const payload = row.sim_payload ?? {};
  const games = n(payload.games);
  const pa = n(payload.pa);
  const ab = n(payload.ab);
  const hits = n(payload.hits);
  const doubles = n(payload.doubles);
  const triples = n(payload.triples);
  const homers = n(payload.homers);
  const walks = n(payload.walks);
  const hbp = n(payload.hbp);
  const strikeouts = n(payload.strikeouts);
  const rbi = n(payload.rbi);
  const sb = n(payload.sb);
  const cs = n(payload.cs);
  const singles = Math.max(0, hits - doubles - triples - homers);
  const totalBases = n(payload.totalBases) || singles + doubles * 2 + triples * 3 + homers * 4;
  const avg = ab > 0 ? hits / ab : n(payload.avg);
  const obp = n(payload.obp) || (ab + walks + hbp > 0 ? (hits + walks + hbp) / (ab + walks + hbp) : 0);
  const slg = ab > 0 ? totalBases / ab : n(payload.slg);
  const ops = n(payload.ops) || obp + slg;

  return {
    player_id: row.player_id,
    player_name: getName(payload, row.player_id),
    team_id: row.team_id,
    kind: "batter",
    snapshot_date: row.snapshot_date,
    games,
    starts: 0,
    pa,
    ab,
    ip: 0,
    hits,
    homers,
    rbi,
    doubles,
    triples,
    walks,
    hbp,
    strikeouts,
    sb,
    cs,
    total_bases: totalBases,
    avg: round3(avg),
    obp: round3(obp),
    slg: round3(slg),
    ops: round3(ops),
    era: 0,
    whip: 0,
    pitcher_strikeouts: 0,
    wins: 0,
    saves: 0,
    holds: 0,
    bb9: 0,
    hr9: 0,
    pitcher_homers_allowed: 0
  };
}

function buildPitcherRow(row: SnapshotRow, starts: number): PlayerRankingRow {
  const payload = row.sim_payload ?? {};
  const games = n(payload.games);
  const ip = n(payload.ip);
  const strikeouts = n(payload.k);
  const walks = n(payload.bb);
  const hbp = n(payload.hbp);
  const hitsAllowed = n(payload.hitsAllowed);
  const homersAllowed = n(payload.hr);
  const earnedRuns = n(payload.earnedRuns);
  const era = n(payload.era) || (ip > 0 ? (earnedRuns * 9) / ip : 0);
  const whip = n(payload.whip) || (ip > 0 ? (hitsAllowed + walks) / ip : 0);
  const bb9 = n(payload.bb9) || (ip > 0 ? (walks * 9) / ip : 0);
  const hr9 = n(payload.hr9) || (ip > 0 ? (homersAllowed * 9) / ip : 0);

  return {
    player_id: row.player_id,
    player_name: getName(payload, row.player_id),
    team_id: row.team_id,
    kind: "pitcher",
    snapshot_date: row.snapshot_date,
    games,
    starts,
    pa: 0,
    ab: 0,
    ip,
    hits: hitsAllowed,
    homers: 0,
    rbi: 0,
    doubles: 0,
    triples: 0,
    walks,
    hbp,
    strikeouts: 0,
    sb: 0,
    cs: 0,
    total_bases: 0,
    avg: 0,
    obp: 0,
    slg: 0,
    ops: 0,
    era: round2(era),
    whip: round2(whip),
    pitcher_strikeouts: strikeouts,
    wins: n(payload.wins),
    saves: n(payload.saves),
    holds: n(payload.holds),
    bb9: round2(bb9),
    hr9: round2(hr9),
    pitcher_homers_allowed: homersAllowed
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: latestRows, error: latestError } = await supabase
      .from("bp_player_stats_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (latestError) throw new Error(latestError.message);
    const snapshotDate = latestRows?.[0]?.snapshot_date;
    if (!snapshotDate) return NextResponse.json({ ok: true, snapshotDate: "", rows: [] });

    const { data, error } = await supabase
      .from("bp_player_stats_snapshots")
      .select("snapshot_date, player_id, team_id, kind, sim_payload")
      .eq("snapshot_date", snapshotDate)
      .order("team_id", { ascending: true })
      .limit(1500);

    if (error) throw new Error(error.message);

    const seasonStart = `${String(snapshotDate).slice(0, 4)}-01-01`;
    const { data: starterLogs, error: starterError } = await supabase
      .from("bp_pitcher_game_logs")
      .select("team_id, pitcher_name")
      .gte("game_date", seasonStart)
      .lte("game_date", snapshotDate)
      .eq("pitcher_order", "1")
      .limit(1000);

    if (starterError) throw new Error(starterError.message);

    const startsByPitcher = new Map<string, number>();
    for (const log of (starterLogs ?? []) as StarterLogRow[]) {
      const key = starterKey(log.team_id, log.pitcher_name);
      startsByPitcher.set(key, (startsByPitcher.get(key) ?? 0) + 1);
    }

    const rows = ((data ?? []) as SnapshotRow[]).map((row) =>
      row.kind === "pitcher"
        ? buildPitcherRow(row, startsByPitcher.get(starterKey(row.team_id, getName(row.sim_payload ?? {}, row.player_id))) ?? 0)
        : buildBatterRow(row)
    );

    return NextResponse.json({ ok: true, snapshotDate, rows });
  } catch (err) {
    console.error("[rankings/player-special] Internal Server Error:", err);
    return NextResponse.json(
      { ok: false, error: "선수 랭킹 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
