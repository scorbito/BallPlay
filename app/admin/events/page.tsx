import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Activity, BarChart3, Clock, ListChecks, Percent, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminBpAdjustPanel } from "@/components/domain/admin/AdminBpAdjustPanel";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { getPointBalance } from "@/lib/server/points";
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

type PlayoffRunRow = {
  id: string;
  user_id: string | null;
  team_id: string | null;
  team_name: string | null;
  status: "active" | "champion" | "eliminated" | "abandoned";
  current_round: number | null;
  created_at: string;
  completed_at: string | null;
};

type CountRow = {
  eventName: string;
  total: number;
};

type RecentEventRow = {
  row: EventRow;
  duplicateCount: number;
};

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type LoadError = { message: string } | null;

const ADMIN_EVENTS_PAGE_SIZE = 1000;
const ADMIN_EVENTS_MAX_ROWS = 100000;

const EVENT_LABELS: Record<string, string> = {
  lineup_created: "팀 생성",
  lineup_published: "출전 등록",
  lineup_withdrawn: "출전 준비 전환",
  match_started: "매치 시작",
  match_completed: "매치 완료",
  prediction_submitted: "승부 예측 제출",
  prediction_correct: "승부 예측 적중",
  ai_prediction_viewed: "AI 예측 조회",
  sim1000_viewed: "1000판 시뮬 조회",
  quiz_started: "퀴즈 시작",
  quiz_completed: "퀴즈 완료",
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

function actorKey(row: EventRow): string {
  return row.user_id ?? row.anonymous_id ?? "-";
}

function metricDedupeKey(row: EventRow): string | null {
  if (row.event_name !== "ai_prediction_viewed") return null;
  const gameDate = row.properties?.gameDate;
  if (!gameDate) return null;
  return [row.event_name, actorKey(row), String(gameDate)].join("|");
}

function dedupeMetricRows(rows: EventRow[]): EventRow[] {
  const seen = new Set<string>();
  const result: EventRow[] = [];

  for (const row of rows) {
    const key = metricDedupeKey(row);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(row);
  }

  return result;
}

function eventLogKey(row: EventRow): string {
  return [
    row.event_name,
    row.pathname ?? "-",
    actorKey(row),
    JSON.stringify(row.properties ?? {})
  ].join("|");
}

function compactRecentEvents(rows: EventRow[], max: number): RecentEventRow[] {
  const grouped = new Map<string, RecentEventRow>();

  for (const row of rows) {
    const key = eventLogKey(row);
    const existing = grouped.get(key);
    if (existing) {
      existing.duplicateCount += 1;
    } else if (grouped.size < max) {
      grouped.set(key, { row, duplicateCount: 1 });
    }
  }

  return Array.from(grouped.values());
}

function eventCount(rows: EventRow[], eventName: string): number {
  return rows.filter((row) => row.event_name === eventName).length;
}

function uniqueActorCount(rows: EventRow[], eventName?: string): number {
  return new Set(
    rows
      .filter((row) => !eventName || row.event_name === eventName)
      .map((row) => row.user_id ?? row.anonymous_id)
      .filter(Boolean)
  ).size;
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

function numberProperty(row: EventRow, key: string): number | null {
  const value = row.properties?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function averageQuizScore(rows: EventRow[]): string {
  const completed = rows.filter((row) => row.event_name === "quiz_completed");
  if (completed.length === 0) return "-";

  let scoreSum = 0;
  let totalSum = 0;
  for (const row of completed) {
    scoreSum += numberProperty(row, "score") ?? 0;
    totalSum += numberProperty(row, "total") ?? 0;
  }
  if (totalSum <= 0) return "-";
  return `${scoreSum.toFixed(1)} / ${totalSum.toFixed(1)} (${Math.round((scoreSum / totalSum) * 100)}%)`;
}

function playoffReached(row: PlayoffRunRow): number {
  if (row.status === "champion") return 5;
  return Math.max(0, row.current_round ?? 0);
}

function playoffReachLabel(value: number): string {
  if (value >= 5) return "우승";
  if (value === 4) return "한국시리즈";
  if (value === 3) return "플레이오프";
  if (value === 2) return "준플레이오프";
  if (value === 1) return "와일드카드";
  return "-";
}

function countPlayoffByReach(rows: PlayoffRunRow[], reach: number): number {
  return rows.filter((row) => playoffReached(row) === reach).length;
}

async function fetchEventRowsSince(
  client: AdminClient,
  sinceISO: string
): Promise<{ rows: EventRow[]; error: LoadError; truncated: boolean }> {
  const rows: EventRow[] = [];

  for (let from = 0; from < ADMIN_EVENTS_MAX_ROWS; from += ADMIN_EVENTS_PAGE_SIZE) {
    const { data, error } = await client
      .from("bp_events")
      .select("event_name, properties, pathname, user_id, anonymous_id, created_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .range(from, from + ADMIN_EVENTS_PAGE_SIZE - 1);

    if (error) return { rows, error, truncated: false };

    const batch = (data ?? []) as EventRow[];
    rows.push(...batch);
    if (batch.length < ADMIN_EVENTS_PAGE_SIZE) return { rows, error: null, truncated: false };
  }

  return { rows, error: null, truncated: true };
}

async function fetchPlayoffRowsSince(
  client: AdminClient,
  sinceISO: string
): Promise<{ rows: PlayoffRunRow[]; error: LoadError; truncated: boolean }> {
  const rows: PlayoffRunRow[] = [];

  for (let from = 0; from < ADMIN_EVENTS_MAX_ROWS; from += ADMIN_EVENTS_PAGE_SIZE) {
    const { data, error } = await client
      .from("bp_playoff_runs")
      .select("id, user_id, team_id, team_name, status, current_round, created_at, completed_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .range(from, from + ADMIN_EVENTS_PAGE_SIZE - 1);

    if (error) return { rows, error, truncated: false };

    const batch = (data ?? []) as PlayoffRunRow[];
    rows.push(...batch);
    if (batch.length < ADMIN_EVENTS_PAGE_SIZE) return { rows, error: null, truncated: false };
  }

  return { rows, error: null, truncated: true };
}

export default async function AdminEventsPage() {
  noStore();

  const serverClient = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(serverClient, identity);
  if (tier !== "admin") notFound();
  const userId = identity.userId;
  if (!userId) notFound();
  const myBpBalance = await getPointBalance(userId);

  const adminClient = createSupabaseAdminClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24hMs = now - 24 * 60 * 60 * 1000;

  const [eventResult, playoffResult] = await Promise.all([
    fetchEventRowsSince(adminClient, since7d),
    fetchPlayoffRowsSince(adminClient, since7d)
  ]);

  const rows = eventResult.rows.filter((row) => row.event_name && row.created_at);
  const metricRows = dedupeMetricRows(rows);
  const rows24h = metricRows.filter((row) => new Date(row.created_at).getTime() >= since24hMs);
  const counts24h = countByEvent(rows24h);
  const counts7d = countByEvent(metricRows);
  const recentRows = compactRecentEvents(metricRows, 50);

  const playoffRows = playoffResult.rows.filter((row) => row.id && row.created_at);
  const playoffRows24h = playoffRows.filter((row) => new Date(row.created_at).getTime() >= since24hMs);
  const recentPlayoffRows = playoffRows.slice(0, 8);

  const started24h = eventCount(rows24h, "match_started");
  const completed24h = eventCount(rows24h, "match_completed");
  const lineupCreated24h = eventCount(rows24h, "lineup_created");
  const lineupPublished24h = eventCount(rows24h, "lineup_published");
  const predictionSubmitted24h = eventCount(rows24h, "prediction_submitted");
  const aiViewed24h = eventCount(rows24h, "ai_prediction_viewed");

  const quizStarted24h = eventCount(rows24h, "quiz_started");
  const quizCompleted24h = eventCount(rows24h, "quiz_completed");
  const quizStarted7d = eventCount(rows, "quiz_started");
  const quizCompleted7d = eventCount(rows, "quiz_completed");
  const quizUsers7d = uniqueActorCount(rows, "quiz_started");

  const playoffUsers7d = new Set(playoffRows.map((row) => row.user_id).filter(Boolean)).size;
  const playoffChampion7d = playoffRows.filter((row) => row.status === "champion").length;
  const playoffActive7d = playoffRows.filter((row) => row.status === "active").length;
  const playoffBestReach7d = playoffRows.reduce((best, row) => Math.max(best, playoffReached(row)), 0);

  const uniqueVisitors24h = uniqueActorCount(rows24h);
  const uniqueVisitors7d = uniqueActorCount(metricRows);

  return (
    <AppShell activeTab="my" title="이벤트 통계" theme="light" backHref="/" wide>
      <section className="admin-events-hero">
        <div>
          <span className="admin-events-kicker">운영자 전용</span>
          <h1>제품 행동 이벤트</h1>
          <p>최근 7일 기준으로 BallPlay 핵심 행동과 신규 콘텐츠 이용을 집계합니다.</p>
        </div>
        <Activity size={34} aria-hidden />
      </section>

      <AdminBpAdjustPanel initialBalance={myBpBalance} />

      {eventResult.error ? (
        <section className="admin-events-error">
          이벤트를 불러오지 못했습니다: {eventResult.error.message}
        </section>
      ) : null}

      {eventResult.truncated ? (
        <section className="admin-events-error">
          이벤트가 많아 최근 {ADMIN_EVENTS_MAX_ROWS.toLocaleString()}건까지만 집계했습니다.
        </section>
      ) : null}

      {playoffResult.error ? (
        <section className="admin-events-error">
          가을야구 통계를 불러오지 못했습니다: {playoffResult.error.message}
        </section>
      ) : null}

      {playoffResult.truncated ? (
        <section className="admin-events-error">
          가을야구 도전이 많아 최근 {ADMIN_EVENTS_MAX_ROWS.toLocaleString()}건까지만 집계했습니다.
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
          <strong>{metricRows.length.toLocaleString()}건</strong>
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
          <span>출전 등록</span>
          <strong>{lineupPublished24h.toLocaleString()}건</strong>
          <small>팀 생성 {lineupCreated24h.toLocaleString()}건</small>
        </article>
        <article>
          <Trophy size={16} aria-hidden />
          <span>가을야구 7일</span>
          <strong>{playoffRows.length.toLocaleString()}회</strong>
          <small>{playoffUsers7d.toLocaleString()}명 도전</small>
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
            <span>팀 생성 / 출전 등록</span>
            <strong>{lineupCreated24h.toLocaleString()} / {lineupPublished24h.toLocaleString()}</strong>
          </div>
          <div>
            <span>AI 예측 조회</span>
            <strong>{aiViewed24h.toLocaleString()}건</strong>
          </div>
          <div>
            <span>승부 예측 제출</span>
            <strong>{predictionSubmitted24h.toLocaleString()}건</strong>
          </div>
        </div>
      </section>

      <section className="admin-events-grid">
        <div className="admin-events-panel">
          <header>
            <h2>야구 퀴즈</h2>
            <span>최근 7일</span>
          </header>
          <div className="admin-events-conversion-list">
            <div>
              <span>시작</span>
              <strong>{quizStarted7d.toLocaleString()}회</strong>
            </div>
            <div>
              <span>완료</span>
              <strong>{quizCompleted7d.toLocaleString()}회</strong>
            </div>
            <div>
              <span>완료율</span>
              <strong>{formatPercent(quizCompleted7d, quizStarted7d)}</strong>
            </div>
            <div>
              <span>참여자</span>
              <strong>{quizUsers7d.toLocaleString()}명</strong>
            </div>
            <div>
              <span>평균 점수</span>
              <strong>{averageQuizScore(rows)}</strong>
            </div>
            <div>
              <span>24시간 시작/완료</span>
              <strong>{quizStarted24h.toLocaleString()} / {quizCompleted24h.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div className="admin-events-panel">
          <header>
            <h2>가을야구</h2>
            <span>최근 7일</span>
          </header>
          <div className="admin-events-conversion-list">
            <div>
              <span>도전</span>
              <strong>{playoffRows.length.toLocaleString()}회</strong>
            </div>
            <div>
              <span>참여자</span>
              <strong>{playoffUsers7d.toLocaleString()}명</strong>
            </div>
            <div>
              <span>24시간 도전</span>
              <strong>{playoffRows24h.length.toLocaleString()}회</strong>
            </div>
            <div>
              <span>진행 중</span>
              <strong>{playoffActive7d.toLocaleString()}회</strong>
            </div>
            <div>
              <span>우승</span>
              <strong>{playoffChampion7d.toLocaleString()}회</strong>
            </div>
            <div>
              <span>최고 도달</span>
              <strong>{playoffReachLabel(playoffBestReach7d)}</strong>
            </div>
          </div>
          <div className="admin-events-reach-list">
            {[5, 4, 3, 2, 1].map((reach) => (
              <div key={reach}>
                <span>{playoffReachLabel(reach)}</span>
                <strong>{countPlayoffByReach(playoffRows, reach).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-events-panel">
        <header>
          <h2>최근 가을야구 도전</h2>
          <span>최대 8건</span>
        </header>
        <div className="admin-events-log">
          {recentPlayoffRows.length > 0 ? recentPlayoffRows.map((row) => (
            <article key={row.id}>
              <div className="admin-events-log-main">
                <strong>{row.team_name ?? row.team_id ?? "-"}</strong>
                <span>{row.status} · 최고 {playoffReachLabel(playoffReached(row))}</span>
              </div>
              <div className="admin-events-log-meta">
                <span>{row.user_id ?? "-"}</span>
                <time>{formatDateTime(row.created_at)}</time>
              </div>
            </article>
          )) : <p className="admin-events-empty">최근 가을야구 도전이 없습니다.</p>}
        </div>
      </section>

      <section className="admin-events-panel">
        <header>
          <h2>최근 이벤트 로그</h2>
          <span>중복 묶음 최대 50건</span>
        </header>
        <div className="admin-events-log">
          {recentRows.length > 0 ? recentRows.map(({ row, duplicateCount }, index) => (
            <article key={`${row.created_at}-${row.event_name}-${index}`}>
              <div className="admin-events-log-main">
                <strong>
                  {labelEvent(row.event_name)}
                  {duplicateCount > 1 ? ` x${duplicateCount}` : ""}
                </strong>
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
