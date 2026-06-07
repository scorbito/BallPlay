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

console.log("Fetching games from 2026-06-09 to 2026-06-14...");
const { data: games, error } = await sb
  .from("games")
  .select("id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .gte("game_date", "2026-06-09")
  .lte("game_date", "2026-06-14")
  .order("game_date")
  .order("game_time");

if (error) {
  console.error("Error fetching games:", error.message);
  process.exit(1);
}

console.log(`Found ${games.length} games.`);
games.forEach(g => {
  console.log(`[${g.game_date}] ${g.id} | ${g.away_team_id} @ ${g.home_team_id} (${g.away_starter ?? '?'} vs ${g.home_starter ?? '?'}) | status: ${g.status}`);
});
