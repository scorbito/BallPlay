#!/usr/bin/env node
/**
 * 라인업 예측 채점 (수동 실행용).
 *
 * 평소에는 sync:kbo-day 의 라인업 수집 직후에 자동으로 돌아간다.
 * 이 스크립트는 그때 놓친 건을 나중에 메우거나, 특정 날짜만 다시 볼 때 쓴다.
 * 실제 라인업이 없는 건은 건너뛰므로 여러 번 돌려도 안전하다.
 *
 * 사용:
 *   npx tsx scripts/score-lineup-predictions.mts
 *   npx tsx scripts/score-lineup-predictions.mts --date=2026-08-15
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scorePendingLineupPredictions } from "../lib/server/lineupPredict/scoreBatch";

function loadEnv(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

/** KST 오늘. */
function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const dateArg = process.argv.slice(2).find((a) => a.startsWith("--date="));
  const throughDate = dateArg ? dateArg.split("=")[1] : todayKST();

  const env = loadEnv();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다. 채점은 RLS 를 우회해야 합니다.");
    process.exit(1);
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);

  const result = await scorePendingLineupPredictions(admin, throughDate);
  console.log(`채점 완료 ${result.scored}건 · 대기 ${result.pending}건 (game_date <= ${throughDate})`);
  if (result.errors.length > 0) {
    console.error("오류:", result.errors.join("\n  "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
