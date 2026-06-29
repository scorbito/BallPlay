"use server";

import { revalidatePath } from "next/cache";
import { getUserTier } from "@/lib/auth/userTier";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeWeeklyContest } from "@/lib/server/predict/weeklyContest";

export type DrawWinnerResult =
  | {
      ok: true;
      winner: { userId: string; nickname: string | null; total: number; correct: number; rate: number };
      qualifierCount: number;
    }
  | { ok: false; error: string };

export type DrawCouponResult =
  | { ok: true; winners: Array<{ userId: string; nickname: string | null }>; participantCount: number }
  | { ok: false; error: string };

async function requireAdminUserId(): Promise<string> {
  const serverClient = createSupabaseServerClient();
  const [{ data: authData }, tierResult] = await Promise.all([
    serverClient.auth.getUser(),
    getUserTier(serverClient)
  ]);
  if (!authData.user) throw new Error("로그인이 필요합니다.");
  if (tierResult.tier !== "admin") throw new Error("운영자 권한이 필요합니다.");
  return authData.user.id;
}

/** 지정 주(화 weekStartISO)의 자격자 중 1명 무작위 추첨 → 이력 upsert(주별 1행, 재추첨 시 교체). */
export async function drawWeeklyEventWinnerAction(weekStartISO: string): Promise<DrawWinnerResult> {
  try {
    const adminUserId = await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    const contest = await computeWeeklyContest(admin, weekStartISO);

    if (contest.qualifiers.length === 0) {
      return { ok: false, error: "자격자가 없어 추첨할 수 없습니다. (AI 평균 초과 + 자격선 충족자 0명)" };
    }

    const winner = contest.qualifiers[Math.floor(Math.random() * contest.qualifiers.length)];

    const { error } = await admin
      .from("bp_predict_event_draws")
      .upsert(
        {
          week_start_date: contest.weekStartISO,
          week_end_date: contest.weekEndISO,
          game_count: contest.gameCount,
          threshold: contest.threshold,
          ai_avg_accuracy: contest.aiAvgAccuracy,
          qualifier_count: contest.qualifiers.length,
          participant_count: contest.participantCount,
          winner_user_id: winner.userId,
          winner_nickname: winner.nickname,
          drawn_by: adminUserId,
          drawn_at: new Date().toISOString()
        },
        { onConflict: "week_start_date" }
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/predict-event");
    return {
      ok: true,
      winner: {
        userId: winner.userId,
        nickname: winner.nickname,
        total: winner.total,
        correct: winner.correct,
        rate: winner.rate
      },
      qualifierCount: contest.qualifiers.length
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "추첨에 실패했습니다." };
  }
}

/** 참여자(로그인+5경기 이상) 중 메인 당첨자 제외하고 무작위 3명 쿠폰 추첨. */
export async function drawCouponWinnersAction(weekStartISO: string): Promise<DrawCouponResult> {
  try {
    const adminUserId = await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    const contest = await computeWeeklyContest(admin, weekStartISO);

    // 메인 당첨자 제외 (이미 추첨됐으면 이력에서 읽어옴)
    const { data: existing } = await admin
      .from("bp_predict_event_draws")
      .select("winner_user_id")
      .eq("week_start_date", contest.weekStartISO)
      .maybeSingle();
    const mainWinnerId = existing?.winner_user_id ? String(existing.winner_user_id) : null;

    const pool = contest.participants.filter((p) => p.userId !== mainWinnerId);
    if (pool.length === 0) {
      return { ok: false, error: "쿠폰 추첨 대상이 없습니다. (로그인 + 5경기 이상 참여자 0명)" };
    }

    // Fisher–Yates 셔플 후 최대 3명.
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winners = shuffled.slice(0, 3).map((w) => ({ userId: w.userId, nickname: w.nickname }));

    const { error } = await admin
      .from("bp_predict_event_draws")
      .upsert(
        {
          week_start_date: contest.weekStartISO,
          week_end_date: contest.weekEndISO,
          game_count: contest.gameCount,
          threshold: contest.threshold,
          ai_avg_accuracy: contest.aiAvgAccuracy,
          qualifier_count: contest.qualifiers.length,
          participant_count: contest.participantCount,
          coupon_winners: winners,
          drawn_by: adminUserId,
          drawn_at: new Date().toISOString()
        },
        { onConflict: "week_start_date" }
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/predict-event");
    return { ok: true, winners, participantCount: contest.participantCount };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "쿠폰 추첨에 실패했습니다." };
  }
}
