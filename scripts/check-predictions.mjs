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

const GAME_DATE = "2026-05-31";

console.log(`Checking predictions for ${GAME_DATE}...`);
const { data, error } = await sb
  .from("bp_ai_predictions")
  .select("id, game_id, ai_provider, predicted_winner_team_id, confidence, key_factor, published_at")
  .eq("game_date", GAME_DATE);

if (error) {
  console.error("Error fetching predictions:", error.message);
  process.exit(1);
}

console.log(`Found ${data.length} predictions in DB:`);
data.forEach((r) => {
  console.log(`- ID: ${r.id} | Game: ${r.game_id} | Provider: ${r.ai_provider} | Winner: ${r.predicted_winner_team_id} | Confidence: ${r.confidence} | Key Factor: ${r.key_factor} | Published At: ${r.published_at}`);
});
