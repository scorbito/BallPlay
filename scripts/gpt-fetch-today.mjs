import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [
        line.slice(0, index).trim(),
        line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
      ];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const gameDate = "2026-05-29";

const { data: games, error: gamesError } = await supabase
  .from("games")
  .select(
    "id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status"
  )
  .eq("game_date", gameDate)
  .order("game_time");

if (gamesError) throw gamesError;

console.log(JSON.stringify({ gameDate, games }, null, 2));

const gameIds = games.map((game) => game.id);
const { data: existing, error: existingError } = await supabase
  .from("bp_ai_predictions")
  .select("game_id, predicted_winner_team_id, confidence")
  .eq("ai_provider", "gpt")
  .eq("game_date", gameDate)
  .in("game_id", gameIds);

if (existingError) throw existingError;

console.log(JSON.stringify({ existingGptPredictions: existing }, null, 2));

const teamIds = [
  ...new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id])),
];

for (const teamId of teamIds) {
  const { data, error } = await supabase
    .from("bp_team_recent_lineups")
    .select("team_id, game_date, game_id, starter_name, is_home, batting")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(5);

  if (error) throw error;

  console.log(JSON.stringify({ teamId, recentLineups: data }, null, 2));
}

const since = "2026-05-27T00:00:00+09:00";
const { data: news, error: newsError } = await supabase
  .from("bp_news")
  .select("title, source, url, published_at")
  .gte("published_at", since)
  .order("published_at", { ascending: false })
  .limit(120);

if (newsError) throw newsError;

console.log(JSON.stringify({ recentNews: news }, null, 2));
