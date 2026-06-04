// 일회성: data/kbo_players_2026.json 의 좌/우 split(vsLhpOps/vsRhpOps)을
// 기존 bp_player_stats_snapshots(batter) 의 sim_payload 에 in-place 추가.
//
// 왜 이렇게: 1000판 시뮬/AI매치는 statsLoaderWithRecent 가 baseline(JSON)을
// DB 스냅샷 블렌드로 덮어쓴다. blendBatter 가 {...season} 으로 split 을 보존하므로,
// 스냅샷 sim_payload 에 split 만 넣어주면 시뮬에 흐른다.
//
// 델타 안전: computeBatterDelta 는 카운팅 스탯(pa/ab/hits)만 쓰고 split 은 안 씀.
// 따라서 split 만 추가하면 최근 폼 델타는 그대로 — 주간 주기 영향 0.
//
// 사용:
//   node scripts/backfill-split-into-snapshots.mjs            # dry-run (쓰기 안 함)
//   node scripts/backfill-split-into-snapshots.mjs --apply    # 실제 업데이트
//
// 모든 날짜 스냅샷 행에 동일 split 적용 (split 은 현재 시즌값이라 날짜 무관, 델타 무영향).
// service role 필요.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  })
);
const SERVICE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("❌ service role key 없음 (.env.local SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// 1) JSON 에서 split 맵
const j = JSON.parse(readFileSync(resolve(process.cwd(), "data/kbo_players_2026.json"), "utf8"));
const splitById = new Map();
for (const team of Object.values(j.teams)) {
  for (const b of team.batters) {
    const s = {};
    if (b.vsLhpOps != null) s.vsLhpOps = b.vsLhpOps;
    if (b.vsRhpOps != null) s.vsRhpOps = b.vsRhpOps;
    if (Object.keys(s).length > 0) splitById.set(b.playerId, s);
  }
}
console.log(`JSON split 보유 타자: ${splitById.size}명`);

// 2) 기존 batter 스냅샷 전부
const { data: rows, error } = await sb
  .from("bp_player_stats_snapshots")
  .select("id, player_id, snapshot_date, sim_payload")
  .eq("kind", "batter");
if (error) {
  console.error("스냅샷 조회 실패:", error.message);
  process.exit(1);
}
console.log(`batter 스냅샷 행: ${rows.length}`);

// 3) split 있는 행만 패치
let toUpdate = 0;
let matchedPlayers = new Set();
const updates = [];
for (const r of rows) {
  const s = splitById.get(r.player_id);
  if (!s) continue;
  const payload = r.sim_payload || {};
  // 이미 동일 값이면 skip
  const changed =
    (s.vsLhpOps != null && payload.vsLhpOps !== s.vsLhpOps) ||
    (s.vsRhpOps != null && payload.vsRhpOps !== s.vsRhpOps);
  if (!changed) continue;
  updates.push({ id: r.id, sim_payload: { ...payload, ...s } });
  toUpdate++;
  matchedPlayers.add(r.player_id);
}
console.log(`업데이트 대상 행: ${toUpdate} (선수 ${matchedPlayers.size}명)`);

// 샘플 출력
console.log("샘플(최대 6):");
for (const u of updates.slice(0, 6)) {
  console.log(`  ${u.sim_payload.playerId} ${u.sim_payload.name}: vsLHP ${u.sim_payload.vsLhpOps ?? "-"} / vsRHP ${u.sim_payload.vsRhpOps ?? "-"}`);
}

if (!APPLY) {
  console.log("\n[dry-run] 실제 쓰기 안 함. 적용하려면 --apply");
  process.exit(0);
}

// 4) 적용 — id 기준 update
let done = 0, failed = 0;
for (const u of updates) {
  const { error: e } = await sb
    .from("bp_player_stats_snapshots")
    .update({ sim_payload: u.sim_payload })
    .eq("id", u.id);
  if (e) { failed++; if (failed <= 5) console.warn("  update 실패:", u.id, e.message); }
  else done++;
}
console.log(`\n✅ 적용 완료 — 성공 ${done} / 실패 ${failed}`);
