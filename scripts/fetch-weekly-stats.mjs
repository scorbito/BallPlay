import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

console.log("Fetching latest team standings...");
const { data: standings, error: sErr } = await sb
  .from("team_standings")
  .select("*")
  .eq("season", 2026)
  .order("rank");

if (sErr) console.error("Standings Error:", sErr.message);

console.log("Fetching latest player snapshots...");
// Fetch batters
const { data: allBatters, error: bErr } = await sb
  .from("bp_player_stats_snapshots")
  .select("player_id, team_id, snapshot_date, sim_payload")
  .eq("kind", "batter")
  .order("snapshot_date", { ascending: false });

if (bErr) console.error("Batters Error:", bErr.message);

// Fetch pitchers
const { data: allPitchers, error: pErr } = await sb
  .from("bp_player_stats_snapshots")
  .select("player_id, team_id, snapshot_date, sim_payload")
  .eq("kind", "pitcher")
  .order("snapshot_date", { ascending: false });

if (pErr) console.error("Pitchers Error:", pErr.message);

const teams = ["lg", "kt", "samsung", "kia", "hanwha", "doosan", "nc", "ssg", "lotte", "kiwoom"];
const statsSummary = {};

for (const tid of teams) {
  // Batters aggregation
  const teamBatters = allBatters?.filter(r => r.team_id === tid) ?? [];
  const latestBattersDate = teamBatters.length > 0 ? teamBatters[0].snapshot_date : null;
  const latestBatters = teamBatters.filter(r => r.snapshot_date === latestBattersDate);

  const batterList = latestBatters.map(r => {
    const p = r.sim_payload ?? {};
    const avg = p.avg ?? 0;
    const obp = p.obp ?? 0;
    const slg = p.slg ?? 0;
    const ops = obp + slg;
    return {
      name: p.name,
      avg: avg.toFixed(3),
      obp: obp.toFixed(3),
      slg: slg.toFixed(3),
      ops: ops.toFixed(3),
      hr: p.hr ?? 0,
      rbi: p.rbi ?? 0
    };
  }).sort((a, b) => parseFloat(b.ops) - parseFloat(a.ops));

  const regularBatters = batterList.filter(b => parseFloat(b.ops) > 0.5);
  const avgOps = regularBatters.length > 0
    ? (regularBatters.reduce((acc, b) => acc + parseFloat(b.ops), 0) / regularBatters.length).toFixed(3)
    : "0.000";
  const avgAvg = regularBatters.length > 0
    ? (regularBatters.reduce((acc, b) => acc + parseFloat(b.avg), 0) / regularBatters.length).toFixed(3)
    : "0.000";

  // Pitchers aggregation
  const teamPitchers = allPitchers?.filter(r => r.team_id === tid) ?? [];
  const latestPitchersDate = teamPitchers.length > 0 ? teamPitchers[0].snapshot_date : null;
  const latestPitchers = teamPitchers.filter(r => r.snapshot_date === latestPitchersDate);

  const pitcherList = latestPitchers.map(r => {
    const p = r.sim_payload ?? {};
    return {
      name: p.name,
      role: p.role ?? "RP",
      era: p.era ?? 0,
      whip: p.whip ?? 0,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      ip: p.ip ?? 0,
      k9: p.k9 ?? 0,
      bb9: p.bb9 ?? 0
    };
  }).sort((a, b) => (b.ip ?? 0) - (a.ip ?? 0)); // Sort by innings pitched

  const startingPitchers = pitcherList.filter(p => p.role === "SP" || p.ip > 20);
  const avgEra = startingPitchers.length > 0
    ? (startingPitchers.reduce((acc, p) => acc + p.era, 0) / startingPitchers.length).toFixed(2)
    : "0.00";
  const avgWhip = startingPitchers.length > 0
    ? (startingPitchers.reduce((acc, p) => acc + p.whip, 0) / startingPitchers.length).toFixed(2)
    : "0.00";

  statsSummary[tid] = {
    team_id: tid,
    batterDate: latestBattersDate,
    pitcherDate: latestPitchersDate,
    avgOps,
    avgAvg,
    avgEra,
    avgWhip,
    topBatters: batterList.slice(0, 5),
    topPitchers: pitcherList.slice(0, 5)
  };
}

const result = {
  standings,
  statsSummary
};

writeFileSync(resolve(process.cwd(), "scripts/weekly-stats-summary.json"), JSON.stringify(result, null, 2), "utf8");
console.log("Successfully wrote weekly stats summary to scripts/weekly-stats-summary.json");
