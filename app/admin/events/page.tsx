import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminBpAdjustPanel } from "@/components/domain/admin/AdminBpAdjustPanel";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { getPointBalance } from "@/lib/server/points";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, kstWeekStartTuesday } from "@/lib/server/predict/weeklyContest";

// bp_events 기반 행동 집계·퀴즈·가을야구 섹션은 Vercel Analytics 와 중복이라 제거(2026-07-27).
// 여기서는 Vercel Analytics 에 없는 "승리팀 예측 참여"만 집계한다.
export const dynamic = "force-dynamic";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

type PredictionRow = { user_id: string; game_date: string; locked_at: string | null };

async function fetchPredictionRowsSince(client: AdminClient, sinceDate: string): Promise<PredictionRow[]> {
  const rows: PredictionRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("bp_predictions")
      .select("user_id, game_date, locked_at")
      .gte("game_date", sinceDate)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return rows;
    const batch = (data ?? []) as PredictionRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/** 승리팀 예측 참여 통계 — 경기일별 참여자·예측수 + 이번주/지난주 비교. */
function summarizePredictions(rows: PredictionRow[], weekStart: string, lastWeekStart: string) {
  const weekEnd = addDays(weekStart, 5);
  const lastWeekEnd = addDays(lastWeekStart, 5);

  const byDate = new Map<string, { users: Set<string>; total: number; locked: number }>();
  const thisWeekUsers = new Set<string>();
  const lastWeekUsers = new Set<string>();
  let thisWeekTotal = 0;
  let lastWeekTotal = 0;

  for (const r of rows) {
    const d = r.game_date;
    const e = byDate.get(d) ?? { users: new Set<string>(), total: 0, locked: 0 };
    e.users.add(r.user_id);
    e.total += 1;
    if (r.locked_at) e.locked += 1;
    byDate.set(d, e);

    if (d >= weekStart && d <= weekEnd) {
      thisWeekUsers.add(r.user_id);
      thisWeekTotal += 1;
    } else if (d >= lastWeekStart && d <= lastWeekEnd) {
      lastWeekUsers.add(r.user_id);
      lastWeekTotal += 1;
    }
  }

  const daily = Array.from(byDate.entries())
    .map(([date, e]) => ({ date, users: e.users.size, total: e.total, locked: e.locked }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return {
    daily,
    thisWeek: { users: thisWeekUsers.size, total: thisWeekTotal },
    lastWeek: { users: lastWeekUsers.size, total: lastWeekTotal }
  };
}

export default async function AdminEventsPage() {
  noStore();

  const serverClient = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(serverClient, identity);
  if (tier !== "admin") notFound();
  const userId = identity.userId;
  if (!userId) notFound();

  const adminClient = createSupabaseAdminClient();
  const predWeekStart = kstWeekStartTuesday();
  const predLastWeekStart = addDays(predWeekStart, -7);

  const [myBpBalance, predictionRows] = await Promise.all([
    getPointBalance(userId),
    fetchPredictionRowsSince(adminClient, predLastWeekStart)
  ]);
  const predictionStats = summarizePredictions(predictionRows, predWeekStart, predLastWeekStart);

  return (
    <AppShell activeTab="my" title="이벤트 통계" theme="light" backHref="/" wide>
      <section className="admin-events-hero">
        <div>
          <span className="admin-events-kicker">운영자 전용</span>
          <h1>승리팀 예측 참여</h1>
          <p>행동·유입 지표는 Vercel Analytics 에서 확인하세요. 여기서는 예측 참여만 집계합니다.</p>
        </div>
        <Target size={34} aria-hidden />
      </section>

      <Link
        href="/admin/predict-event"
        prefetch={false}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          margin: "0 0 4px",
          borderRadius: 14,
          background: "#fce7f3",
          border: "1px solid #f9a8d4",
          color: "#db2777",
          fontWeight: 900,
          fontSize: 15
        }}
      >
        🎯 승부예측 이벤트 추첨
        <span aria-hidden>→</span>
      </Link>

      <Link
        href="/admin/coupons"
        prefetch={false}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          margin: "0 0 4px",
          borderRadius: 14,
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          color: "#b45309",
          fontWeight: 900,
          fontSize: 15
        }}
      >
        🎟 쿠폰 지급
        <span aria-hidden>→</span>
      </Link>

      <Link
        href="/admin/inquiries"
        prefetch={false}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          margin: "0 0 4px",
          borderRadius: 14,
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          color: "#4338ca",
          fontWeight: 900,
          fontSize: 15
        }}
      >
        💬 문의 관리
        <span aria-hidden>→</span>
      </Link>

      <AdminBpAdjustPanel initialBalance={myBpBalance} />

      {/* 승리팀 예측 참여 통계 — Vercel Analytics 에 없는 지표 */}
      <section className="admin-events-panel">
        <header>
          <h2>🎯 승리팀 예측 참여</h2>
          <span>화~일 주간 기준</span>
        </header>
        <div className="admin-events-conversion-list">
          <div>
            <span>이번 주 참여자</span>
            <strong>{predictionStats.thisWeek.users}명 (지난주 {predictionStats.lastWeek.users}명)</strong>
          </div>
          <div>
            <span>이번 주 예측 수</span>
            <strong>{predictionStats.thisWeek.total}건 (지난주 {predictionStats.lastWeek.total}건)</strong>
          </div>
        </div>
        <div className="admin-events-count-list">
          {predictionStats.daily.length > 0 ? predictionStats.daily.map((d) => (
            <div key={d.date}>
              <span>{d.date}</span>
              <strong>참여 {d.users} · 예측 {d.total} · 잠금 {d.locked}</strong>
            </div>
          )) : <p className="admin-events-empty">최근 예측 참여가 없습니다.</p>}
        </div>
      </section>
    </AppShell>
  );
}
