import type { SupabaseClient } from "@supabase/supabase-js";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import { buildWeeklyReport, type TeamWeeklyReport } from "@/lib/utils/weeklyReportHelper";

export function getMondayOfDate(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

export function addWeekDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatWeekName(startMonStr: string): string {
  const endSunStr = addWeekDays(startMonStr, 6);
  const [, monthStr, dayStr] = startMonStr.split("-");
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);
  const weekNum = Math.ceil(dayNum / 7);
  const endParts = endSunStr.split("-");
  return `${monthNum}\uC6D4 ${weekNum}\uC8FC\uCC28 (${monthNum}/${dayNum} ~ ${parseInt(endParts[1], 10)}/${parseInt(endParts[2], 10)})`;
}

export interface WeeklyReportResult {
  rankings: TeamWeeklyReport[];
  cached: boolean;
  error?: string;
}

// Kept for backward compatibility only. Reports are now authored manually by the agent
// and inserted with npm run report:weekly:upsert, so this function never calls AI APIs.
export async function generateAndCacheWeeklyReport(
  _admin: SupabaseClient,
  startMonStr: string
): Promise<WeeklyReportResult> {
  const endSunStr = addWeekDays(startMonStr, 6);
  const weekName = formatWeekName(startMonStr);
  const games = await listGamesFromDb({ from: startMonStr, to: endSunStr });
  const rankings = buildWeeklyReport(games, weekName);

  return {
    rankings,
    cached: false,
    error: "Manual weekly report insertion required. Use npm run report:weekly:upsert."
  };
}
