import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Activity, BarChart3, Clock, ListChecks, Percent } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getUserTier } from "@/lib/auth/userTier";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventRow = {
  event_name: string;
  properties: Record<string, unknown> | null;
  pathname: string | null;
  user_id: string | null;
  anonymous_id: string | null;
  created_at: string;
};

type CountRow = {
  eventName: string;
  total: number;
};

const EVENT_LABELS: Record<string, string> = {
  lineup_created: "라인업 생성",
  lineup_published: "라인업 공개",
  match_started: "매치 시작",
  match_completed: "매치 완료",
  prediction_submitted: "승부예측 제출",
  prediction_correct: "승부예측 적중",
  ai_prediction_viewed: "AI 예측 조회",
  sim1000_viewed: "1000회 시뮬 조회",
  video_submitted: "영상 등록",
  point_earned: "포인트 획득",
  point_spent: "포인트 소비"
};

function labelEvent(eventName: string): string {
  return EVENT_LABELS[eventName] ?? eventName;
}

function countByEvent(rows: EventRow[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([eventName, total]) => ({ eventName, total }))
    .sort((a, b) => b.total - a.total || a.eventName.localeCompare(b.eventName));
}

function eventCount(rows: EventRow[], eventName: string): number {
  return rows.filter((row) => row.event_name === eventName).length;
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "-";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatProperties(properties: Record<string, unknown> | null): string {
  if (!properties || Object.keys(properties).length === 0) return "-";
  return Object.entries(properties)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export default async function AdminEventsPage() {
  noStore();

  const serverClient = createSupabaseServerClient();
  const { tier } = await getUserTier(serverClient);
  if (tier !== "admin") notFound();

  const adminClient = createSupabaseAdminClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24hMs = now - 24 * 60 * 60 * 1000;

  const { data, error } = await adminClient
    .from("bp_events")
    .select("event_name, properties, pathname, user_id, anonymous_id, created_at")
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = ((data ?? []) as EventRow[]).filter((row) => row.event_name && row.created_at);
  const rows24h = rows.filter((row) => new Date(row.created_at).getTime() >= since24hMs);
  const counts24h = countByEvent(rows24h);
  const counts7d = countByEvent(rows);
  const recentRows = rows.slice(0, 50);

  const started24h = eventCount(rows24h, "match_started");
  const completed24h = eventCount(rows24h, "match_completed");
  const lineupCreated24h = eventCount(rows24h, "lineup_created");
  const lineupPublished24h = eventCount(rows24h, "lineup_published");
  const predictionSubmitted24h = eventCount(rows24h, "prediction_submitted");
  const aiViewed24h = eventCount(rows24h, "ai_prediction_viewed");

  const uniqueVisitors24h = new Set(
    rows24h.map((row) => row.user_id ?? row.anonymous_id).filter(Boolean)
  ).size;
  const uniqueVisitors7d = new Set(
    rows.map((row) => row.user_id ?? row.anonymous_id).filter(Boolean)
  ).size;

  return (
    <AppShell activeTab="my" title="이벤트 통계" theme="light" backHref="/my/settings" wide>
      <section className="admin-events-hero">
        <div>
          <span className="admin-events-kicker">운영자 전용</span>
          <h1>제품 행동 이벤트</h1>
          <p>최근 7일 기준으로 BallPlay 핵심 행동을 집계합니다.</p>
        </div>
        <Activity size={34} aria-hidden />
      </section>

      {error ? (
        <section className="admin-events-error">
          이벤트를 불러오지 못했습니다: {error.message}
        </section>
      ) : null}

      <section className="admin-events-metrics" aria-label="요약">
        <article>
          <Clock size={16} aria-hidden />
          <span>최근 24시간</span>
          <strong>{rows24h.length.toLocaleString()}건</strong>
          <small>{uniqueVisitors24h.toLocaleString()}명 기준</small>
        </article>
        <article>
          <BarChart3 size={16} aria-hidden />
          <span>최근 7일</span>
          <strong>{rows.length.toLocaleString()}건</strong>
          <small>{uniqueVisitors7d.toLocaleString()}명 기준</small>
        </article>
        <article>
          <Percent size={16} aria-hidden />
          <span>매치 완주율</span>
          <strong>{formatPercent(completed24h, started24h)}</strong>
          <small>{completed24h}/{started24h}</small>
        </article>
        <article>
          <ListChecks size={16} aria-hidden />
          <span>라인업 공개율</span>
          <strong>{formatPercent(lineupPublished24h, lineupCreated24h)}</strong>
          <small>{lineupPublished24h}/{lineupCreated24h}</small>
        </article>
      </section>

      <section className="admin-events-grid">
        <div className="admin-events-panel">
          <header>
            <h2>최근 24시간 이벤트</h2>
            <span>{counts24h.length}종</span>
          </header>
          <div className="admin-events-count-list">
            {counts24h.length > 0 ? counts24h.map((row) => (
              <div key={row.eventName}>
                <span>{labelEvent(row.eventName)}</span>
                <strong>{row.total.toLocaleString()}</strong>
              </div>
            )) : <p className="admin-events-empty">아직 이벤트가 없습니다.</p>}
          </div>
        </div>

        <div className="admin-events-panel">
          <header>
            <h2>최근 7일 이벤트</h2>
            <span>{counts7d.length}종</span>
          </header>
          <div className="admin-events-count-list">
            {counts7d.length > 0 ? counts7d.map((row) => (
              <div key={row.eventName}>
                <span>{labelEvent(row.eventName)}</span>
                <strong>{row.total.toLocaleString()}</strong>
              </div>
            )) : <p className="admin-events-empty">아직 이벤트가 없습니다.</p>}
          </div>
        </div>
      </section>

      <section className="admin-events-panel admin-events-conversions">
        <header>
          <h2>오늘 전환 체크</h2>
          <span>24시간 기준</span>
        </header>
        <div className="admin-events-conversion-list">
          <div>
            <span>매치 시작 → 완료</span>
            <strong>{formatPercent(completed24h, started24h)}</strong>
          </div>
          <div>
            <span>라인업 생성 → 공개</span>
            <strong>{formatPercent(lineupPublished24h, lineupCreated24h)}</strong>
          </div>
          <div>
            <span>AI 예측 조회</span>
            <strong>{aiViewed24h.toLocaleString()}건</strong>
          </div>
          <div>
            <span>승부예측 제출</span>
            <strong>{predictionSubmitted24h.toLocaleString()}건</strong>
          </div>
        </div>
      </section>

      <section className="admin-events-panel">
        <header>
          <h2>최근 이벤트 로그</h2>
          <span>최대 50건</span>
        </header>
        <div className="admin-events-log">
          {recentRows.length > 0 ? recentRows.map((row, index) => (
            <article key={`${row.created_at}-${row.event_name}-${index}`}>
              <div className="admin-events-log-main">
                <strong>{labelEvent(row.event_name)}</strong>
                <span>{formatProperties(row.properties)}</span>
              </div>
              <div className="admin-events-log-meta">
                <span>{row.pathname ?? "-"}</span>
                <time>{formatDateTime(row.created_at)}</time>
              </div>
            </article>
          )) : <p className="admin-events-empty">최근 이벤트가 없습니다.</p>}
        </div>
      </section>
    </AppShell>
  );
}
