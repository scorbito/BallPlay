// Run the end-of-day KBO maintenance job locally:
//   1. sync games for the date
//   2. sync upcoming KBO schedule range
//   3. sync lineups for the date
//   4. sync standings for the season
//   5. sync player stat snapshots and recent-10 rankings
//   6. generate and cache the daily AI report
//   7. generate and cache tomorrow's 1000-game simulations
//
// Usage:
//   npm run sync:kbo-day
//   npm run sync:kbo-day -- 2026-06-16
//   npm run sync:kbo-day -- 2026-06-16 --force-report
//   npm run sync:kbo-day -- 2026-06-16 --skip-games --skip-lineups --skip-standings --skip-stats --skip-report
//   npm run sync:kbo-day -- 2026-06-16 --skip-stats
//   npm run sync:kbo-day -- 2026-06-16 --skip-report
//   npm run sync:kbo-day -- 2026-06-16 --skip-schedule
//   npm run sync:kbo-day -- 2026-06-16 --skip-sim1000

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function kstYesterday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() - 1);
  return formatDate(kst);
}

function kstDateOffset(days: number): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() + days);
  return formatDate(kst);
}

function isFinishedStatus(status: string | null | undefined): boolean {
  return status === "finished" || status === "canceled";
}

const args = process.argv.slice(2);
const targetDate = args.find((arg) => DATE_RE.test(arg)) ?? kstYesterday();
const forceReport = args.includes("--force-report");
const skipGames = args.includes("--skip-games");
const skipStats = args.includes("--skip-stats");
const skipRecent10 = args.includes("--skip-recent10");
const skipReport = args.includes("--skip-report");
const skipLineups = args.includes("--skip-lineups");
const skipStandings = args.includes("--skip-standings");
const skipSchedule = args.includes("--skip-schedule");
const skipSim1000 = args.includes("--skip-sim1000");
const scheduleFrom = kstDateOffset(-1);
const scheduleTo = kstDateOffset(30);
const sim1000Date = kstDateOffset(1);

loadLocalEnv();

const [
  { createSupabaseAdminClient },
  { syncGamesInRange },
  { syncLineupsForDate },
  { syncStandings },
  { syncStatsSnapshot },
  { upsertRecent10TopPlayers },
  { listGamesFromDb, listStandingsFromDb },
  { buildDailyReportSkeleton },
  { generateDailyReportWithGemini },
  { runDailySimAndUpsert }
] = await Promise.all([
  import("@/lib/supabase/server"),
  import("@/lib/server/kbo/syncGames"),
  import("@/lib/server/kbo/syncLineups"),
  import("@/lib/server/kbo/syncStandings"),
  import("@/lib/server/kbo/syncStats"),
  import("@/lib/server/recent10/upsertTopPlayers"),
  import("@/lib/supabase/query-parts/core"),
  import("@/lib/utils/dailyReportHelper"),
  import("@/lib/server/kbo/geminiDailyReport"),
  import("@/lib/server/sim/runDailySimAndUpsert")
]);

const admin = createSupabaseAdminClient();
const season = Number(targetDate.slice(0, 4));

console.log(`[sync:kbo-day] start date=${targetDate}`);

if (!skipGames) {
  console.log("[sync:kbo-day] 1/7 games");
  const gameResults = await syncGamesInRange(targetDate, targetDate, { delayMs: 200 });
  const gameTotals = gameResults.reduce(
    (acc, result) => ({
      inserted: acc.inserted + result.inserted,
      updated: acc.updated + result.updated
    }),
    { inserted: 0, updated: 0 }
  );
  console.log("[sync:kbo-day] games", JSON.stringify({ totals: gameTotals, results: gameResults }, null, 2));
} else {
  console.log("[sync:kbo-day] 1/7 games skipped");
}

if (!skipSchedule) {
  console.log(`[sync:kbo-day] 2/7 upcoming schedule ${scheduleFrom}..${scheduleTo}`);
  const scheduleResults = await syncGamesInRange(scheduleFrom, scheduleTo, { delayMs: 200 });
  const scheduleTotals = scheduleResults.reduce(
    (acc, result) => ({
      inserted: acc.inserted + result.inserted,
      updated: acc.updated + result.updated
    }),
    { inserted: 0, updated: 0 }
  );
  console.log("[sync:kbo-day] schedule", JSON.stringify({ totals: scheduleTotals, results: scheduleResults }, null, 2));
} else {
  console.log("[sync:kbo-day] 2/7 upcoming schedule skipped");
}

if (!skipLineups) {
  console.log("[sync:kbo-day] 3/7 lineups");
  const lineups = await syncLineupsForDate(targetDate);
  console.log("[sync:kbo-day] lineups", JSON.stringify(lineups, null, 2));
} else {
  console.log("[sync:kbo-day] 3/7 lineups skipped");
}

if (!skipStandings) {
  console.log("[sync:kbo-day] 4/7 standings");
  const standings = await syncStandings(season);
  console.log("[sync:kbo-day] standings", JSON.stringify(standings, null, 2));
} else {
  console.log("[sync:kbo-day] 4/7 standings skipped");
}

if (!skipStats) {
  console.log("[sync:kbo-day] 5/7 stats snapshot");
  const stats = await syncStatsSnapshot(targetDate, { year: season });
  console.log("[sync:kbo-day] stats", JSON.stringify(stats, null, 2));

  if (!skipRecent10) {
    const recent10 = await upsertRecent10TopPlayers();
    console.log("[sync:kbo-day] recent10", JSON.stringify(recent10, null, 2));
  }
} else {
  console.log("[sync:kbo-day] 5/7 stats snapshot skipped");
}

if (!skipReport) {
  console.log("[sync:kbo-day] 6/7 daily report");

  const games = await listGamesFromDb({ from: targetDate, to: targetDate });
  if (games.length === 0) {
    console.log("[sync:kbo-day] report skipped: no games");
  } else if (!forceReport && games.some((game) => !isFinishedStatus(game.status))) {
    console.log("[sync:kbo-day] report skipped: unfinished games remain. Use --force-report to override.");
  } else {
    const { data: existingReport } = await admin
      .from("daily_ai_reports")
      .select("report_date")
      .eq("report_date", targetDate)
      .maybeSingle();

    if (existingReport && !forceReport) {
      console.log("[sync:kbo-day] report skipped: already cached. Use --force-report to regenerate.");
    } else {
      const { data: newsData } = await admin
        .from("bp_news")
        .select("title")
        .gte("published_at", `${targetDate}T00:00:00+09:00`)
        .lte("published_at", `${targetDate}T23:59:59+09:00`)
        .order("published_at", { ascending: false });
      const newsTitles = (newsData ?? []).map((news) => news.title);
      const standingsData = await listStandingsFromDb(season).catch(() => []);
      const skeleton = buildDailyReportSkeleton(games, targetDate);
      const report = await generateDailyReportWithGemini(skeleton, newsTitles, standingsData);

      if (!report) {
        throw new Error("Daily report generation returned null");
      }

      const { error } = await admin.from("daily_ai_reports").upsert({
        report_date: targetDate,
        report_json: report,
        created_at: new Date().toISOString()
      });

      if (error) {
        throw new Error(`daily_ai_reports upsert failed: ${error.message}`);
      }

      console.log("[sync:kbo-day] report cached", JSON.stringify({ reportDate: targetDate }, null, 2));
    }
  }
} else {
  console.log("[sync:kbo-day] 6/7 daily report skipped");
}

if (!skipSim1000) {
  console.log(`[sync:kbo-day] 7/7 sim-1000 date=${sim1000Date}`);
  const outcome = await runDailySimAndUpsert(admin, sim1000Date);

  if (!outcome.ok) {
    throw new Error(`sim-1000 failed: ${outcome.error}`);
  }

  console.log(
    "[sync:kbo-day] sim-1000",
    JSON.stringify(
      {
        gameDate: outcome.gameDate,
        total: outcome.total,
        ran: outcome.ran,
        failed: outcome.failed,
        results: outcome.results
      },
      null,
      2
    )
  );
} else {
  console.log("[sync:kbo-day] 7/7 sim-1000 skipped");
}

console.log("[sync:kbo-day] done");
