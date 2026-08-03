// 승부예측 주간(화~일) 이벤트 집계 — 운영 공유 DB 스키마 변경 없이 앱단 집계.
//   - 자격선: 그 주 경기의 2/3 이상 예측 (올림)
//   - 비교 기준: 3 AI 적중률 평균
//   - 자격자: 자격선 이상 예측 + 적중률 > AI평균
// 기존 뷰(bp_prediction_results, bp_ai_predictions_with_result)를 화~일 범위로 읽어 집계한다.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EventQualifier = {
  userId: string;
  nickname: string | null;
  total: number;
  correct: number;
  rate: number; // 0~1
};

export type AiProviderWeekly = {
  provider: string;
  total: number;
  correct: number;
  accuracy: number | null; // 0~100
};

export type CouponWinner = { userId: string; nickname: string | null };

export type WeeklyContest = {
  weekStartISO: string; // 화
  weekEndISO: string;   // 일
  gameCount: number;
  threshold: number;    // 자격선 = ceil(gameCount * 2/3)
  aiAvgAccuracy: number | null; // 0~100, 3 AI 평균 (참고 표시용)
  /** 0~100, 3 AI 중 최고 적중률. AI를 모두 이겨야 하므로 이 값이 자격 기준선. */
  aiMaxAccuracy: number | null;
  aiProviders: AiProviderWeekly[];
  /** 메인 후보 — 로그인 계정 + 자격선 이상 + 3개 AI를 모두 초과(=최고 AI 초과). */
  qualifiers: EventQualifier[];
  /** 쿠폰 추첨 후보 — 로그인 계정 + COUPON_MIN_GAMES 이상 예측한 참여자 전체. */
  participants: EventQualifier[];
  participantCount: number;
};

export type EventDraw = {
  weekStartDate: string;
  weekEndDate: string;
  gameCount: number;
  threshold: number;
  aiAvgAccuracy: number | null;
  qualifierCount: number;
  participantCount: number;
  winnerUserId: string | null;
  winnerNickname: string | null;
  /** 예측왕의 예측 경기수 (추첨 시 스냅샷). 없으면 null(구 기록). */
  winnerTotal: number | null;
  /** 예측왕 적중률 0~1 (추첨 시 스냅샷). 없으면 null. */
  winnerRate: number | null;
  couponWinners: CouponWinner[];
  /** 외부(카톡/이메일)로 이미 지급 완료 처리한 당첨자 user_id 목록 (패널 표시용). */
  couponIssuedExternal: string[];
  drawnAt: string;
};

/** 쿠폰(참여 보상) 추첨 풀 최소 예측 경기 수. */
export const COUPON_MIN_GAMES = 5;

const PAGE = 1000;
const MAX_ROWS = 50000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 주어진 날짜(미지정 시 오늘 KST)가 속한 주의 화요일 ISO. 월요일이면 직전 주 화요일.
export function kstWeekStartTuesday(refISO?: string): string {
  const base = refISO
    ? new Date(`${refISO}T00:00:00`)
    : new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = base.getDay(); // 0=일 .. 6=토
  const daysSinceTue = (dow - 2 + 7) % 7;
  base.setDate(base.getDate() - daysSinceTue);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

// 익명계정 제외 — 로그인 계정 id만 남긴다. 함수 에러 시 안전하게 빈 집합(추첨 0명)으로.
async function filterLoggedIn(client: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await client.rpc("bp_filter_logged_in_users", { p_ids: ids });
  if (error) return new Set();
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}

export async function computeWeeklyContest(
  client: SupabaseClient,
  weekStartISO: string
): Promise<WeeklyContest> {
  const weekEndISO = addDays(weekStartISO, 5); // 화 + 5 = 일

  // 1) 그 주 경기 수 (취소 제외)
  const { count } = await client
    .from("games")
    .select("id", { count: "exact", head: true })
    .gte("game_date", weekStartISO)
    .lte("game_date", weekEndISO)
    .neq("status", "canceled");
  const gameCount = count ?? 0;
  const threshold = Math.max(1, Math.ceil((gameCount * 2) / 3));

  // 2) AI provider별 적중률 (화~일, 채점된 것만) → 3개 평균
  const aiByProvider = new Map<string, { total: number; correct: number }>();
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data } = await client
      .from("bp_ai_predictions_with_result")
      .select("ai_provider,is_correct_live")
      .gte("game_date", weekStartISO)
      .lte("game_date", weekEndISO)
      .eq("is_judged", true)
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as Array<{ ai_provider: string; is_correct_live: boolean | null }>;
    for (const r of rows) {
      const agg = aiByProvider.get(r.ai_provider) ?? { total: 0, correct: 0 };
      agg.total += 1;
      if (r.is_correct_live === true) agg.correct += 1;
      aiByProvider.set(r.ai_provider, agg);
    }
    if (rows.length < PAGE) break;
  }
  const aiProviders: AiProviderWeekly[] = Array.from(aiByProvider.entries()).map(([provider, a]) => ({
    provider,
    total: a.total,
    correct: a.correct,
    accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 1000) / 10 : null
  }));
  const accs = aiProviders.map((p) => p.accuracy).filter((x): x is number => x !== null);
  const aiAvgAccuracy =
    accs.length > 0 ? Math.round((accs.reduce((s, x) => s + x, 0) / accs.length) * 10) / 10 : null;
  // AI도 참가자 → 모든 AI를 이겨야 하므로 '가장 높은 AI'가 넘어야 할 기준선.
  const aiMaxAccuracy = accs.length > 0 ? Math.max(...accs) : null;

  // 3) 유저별 적중률 (화~일, 잠금+채점된 것만)
  const byUser = new Map<string, { total: number; correct: number }>();
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data } = await client
      .from("bp_prediction_results")
      .select("user_id,is_correct")
      .gte("game_date", weekStartISO)
      .lte("game_date", weekEndISO)
      .not("locked_at", "is", null)
      .eq("is_judged", true)
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as Array<{ user_id: string; is_correct: boolean | null }>;
    for (const r of rows) {
      const agg = byUser.get(r.user_id) ?? { total: 0, correct: 0 };
      agg.total += 1;
      if (r.is_correct === true) agg.correct += 1;
      byUser.set(r.user_id, agg);
    }
    if (rows.length < PAGE) break;
  }

  // 추첨 대상은 로그인 계정만 (익명 제외).
  const loggedIn = await filterLoggedIn(client, Array.from(byUser.keys()));

  const aiMaxRate = aiMaxAccuracy === null ? null : aiMaxAccuracy / 100;
  const enriched = Array.from(byUser.entries())
    .filter(([userId]) => loggedIn.has(userId))
    .map(([userId, a]) => ({
      userId,
      total: a.total,
      correct: a.correct,
      rate: a.total > 0 ? a.correct / a.total : 0
    }));

  // 메인: 자격선 이상 + 3개 AI를 모두 초과(=최고 AI 초과).
  // AI 기록이 없는 빈 주는 기준선을 못 정하므로 자격자 없음.
  const ranked = enriched
    .filter((q) => q.total >= threshold && aiMaxRate !== null && q.rate > aiMaxRate)
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

  // 쿠폰: COUPON_MIN_GAMES 이상 예측한 참여자 전체.
  const participantsRaw = enriched
    .filter((p) => p.total >= COUPON_MIN_GAMES)
    .sort((a, b) => b.total - a.total || b.rate - a.rate);

  // 닉네임 — 메인 + 참여자 합집합 한 번에 조회.
  const nickIds = Array.from(new Set([...ranked, ...participantsRaw].map((r) => r.userId)));
  const nickById = new Map<string, string | null>();
  if (nickIds.length > 0) {
    const { data: profiles } = await client.from("profiles").select("id,nickname").in("id", nickIds);
    for (const p of (profiles ?? []) as Array<{ id: string; nickname: string | null }>) {
      nickById.set(p.id, p.nickname ?? null);
    }
  }
  const withNick = (r: { userId: string; total: number; correct: number; rate: number }): EventQualifier => ({
    ...r,
    nickname: nickById.get(r.userId) ?? null
  });

  return {
    weekStartISO,
    weekEndISO,
    gameCount,
    threshold,
    aiAvgAccuracy,
    aiMaxAccuracy,
    aiProviders,
    qualifiers: ranked.map(withNick),
    participants: participantsRaw.map(withNick),
    participantCount: participantsRaw.length
  };
}

/**
 * 그 주 당첨자 전원에게 쿠폰이 전달됐는지 여부.
 * 사이트 쿠폰함 지급(bp_coupons.source = predict-king-<주시작일>) + 외부 지급 표시를 합쳐 판정한다.
 * 공개 페이지 문구 전환용 — 불리언만 쓰고 user_id 는 렌더하지 않는다.
 */
export async function isWeekFullyIssued(client: SupabaseClient, draw: EventDraw): Promise<boolean> {
  const expectedIds = [
    ...(draw.winnerUserId ? [draw.winnerUserId] : []),
    ...draw.couponWinners.map((w) => w.userId)
  ];
  if (expectedIds.length === 0) return false;

  const { data, error } = await client
    .from("bp_coupons")
    .select("user_id")
    .eq("source", `predict-king-${draw.weekStartDate}`);
  if (error) return false; // 조회 실패 시 "전달 예정" 문구 유지 — 잘못된 완료 표시보다 안전.

  const delivered = new Set<string>([
    ...(data ?? []).map((r: { user_id: string }) => String(r.user_id)),
    ...draw.couponIssuedExternal
  ]);
  return expectedIds.every((id) => delivered.has(id));
}

export async function listEventDraws(client: SupabaseClient): Promise<EventDraw[]> {
  const { data, error } = await client
    .from("bp_predict_event_draws")
    .select(
      "week_start_date,week_end_date,game_count,threshold,ai_avg_accuracy,qualifier_count,participant_count,winner_user_id,winner_nickname,winner_total,winner_rate,coupon_winners,coupon_issued_external,drawn_at"
    )
    .order("week_start_date", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    weekStartDate: String(r.week_start_date),
    weekEndDate: String(r.week_end_date),
    gameCount: Number(r.game_count ?? 0),
    threshold: Number(r.threshold ?? 0),
    aiAvgAccuracy: r.ai_avg_accuracy === null || r.ai_avg_accuracy === undefined ? null : Number(r.ai_avg_accuracy),
    qualifierCount: Number(r.qualifier_count ?? 0),
    participantCount: Number(r.participant_count ?? 0),
    winnerUserId: r.winner_user_id ? String(r.winner_user_id) : null,
    winnerNickname: r.winner_nickname ? String(r.winner_nickname) : null,
    winnerTotal: r.winner_total === null || r.winner_total === undefined ? null : Number(r.winner_total),
    winnerRate: r.winner_rate === null || r.winner_rate === undefined ? null : Number(r.winner_rate),
    couponWinners: Array.isArray(r.coupon_winners) ? (r.coupon_winners as CouponWinner[]) : [],
    couponIssuedExternal: Array.isArray(r.coupon_issued_external)
      ? (r.coupon_issued_external as unknown[]).map((v) => String(v))
      : [],
    drawnAt: String(r.drawn_at)
  }));
}
