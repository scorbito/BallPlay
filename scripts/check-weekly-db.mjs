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

console.log("Checking bp_ai_weekly_series for week 2026-06-08...");
const { data: seriesList, error: sErr } = await sb
  .from("bp_ai_weekly_series")
  .select("id, series_group, home_team_id, away_team_id")
  .eq("week_start_date", "2026-06-08");

if (sErr) {
  console.error("Series error:", sErr.message);
  process.exit(1);
}

console.log(`Found ${seriesList.length} series in DB.`);

console.log("\nChecking bp_ai_weekly_series_predictions for week 2026-06-08...");
const { data: predsList, error: pErr } = await sb
  .from("bp_ai_weekly_series_predictions")
  .select("id, series_id, ai_provider, predicted_winner_team_id, predicted_result, confidence")
  .eq("week_start_date", "2026-06-08");

if (pErr) {
  console.error("Predictions error:", pErr.message);
  process.exit(1);
}

console.log(`Found ${predsList.length} predictions in DB.`);
predsList.forEach(p => {
  const matchingSeries = seriesList.find(s => s.id === p.series_id);
  const matchup = matchingSeries 
    ? `${matchingSeries.away_team_id} @ ${matchingSeries.home_team_id} (${matchingSeries.series_group})`
    : "Unknown Series";
  console.log(`- Matchup: ${matchup} | Provider: ${p.ai_provider} | Winner Pick: ${p.predicted_winner_team_id} | Result: ${p.predicted_result} | Confidence: ${p.confidence}`);
});
