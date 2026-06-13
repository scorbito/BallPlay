import type { SupabaseClient } from "@supabase/supabase-js";
import { POINT_CONTENT_REWARD_START_AT, POINT_REWARDS } from "@/lib/points/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { addDaysISO, kstDateString } from "@/lib/server/points";
import { isSkeletonReport } from "@/lib/utils/dailyReportHelper";

export type HomePointAvailability = Record<string, boolean>;

const EARN_REASONS = [
  "prediction_submitted",
  "ai_battle_vote",
  "stadium_official_completed",
  "content_ai_prediction",
  "content_daily_report",
  "content_daily_report_game"
];

function sumEarnedByReason(rows: Array<{ reason: string | null; amount: number | null }>) {
  const earned = new Map<string, number>();
  for (const row of rows) {
    if (!row.reason) continue;
    earned.set(row.reason, (earned.get(row.reason) ?? 0) + Number(row.amount ?? 0));
  }
  return earned;
}

async function getLatestPublishedDailyReport(client: SupabaseClient) {
  const { data } = await client
    .from("daily_ai_reports")
    .select("report_date, report_json, created_at")
    .order("report_date", { ascending: false })
    .limit(5);

  const report = (data ?? []).find((row) => !isSkeletonReport(row.report_json));
  if (typeof report?.report_date !== "string") return null;
  return {
    date: report.report_date,
    createdAt: typeof report.created_at === "string" ? report.created_at : null
  };
}

export async function getHomePointAvailability(
  userId: string,
  client: SupabaseClient = createSupabaseAdminClient(),
  userCreatedAt?: string | null
): Promise<HomePointAvailability> {
  const today = kstDateString();
  const yesterday = addDaysISO(today, -1);
  const start = `${today}T00:00:00+09:00`;
  const end = `${addDaysISO(today, 1)}T00:00:00+09:00`;

  const [gamesRes, aiPredictionsRes, claimsRes, transactionsRes, latestDailyReport] = await Promise.all([
    client
      .from("games")
      .select("id")
      .eq("game_date", today),
    client
      .from("bp_ai_predictions")
      .select("game_id,published_at")
      .eq("game_date", today),
    client
      .from("point_reward_claims")
      .select("reward_key,reward_date,amount")
      .eq("user_id", userId),
    client
      .from("point_transactions")
      .select("reason, amount")
      .eq("user_id", userId)
      .eq("type", "earn")
      .in("reason", EARN_REASONS)
      .gte("created_at", start)
      .lt("created_at", end),
    getLatestPublishedDailyReport(client)
  ]);

  const eligibleFrom = userCreatedAt && new Date(userCreatedAt).getTime() > new Date(POINT_CONTENT_REWARD_START_AT).getTime()
    ? userCreatedAt
    : POINT_CONTENT_REWARD_START_AT;
  const eligibleAiPredictions = ((aiPredictionsRes.data ?? []) as Array<{ game_id: string | null; published_at: string | null }>)
    .filter((row): row is { game_id: string; published_at: string } => Boolean(row.game_id && row.published_at))
    .filter((row) => new Date(row.published_at).getTime() >= new Date(eligibleFrom).getTime())
    .map((row) => ({ gameId: row.game_id, rewardDate: kstDateString(new Date(row.published_at)) }));
  const aiGameIds = new Set(eligibleAiPredictions.map((row) => row.gameId));
  const claimsRows = (claimsRes.data ?? []) as Array<{ reward_key: string | null; reward_date: string | null; amount: number | null }>;
  const claims = new Set(
    claimsRows
      .filter((row): row is { reward_key: string; reward_date: string; amount: number | null } => Boolean(row.reward_key && row.reward_date))
      .map((row) => `${row.reward_key}|${row.reward_date}`)
  );
  const hasClaim = (rewardKey: string, rewardDate: string) => claims.has(`${rewardKey}|${rewardDate}`);
  const earned = sumEarnedByReason(
    (transactionsRes.data ?? []) as Array<{ reason: string | null; amount: number | null }>
  );

  const claimedAiPredictionCount = eligibleAiPredictions
    .filter((row) => hasClaim(`content_ai_prediction:${row.gameId}`, row.rewardDate))
    .length;
  const gameIds = ((gamesRes.data ?? []) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((gameId): gameId is string => Boolean(gameId));
  const claimedWinnerPredictionCount = gameIds
    .filter((gameId) => hasClaim(`prediction_submitted:${gameId}`, today))
    .length;
  const dailyReportDates = Array.from(new Set([
    latestDailyReport?.date,
    today,
    yesterday
  ].filter((date): date is string => Boolean(date))));
  const latestDailyReportContentId = latestDailyReport
    ? `${latestDailyReport.date}${latestDailyReport.createdAt ? `|${latestDailyReport.createdAt}` : ""}`
    : null;
  const claimedDailyReport = dailyReportDates
    .some((date) => {
      const rewardDate = latestDailyReport?.date === date && latestDailyReport.createdAt
        ? kstDateString(new Date(latestDailyReport.createdAt))
        : date;
      const rewardKey = latestDailyReport?.date === date && latestDailyReportContentId
        ? `content_daily_report:${latestDailyReportContentId}`
        : `content_daily_report:${date}`;
      return hasClaim(rewardKey, rewardDate);
    });
  const stadiumMax = (POINT_REWARDS.stadiumOfficialFirstFive * POINT_REWARDS.stadiumOfficialFirstFiveCount)
    + POINT_REWARDS.stadiumOfficialExtraMax;
  const aiPredictionEligible = Array.from(aiGameIds).length > 0;

  return {
    "daily-report": dailyReportDates.some((date) =>
      new Date(`${date}T00:00:00+09:00`).getTime() >= new Date(eligibleFrom).getTime()
    ) && ((!claimedDailyReport
        && (earned.get("content_daily_report") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.daily_report)
        || (earned.get("content_daily_report_game") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.daily_report_game),
    "ai-predict": aiPredictionEligible
      && claimedAiPredictionCount < aiGameIds.size
      && (earned.get("content_ai_prediction") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.ai_prediction,
    "ai-battle": aiGameIds.size > 0
      && (earned.get("ai_battle_vote") ?? 0) < POINT_REWARDS.aiBattleVoteDailyMax,
    "winner-predict": gameIds.length > 0
      && claimedWinnerPredictionCount < gameIds.length
      && (earned.get("prediction_submitted") ?? 0) < POINT_REWARDS.predictionSubmittedDailyMax,
    "quiz": !hasClaim("quiz_completed", today),
    "stadium": (earned.get("stadium_official_completed") ?? 0) < stadiumMax
  };
}
