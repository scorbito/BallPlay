#!/usr/bin/env node
// @ts-check
/**
 * data/kbo_players_2026.json (5/22 baseline)을 bp_player_stats_snapshots에 시드.
 * recentFormLoader가 첫 델타 윈도우(baseline ↔ 첫 cron) 처리할 때 previous로 사용.
 *
 * 사용법:
 *   node scripts/seed-stats-snapshot-from-baseline.mjs                # 기본: data/kbo_players_2026.json의 snapshotDate 사용
 *   node scripts/seed-stats-snapshot-from-baseline.mjs --date=2026-05-22   # 강제 날짜
 *   node scripts/seed-stats-snapshot-from-baseline.mjs --dry-run      # 출력만, 저장 안 함
 *
 * idempotent — (snapshot_date, player_id, kind) unique라 재실행해도 덮어쓰기만.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── env ──────────────────────────────────────────────────
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

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dateFlag = args.find((a) => a.startsWith("--date="))?.split("=")[1] ?? null;

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const BASELINE_PATH = resolve(process.cwd(), "data", "kbo_players_2026.json");
const raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const snapshotDate = dateFlag ?? raw.snapshotDate;

if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
  console.error(`invalid snapshot_date: ${snapshotDate}`);
  process.exit(1);
}

console.log(`[seed-stats-snapshot] snapshot_date=${snapshotDate} dry-run=${dryRun}`);

// (player_id, kind) 기준 dedupe — 이적/중복 시드 대비. 마지막 등장 우선.
const byKey = new Map();
let dupes = 0;
for (const [teamId, team] of Object.entries(raw.teams ?? {})) {
  for (const b of team.batters ?? []) {
    const key = `${b.playerId}|batter`;
    if (byKey.has(key)) dupes++;
    byKey.set(key, {
      snapshot_date: snapshotDate,
      player_id: b.playerId,
      team_id: teamId,
      kind: "batter",
      sim_payload: b,
      source: "baseline-json"
    });
  }
  for (const p of team.pitchers ?? []) {
    const key = `${p.playerId}|pitcher`;
    if (byKey.has(key)) dupes++;
    byKey.set(key, {
      snapshot_date: snapshotDate,
      player_id: p.playerId,
      team_id: teamId,
      kind: "pitcher",
      sim_payload: p,
      source: "baseline-json"
    });
  }
}
const rows = Array.from(byKey.values());

console.log(`  타자 ${rows.filter((r) => r.kind === "batter").length}명 / 투수 ${rows.filter((r) => r.kind === "pitcher").length}명 / 총 ${rows.length}행 (중복 제거 ${dupes}건)`);

if (dryRun) {
  console.log("  (dry-run, exit)");
  process.exit(0);
}

// 500행씩 배치 upsert (Supabase row limit 방지)
const CHUNK = 500;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const { error } = await sb
    .from("bp_player_stats_snapshots")
    .upsert(slice, { onConflict: "snapshot_date,player_id,kind" });
  if (error) {
    console.error(`  ! chunk ${i / CHUNK}: ${error.message}`);
    process.exit(1);
  }
  done += slice.length;
  process.stdout.write(`\r  upserted ${done}/${rows.length}`);
}
console.log(`\n  ✓ done`);
