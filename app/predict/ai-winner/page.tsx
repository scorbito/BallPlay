import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getAiOverallStats,
  getAiByProviderStats,
  listAiPredictionsForDate,
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

/** 해당 날짜의 09:00 KST → ISO. AI publish 시점 + 카운트다운 기준. */
function publishAtISO(dateISO: string): string {
  return `${dateISO}T09:00:00+09:00`;
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
  // ?date=YYYY-MM-DD 형식이면 그 날짜, 아니면 오늘로 폴백
  const requested = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : today;
  const selectedDate = requested;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const prevDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);

  const supabase = createSupabaseServerClient();

  // 운영자(admin) 는 09시 공개 전이라도 예측을 미리 볼 수 있어야 함 (컨텐츠 영상 제작용).
  // RLS 가 published_at <= now() 만 노출하므로 service_role 클라이언트로 우회 fetch.
  // 일반 유저는 그대로 RLS 적용.
  const userTier = await getUserTier(supabase);
  const isAdmin = userTier.tier === "admin";
  const predictionsClient = isAdmin ? createSupabaseAdminClient() : supabase;

  // 선택 날짜의 경기 + 예측 + 시즌 통계 병렬
  const [games, predictionsResult, overallResult, providerResult] = await Promise.all([
    listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []),
    listAiPredictionsForDate(predictionsClient, selectedDate),
    getAiOverallStats(supabase),
    getAiByProviderStats(supabase)
  ]);

  // 경기별 예측 매핑
  const predictionsByGameId = new Map<string, BpAiPredictionRow[]>();
  if (predictionsResult.ok) {
    for (const row of predictionsResult.rows) {
      const list = predictionsByGameId.get(row.game_id) ?? [];
      list.push(row);
      predictionsByGameId.set(row.game_id, list);
    }
  }

  const gameCards: AiWinnerGame[] = games.map((g) => ({
    id: g.id,
    gameTime: g.time ?? null,
    stadium: g.stadium,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    status: g.status,
    predictions: predictionsByGameId.get(g.id) ?? []
  }));

  // 경기 없는 날 — 다음 경기 날짜 찾기 (다음 7일 내 첫 경기일). 과거 날짜에선 미사용.
  let nextGameDate: string | null = null;
  if (gameCards.length === 0 && isToday) {
    for (let i = 1; i <= 7; i += 1) {
      const d = addDays(today, i);
      const rows = await listGamesFromDb({ from: d, to: d }).catch(() => []);
      if (rows.length > 0) {
        nextGameDate = d;
        break;
      }
    }
  }

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
      publishAtISO={publishAtISO(selectedDate)}
      games={gameCards}
      nextGameDate={nextGameDate}
      overallStats={overallResult.ok ? overallResult.stats : { total_count: 0, correct_count: 0, accuracy: null }}
      providerStats={providerResult.ok ? providerResult.rows : []}
      isAdmin={isAdmin}
    />
  );
}
