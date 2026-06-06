// 오늘(2026-06-05)자 claude 예측 행 model_name 을 4-7 → 4-8 로 일괄 UPDATE.

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

const { data, error } = await sb
  .from("bp_ai_predictions")
  .update({ model_name: "claude-opus-4-8" })
  .eq("ai_provider", "claude")
  .eq("game_date", GAME_DATE)
  .select("id, game_id, predicted_winner_team_id, model_name");

if (error) {
  console.log(`✗ update failed: ${error.message}`);
  process.exit(1);
}

console.log(`✓ updated ${data.length} rows to model_name='claude-opus-4-8':`);
data.forEach((r) => console.log(`  - ${r.predicted_winner_team_id.padEnd(8)} ${r.id}`));
