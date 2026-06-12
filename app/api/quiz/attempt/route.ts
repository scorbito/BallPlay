import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { POINT_REWARDS } from "@/lib/points/config";
import { awardPoints, kstDateString } from "@/lib/server/points";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const score = Number(body.score ?? 0);
  const total = Number(body.total ?? 0);
  if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
    return NextResponse.json({ ok: false, error: "invalid score" }, { status: 400 });
  }

  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const today = kstDateString();
  const completion = await awardPoints({
    userId: user.id,
    amount: POINT_REWARDS.quizComplete,
    reason: "quiz_completed",
    referenceType: "quiz",
    referenceId: today,
    rewardKey: "quiz_completed",
    rewardDate: today,
    metadata: { score, total }
  });

  let bonus = null;
  if (score === 10 && total === 10) {
    bonus = await awardPoints({
      userId: user.id,
      amount: POINT_REWARDS.quizPerfectBonus,
      reason: "quiz_perfect_bonus",
      referenceType: "quiz",
      referenceId: today,
      rewardKey: "quiz_perfect_bonus",
      rewardDate: today,
      metadata: { score, total }
    });
  }

  const admin = createSupabaseAdminClient();
  await admin.from("quiz_attempts").insert({
    user_id: user.id,
    attempt_date: today,
    score,
    total,
    completion_transaction_id: completion.transaction_id ?? null,
    bonus_transaction_id: bonus?.transaction_id ?? null
  });

  return NextResponse.json({
    ok: true,
    awarded: completion.amount + (bonus?.amount ?? 0),
    completion,
    bonus,
    balance: bonus?.balance ?? completion.balance
  });
}
