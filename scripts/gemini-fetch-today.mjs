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

const KST_TODAY = "2026-05-30";

// 1) 오늘 경기 (games)
const { data: games, error: gErr } = await sb
  .from("games")
  .select("id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .eq("game_date", KST_TODAY)
  .order("game_time");

if (gErr) {
  console.error("games:", gErr.message);
  process.exit(1);
}

// 2) 팀별 최근 라인업 (bp_team_recent_lineups)
const allTeamIds = [...new Set([...games.map(g => g.home_team_id), ...games.map(g => g.away_team_id)])];
const lineups = {};
for (const teamId of allTeamIds) {
  const { data, error } = await sb
    .from("bp_team_recent_lineups")
    .select("game_date, game_id, batting, starter_name, is_home")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(5);
  if (!error && data) {
    lineups[teamId] = data;
  }
}

// 3) 최근 48h 뉴스 (bp_news)
const since = new Date(new Date(KST_TODAY).getTime() - 48 * 60 * 60 * 1000).toISOString();
const { data: news } = await sb
  .from("bp_news")
  .select("title, url, source, published_at")
  .gte("published_at", since)
  .order("published_at", { ascending: false })
  .limit(200);

const teamKeywordMap = {
  kt: ["KT", "위즈"], doosan: ["두산", "베어스"], lg: ["LG", "트윈스"],
  samsung: ["삼성", "라이온즈"], kia: ["KIA", "기아", "타이거즈"], nc: ["NC", "다이노스"],
  lotte: ["롯데", "자이언츠"], hanwha: ["한화", "이글스"], kiwoom: ["키움", "히어로즈"], ssg: ["SSG", "랜더스"]
};

const teamNews = {};
allTeamIds.forEach(tid => { teamNews[tid] = []; });

(news ?? []).forEach(n => {
  for (const tid of allTeamIds) {
    const keys = teamKeywordMap[tid] ?? [];
    if (keys.some(k => n.title.includes(k))) {
      teamNews[tid].push(n);
    }
  }
});

const result = {
  date: KST_TODAY,
  games,
  lineups,
  teamNews
};

writeFileSync(resolve(process.cwd(), "scripts/today-fetched-data.json"), JSON.stringify(result, null, 2), "utf8");
console.log("Successfully wrote today's games, lineups, and news to scripts/today-fetched-data.json");
