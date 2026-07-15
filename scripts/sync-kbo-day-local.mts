// Run the end-of-day KBO maintenance job locally:
//   1. sync games for the date
//   2. sync upcoming KBO schedule range
//   3. sync lineups for the date
//   4. sync team game stats for the date
//   5. parse pitcher game logs and pitcher-vs-team aggregates
//   6. sync standings for the season
//   7. sync player stat snapshots and recent-10 rankings
//   8. verify daily report is cached (manual agent-authored report; no AI API call here)
//   9. generate and cache tomorrow's 1000-game simulations
//  10. on Sundays, verify the just-finished week's weekly report is cached
//
// Usage:
//   npm run sync:kbo-day
//   npm run sync:kbo-day -- 2026-06-16
//   npm run sync:kbo-day -- 2026-06-16 --force
//   npm run sync:kbo-day -- 2026-06-16 --skip-games --skip-lineups --skip-standings --skip-stats --skip-report
//   npm run sync:kbo-day -- 2026-06-16 --skip-stats
//   npm run sync:kbo-day -- 2026-06-16 --skip-report
//   npm run report:daily:upsert -- 2026-06-16 .report-drafts/daily-2026-06-16.json
//   npm run report:weekly:upsert -- 2026-06-15 .report-drafts/weekly-2026-06-15.json
//   npm run sync:kbo-day -- 2026-06-16 --skip-schedule
//   npm run sync:kbo-day -- 2026-06-16 --skip-team-stats
//   npm run sync:kbo-day -- 2026-06-16 --skip-pitcher-logs
//   npm run sync:kbo-day -- 2026-06-16 --skip-sim1000
//   npm run sync:kbo-day -- 2026-06-16 --skip-weekly
//   npm run sync:kbo-day -- 2026-06-21 --force-weekly   (run weekly report for that date's week regardless of weekday)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_STATS_SNAPSHOT_ROWS = 100;

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

function parseLocalDate(dateText: string): Date {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateText: string, days: number): string {
  const date = parseLocalDate(dateText);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function defaultTargetDate(): string {
  const kst = kstNow();
  if (kst.getHours() < 6) {
    kst.setDate(kst.getDate() - 1);
  }
  return formatDate(kst);
}

function isFinishedStatus(status: string | null | undefined): boolean {
  return status === "finished" || status === "canceled";
}

function markerPathFor(targetDate: string, simDate: string): string {
  return resolve(process.cwd(), ".sync-state", "kbo-day", `${targetDate}__sim-${simDate}.done.json`);
}

function writeCompletionMarker(path: string, payload: unknown) {
  mkdirSync(resolve(process.cwd(), ".sync-state", "kbo-day"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function hasStatsSnapshot(admin: SupabaseClient, snapshotDate: string): Promise<boolean> {
  const { count, error } = await admin
    .from("bp_player_stats_snapshots")
    .select("snapshot_date", { count: "exact", head: true })
    .eq("snapshot_date", snapshotDate);

  if (error) {
    console.warn(`[sync:kbo-day] stats existing check failed: ${error.message}`);
    return false;
  }

  return (count ?? 0) >= MIN_STATS_SNAPSHOT_ROWS;
}

async function getSim1000ExistingState(admin: SupabaseClient, gameDate: string) {
  const [{ count: gameCount, error: gameError }, { count: simCount, error: simError }] = await Promise.all([
    admin
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("game_date", gameDate)
      .neq("status", "cancelled"),
    admin
      .from("bp_sim_results")
      .select("game_id", { count: "exact", head: true })
      .eq("game_date", gameDate)
  ]);

  if (gameError) console.warn(`[sync:kbo-day] sim-1000 games check failed: ${gameError.message}`);
  if (simError) console.warn(`[sync:kbo-day] sim-1000 existing check failed: ${simError.message}`);

  return {
    gameCount: gameError ? null : gameCount ?? 0,
    simCount: simError ? null : simCount ?? 0
  };
}

const args = process.argv.slice(2);
const targetDate = args.find((arg) => DATE_RE.test(arg)) ?? defaultTargetDate();
const force = args.includes("--force");
const skipGames = args.includes("--skip-games");
const skipStats = args.includes("--skip-stats");
const skipRecent10 = args.includes("--skip-recent10");
const skipReport = args.includes("--skip-report");
const skipLineups = args.includes("--skip-lineups");
const skipTeamStats = args.includes("--skip-team-stats");
const skipPitcherLogs = args.includes("--skip-pitcher-logs");
const skipStandings = args.includes("--skip-standings");
const skipSchedule = args.includes("--skip-schedule");
const skipSim1000 = args.includes("--skip-sim1000");
const skipWeekly = args.includes("--skip-weekly");
const forceWeekly = args.includes("--force-weekly");
const scheduleFrom = addDays(targetDate, -1);
const scheduleTo = addDays(targetDate, 30);
const sim1000Date = addDays(targetDate, 1);
const completionMarkerPath = markerPathFor(targetDate, sim1000Date);
const blockingIssues: string[] = [];

if (!force && existsSync(completionMarkerPath)) {
  console.log(`[sync:kbo-day] already completed for date=${targetDate}, sim1000Date=${sim1000Date}`);
  console.log(`[sync:kbo-day] marker=${completionMarkerPath}`);
  console.log("[sync:kbo-day] use --force to run again");
  process.exit(0);
}

loadLocalEnv();

const [
  { createSupabaseAdminClient },
  { syncGamesInRange },
  { syncLineupsForDate },
  { syncTeamGameStatsForDate },
  { backfillPitcherGameLogsFromTeamStats },
  { upsertBullpenDailySnapshots },
  { syncStandings },
  { syncStatsSnapshot },
  { upsertRecent10TopPlayers },
  { listGamesFromDb },
  { runDailySimAndUpsert },
  { getMondayOfDate, formatWeekName }
] = await Promise.all([
  import("@/lib/supabase/server"),
  import("@/lib/server/kbo/syncGames"),
  import("@/lib/server/kbo/syncLineups"),
  import("@/lib/server/kbo/syncTeamGameStats"),
  import("@/lib/server/kbo/pitcherGameLogs"),
  import("@/lib/server/kbo/bullpenDaily"),
  import("@/lib/server/kbo/syncStandings"),
  import("@/lib/server/kbo/syncStats"),
  import("@/lib/server/recent10/upsertTopPlayers"),
  import("@/lib/supabase/query-parts/core"),
  import("@/lib/server/sim/runDailySimAndUpsert"),
  import("@/lib/server/kbo/weeklyReport")
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

const targetGames = await listGamesFromDb({ from: targetDate, to: targetDate });
const unfinishedGames = targetGames.filter((game) => !isFinishedStatus(game.status));
if (targetGames.length === 0) {
  blockingIssues.push("target games not found");
} else if (unfinishedGames.length > 0) {
  blockingIssues.push(`unfinished games remain: ${unfinishedGames.length}/${targetGames.length}`);
}
if (!skipLineups) {
  console.log("[sync:kbo-day] 3/9 lineups");
  const lineups = await syncLineupsForDate(targetDate);
  console.log("[sync:kbo-day] lineups", JSON.stringify(lineups, null, 2));
  if (lineups.errors.length > 0) {
    blockingIssues.push(`lineups errors: ${lineups.errors.length}`);
  }
} else {
  console.log("[sync:kbo-day] 3/9 lineups skipped");
}

if (!skipTeamStats) {
  console.log("[sync:kbo-day] 4/9 team game stats");
  const teamStats = await syncTeamGameStatsForDate(targetDate, { gameDelayMs: 2500 });
  console.log("[sync:kbo-day] team game stats", JSON.stringify(teamStats, null, 2));
  if (teamStats.errors.length > 0) {
    blockingIssues.push(`team game stats errors: ${teamStats.errors.length}`);
  }
} else {
  console.log("[sync:kbo-day] 4/9 team game stats skipped");
}

if (!skipPitcherLogs && !skipTeamStats) {
  console.log("[sync:kbo-day] 5/9 pitcher game logs");
  const pitcherLogs = await backfillPitcherGameLogsFromTeamStats(targetDate, targetDate);
  console.log("[sync:kbo-day] pitcher game logs", JSON.stringify(pitcherLogs, null, 2));
  if (pitcherLogs.sourceRows === 0) {
    blockingIssues.push("pitcher game logs source rows: 0");
  }
} else {
  console.log("[sync:kbo-day] 5/9 pitcher game logs skipped");
}

// The snapshot is for tomorrow's AI prediction. It is refreshed after pitcher logs are finalized.
if (!skipPitcherLogs && !skipTeamStats) {
  console.log("[sync:kbo-day] bullpen daily snapshots");
  const bullpenSnapshots = await upsertBullpenDailySnapshots(targetDate);
  console.log("[sync:kbo-day] bullpen daily snapshots", JSON.stringify(bullpenSnapshots, null, 2));
} else {
  console.log("[sync:kbo-day] bullpen daily snapshots skipped");
}

if (!skipStandings) {
  console.log("[sync:kbo-day] 6/9 standings");
  const standings = await syncStandings(season);
  console.log("[sync:kbo-day] standings", JSON.stringify(standings, null, 2));
} else {
  console.log("[sync:kbo-day] 6/9 standings skipped");
}

if (!skipStats) {
  console.log("[sync:kbo-day] 7/9 stats snapshot");
  if (!force && await hasStatsSnapshot(admin, targetDate)) {
    console.log(`[sync:kbo-day] stats skipped: snapshot already exists for ${targetDate}`);
  } else {
    const stats = await syncStatsSnapshot(targetDate, { year: season });
    console.log("[sync:kbo-day] stats", JSON.stringify(stats, null, 2));
  }

  if (!skipRecent10) {
    const recent10 = await upsertRecent10TopPlayers();
    console.log("[sync:kbo-day] recent10", JSON.stringify(recent10, null, 2));
  }
} else {
  console.log("[sync:kbo-day] 7/9 stats snapshot skipped");
}

if (!skipReport) {
  console.log("[sync:kbo-day] 8/9 daily report");

  const games = await listGamesFromDb({ from: targetDate, to: targetDate });
  if (games.length === 0) {
    console.log("[sync:kbo-day] report skipped: no games");
  } else if (games.some((game) => !isFinishedStatus(game.status))) {
    console.log("[sync:kbo-day] report skipped: unfinished games remain.");
  } else {
    const { data: existingReport } = await admin
      .from("daily_ai_reports")
      .select("report_date")
      .eq("report_date", targetDate)
      .maybeSingle();

    if (existingReport) {
      console.log("[sync:kbo-day] report cached", JSON.stringify({ reportDate: targetDate }, null, 2));
    } else {
      console.log(
        `[sync:kbo-day] report pending: run npm run report:daily:upsert -- ${targetDate} <report.json>`
      );
    }
  }
} else {
  console.log("[sync:kbo-day] 8/9 daily report skipped");
}

if (!skipSim1000) {
  console.log(`[sync:kbo-day] 9/9 sim-1000 date=${sim1000Date}`);
  const existingSim = await getSim1000ExistingState(admin, sim1000Date);

  if (existingSim.gameCount === 0) {
    console.log(`[sync:kbo-day] sim-1000 skipped: no games for ${sim1000Date}`);
  } else if (
    !force &&
    existingSim.gameCount !== null &&
    existingSim.simCount !== null &&
    existingSim.simCount >= existingSim.gameCount
  ) {
    console.log(
      `[sync:kbo-day] sim-1000 skipped: already cached (${existingSim.simCount}/${existingSim.gameCount}) for ${sim1000Date}`
    );
  } else {
    const outcome = await runDailySimAndUpsert(admin, sim1000Date);

    if (!outcome.ok) {
      throw new Error(`sim-1000 failed: ${outcome.error}`);
    }
    if (outcome.failed > 0 || outcome.ran < outcome.total) {
      blockingIssues.push(`sim-1000 incomplete: ran ${outcome.ran}/${outcome.total}, failed ${outcome.failed}`);
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
  }
} else {
  console.log("[sync:kbo-day] 9/9 sim-1000 skipped");
}

if (!skipWeekly) {
  // Weekly reports are checked only when the week is complete. Use --force-weekly to override.
  const targetDow = parseLocalDate(targetDate).getDay(); // 0 = Sunday
  const weekMon = getMondayOfDate(parseLocalDate(targetDate));

  if (targetDow !== 0 && !forceWeekly) {
    console.log(
      `[sync:kbo-day] 10/10 weekly report skipped: ${targetDate} is not Sunday (week completes Sun). Use --force-weekly to override.`
    );
  } else {
    const { data: existingWeekly } = await admin
      .from("weekly_ai_reports")
      .select("week_id")
      .eq("week_id", weekMon)
      .maybeSingle();

    if (existingWeekly && !force && !forceWeekly) {
      console.log(
        `[sync:kbo-day] 10/10 weekly report skipped: already cached for week ${weekMon}. Use --force-weekly to regenerate.`
      );
    } else {
      console.log(`[sync:kbo-day] 10/10 weekly report week=${weekMon} (${formatWeekName(weekMon)})`);
      console.log(
        `[sync:kbo-day] weekly report pending: run npm run report:weekly:upsert -- ${weekMon} <rankings.json>`
      );
    }
  }
} else {
  console.log("[sync:kbo-day] 10/10 weekly report skipped");
}

if (blockingIssues.length > 0) {
  throw new Error(`sync incomplete; completion marker not written: ${blockingIssues.join("; ")}`);
}

writeCompletionMarker(completionMarkerPath, {
  targetDate,
  scheduleFrom,
  scheduleTo,
  sim1000Date,
  completedAt: new Date().toISOString()
});
console.log(`[sync:kbo-day] completion marker written: ${completionMarkerPath}`);
console.log("[sync:kbo-day] done");

