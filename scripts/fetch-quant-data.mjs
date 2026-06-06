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

// 1) 모든 투수 스냅샷 조회
const { data: allPitchers, error: pErr } = await sb
  .from("bp_player_stats_snapshots")
  .select("player_id, team_id, snapshot_date, sim_payload")
  .eq("kind", "pitcher")
  .order("snapshot_date", { ascending: false })
  .limit(3000);

if (pErr) console.error("Error fetching all pitchers:", pErr.message);

// 2) 모든 타자 스냅샷 조회
const { data: allBatters, error: bErr } = await sb
  .from("bp_player_stats_snapshots")
  .select("player_id, team_id, snapshot_date, sim_payload")
  .eq("kind", "batter")
  .order("snapshot_date", { ascending: false })
  .limit(3000);

if (bErr) console.error("Error fetching all batters:", bErr.message);

const todayData = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/today-fetched-data.json"), "utf8"));
const starters = [];
for (const g of todayData.games) {
  if (g.home_starter) {
    starters.push({ team: g.home_team_id, name: g.home_starter });
  }
  if (g.away_starter) {
    starters.push({ team: g.away_team_id, name: g.away_starter });
  }
}

const starterStats = [];
for (const s of starters) {
  const matchedList = allPitchers?.filter(r => 
    r.sim_payload?.name === s.name || 
    r.sim_payload?.name?.includes(s.name)
  ) ?? [];

  if (matchedList.length > 0) {
    const latest = matchedList[0];
    starterStats.push({
      team: s.team,
      reqTeam: s.team,
      foundTeam: latest.team_id,
      name: s.name,
      snapshot_date: latest.snapshot_date,
      stats: latest.sim_payload
    });
  } else {
    starterStats.push({
      team: s.team,
      name: s.name,
      stats: null,
      message: "No snapshot found in DB"
    });
  }
}

// 팀별 타선 요약 (상위 타자들 스탯 집계)
const teamOffense = {};
const uniqueTeams = ["lotte", "kia", "lg", "kt", "hanwha", "doosan", "nc", "samsung", "kiwoom", "ssg"];

for (const tid of uniqueTeams) {
  // 해당 팀의 가장 최신 스냅샷 타자들 필터링
  const teamBatters = allBatters?.filter(r => r.team_id === tid) ?? [];
  // 최신 snapshot_date 찾기
  const latestDate = teamBatters.length > 0 ? teamBatters[0].snapshot_date : null;
  const latestBatters = teamBatters.filter(r => r.snapshot_date === latestDate);

  // 타자들 정량 요약
  const battersList = latestBatters.map(r => {
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
  }).sort((a, b) => parseFloat(b.ops) - parseFloat(a.ops)); // OPS 순 정렬

  // 팀 평균 타격 지표 계산 (OPS 0.5 이상 실질 주전 타자 기준 평균)
  const regularBatters = battersList.filter(b => parseFloat(b.ops) > 0.5);
  const avgOps = regularBatters.length > 0 
    ? (regularBatters.reduce((acc, b) => acc + parseFloat(b.ops), 0) / regularBatters.length).toFixed(3)
    : "0.000";
  const avgAvg = regularBatters.length > 0
    ? (regularBatters.reduce((acc, b) => acc + parseFloat(b.avg), 0) / regularBatters.length).toFixed(3)
    : "0.000";

  teamOffense[tid] = {
    snapshot_date: latestDate,
    team_avg_ops: avgOps,
    team_avg_avg: avgAvg,
    top_hitters: battersList.slice(0, 5) // 팀 내 상위 5명 노출
  };
}

// 1) 팀 순위 조회 (2026시즌)
const { data: standings, error: sErr } = await sb
  .from("team_standings")
  .select("*")
  .eq("season", 2026)
  .order("rank");

const result = {
  standings,
  starterStats,
  teamOffense
};

writeFileSync(resolve(process.cwd(), "scripts/quant-fetched-data.json"), JSON.stringify(result, null, 2), "utf8");
console.log("Successfully wrote quant and batting data to scripts/quant-fetched-data.json");
