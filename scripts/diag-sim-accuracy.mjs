// bp_sim_results 누적 적중률 진단 — 어떤 경기가 집계되는지 출력 (read-only, anon).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const { data: sims, error: e1 } = await sb
  .from("bp_sim_results")
  .select("game_id, game_date, home_team_id, away_team_id, home_wins, away_wins");
if (e1) { console.error("sims:", e1.message); process.exit(1); }
console.log(`bp_sim_results 총 ${sims.length}행`);

const ids = sims.map((s) => s.game_id);
const { data: games, error: e2 } = await sb
  .from("games")
  .select("id, game_date, home_team_id, away_team_id, home_score, away_score, status")
  .in("id", ids);
if (e2) { console.error("games:", e2.message); process.exit(1); }
const gById = new Map(games.map((g) => [g.id, g]));

let total = 0, correct = 0;
const byDate = {};
for (const s of sims) {
  const g = gById.get(s.game_id);
  byDate[s.game_date] ??= { rows: 0, judged: 0, hit: 0, games: [] };
  byDate[s.game_date].rows++;
  if (!g) { byDate[s.game_date].games.push(`  ${s.home_team_id} vs ${s.away_team_id} — games 매칭 없음`); continue; }
  const finished = g.status === "finished" && g.home_score !== null && g.away_score !== null;
  const canceled = g.status === "canceled";
  const simHome = s.home_wins > s.away_wins, simAway = s.away_wins > s.home_wins;
  const actHome = finished && g.home_score > g.away_score, actAway = finished && g.away_score > g.home_score;
  let verdict = "제외";
  // 시뮬 우세팀 있는 종료 경기만 분모. 실제 무승부도 분모 포함(빗나감).
  if (finished && (simHome || simAway)) {
    total++; byDate[s.game_date].judged++;
    if ((simHome && actHome) || (simAway && actAway)) { correct++; byDate[s.game_date].hit++; verdict = "적중"; }
    else verdict = (!actHome && !actAway) ? "빗나감(무승부)" : "빗나감";
  } else if (canceled) verdict = "취소";
  else if (g.status !== "finished") verdict = `미종료(${g.status})`;
  else verdict = "시뮬박빙";
  byDate[s.game_date].games.push(
    `  ${s.home_team_id} ${g?.home_score ?? "-"} vs ${g?.away_score ?? "-"} ${s.away_team_id} | 시뮬 ${s.home_wins}-${s.away_wins} | status=${g?.status} → ${verdict}`
  );
}

for (const d of Object.keys(byDate).sort()) {
  const b = byDate[d];
  console.log(`\n## ${d} (행 ${b.rows} · 판정 ${b.judged} · 적중 ${b.hit})`);
  b.games.forEach((line) => console.log(line));
}
console.log(`\n=== 누적: ${correct} / ${total} 적중 (${total > 0 ? Math.round(correct/total*100) : "—"}%) ===`);
