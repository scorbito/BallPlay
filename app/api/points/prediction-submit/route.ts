import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { POINT_REWARDS } from "@/lib/points/config";
import { awardPoints, getPointBalance, kstDateString } from "@/lib/server/points";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const gameDate = DATE_RE.test(String(body.gameDate ?? "")) ? String(body.gameDate) : kstDateString();

  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bp_predictions")
    .select("id, game_id")
    .eq("user_id", user.id)
    .eq("game_date", gameDate)
    .not("locked_at", "is", null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const reason = "prediction_submitted";
  let awarded = 0;
  let balance = await getPointBalance(user.id);
  for (const row of (data ?? []) as Array<{ id: string; game_id: string }>) {
    const result = await awardPoints({
      userId: user.id,
      amount: POINT_REWARDS.predictionSubmittedPerGame,
      reason,
      referenceType: "game",
      referenceId: row.game_id,
      rewardKey: `prediction_submitted:${row.game_id}`,
      rewardDate: gameDate
    });
    awarded += result.amount;
    balance = result.balance;
  }

  return NextResponse.json({ ok: true, awarded, balance, checked: data?.length ?? 0 });
}
