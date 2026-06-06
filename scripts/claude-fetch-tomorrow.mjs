// 내일 경기 + 컨텍스트 조회용 일회성 스크립트.
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

const KST_TOMORROW = (() => {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() + 1);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
})();

console.log(`### KST tomorrow: ${KST_TOMORROW}`);
console.log("=".repeat(70));

const { data: games } = await sb
  .from("games")
  .select("id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .eq("game_date", KST_TOMORROW)
  .order("game_time");

console.log(`\n## 내일 경기 ${games.length}건\n`);
games.forEach((g) => {
  console.log(`- ${g.game_time?.slice(0,5) ?? "-"} ${g.stadium} | ${g.away_team_id}(${g.away_starter ?? "-"}) @ ${g.home_team_id}(${g.home_starter ?? "-"})`);
  console.log(`  uuid=${g.id}`);
});

const gameIds = games.map(g => g.id);
const { data: myExisting } = await sb
  .from("bp_ai_predictions")
  .select("game_id, predicted_winner_team_id")
  .eq("ai_provider", "claude")
  .in("game_id", gameIds);
console.log(`\n## 본인(claude) 기존 예측: ${myExisting?.length ?? 0}건`);

const allTeamIds = [...new Set([...games.map(g=>g.home_team_id), ...games.map(g=>g.away_team_id)])];

console.log("\n## 팀별 최근 라인업 (최근 3건)");
for (const teamId of allTeamIds) {
  const { data } = await sb
    .from("bp_team_recent_lineups")
    .select("game_date, starter_name, is_home, batting")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(3);
  if (!data?.length) continue;
  console.log(`\n  [${teamId}]`);
  data.forEach(r => {
    const names = (r.batting ?? []).map(b => `${b.order ?? "?"}.${b.name}${b.position ? `(${b.position})` : ""}`).join(" ");
    console.log(`    ${r.game_date} ${r.is_home ? "홈" : "원정"} 선발=${r.starter_name ?? "-"} | ${names}`);
  });
}

console.log("\n## 최근 24h 뉴스 (팀별 6건)");
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const teamKeywordMap = {
  kt: ["KT", "위즈"], doosan: ["두산", "베어스"], lg: ["LG", "트윈스"],
  samsung: ["삼성", "라이온즈"], kia: ["KIA", "기아", "타이거즈"], nc: ["NC", "다이노스"],
  lotte: ["롯데", "자이언츠"], hanwha: ["한화", "이글스"], kiwoom: ["키움", "히어로즈"], ssg: ["SSG", "랜더스"]
};
const { data: news } = await sb
  .from("bp_news")
  .select("title, published_at")
  .gte("published_at", since)
  .order("published_at", { ascending: false })
  .limit(200);
const byTeam = new Map(allTeamIds.map(t => [t, []]));
(news ?? []).forEach(n => {
  for (const tid of allTeamIds) {
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
