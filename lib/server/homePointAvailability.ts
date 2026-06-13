import type { SupabaseClient } from "@supabase/supabase-js";
import { POINT_REWARDS } from "@/lib/points/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { addDaysISO, kstDateString } from "@/lib/server/points";
import { isSkeletonReport } from "@/lib/utils/dailyReportHelper";

export type HomePointAvailability = Record<string, boolean>;

const EARN_REASONS = [
  "prediction_submitted",
  "ai_battle_vote",
  "stadium_official_completed",
  "content_ai_prediction",
  "content_daily_report"
];

function sumEarnedByReason(rows: Array<{ reason: string | null; amount: number | null }>) {
  const earned = new Map<string, number>();
  for (const row of rows) {
    if (!row.reason) continue;
    earned.set(row.reason, (earned.get(row.reason) ?? 0) + Number(row.amount ?? 0));
  }
  return earned;
}

async function getLatestPublishedDailyReportDate(client: SupabaseClient) {
  const { data } = await client
    .from("daily_ai_reports")
    .select("report_date, report_json")
    .order("report_date", { ascending: false })
    .limit(5);

  const report = (data ?? []).find((row) => !isSkeletonReport(row.report_json));
  return typeof report?.report_date === "string" ? report.report_date : null;
}

export async function getHomePointAvailability(
  userId: string,
  client: SupabaseClient = createSupabaseAdminClient()
): Promise<HomePointAvailability> {
  const today = kstDateString();
  const yesterday = addDaysISO(today, -1);
  const start = `${today}T00:00:00+09:00`;
  const end = `${addDaysISO(today, 1)}T00:00:00+09:00`;

  const [gamesRes, aiPredictionsRes, claimsRes, transactionsRes, latestDailyReportDate] = await Promise.all([
    client
      .from("games")
      .select("id")
      .eq("game_date", today),
    client
      .from("bp_ai_predictions")
      .select("game_id")
      .eq("game_date", today),
    client
      .from("point_reward_claims")
      .select("reward_key, reward_date")
      .eq("user_id", userId),
    client
      .from("point_transactions")
      .select("reason, amount")
      .eq("user_id", userId)
      .eq("type", "earn")
      .in("reason", EARN_REASONS)
      .gte("created_at", start)
      .lt("created_at", end),
    getLatestPublishedDailyReportDate(client)
  ]);

  const aiGameIds = new Set(
    ((aiPredictionsRes.data ?? []) as Array<{ game_id: string | null }>)
      .map((row) => row.game_id)
      .filter((gameId): gameId is string => Boolean(gameId))
  );
  const claims = new Set(
    ((claimsRes.data ?? []) as Array<{ reward_key: string | null; reward_date: string | null }>)
      .map((row) => row.reward_key)
      .filter((rewardKey): rewardKey is string => Boolean(rewardKey))
  );
  const todayClaims = new Set(
    ((claimsRes.data ?? []) as Array<{ reward_key: string | null; reward_date: string | null }>)
      .filter((row) => row.reward_date === today)
      .map((row) => row.reward_key)
      .filter((rewardKey): rewardKey is string => Boolean(rewardKey))
  );
  const earned = sumEarnedByReason(
    (transactionsRes.data ?? []) as Array<{ reason: string | null; amount: number | null }>
  );

  const claimedAiPredictionCount = Array.from(aiGameIds)
    .filter((gameId) => claims.has(`content_ai_prediction:${gameId}`))
    .length;
  const gameIds = ((gamesRes.data ?? []) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((gameId): gameId is string => Boolean(gameId));
  const claimedWinnerPredictionCount = gameIds
    .filter((gameId) => claims.has(`prediction_submitted:${gameId}`))
    .length;
  const dailyReportDates = Array.from(new Set([
    latestDailyReportDate,
    today,
    yesterday
  ].filter((date): date is string => Boolean(date))));
  const claimedDailyReport = dailyReportDates
    .some((date) => claims.has(`content_daily_report:${date}`));
  const stadiumMax = (POINT_REWARDS.stadiumOfficialFirstFive * POINT_REWARDS.stadiumOfficialFirstFiveCount)
    + POINT_REWARDS.stadiumOfficialExtraMax;

  return {
    "daily-report": !claimedDailyReport
      && (earned.get("content_daily_report") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType,
    "ai-predict": aiGameIds.size > 0
      && claimedAiPredictionCount < aiGameIds.size
      && (earned.get("content_ai_prediction") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType,
    "ai-battle": aiGameIds.size > 0
      && (earned.get("ai_battle_vote") ?? 0) < POINT_REWARDS.aiBattleVoteDailyMax,
    "winner-predict": gameIds.length > 0
      && claimedWinnerPredictionCount < gameIds.length
      && (earned.get("prediction_submitted") ?? 0) < POINT_REWARDS.predictionSubmittedDailyMax,
    "quiz": !todayClaims.has("quiz_completed"),
    "stadium": (earned.get("stadium_official_completed") ?? 0) < stadiumMax
  };
}
