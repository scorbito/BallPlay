// 2026-06-05 자 gemini / gpt 예측 행 model_name 일괄 UPDATE.

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

const GAME_DATE = "2026-06-05";
const updates = [
  { provider: "gemini", model: "gemini-3-5-flash-high" },
  { provider: "gpt", model: "gpt-5.5-codex" }
];

for (const u of updates) {
  const { data, error } = await sb
    .from("bp_ai_predictions")
    .update({ model_name: u.model })
    .eq("ai_provider", u.provider)
    .eq("game_date", GAME_DATE)
    .select("id, predicted_winner_team_id");

  if (error) {
    console.log(`✗ ${u.provider}: ${error.message}`);
    continue;
  }
  console.log(`✓ ${u.provider} → ${u.model} (${data.length}건)`);
  data.forEach((r) => console.log(`    - ${r.predicted_winner_team_id.padEnd(8)} ${r.id}`));
}
