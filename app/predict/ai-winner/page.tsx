import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getAiOverallStats,
  getAiByProviderStats,
  listAiPredictionResultsForDate,
  type BpAiPredictionResultRow,
  type BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";
import { getUserTier } from "@/lib/auth/userTier";
import { AiWinnerListScreen, type AiWinnerGame } from "@/components/domain/AiWinnerListScreen";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  return new Date(`${dateISO}T00:00:00+09:00`).getDay() === 1;
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

export default async function AiWinnerPredictPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  // 페이지 진입 시 일일 sync 트리거 (throttle). AI 채점이 가장 중요한 페이지라
  // 결과 도착 즉시 ✓/✗ 가 보이도록.
  void triggerDailyDataSync();

  const today = kstToday();
  // ?date=YYYY-MM-DD 형식이면 그 날짜. 없으면 일단 오늘로 시도 후 경기 없으면 다음 경기일로 점프.
  const explicitDate = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : null;

  let selectedDate = explicitDate ?? today;
  let gamesForDate = await listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []);
  const shouldShowWeeklyPreview = isMonday(selectedDate) && gamesForDate.length === 0;

  // 오늘 진입인데 경기 자체가 없음 → 14일 lookahead 중 가장 이른 경기일로 자동 이동.
  // (AI 예측이 목적이라 경기 없는 날엔 미리 다음 경기일 + 카운트다운 노출.)
  if (!explicitDate && gamesForDate.length === 0 && !shouldShowWeeklyPreview) {
    const lookahead = await listGamesFromDb({
      from: addDays(today, 1),
      to: addDays(today, 14)
    }).catch(() => []);
    if (lookahead.length > 0) {
      selectedDate = lookahead[0].date;
      gamesForDate = lookahead.filter((g) => g.date === selectedDate);
    }
  }

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  // 인접 경기일 탐색 — prev/next 화살표가 경기 없는 날을 자동 스킵. ±14일 윈도우.
  const [prevLookback, nextLookahead] = await Promise.all([
    listGamesFromDb({ from: addDays(selectedDate, -14), to: addDays(selectedDate, -1) }).catch(() => []),
    listGamesFromDb({ from: addDays(selectedDate, 1), to: addDays(selectedDate, 14) }).catch(() => [])
  ]);
  const prevDate = pickPrevDate(selectedDate, prevLookback.map((g) => g.date));
  const nextDate = pickNextDate(selectedDate, nextLookahead.map((g) => g.date));

  const supabase = createSupabaseServerClient();

  // 운영자(admin) 는 시간 게이트(published_at) 만 우회 — 그 외 동작은 일반 유저와 동일.
  // service_role 클라이언트로 RLS 우회 → 발행 전 픽도 미리 봄 (영상 사전 제작용).
  const userTier = await getUserTier(supabase);
  const isAdmin = userTier.tier === "admin";
  // 소프트 게이트: 비로그인/익명(guest)은 AI 픽을 못 본다. 매치업·AI 종합 적중률(미끼)만 노출.
  // 정식 로그인(free/pro/admin)만 해제. 잠긴 사용자에겐 픽 데이터를 서버에서 비워 보내
  // 개발자도구로도 훔쳐볼 수 없게 한다.
  const locked = userTier.tier === "guest";
  // 예측은 항상 service_role 로 전부 읽고(발행 전 포함) 서버에서 "3개 AI 완료" 여부로 게이트한다.
  // (기존 09시 published_at RLS 게이트 → 3개 AI 입력 완료 시 공개로 변경.)
  const predictionsClient = createSupabaseAdminClient();

  // 예측 + 시즌 통계 병렬 (게임 데이터는 위에서 이미 확보)
  // 예측은 VIEW(bp_ai_predictions_with_result) 에서 가져옴 — 점수 입력 즉시 is_correct_live 채워짐.
  const [predictionsResult, overallResult, providerResult] = await Promise.all([
    listAiPredictionResultsForDate(predictionsClient, selectedDate),
    getAiOverallStats(supabase),
    getAiByProviderStats(supabase)
  ]);

  // 경기별 예측 매핑
  const predictionsByGameId = new Map<string, BpAiPredictionResultRow[]>();
  if (predictionsResult.ok) {
    for (const row of predictionsResult.rows) {
      const list = predictionsByGameId.get(row.game_id) ?? [];
      list.push(row);
      predictionsByGameId.set(row.game_id, list);
    }
  }

  // 공개 게이트: 그 날의 모든 경기가 3개 AI(gemini/claude/gpt) 예측을 다 갖추면 공개.
  const AI_PROVIDER_COUNT = 3;
  const predictionsPublished =
    gamesForDate.length > 0 &&
    gamesForDate.every((g) => {
      const ps = predictionsByGameId.get(g.id) ?? [];
      return new Set(ps.map((p) => p.ai_provider)).size >= AI_PROVIDER_COUNT;
    });

  const gameCards: AiWinnerGame[] = gamesForDate.map((g) => {
    // VIEW 의 is_correct_live 를 BpAiPredictionRow.is_correct 로 매핑.
    // 컴포넌트 시그니처(BpAiPredictionRow[]) 유지 위해 page 안에서 형변환.
    const rawPredictions = predictionsByGameId.get(g.id) ?? [];
    const enriched: BpAiPredictionRow[] = rawPredictions.map((p) => ({
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
      // VIEW 의 라이브 판정값을 컴포넌트가 기대하는 is_correct 자리에 채움.
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
      // guest 는 항상 가림(클라이언트로 데이터 자체가 안 감). 그 외엔 3개 AI 완료(공개) 전엔
      // 가리되, 운영자(영상 사전제작용)는 미리 본다.
      predictions: locked ? [] : predictionsPublished || isAdmin ? enriched : []
    };
  });

  // 다음 경기일 hint (auto-jump 했어도 경기 없는 날짜에 ?date= 명시 진입한 경우 표시용)
  const nextGameDate = nextDate;

  return (
    <AiWinnerListScreen
      // 날짜 바뀌면 컴포넌트 강제 재마운트 — countdown/seen 등 state 가 새 날짜 기준으로 초기화되도록
      key={selectedDate}
      today={today}
      selectedDate={selectedDate}
      isToday={isToday}
      isFuture={isFuture}
      prevDate={prevDate}
      nextDate={nextDate}
      published={predictionsPublished}
      showWeeklyPreview={shouldShowWeeklyPreview}
      games={gameCards}
      nextGameDate={nextGameDate}
      overallStats={overallResult.ok ? overallResult.stats : { total_count: 0, correct_count: 0, accuracy: null }}
      providerStats={providerResult.ok ? providerResult.rows : []}
      isAdmin={isAdmin}
      locked={locked}
    />
  );
}
