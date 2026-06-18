import { unstable_cache } from "next/cache";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getAiOverallStats,
  getAiByProviderStats,
  listAiPredictionResultsForDate,
  type BpAiPredictionResultRow,
  type BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import { listAiWeeklySeriesForWeek } from "@/lib/supabase/query-parts/bpAiWeeklySeriesPredictions";
import { AiWinnerListScreen, type AiWinnerGame } from "@/components/domain/AiWinnerListScreen";
import type { SupabaseClient } from "@supabase/supabase-js";

// AI 예측 리스트 — 정적/ISR 캐시 대상. 날짜는 URL(쿼리 X, 경로 O)로 받아 라우트별 캐시.
// 운영자 발행 전 미리보기는 제거(캐시 위해) — 발행 게이트(predictionsPublished)는 유지.
export const AI_WINNER_REVALIDATE = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string | undefined | null): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isMonday(dateISO: string): boolean {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

function listMondaysBetween(fromISO: string, toISO: string): string[] {
  const dates: string[] = [];
  let cursor = fromISO;
  while (cursor <= toISO) {
    if (isMonday(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function pickPrevDate(selectedDate: string, gameDates: string[]): string | null {
  const candidates = new Set<string>([
    ...gameDates,
    ...listMondaysBetween(addDays(selectedDate, -14), addDays(selectedDate, -1))
  ]);
  const sorted = Array.from(candidates).filter((date) => date < selectedDate).sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function pickNextDate(selectedDate: string, gameDates: string[]): string | null {
  const candidates = new Set<string>([
    ...gameDates,
    ...listMondaysBetween(addDays(selectedDate, 1), addDays(selectedDate, 14))
  ]);
  const sorted = Array.from(candidates).filter((date) => date > selectedDate).sort();
  return sorted[0] ?? null;
}

async function getLatestAiWinnerContentDate(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("bp_ai_predictions")
    .select("game_date")
    .order("game_date", { ascending: false })
    .limit(1);
  if (error) return null;
  return typeof data?.[0]?.game_date === "string" ? data[0].game_date : null;
}

// 적중률 통계는 RPC(POST)라 정적 생성에서 동적을 유발할 수 있어 unstable_cache 로 결과를 캐시한다.
const getCachedAiStats = unstable_cache(
  async () => {
    const client = createSupabaseCacheClient(AI_WINNER_REVALIDATE);
    const [overall, provider] = await Promise.all([
      getAiOverallStats(client),
      getAiByProviderStats(client)
    ]);
    return {
      overallStats: overall.ok ? overall.stats : { total_count: 0, correct_count: 0, accuracy: null },
      providerStats: provider.ok ? provider.rows : []
    };
  },
  ["ai-winner-overall-stats"],
  { revalidate: AI_WINNER_REVALIDATE, tags: ["ai-winner-stats"] }
);

/** AI 예측 리스트 화면 — explicitDate 가 있으면 그 날짜, 없으면 최신/오늘 기준. */
export async function renderAiWinnerList(explicitDateParam: string | null) {
  const today = kstToday();
  const explicitDate = isValidDate(explicitDateParam) ? explicitDateParam : null;

  const supabase = createSupabaseCacheClient(AI_WINNER_REVALIDATE);

  const latestContentDate = explicitDate ? null : await getLatestAiWinnerContentDate(supabase);

  let selectedDate = explicitDate ?? latestContentDate ?? today;
  let gamesForDate = await listGamesFromDb({ from: selectedDate, to: selectedDate }, supabase).catch(() => []);
  const shouldShowWeeklyPreview = isMonday(selectedDate) && gamesForDate.length === 0;

  // 기본 진입(날짜 미지정)인데 경기 없음 → 14일 lookahead 중 가장 이른 경기일로 자동 이동.
  if (!explicitDate && gamesForDate.length === 0 && !shouldShowWeeklyPreview) {
    const lookahead = await listGamesFromDb({ from: addDays(today, 1), to: addDays(today, 14) }, supabase).catch(() => []);
    if (lookahead.length > 0) {
      selectedDate = lookahead[0].date;
      gamesForDate = lookahead.filter((g) => g.date === selectedDate);
    }
  }

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const [prevLookback, nextLookahead] = await Promise.all([
    listGamesFromDb({ from: addDays(selectedDate, -14), to: addDays(selectedDate, -1) }, supabase).catch(() => []),
    listGamesFromDb({ from: addDays(selectedDate, 1), to: addDays(selectedDate, 14) }, supabase).catch(() => [])
  ]);
  const prevDate = pickPrevDate(selectedDate, prevLookback.map((g) => g.date));
  const nextDate = pickNextDate(selectedDate, nextLookahead.map((g) => g.date));

  const weeklySeriesResult = shouldShowWeeklyPreview
    ? await listAiWeeklySeriesForWeek(supabase, selectedDate)
    : { ok: true as const, rows: [] };

  const [predictionsResult, stats] = await Promise.all([
    listAiPredictionResultsForDate(supabase, selectedDate),
    getCachedAiStats()
  ]);

  const predictionsByGameId = new Map<string, BpAiPredictionResultRow[]>();
  if (predictionsResult.ok) {
    for (const row of predictionsResult.rows) {
      const list = predictionsByGameId.get(row.game_id) ?? [];
      list.push(row);
      predictionsByGameId.set(row.game_id, list);
    }
  }

  // 공개 게이트: 그 날의 모든 경기가 3개 AI 예측을 다 갖추면 공개. (운영자 발행 전 미리보기 없음)
  const AI_PROVIDER_COUNT = 3;
  const predictionsPublished =
    gamesForDate.length > 0 &&
    gamesForDate.every((g) => {
      const ps = predictionsByGameId.get(g.id) ?? [];
      return new Set(ps.map((p) => p.ai_provider)).size >= AI_PROVIDER_COUNT;
    });

  const gameCards: AiWinnerGame[] = gamesForDate.map((g) => {
    const rawPredictions = predictionsByGameId.get(g.id) ?? [];
    const visiblePredictions = predictionsPublished ? rawPredictions : [];
    const enriched: BpAiPredictionRow[] = visiblePredictions.map((p) => ({
      id: p.id,
      game_id: p.game_id,
      game_date: p.game_date,
      ai_provider: p.ai_provider,
      model_name: p.model_name,
      predicted_winner_team_id: p.predicted_winner_team_id,
      confidence: p.confidence,
      key_factor: p.key_factor,
      one_liner: p.one_liner,
      detailed_analysis: p.detailed_analysis,
      published_at: p.published_at,
      is_correct: p.is_correct_live
    }));

    return {
      id: g.id,
      gameTime: g.time ?? null,
      stadium: g.stadium,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeStarter: g.homeStarter ?? null,
      awayStarter: g.awayStarter ?? null,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      status: g.status,
      predictions: enriched
    };
  });

  return (
    <AiWinnerListScreen
      key={selectedDate}
      today={today}
      selectedDate={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      prevDate={prevDate}
      nextDate={nextDate}
      published={predictionsPublished}
      showWeeklyPreview={shouldShowWeeklyPreview}
      weeklySeries={weeklySeriesResult.ok ? weeklySeriesResult.rows : []}
      games={gameCards}
      nextGameDate={nextDate}
      overallStats={stats.overallStats}
      providerStats={stats.providerStats}
      locked={false}
    />
  );
}

/** generateStaticParams 용 — 예측이 있는 최근 날짜들. */
export async function recentAiWinnerDates(limit = 30): Promise<string[]> {
  const client = createSupabaseCacheClient(AI_WINNER_REVALIDATE);
  const { data, error } = await client
    .from("bp_ai_predictions")
    .select("game_date")
    .order("game_date", { ascending: false })
    .limit(400);
  if (error || !data) return [];
  const seen = new Set<string>();
  for (const row of data as Array<{ game_date: string }>) {
    if (typeof row.game_date === "string") seen.add(row.game_date);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}
