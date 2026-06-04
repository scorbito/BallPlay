// 일회성: 오늘(또는 지정) 날짜 1000판 시뮬을 prod DB 기준으로 재생성.
// 엔진 v2(좌/우 split + 구장효과) + DB 스냅샷 split 반영본으로 bp_sim_results UPSERT.
// 실행: npx tsx scripts/run-sim-today.mts [YYYY-MM-DD]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runDailySimAndUpsert } from "@/lib/server/sim/runDailySimAndUpsert";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  })
);
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("service role key 없음");
  process.exit(1);
}

const kstToday = (() => {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
})();
const date = process.argv[2] ?? kstToday;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

console.log(`▶ 1000판 시뮬 재생성: ${date}`);
const res = await runDailySimAndUpsert(admin, date);
console.log(JSON.stringify(res, null, 2));
