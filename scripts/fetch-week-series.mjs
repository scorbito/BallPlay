// 이번 주 시리즈 일정 조회 (2026-07-07 ~ 06-28).
// early: 화-목 (6/30-7/2), weekend: 금-일 (7/3-7/5).

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

const { data: games } = await sb
  .from("games")
  .select("id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .gte("game_date", "2026-07-07")
  .lte("game_date", "2026-07-12")
  .order("game_date")
  .order("game_time");

console.log(`총 ${games.length}경기`);

// 매치업별로 그룹화: home-away 쌍이 같으면 같은 시리즈
const byMatchup = new Map();
for (const g of games) {
  const key = `${g.home_team_id}|${g.away_team_id}`;
  if (!byMatchup.has(key)) byMatchup.set(key, []);
  byMatchup.get(key).push(g);
}

console.log(`\n매치업 수: ${byMatchup.size}`);
for (const [key, gs] of byMatchup) {
  const [home, away] = key.split("|");
  const dates = gs.map((g) => g.game_date).join(", ");
  const group = gs[0].game_date <= "2026-07-09" ? "early" : "weekend";
  console.log(`\n[${group}] ${away} @ ${home} (${gs.length}경기) — ${dates}`);
  gs.forEach((g) => {
    console.log(`  ${g.game_date} ${g.game_time?.slice(0, 5)} ${g.stadium} | ${g.away_starter ?? "-"} vs ${g.home_starter ?? "-"} | ${g.id}`);
  });
}
