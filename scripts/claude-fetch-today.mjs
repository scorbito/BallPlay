// Claude 본인 작업용: 오늘 경기 + 허용된 3개 테이블만 조회.
// 다른 AI 예측은 보지 않음. 본인 claude row 존재 여부만 확인.

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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const KST_TODAY = (() => {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
})();

console.log(`### KST today: ${KST_TODAY}`);
console.log("=".repeat(70));

// 1) 오늘 경기 (games)
const { data: games, error: gErr } = await sb
  .from("games")
  .select("id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .eq("game_date", KST_TODAY)
  .order("game_time");
if (gErr) { console.error("games:", gErr.message); process.exit(1); }

console.log(`\n## 오늘 경기 ${games.length}건\n`);
games.forEach((g) => {
  console.log(`- ${g.game_time?.slice(0,5) ?? "-"} ${g.stadium} | ${g.away_team_id}(${g.away_starter ?? "-"}) @ ${g.home_team_id}(${g.home_starter ?? "-"}) | ${g.status}`);
  console.log(`  uuid=${g.id}`);
});

// 2) 본인 claude 예측 이미 있는지만 확인 (UNIQUE 위반 방지)
const gameIds = games.map(g => g.id);
const { data: myExisting } = await sb
  .from("bp_ai_predictions")
  .select("game_id, predicted_winner_team_id, confidence")
  .eq("ai_provider", "claude")
  .eq("game_date", KST_TODAY)
  .in("game_id", gameIds);

console.log(`\n## 본인(claude) 기존 예측: ${myExisting?.length ?? 0}건`);
(myExisting ?? []).forEach(r => console.log(`  - ${r.game_id} → ${r.predicted_winner_team_id} (${r.confidence})`));

// 3) 팀별 최근 라인업 (bp_team_recent_lineups)
console.log("\n## 팀별 최근 라인업 (최근 5건씩)");
const allTeamIds = [...new Set([...games.map(g=>g.home_team_id), ...games.map(g=>g.away_team_id)])];
for (const teamId of allTeamIds) {
  const { data, error } = await sb
    .from("bp_team_recent_lineups")
    .select("game_date, game_id, batting, starter_name, is_home")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(5);
  if (error || !data?.length) { console.log(`  ${teamId}: 없음`); continue; }
  console.log(`\n  [${teamId}]`);
  data.forEach(r => {
    const names = (r.batting ?? []).map(b => `${b.order ?? "?"}.${b.name}${b.position ? `(${b.position})` : ""}`).join(" ");
    console.log(`    ${r.game_date} ${r.is_home ? "홈" : "원정"} 선발=${r.starter_name ?? "-"} | ${names}`);
  });
}

// 4) 최근 48h 뉴스 (bp_news)
console.log("\n## 최근 48h 뉴스 (팀명 매칭)");
const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
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
  .limit(150);

const teamsInPlay = new Set(allTeamIds);
const byTeam = new Map(allTeamIds.map(t => [t, []]));
(news ?? []).forEach(n => {
  for (const tid of teamsInPlay) {
    const keys = teamKeywordMap[tid] ?? [];
    if (keys.some(k => n.title.includes(k))) {
      byTeam.get(tid).push(n);
      break;
    }
  }
});

for (const teamId of allTeamIds) {
  const items = byTeam.get(teamId).slice(0, 6);
  if (!items.length) continue;
  console.log(`\n  [${teamId}]`);
  items.forEach(n => console.log(`    [${n.published_at?.slice(0, 16)}] ${n.title}`));
}

console.log("\n" + "=".repeat(70));
console.log("완료. team_standings, bp_player_stats_snapshots 등 금지 테이블 조회 안 함.");
