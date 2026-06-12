import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { POINT_REWARDS } from "@/lib/points/config";
import { awardPoints, getEarnedAmountForReasonOnDate, getPointBalance, kstDateString } from "@/lib/server/points";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const recordId = String(body.recordId ?? "").trim();
  if (!recordId || recordId === "mirrored") {
    return NextResponse.json({ ok: false, error: "invalid record" }, { status: 400 });
  }

  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: record, error } = await admin
    .from("bp_records")
    .select("id, owner_user_id, source, created_at")
    .eq("id", recordId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!record || record.owner_user_id !== user.id || record.source !== "public") {
    return NextResponse.json({ ok: false, error: "not eligible" }, { status: 403 });
  }

  const today = kstDateString();
  const reason = "stadium_official_completed";
  const earnedToday = await getEarnedAmountForReasonOnDate(admin, user.id, reason, today);
  const firstTierMax = POINT_REWARDS.stadiumOfficialFirstFive * POINT_REWARDS.stadiumOfficialFirstFiveCount;
  const totalMax = firstTierMax + POINT_REWARDS.stadiumOfficialExtraMax;
  const baseAmount = POINT_REWARDS.stadiumOfficialAfterFive;
  const firstTierBonus = POINT_REWARDS.stadiumOfficialFirstFive - baseAmount;
  const policyMessage = `공식 경기는 기본 ${baseAmount}BP, 하루 첫 ${POINT_REWARDS.stadiumOfficialFirstFiveCount}경기는 보너스 ${firstTierBonus}BP가 추가돼요.`;

  let amount = 0;
  if (earnedToday < firstTierMax) {
    amount = Math.min(POINT_REWARDS.stadiumOfficialFirstFive, firstTierMax - earnedToday);
  } else if (earnedToday < totalMax) {
    amount = Math.min(POINT_REWARDS.stadiumOfficialAfterFive, totalMax - earnedToday);
  }

  if (amount <= 0) {
    return NextResponse.json({
      ok: true,
      awarded: false,
      amount: 0,
      balance: await getPointBalance(user.id),
      capped: true,
      earnedToday,
      baseAmount,
      bonusAmount: 0,
      policyMessage
    });
  }

  const result = await awardPoints({
    userId: user.id,
    amount,
    reason,
    referenceType: "bp_record",
    referenceId: recordId,
    rewardKey: `stadium_record:${recordId}`,
    rewardDate: today,
    metadata: { earnedBefore: earnedToday }
  });
  const bonusAmount = Math.max(0, result.amount - baseAmount);
  return NextResponse.json({
    ok: true,
    ...result,
    earnedToday,
    awardedToday: earnedToday + result.amount,
    baseAmount,
    bonusAmount,
    firstTierCount: bonusAmount > 0
      ? Math.min(
          POINT_REWARDS.stadiumOfficialFirstFiveCount,
          Math.max(1, Math.ceil((earnedToday + result.amount) / POINT_REWARDS.stadiumOfficialFirstFive))
        )
      : null,
    firstTierLimit: POINT_REWARDS.stadiumOfficialFirstFiveCount,
    nextAmount: earnedToday + result.amount < firstTierMax
      ? POINT_REWARDS.stadiumOfficialFirstFive
      : earnedToday + result.amount < totalMax
        ? POINT_REWARDS.stadiumOfficialAfterFive
        : 0,
    policyMessage
  });
}
