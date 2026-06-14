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

  let awarded = 0;
  let awardedCount = 0;
  let balance = await getPointBalance(user.id);

  for (const row of (data ?? []) as CorrectPredictionRow[]) {
    const result = await awardPoints({
      userId: user.id,
      amount: POINT_REWARDS.predictionCorrectPerGame,
      reason: "prediction_correct",
      referenceType: "game",
      referenceId: row.game_id,
      rewardKey: `prediction_correct:${row.id}`,
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
    checked: data?.length ?? 0,
    balance
  });
}
