import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  POINT_CONTENT_REWARD_START_AT,
  POINT_REWARDS,
  getContentPointAmount,
  getContentPointDailyMax,
  type ContentPointType
} from "@/lib/points/config";

export type AwardResult = {
  awarded: boolean;
  amount: number;
  balance: number;
  reason: string;
  already_claimed?: boolean;
  transaction_id?: string;
  ineligibleReason?: string;
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

function dateOnlyToKstStart(dateISO: string): string {
  return `${dateISO}T00:00:00+09:00`;
}

function kstDateFromTimestamp(timestamp: string): string {
  return kstDateString(new Date(timestamp));
}

function parseDailyReportContentId(contentId: string): { dateISO: string; publishedAt: string | null } | null {
  const [dateISO, publishedAt] = contentId.split("|");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  return { dateISO, publishedAt: publishedAt || null };
}

function parseDailyReportGameContentId(contentId: string): {
  dateISO: string;
  publishedAt: string | null;
  gameId: string;
} | null {
  const pipeParts = contentId.split("|");
  if (pipeParts.length >= 3) {
    const [dateISO, publishedAt, ...gameIdParts] = pipeParts;
    const gameId = gameIdParts.join("|");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !publishedAt || !gameId) return null;
    return { dateISO, publishedAt, gameId };
  }

  const [dateISO, gameId] = contentId.split(":");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !gameId) return null;
  return { dateISO, publishedAt: null, gameId };
}

function getUserContentEligibilityStart(userCreatedAt?: string | null): string {
  if (!userCreatedAt) return POINT_CONTENT_REWARD_START_AT;
  return new Date(userCreatedAt).getTime() > new Date(POINT_CONTENT_REWARD_START_AT).getTime()
    ? userCreatedAt
    : POINT_CONTENT_REWARD_START_AT;
}

async function resolveContentRewardContext(input: {
  contentType: ContentPointType;
  contentId: string;
}): Promise<{
  eligible: boolean;
  publishedAt: string | null;
  rewardDate: string;
  skipUserCreatedAtCheck?: boolean;
  reason?: string;
}> {
  if (input.contentType === "daily_report") {
    const parsed = parseDailyReportContentId(input.contentId);
    if (!parsed) {
      return { eligible: false, publishedAt: null, rewardDate: kstDateString(), reason: "invalid content date" };
    }
    const publishedAt = parsed.publishedAt ?? dateOnlyToKstStart(parsed.dateISO);
    return {
      eligible: true,
      publishedAt,
      rewardDate: parsed.publishedAt ? kstDateFromTimestamp(parsed.publishedAt) : parsed.dateISO
    };
  }

  if (input.contentType === "daily_report_game") {
    const parsed = parseDailyReportGameContentId(input.contentId);
    if (!parsed) {
      return { eligible: false, publishedAt: null, rewardDate: kstDateString(), reason: "invalid content date" };
    }
    const publishedAt = parsed.publishedAt ?? dateOnlyToKstStart(parsed.dateISO);
    return {
      eligible: true,
      publishedAt,
      rewardDate: parsed.publishedAt ? kstDateFromTimestamp(parsed.publishedAt) : parsed.dateISO
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bp_ai_predictions")
    .select("ai_provider,game_date,created_at,published_at")
    .eq("game_id", input.contentId);

  if (error || !data || data.length === 0) {
    return { eligible: false, publishedAt: null, rewardDate: kstDateString(), reason: "AI 예측이 아직 준비되지 않았어요." };
  }

  const rows = data as Array<{
    ai_provider: string | null;
    game_date: string | null;
    created_at: string | null;
    published_at: string | null;
  }>;
  const providerCount = new Set(rows.map((row) => row.ai_provider).filter(Boolean)).size;
  if (providerCount < 3) {
    return { eligible: false, publishedAt: null, rewardDate: kstDateString(), reason: "3개 AI 예측이 모두 도착하면 BP를 받을 수 있어요." };
  }

  const completedAt = rows
    .map((row) => row.created_at ?? row.published_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (!completedAt) {
    return { eligible: false, publishedAt: null, rewardDate: kstDateString(), reason: "AI 예측 입력 시간을 확인하지 못했어요." };
  }

  return {
    eligible: true,
    publishedAt: completedAt,
    rewardDate: kstDateFromTimestamp(completedAt),
    skipUserCreatedAtCheck: true
  };
}

export async function getContentRewardEligibility(input: {
  contentType: ContentPointType;
  contentId: string;
  userCreatedAt?: string | null;
}): Promise<{
  eligible: boolean;
  publishedAt: string | null;
  rewardDate: string;
  skipUserCreatedAtCheck?: boolean;
  reason?: string;
}> {
  const context = await resolveContentRewardContext(input);
  if (!context.eligible || !context.publishedAt) return context;

  const eligibleFrom = getUserContentEligibilityStart(input.userCreatedAt);
  if (!context.skipUserCreatedAtCheck && new Date(context.publishedAt).getTime() < new Date(eligibleFrom).getTime()) {
    return {
      ...context,
      eligible: false,
      reason: "콘텐츠 BP는 포인트 오픈 이후, 그리고 계정 생성 이후 발행된 콘텐츠부터 받을 수 있어요."
    };
  }

  return context;
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

export async function adjustPointBalance(input: {
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  adjusted: number;
  balance: number;
  transaction_id?: string;
}> {
  const amount = Math.trunc(input.amount);
  if (!input.userId) throw new Error("user_id is required");
  if (!Number.isFinite(amount) || amount === 0) {
    return { adjusted: 0, balance: await getPointBalance(input.userId) };
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("point_balances")
    .upsert({
      user_id: input.userId,
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: balanceRow, error: balanceError } = await admin
    .from("point_balances")
    .select("balance")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (balanceError) throw new Error(balanceError.message);

  const currentBalance = Number(balanceRow?.balance ?? 0);
  const nextBalance = currentBalance + amount;
  if (nextBalance < 0) throw new Error("BP cannot be negative");

  const { error: updateError } = await admin
    .from("point_balances")
    .update({
      balance: nextBalance,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId)
    .eq("balance", currentBalance);
  if (updateError) throw new Error(updateError.message);

  const { data: tx, error: txError } = await admin
    .from("point_transactions")
    .insert({
      user_id: input.userId,
      amount,
      type: "adjust",
      reason: input.reason,
      reference_type: "admin",
      reference_id: input.userId,
      metadata: {
        previous_balance: currentBalance,
        next_balance: nextBalance,
        ...(input.metadata ?? {})
      }
    })
    .select("id")
    .single();
  if (txError) throw new Error(txError.message);

  return {
    adjusted: amount,
    balance: nextBalance,
    transaction_id: tx.id
  };
}

export async function setPointBalance(input: {
  userId: string;
  balance: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  adjusted: number;
  balance: number;
  transaction_id?: string;
}> {
  const nextBalance = Math.trunc(input.balance);
  if (!Number.isFinite(nextBalance) || nextBalance < 0) throw new Error("invalid balance");
  const currentBalance = await getPointBalance(input.userId);
  return adjustPointBalance({
    userId: input.userId,
    amount: nextBalance - currentBalance,
    reason: input.reason,
    metadata: input.metadata
  });
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

export async function spendPoints(input: {
  userId: string;
  amount: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  spent: number;
  balance: number;
  reason: string;
  transaction_id?: string;
}> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("invalid spend amount");
  }

  const admin = createSupabaseAdminClient();
  const amount = Math.floor(input.amount);

  await admin
    .from("point_balances")
    .upsert({
      user_id: input.userId,
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id", ignoreDuplicates: true });

  const { data: balanceRow, error: balanceError } = await admin
    .from("point_balances")
    .select("balance, lifetime_spent")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (balanceError) throw new Error(balanceError.message);

  const currentBalance = Number(balanceRow?.balance ?? 0);
  const currentLifetimeSpent = Number(balanceRow?.lifetime_spent ?? 0);
  if (currentBalance < amount) {
    throw new Error("Insufficient BP");
  }

  const nextBalance = currentBalance - amount;
  const { error: updateError } = await admin
    .from("point_balances")
    .update({
      balance: nextBalance,
      lifetime_spent: currentLifetimeSpent + amount,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId)
    .eq("balance", currentBalance);
  if (updateError) throw new Error(updateError.message);

  const { data: tx, error: txError } = await admin
    .from("point_transactions")
    .insert({
      user_id: input.userId,
      amount,
      type: "spend",
      reason: input.reason,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single();
  if (txError) throw new Error(txError.message);

  return {
    spent: amount,
    balance: nextBalance,
    reason: input.reason,
    transaction_id: tx.id
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

async function getClaimedContentAmountForRewardDate(
  client: SupabaseClient,
  userId: string,
  rewardKeyPrefix: string,
  rewardDate: string
): Promise<number> {
  const { data, error } = await client
    .from("point_reward_claims")
    .select("amount")
    .eq("user_id", userId)
    .eq("reward_date", rewardDate)
    .like("reward_key", `${rewardKeyPrefix}:%`);
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
  userCreatedAt?: string | null;
  contentType: ContentPointType;
  contentId: string;
}): Promise<AwardResult> {
  const admin = createSupabaseAdminClient();
  const reason = `content_${input.contentType}`;
  const eligibility = await getContentRewardEligibility(input);
  if (!eligibility.eligible) {
    return {
      awarded: false,
      amount: 0,
      balance: await getPointBalance(input.userId),
      reason,
      already_claimed: true,
      ineligibleReason: eligibility.reason
    };
  }
  const rewardDate = eligibility.rewardDate;
  const earnedToday = await getClaimedContentAmountForRewardDate(admin, input.userId, reason, rewardDate);
  const amount = getContentPointAmount(input.contentType);
  const dailyMax = getContentPointDailyMax(input.contentType);
  if (earnedToday >= dailyMax) {
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
    amount,
    reason,
    referenceType: input.contentType,
    referenceId: input.contentId,
    rewardKey: `${reason}:${input.contentId}`,
    rewardDate
  });
}

export async function getContentPointClaimStatus(input: {
  userId: string;
  userCreatedAt?: string | null;
  contentType: ContentPointType;
  contentId: string;
}): Promise<{
  claimed: boolean;
  capped: boolean;
  balance: number;
  eligible: boolean;
  ineligibleReason?: string;
}> {
  const admin = createSupabaseAdminClient();
  const reason = `content_${input.contentType}`;
  const rewardKey = `${reason}:${input.contentId}`;
  const dailyMax = getContentPointDailyMax(input.contentType);
  const eligibility = await getContentRewardEligibility(input);
  const rewardDate = eligibility.rewardDate;

  const { data: claim } = await admin
    .from("point_reward_claims")
    .select("id")
    .eq("user_id", input.userId)
    .eq("reward_key", rewardKey)
    .eq("reward_date", rewardDate)
    .maybeSingle();

  const earnedToday = await getClaimedContentAmountForRewardDate(admin, input.userId, reason, rewardDate);
  return {
    claimed: Boolean(claim),
    capped: earnedToday >= dailyMax,
    balance: await getPointBalance(input.userId),
    eligible: eligibility.eligible,
    ineligibleReason: eligibility.reason
  };
}
