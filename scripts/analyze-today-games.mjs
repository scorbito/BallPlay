// 오늘 경기 분석 데이터 수집 (read-only, anon key).
// 다른 AI 의 예측은 의도적으로 조회하지 않음 (독립성 규칙).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
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

const KST_TODAY = process.argv[2] ?? (() => {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
})();

console.log(`### KST today: ${KST_TODAY}`);
console.log("=".repeat(70));

// --- 1) 오늘 경기 ---
const { data: games, error: gErr } = await sb
  .from("games")
  .select("id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .eq("game_date", KST_TODAY)
  .order("game_time");
if (gErr) { console.error("games:", gErr.message); process.exit(1); }

console.log(`\n## 오늘 경기 ${games.length}건\n`);
games.forEach((g) => {
  console.log(`- ${g.external_id ?? g.id}`);
  console.log(`  ${g.game_time?.slice(0,5) ?? "-"} ${g.stadium} | ${g.away_team_id} ${g.away_starter ?? "-"} @ ${g.home_team_id} ${g.home_starter ?? "-"} | status=${g.status}`);
  console.log(`  uuid=${g.id}`);
});

// --- 2) 팀 순위 ---
console.log("\n## 팀 순위 / 최근 폼");
const tryStandings = await sb
  .from("team_standings")
  .select("*")
  .order("rank", { ascending: true });
if (tryStandings.error) {
  console.log("  team_standings 조회 실패:", tryStandings.error.message);
} else {
  // 최신 row만
  const bySeason = new Map();
  for (const r of tryStandings.data) {
    const key = r.team_id;
    const cur = bySeason.get(key);
    if (!cur || (r.updated_at ?? "") > (cur.updated_at ?? "")) bySeason.set(key, r);
  }
  const teams = new Set([...games.map(g=>g.home_team_id), ...games.map(g=>g.away_team_id)]);
  for (const r of [...bySeason.values()].sort((a,b)=>a.rank-b.rank)) {
    if (!teams.has(r.team_id)) continue;
    const winRate = r.win_rate ?? (r.wins / Math.max(1, r.wins + r.losses));
    const gb = r.games_behind ?? "-";
    console.log(`  ${String(r.rank).padStart(2)}위 ${r.team_id.padEnd(8)} ${r.wins}승 ${r.losses}패${r.draws ? ` ${r.draws}무` : ""} | 승률 ${Number(winRate).toFixed(3)} | GB ${gb}`);
  }
}

// --- 3) 선발 투수 스탯 (이름 매칭) ---
console.log("\n## 선발 투수 시즌 스탯 (최신 스냅샷)");
const starterNames = new Set();
games.forEach((g) => { if (g.home_starter) starterNames.add(g.home_starter); if (g.away_starter) starterNames.add(g.away_starter); });

const pitcherInfo = new Map();
for (const name of starterNames) {
  const { data, error } = await sb
    .from("bp_player_stats_snapshots")
    .select("player_id, team_id, snapshot_date, sim_payload")
    .eq("kind", "pitcher")
    .ilike("sim_payload->>name", `%${name}%`)
    .order("snapshot_date", { ascending: false })
    .limit(2);
  if (error || !data?.length) {
    console.log(`  ${name}: 스냅샷 없음`);
    continue;
  }
  const latest = data[0].sim_payload;
  const prev = data[1]?.sim_payload;
  pitcherInfo.set(name, { latest, prev, teamId: data[0].team_id });
  const deltaIp = prev ? (latest.ip - prev.ip).toFixed(1) : "-";
  const deltaEr = prev ? (latest.earnedRuns - prev.earnedRuns) : "-";
  console.log(`  ${name.padEnd(6)} [${data[0].team_id}] ip=${latest.ip} era=${latest.era} whip=${latest.whip} k9=${latest.k9} bb9=${latest.bb9} hr9=${latest.hr9} | 주간Δ ip=${deltaIp} er=${deltaEr}`);
}

// --- 3-1) 선발 투수 상대팀 전적 ---
console.log("\n## 선발 투수 상대팀 전적");
if (starterNames.size === 0) {
  console.log("  선발 투수 이름이 없어 조회하지 않음");
} else {
  const { data: vsRows, error: vsErr } = await sb
    .from("bp_pitcher_vs_team_stats")
    .select("pitcher_name,team_id,opponent_team_id,games,starts,wins,losses,innings,era,whip,k9,bb9,last_game_date")
    .in("pitcher_name", [...starterNames]);

  if (vsErr) {
    console.log("  bp_pitcher_vs_team_stats 조회 실패:", vsErr.message);
  } else {
    const formatVs = (row) => {
      if (!row) return "상대 전적 없음";
      return `${row.games}경기/${row.starts}선발 ${row.innings}이닝 ERA ${row.era ?? "-"} WHIP ${row.whip ?? "-"} K9 ${row.k9 ?? "-"} BB9 ${row.bb9 ?? "-"} | 최근 ${row.last_game_date}`;
    };

    for (const g of games) {
      const awayVs = (vsRows ?? []).find(
        (row) =>
          row.pitcher_name === g.away_starter &&
          row.team_id === g.away_team_id &&
          row.opponent_team_id === g.home_team_id
      );
      const homeVs = (vsRows ?? []).find(
        (row) =>
          row.pitcher_name === g.home_starter &&
          row.team_id === g.home_team_id &&
          row.opponent_team_id === g.away_team_id
      );

      console.log(`  ${g.away_team_id}@${g.home_team_id}`);
      console.log(`    ${g.away_team_id} ${g.away_starter ?? "-"} vs ${g.home_team_id}: ${formatVs(awayVs)}`);
      console.log(`    ${g.home_team_id} ${g.home_starter ?? "-"} vs ${g.away_team_id}: ${formatVs(homeVs)}`);
    }
  }
}

// --- 4) 팀별 최근 10경기 라인업 — 타선 종합 평가용 ---
console.log("\n## 팀별 최근 라인업 (가장 최근 1건)");
const teamLineups = new Map();
const allTeamIds = [...new Set([...games.map(g=>g.home_team_id), ...games.map(g=>g.away_team_id)])];
for (const teamId of allTeamIds) {
  const { data, error } = await sb
    .from("bp_team_recent_lineups")
    .select("game_date, game_id, batting, starter_name, is_home")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error || !data?.length) { console.log(`  ${teamId}: 없음`); continue; }
  teamLineups.set(teamId, data);
  const recent = data[0];
  const names = (recent.batting ?? []).map(b => b.name).join(", ");
  console.log(`  ${teamId} (${recent.game_date}): ${names}`);
}

// --- 5) 팀별 타선 평균 능력 (최근 라인업의 선수 스탯 평균) ---
console.log("\n## 팀별 타선 시즌 능력 평균 (최근 라인업 9인 기준)");
for (const teamId of allTeamIds) {
  const lineup = teamLineups.get(teamId)?.[0]?.batting;
  if (!lineup) continue;
  const names = lineup.map(b => b.name).filter(Boolean);
  if (names.length === 0) continue;

  // OR 검색
  const filter = names.map(n => `sim_payload->>name.ilike.%${n}%`).join(",");
  const { data, error } = await sb
    .from("bp_player_stats_snapshots")
    .select("player_id, snapshot_date, sim_payload")
    .eq("kind", "batter")
    .eq("team_id", teamId)
    .or(filter)
    .order("snapshot_date", { ascending: false })
    .limit(50);
  if (error) { console.log(`  ${teamId}: ${error.message}`); continue; }

  // 선수별 최신 1개씩
  const seen = new Map();
  for (const r of data) {
    if (!seen.has(r.sim_payload?.name)) seen.set(r.sim_payload?.name, r.sim_payload);
  }
  const arr = [...seen.values()];
  if (arr.length === 0) continue;
  const avgAvg = arr.reduce((s, p) => s + (p.avg ?? 0), 0) / arr.length;
  const avgObp = arr.reduce((s, p) => s + (p.obp ?? 0), 0) / arr.length;
  const avgSlg = arr.reduce((s, p) => s + (p.slg ?? 0), 0) / arr.length;
  const avgIso = arr.reduce((s, p) => s + (p.iso ?? 0), 0) / arr.length;
  const avgK = arr.reduce((s, p) => s + (p.kRate ?? 0), 0) / arr.length;
  console.log(`  ${teamId.padEnd(8)} (${arr.length}명) avg=${avgAvg.toFixed(3)} obp=${avgObp.toFixed(3)} slg=${avgSlg.toFixed(3)} iso=${avgIso.toFixed(3)} k%=${(avgK*100).toFixed(1)}`);
}

// --- 6) 최근 24h 뉴스 (팀 키워드 매칭) ---
console.log("\n## 최근 24h 뉴스 (팀명 매칭, 최대 8건)");
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const teamKeywordMap = {
  kt: ["KT", "위즈"], doosan: ["두산", "베어스"], lg: ["LG", "트윈스"],
  samsung: ["삼성", "라이온즈"], kia: ["KIA", "기아", "타이거즈"], nc: ["NC", "다이노스"],
  lotte: ["롯데", "자이언츠"], hanwha: ["한화", "이글스"], kiwoom: ["키움", "히어로즈"], ssg: ["SSG", "랜더스"]
};
const { data: news } = await sb
  .from("bp_news")
  .select("title, url, source, published_at")
  .gte("published_at", since)
  .order("published_at", { ascending: false })
  .limit(60);

const teamsInPlay = new Set(allTeamIds);
const filteredNews = (news ?? []).filter(n => {
  for (const tid of teamsInPlay) {
    const keys = teamKeywordMap[tid] ?? [];
    if (keys.some(k => n.title.includes(k))) return true;
  }
  return false;
}).slice(0, 8);

filteredNews.forEach(n => {
  console.log(`  [${n.published_at?.slice(0, 16)}] ${n.title}`);
});

console.log("\n" + "=".repeat(70));
console.log("완료. 다른 AI 예측은 조회하지 않았습니다.");
