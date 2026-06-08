// 오늘 스냅샷이 "언제" 적재됐는지 — cron 자동(월 04시 KST)인지 수동 백필인지 판별.
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

// 컬럼 전체를 한 행만 받아 어떤 타임스탬프 컬럼이 있는지 확인
const { data: sample, error: e0 } = await sb
  .from("bp_player_stats_snapshots")
  .select("*")
  .eq("snapshot_date", "2026-06-08")
  .limit(1);

if (e0) {
  console.error("error:", e0.message);
  process.exit(1);
}
console.log("=== 컬럼 목록 ===");
console.log(Object.keys(sample?.[0] ?? {}));

// 타임스탬프 후보 컬럼들로 min/max 조회
for (const col of ["created_at", "updated_at", "inserted_at"]) {
  const { data, error } = await sb
    .from("bp_player_stats_snapshots")
    .select(col)
    .eq("snapshot_date", "2026-06-08")
    .order(col, { ascending: true });
  if (error) {
    console.log(`\n[${col}] 없음/에러: ${error.message}`);
    continue;
  }
  const vals = (data ?? []).map((r) => r[col]).filter(Boolean);
  if (vals.length === 0) {
    console.log(`\n[${col}] 값 없음`);
    continue;
  }
  const min = vals[0];
  const max = vals[vals.length - 1];
  const toKst = (iso) =>
    new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`\n[${col}]`);
  console.log(`  최초: ${min}  (KST ${toKst(min)})`);
  console.log(`  최종: ${max}  (KST ${toKst(max)})`);
}
