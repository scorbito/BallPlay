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

const GAME_DATE = "2026-06-09";

// 1) 경기 정보 조회
const { data: games, error: gError } = await sb
  .from("games")
  .select("id, home_team_id, away_team_id, stadium, game_time")
  .eq("game_date", GAME_DATE);

if (gError) {
  console.error("Error fetching games:", gError.message);
  process.exit(1);
}

// 2) 예측 정보 조회
const { data: predictions, error: pError } = await sb
  .from("bp_ai_predictions")
  .select("game_id, ai_provider, predicted_winner_team_id, confidence, key_factor, one_liner")
  .eq("game_date", GAME_DATE);

if (pError) {
  console.error("Error fetching predictions:", pError.message);
  process.exit(1);
}

// 3) 경기 매핑 생성
const gamesMap = new Map();
games.forEach(g => {
  gamesMap.set(g.id, g);
});

// 4) 예측 그룹화
const groups = {};
predictions.forEach(p => {
  if (!groups[p.game_id]) {
    groups[p.game_id] = [];
  }
  groups[p.game_id].push(p);
});

// 5) 경기별/AI(gpt -> gemini -> claude) 예측 포맷팅
console.log(`=== ${GAME_DATE} 승부예측 요약 ===\n`);

const providerOrder = ["gpt", "gemini", "claude"];

games.forEach(g => {
  console.log(`■ [${g.stadium}] ${g.away_team_id.toUpperCase()} vs ${g.home_team_id.toUpperCase()} (시간: ${g.game_time.slice(0, 5)})`);
  const gamePreds = groups[g.id] ?? [];
  
  providerOrder.forEach(prov => {
    const pred = gamePreds.find(p => p.ai_provider === prov);
    if (pred) {
      console.log(`  - ${prov.toUpperCase()}: ${pred.predicted_winner_team_id.toUpperCase()} 승리 예측 (신뢰도: ${(pred.confidence * 100).toFixed(0)}%)`);
      console.log(`    * 핵심 요인: ${pred.key_factor}`);
      console.log(`    * 요약: ${pred.one_liner}`);
    } else {
      console.log(`  - ${prov.toUpperCase()}: 예측 데이터 없음`);
    }
  });
  console.log("");
});
