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
      /** 1위가 적중률·게임수까지 완전 동점인 인원 수. 2 이상이면 그들끼리 추첨한 것. */
      tiedCount: number;
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

/**
 * 지정 주(화 weekStartISO)의 메인 1등 선정 → 이력 upsert(주별 1행, 재선정 시 교체).
 * 규칙: AI 평균을 넘은 자격자(20경기↑) 중 적중률 1위. 동률이면 게임 많은 사람.
 *       적중률·게임수까지 완전 동점이면 그들끼리만 추첨.
 * (AI를 하나의 참가자로 보므로, AI 평균을 넘은 사람이 없으면 = AI가 1등 → 메인 당첨자 없음)
 */
export async function drawWeeklyEventWinnerAction(weekStartISO: string): Promise<DrawWinnerResult> {
  try {
    const adminUserId = await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    const contest = await computeWeeklyContest(admin, weekStartISO);

    if (contest.qualifiers.length === 0) {
      return { ok: false, error: "AI 평균을 넘은 자격자가 없습니다. (이 주는 AI가 1위 — 메인 당첨자 없음)" };
    }

    // qualifiers는 computeWeeklyContest에서 이미 적중률 desc → 게임수 desc 로 정렬됨.
    // 맨 위와 적중률·게임수까지 완전히 같은 사람들 중에서만 추첨(그래도 동점일 때).
    const top = contest.qualifiers[0];
    const tied = contest.qualifiers.filter((q) => q.rate === top.rate && q.total === top.total);
    const winner = tied.length > 1 ? tied[Math.floor(Math.random() * tied.length)] : top;

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
      qualifierCount: contest.qualifiers.length,
      tiedCount: tied.length
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
