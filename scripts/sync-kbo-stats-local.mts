// Run KBO season stat sync locally and upsert the precomputed recent-10 rankings.
// Usage:
//   npm run sync:kbo-stats
//   npm run sync:kbo-stats -- 2026-06-16
//   npm run sync:kbo-stats -- 2026-06-16 --team=doosan
//   npm run sync:kbo-stats -- 2026-06-16 --skip-recent10

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function kstToday(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

const args = process.argv.slice(2);
const dateArg = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const teamArg = args.find((arg) => arg.startsWith("--team="))?.slice("--team=".length);
const yearArg = args.find((arg) => arg.startsWith("--year="))?.slice("--year=".length);
const skipRecent10 = args.includes("--skip-recent10");

loadLocalEnv();

const snapshotDate = dateArg ?? kstToday();
const year = yearArg ? Number(yearArg) : undefined;
const teams = teamArg ? teamArg.split(",").map((team) => team.trim()).filter(Boolean) : undefined;

const { syncStatsSnapshot } = await import("@/lib/server/kbo/syncStats");
const { upsertRecent10TopPlayers } = await import("@/lib/server/recent10/upsertTopPlayers");

console.log(`[sync-kbo-stats-local] snapshotDate=${snapshotDate} teams=${teams?.join(",") ?? "all"}`);
const statsResult = await syncStatsSnapshot(snapshotDate, { year, teams });
console.log("[sync-kbo-stats-local] stats", JSON.stringify(statsResult, null, 2));

if (!skipRecent10) {
  const recent10Result = await upsertRecent10TopPlayers();
  console.log("[sync-kbo-stats-local] recent10", JSON.stringify(recent10Result, null, 2));
}
