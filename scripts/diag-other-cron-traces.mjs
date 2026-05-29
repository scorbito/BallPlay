// 다른 cron의 동작 흔적 확인 — sync-kbo-lineups, sync-kbo-standings.

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

// 1) bp_team_recent_lineups — sync-kbo-lineups가 매일 update해야 하는 테이블
const { data: lineups } = await sb
  .from("bp_team_recent_lineups")
  .select("team_id, updated_at, source_game_date")
  .order("updated_at", { ascending: false })
  .limit(10);

console.log(`\n=== bp_team_recent_lineups — sync-kbo-lineups cron이 만지는 테이블 ===`);
for (const r of lineups ?? []) {
  console.log(`  ${r.team_id} | source_game_date=${r.source_game_date} | updated_at=${r.updated_at}`);
}

// 2) team_standings — sync-kbo-standings가 매일 update해야 하는 테이블
const { data: standings } = await sb
  .from("team_standings")
  .select("team_id, updated_at")
  .order("updated_at", { ascending: false })
  .limit(5);

console.log(`\n=== team_standings — sync-kbo-standings cron이 만지는 테이블 (방금 23:30 KST에 호출 확인됨) ===`);
for (const r of standings ?? []) {
  console.log(`  ${r.team_id} | updated_at=${r.updated_at}`);
}

// 3) games starter_fetched_at — sync-kbo-games cron payload에 들어가는 필드. 이게 갱신되면 games sync 호출 동작 확인.
const { data: games } = await sb
  .from("games")
  .select("game_date, external_id, starter_fetched_at")
  .gte("game_date", "2026-05-28")
  .lte("game_date", "2026-05-30")
  .order("starter_fetched_at", { ascending: false, nullsFirst: false })
  .limit(15);

console.log(`\n=== games.starter_fetched_at — sync-kbo-games cron이 매번 갱신하는 필드 ===`);
for (const g of games ?? []) {
  console.log(`  ${g.game_date} | ${g.external_id} | starter_fetched_at=${g.starter_fetched_at}`);
}
