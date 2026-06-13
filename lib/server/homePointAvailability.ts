import type { SupabaseClient } from "@supabase/supabase-js";
import { POINT_CONTENT_REWARD_START_AT, POINT_REWARDS } from "@/lib/points/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { addDaysISO, kstDateString } from "@/lib/server/points";

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

export async function getHomePointAvailability(
  userId: string,
  client: SupabaseClient = createSupabaseAdminClient(),
  userCreatedAt?: string | null
): Promise<HomePointAvailability> {
  const today = kstDateString();
  const yesterday = addDaysISO(today, -1);
  const start = `${today}T00:00:00+09:00`;
  const end = `${addDaysISO(today, 1)}T00:00:00+09:00`;

  const [gamesRes, aiPredictionsRes, claimsRes, transactionsRes] = await Promise.all([
    client
      .from("games")
      .select("id", { count: "exact", head: true })
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
      .lt("created_at", end)
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
  const stadiumMax = (POINT_REWARDS.stadiumOfficialFirstFive * POINT_REWARDS.stadiumOfficialFirstFiveCount)
    + POINT_REWARDS.stadiumOfficialExtraMax;
  const yesterdayEligible = new Date(`${yesterday}T00:00:00+09:00`).getTime() >= new Date(eligibleFrom).getTime();
  const aiPredictionEligible = Array.from(aiGameIds).length > 0;

  return {
    "daily-report": yesterdayEligible
      && ((!hasClaim(`content_daily_report:${yesterday}`, yesterday)
        && (earned.get("content_daily_report") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.daily_report)
        || (earned.get("content_daily_report_game") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.daily_report_game),
    "ai-predict": aiPredictionEligible
      && claimedAiPredictionCount < aiGameIds.size
      && (earned.get("content_ai_prediction") ?? 0) < POINT_REWARDS.contentClaimDailyMaxByType.ai_prediction,
    "ai-battle": aiGameIds.size > 0
      && (earned.get("ai_battle_vote") ?? 0) < POINT_REWARDS.aiBattleVoteDailyMax,
    "winner-predict": (gamesRes.count ?? 0) > 0
      && (earned.get("prediction_submitted") ?? 0) < POINT_REWARDS.predictionSubmittedDailyMax,
    "quiz": !hasClaim("quiz_completed", today),
    "stadium": (earned.get("stadium_official_completed") ?? 0) < stadiumMax
  };
}
