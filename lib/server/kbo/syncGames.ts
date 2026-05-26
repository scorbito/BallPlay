import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchGamesForDate, type RawGame } from "./fetchGames";

type KboDateInput = Date | string;

export type SyncResult = {
  date: string;
  source: "kbo" | "naver" | "none";
  inserted: number;
  updated: number;
  skipped: number;
};

function toRow(game: RawGame) {
  return {
    external_id: game.externalId,
    game_date: game.gameDate,
    game_time: game.gameTime,
    stadium: game.stadium,
    home_team_id: game.homeTeamId,
    away_team_id: game.awayTeamId,
    home_score: game.homeScore,
    away_score: game.awayScore,
    status: game.status,
    innings: game.innings,
    home_starter: game.homeStarter,
    away_starter: game.awayStarter,
    starter_fetched_at: new Date().toISOString()
  };
}

function formatDateInput(input: KboDateInput) {
  if (typeof input === "string") return input;
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, "0")}-${String(input.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function syncGamesForDate(date: KboDateInput): Promise<SyncResult> {
  const dateStr = formatDateInput(date);
  const { games, source } = await fetchGamesForDate(dateStr);

  if (games.length === 0) {
    return { date: dateStr, source, inserted: 0, updated: 0, skipped: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const externalIds = games.map((g) => g.externalId);
  const { data: existing, error: existErr } = await supabase
    .from("games")
    .select("external_id")
    .in("external_id", externalIds);
  if (existErr) throw new Error(`existing fetch failed: ${existErr.message}`);

  const existingIds = new Set((existing ?? []).map((row) => row.external_id));
  const inserts = games.filter((g) => !existingIds.has(g.externalId)).map(toRow);
  const updates = games.filter((g) => existingIds.has(g.externalId)).map(toRow);

  let inserted = 0;
  let updated = 0;

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("games").insert(inserts);
    if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);
    inserted = inserts.length;
  }

  for (const row of updates) {
    // 선발 투수는 null이 오면 기존 값 보존 (KBO가 발표 후 응답에서 누락하는 케이스 방지).
    // 값이 있을 때만 덮어씀. 또한 starter_fetched_at은 항상 갱신 → throttle 정상 작동.
    const payload: Record<string, unknown> = {
      game_date: row.game_date,
      game_time: row.game_time,
      stadium: row.stadium,
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      home_score: row.home_score,
      away_score: row.away_score,
      status: row.status,
      innings: row.innings,
      starter_fetched_at: new Date().toISOString()
    };
    if (row.home_starter !== null) payload.home_starter = row.home_starter;
    if (row.away_starter !== null) payload.away_starter = row.away_starter;

    const { error: updateErr } = await supabase
      .from("games")
      .update(payload)
      .eq("external_id", row.external_id);
    if (updateErr) {
      console.error(`update failed for ${row.external_id}:`, updateErr.message);
    } else {
      updated++;
    }
  }

  return { date: dateStr, source, inserted, updated, skipped: 0 };
}

export async function syncGamesInRange(fromDate: KboDateInput, toDate: KboDateInput, options?: { delayMs?: number }): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  let cursor = formatDateInput(fromDate);
  const end = formatDateInput(toDate);

  while (cursor <= end) {
    try {
      const result = await syncGamesForDate(cursor);
      results.push(result);
    } catch (err) {
      console.error(`[syncGames] ${cursor} failed:`, (err as Error).message);
      results.push({ date: cursor, source: "none", inserted: 0, updated: 0, skipped: 0 });
    }
    cursor = addDays(cursor, 1);
    if (options?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  return results;
}
