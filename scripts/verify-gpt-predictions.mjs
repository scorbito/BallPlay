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

const gameDate = process.argv[2] ?? "2026-05-29";

const { data, error } = await supabase
  .from("bp_ai_predictions")
  .select("game_id, ai_provider, predicted_winner_team_id, confidence, published_at")
  .eq("game_date", gameDate)
  .eq("ai_provider", "gpt")
  .order("created_at");

if (error) throw error;

console.log(JSON.stringify(data, null, 2));
