import { NextResponse } from "next/server";
import { POINT_REWARDS } from "@/lib/points/config";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { awardPoints, getPointBalance } from "@/lib/server/points";

type CorrectPredictionRow = {
  id: string;
  game_id: string;
  game_date: string;
  predicted_winner_team_id: string;
  actual_winner_team_id: string | null;
  is_correct: boolean | null;
};

export async function POST() {
  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bp_prediction_results")
    .select("id, game_id, game_date, predicted_winner_team_id, actual_winner_team_id, is_correct")
    .eq("user_id", user.id)
    .not("locked_at", "is", null)
    .eq("is_judged", true)
    .eq("is_correct", true)
    .order("game_date", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as CorrectPredictionRow[];
  const rewardKeys = rows.map((row) => `prediction_correct:${row.id}`);
  const claimedKeys = new Set<string>();

  if (rewardKeys.length > 0) {
    const { data: claims, error: claimsError } = await admin
      .from("point_reward_claims")
      .select("reward_key")
      .eq("user_id", user.id)
      .in("reward_key", rewardKeys);

    if (claimsError) return NextResponse.json({ ok: false, error: claimsError.message }, { status: 500 });
    for (const claim of claims ?? []) {
      if (typeof claim.reward_key === "string") claimedKeys.add(claim.reward_key);
    }
  }

  let awarded = 0;
  let awardedCount = 0;
  let balance = await getPointBalance(user.id);

  for (const row of rows) {
    const rewardKey = `prediction_correct:${row.id}`;
    if (claimedKeys.has(rewardKey)) continue;

    const result = await awardPoints({
      userId: user.id,
      amount: POINT_REWARDS.predictionCorrectPerGame,
      reason: "prediction_correct",
      referenceType: "game",
      referenceId: row.game_id,
      rewardKey,
      rewardDate: row.game_date,
      metadata: {
        predicted_winner_team_id: row.predicted_winner_team_id,
        actual_winner_team_id: row.actual_winner_team_id
      }
    });

    if (result.awarded) {
      awarded += result.amount;
      awardedCount += 1;
      balance = result.balance;
    } else {
      balance = result.balance;
    }
  }

  return NextResponse.json({
    ok: true,
    awarded,
    awardedCount,
    checked: rows.length,
    balance
  });
}
