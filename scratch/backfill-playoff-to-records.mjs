// 과거 가을야구 경기를 공식 누적 전적(bp_records)에 백필.
// - 각 bp_playoff_runs.state.games 를 훑어 source='public' row 로 insert.
// - z_bp_account_stats 트리거가 final_score+owner 로 자동 +1 → 누적전적/뱃지/랭킹 반영.
// - 멱등: unique(owner_user_id, source, seed) 인덱스가 같은 playSeed 재삽입을 23505 로 거부.
//   → 두 번 돌려도 중복 누적 없음. playSeed 없는 과거 game 은 건너뜀(중복 위험 차단).
//
// 실행:
//   node scratch/backfill-playoff-to-records.mjs --dry   (집계만, 쓰기 X)
//   node scratch/backfill-playoff-to-records.mjs         (실제 insert)

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

const DRY = process.argv.includes("--dry");
const ROUND_LABEL = { 1: "와일드카드", 2: "준플레이오프", 3: "플레이오프", 4: "한국시리즈" };

// 모든 run 조회(페이지네이션).
async function fetchAllRuns() {
  const all = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from("bp_playoff_runs")
      .select("user_id, team_id, team_name, state, created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const runs = await fetchAllRuns();
console.log(`run 수: ${runs.length}`);

// 백필 대상 row 빌드.
const rows = [];
let totalGames = 0;
let noSeed = 0;
for (const run of runs) {
  const games = Array.isArray(run.state?.games) ? run.state.games : [];
  const opps = Array.isArray(run.state?.opponents) ? run.state.opponents : [];
  for (const g of games) {
    totalGames++;
    if (typeof g.playSeed !== "number") {
      noSeed++;
      continue;
    }
    const opp = opps.find((o) => o.round === g.round);
    rows.push({
      owner_user_id: run.user_id,
      source: "public",
      user_side: "home",
      engine_version: "playoff-backfill",
      seed: g.playSeed,
      input: null,
      result: null,
      home_team_id: run.team_id,
      away_team_id: g.oppTeamId,
      home_label: run.team_name,
      away_label: opp?.teamName ?? g.oppTeamId,
      final_score: { home: g?.score?.me ?? 0, away: g?.score?.opp ?? 0 },
      is_walkoff: false,
      total_innings: 9,
      name: `가을야구 ${ROUND_LABEL[g.round] ?? ""}`.trim(),
      created_at: g.playedAt ?? undefined
    });
  }
}

// 승/패 분포 미리보기.
let wins = 0;
let losses = 0;
for (const r of rows) {
  if (r.final_score.home > r.final_score.away) wins++;
  else if (r.final_score.home < r.final_score.away) losses++;
}

console.log(`\n=== 백필 대상 ===`);
console.log(`총 게임: ${totalGames}`);
console.log(`playSeed 없음(건너뜀): ${noSeed}`);
console.log(`insert 시도: ${rows.length}  (승 ${wins} / 패 ${losses})`);

// 유저별 분포(상위 10명)
const byUser = {};
for (const r of rows) byUser[r.owner_user_id] = (byUser[r.owner_user_id] ?? 0) + 1;
const top = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`\n유저별 게임 수(상위 10):`);
for (const [uid, n] of top) console.log(`  ${uid.slice(0, 8)}…: ${n}`);

if (DRY) {
  console.log(`\n[DRY] 실제 insert 안 함. 실행하려면 --dry 빼고 재실행.`);
  process.exit(0);
}

// 실제 insert — 개별 처리(23505=이미 있음 skip).
console.log(`\n=== insert 시작 ===`);
let inserted = 0;
let dup = 0;
let failed = 0;
for (const row of rows) {
  const { error } = await sb.from("bp_records").insert(row);
  if (!error) inserted++;
  else if (error.code === "23505") dup++;
  else {
    failed++;
    if (failed <= 10) console.warn(`  실패: ${error.code} ${error.message}`);
  }
}
console.log(`\n=== 완료 ===`);
console.log(`insert: ${inserted}  중복skip: ${dup}  실패: ${failed}`);
