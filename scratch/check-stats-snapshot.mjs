// 오늘(및 최근) 선수 스탯 스냅샷 적재 여부 확인.
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

const TODAY = "2026-06-08";

// 1) 오늘 날짜 스냅샷 개수 + kind/team 분포
const { data: today, error: e1 } = await sb
  .from("bp_player_stats_snapshots")
  .select("team_id, kind")
  .eq("snapshot_date", TODAY);

if (e1) {
  console.error("query error:", e1.message);
  process.exit(1);
}

console.log(`\n=== ${TODAY} 스냅샷 ===`);
console.log(`총 행: ${today.length}`);
const byKind = {};
const byTeam = {};
for (const r of today) {
  byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  byTeam[r.team_id] = (byTeam[r.team_id] ?? 0) + 1;
}
console.log("kind별:", byKind);
console.log("팀별:", byTeam);

// 2) 최근 스냅샷 날짜 목록 (적재 이력)
const { data: recent } = await sb
  .from("bp_player_stats_snapshots")
  .select("snapshot_date")
  .order("snapshot_date", { ascending: false })
  .limit(2000);

const dateCounts = {};
for (const r of recent ?? []) {
  dateCounts[r.snapshot_date] = (dateCounts[r.snapshot_date] ?? 0) + 1;
}
console.log(`\n=== 최근 스냅샷 날짜별 행수 ===`);
for (const d of Object.keys(dateCounts).sort().reverse().slice(0, 10)) {
  console.log(`  ${d}: ${dateCounts[d]}`);
}
