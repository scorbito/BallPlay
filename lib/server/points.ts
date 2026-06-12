import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { POINT_REWARDS, type ContentPointType } from "@/lib/points/config";

export type AwardResult = {
  awarded: boolean;
  amount: number;
  balance: number;
  reason: string;
  already_claimed?: boolean;
  transaction_id?: string;
};

export function kstDateString(date = new Date()): string {
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getPointBalance(userId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("point_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  return Number(data?.balance ?? 0);
}

export async function awardPoints(input: {
  userId: string;
  amount: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  rewardKey?: string | null;
  rewardDate?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AwardResult> {
  const admin = createSupabaseAdminClient();
  const rewardDate = input.rewardDate ?? kstDateString();
  let claimId: string | null = null;

  if (input.rewardKey) {
    const { data: claim, error: claimError } = await admin
      .from("point_reward_claims")
      .insert({
        user_id: input.userId,
        reward_key: input.rewardKey,
        reward_date: rewardDate,
        amount: input.amount
      })
      .select("id")
      .single();

    if (claimError) {
      if (claimError.code === "23505") {
        return {
          awarded: false,
          amount: 0,
          balance: await getPointBalance(input.userId),
          reason: input.reason,
          already_claimed: true
        };
      }
      throw new Error(claimError.message);
    }

    claimId = claim.id;
  }

  const { data: tx, error: txError } = await admin
    .from("point_transactions")
    .insert({
      user_id: input.userId,
      amount: input.amount,
      type: "earn",
      reason: input.reason,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single();
  if (txError) throw new Error(txError.message);

  const { data: balanceRow, error: balanceError } = await admin
    .from("point_balances")
    .select("balance, lifetime_earned")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (balanceError) throw new Error(balanceError.message);

  const balance = Number(balanceRow?.balance ?? 0) + input.amount;
  const lifetimeEarned = Number(balanceRow?.lifetime_earned ?? 0) + input.amount;
  const { error: upsertError } = await admin
    .from("point_balances")
    .upsert({
      user_id: input.userId,
      balance,
      lifetime_earned: lifetimeEarned,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
  if (upsertError) throw new Error(upsertError.message);

  if (claimId) {
    await admin
      .from("point_reward_claims")
      .update({ transaction_id: tx.id })
      .eq("id", claimId);
  }

  return {
    awarded: true,
    amount: input.amount,
    balance,
    reason: input.reason,
    transaction_id: tx.id,
    already_claimed: false
  };
}

export async function getEarnedAmountForReasonOnDate(
  client: SupabaseClient,
  userId: string,
  reason: string,
  dateISO: string
): Promise<number> {
  const start = `${dateISO}T00:00:00+09:00`;
  const end = `${addDaysISO(dateISO, 1)}T00:00:00+09:00`;
  const { data, error } = await client
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", reason)
    .eq("type", "earn")
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) return 0;
  const rows = (data ?? []) as Array<{ amount: number | null }>;
  return rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function claimDailyCheckin(userId: string): Promise<{
  awarded: boolean;
  amount: number;
  balance: number;
  streak: number;
  bonus: number;
}> {
  const admin = createSupabaseAdminClient();
  const today = kstDateString();
  const yesterday = addDaysISO(today, -1);

  const { data: existing } = await admin
    .from("daily_checkins")
    .select("streak_count")
    .eq("user_id", userId)
    .eq("checkin_date", today)
    .maybeSingle();
  if (existing) {
    return { awarded: false, amount: 0, balance: await getPointBalance(userId), streak: existing.streak_count, bonus: 0 };
  }

  const { data: prev } = await admin
    .from("daily_checkins")
    .select("streak_count")
    .eq("user_id", userId)
    .eq("checkin_date", yesterday)
    .maybeSingle();
  const streak = Number(prev?.streak_count ?? 0) + 1;
  const bonus = Math.min((streak - 1) * POINT_REWARDS.checkinStreakStep, POINT_REWARDS.checkinStreakMaxBonus);
  const amount = POINT_REWARDS.dailyCheckin + bonus;

  const award = await awardPoints({
    userId,
    amount,
    reason: "daily_checkin",
    referenceType: "date",
    referenceId: today,
    rewardKey: "daily_checkin",
    rewardDate: today,
    metadata: { streak, bonus }
  });

  if (award.awarded) {
    await admin.from("daily_checkins").insert({
      user_id: userId,
      checkin_date: today,
      streak_count: streak,
      base_points: POINT_REWARDS.dailyCheckin,
      bonus_points: bonus,
      transaction_id: award.transaction_id ?? null
    });
  }

  return { awarded: award.awarded, amount: award.amount, balance: award.balance, streak, bonus };
}

export async function claimContentPoints(input: {
  userId: string;
  contentType: ContentPointType;
  contentId: string;
}): Promise<AwardResult> {
  const admin = createSupabaseAdminClient();
  const today = kstDateString();
  const reason = `content_${input.contentType}`;
  const earnedToday = await getEarnedAmountForReasonOnDate(admin, input.userId, reason, today);
  if (earnedToday >= POINT_REWARDS.contentClaimDailyMaxByType) {
    return {
      awarded: false,
      amount: 0,
      balance: await getPointBalance(input.userId),
      reason,
      already_claimed: true
    };
  }

  return awardPoints({
    userId: input.userId,
    amount: POINT_REWARDS.contentClaim,
    reason,
    referenceType: input.contentType,
    referenceId: input.contentId,
    rewardKey: `${reason}:${input.contentId}`,
    rewardDate: today
  });
}

export async function getContentPointClaimStatus(input: {
  userId: string;
  contentType: ContentPointType;
  contentId: string;
}): Promise<{
  claimed: boolean;
  capped: boolean;
  balance: number;
}> {
  const admin = createSupabaseAdminClient();
  const today = kstDateString();
  const reason = `content_${input.contentType}`;
  const rewardKey = `${reason}:${input.contentId}`;

  const { data: claim } = await admin
    .from("point_reward_claims")
    .select("id")
    .eq("user_id", input.userId)
    .eq("reward_key", rewardKey)
    .eq("reward_date", today)
    .maybeSingle();

  const earnedToday = await getEarnedAmountForReasonOnDate(admin, input.userId, reason, today);
  return {
    claimed: Boolean(claim),
    capped: earnedToday >= POINT_REWARDS.contentClaimDailyMaxByType,
    balance: await getPointBalance(input.userId)
  };
}
