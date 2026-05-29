import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  getAiOverallStats,
  getAiByProviderStats,
  listAiPredictionsForDate,
  type BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import { AiWinnerListScreen, type AiWinnerGame } from "@/components/domain/AiWinnerListScreen";

export const dynamic = "force-dynamic";

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 오늘 09:00 KST → ISO. AI publish 시점 계산용. 클라이언트가 countdown 으로 사용. */
function todayPublishAtISO(dateISO: string): string {
  // dateISO 의 09:00 KST = (해당 날짜 00시 UTC + 0시간) 의 09:00 — 그냥 ISO 로 박는다.
  return `${dateISO}T09:00:00+09:00`;
}

export default async function AiWinnerPredictPage() {
  const today = kstToday();
  const supabase = createSupabaseServerClient();

  // 오늘 경기 + 오늘자 AI 예측 + 시즌 통계를 병렬로
  const [games, predictionsResult, overallResult, providerResult] = await Promise.all([
    listGamesFromDb({ from: today, to: today }).catch(() => []),
    listAiPredictionsForDate(supabase, today),
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

  // 경기 없는 날 — 다음 경기 날짜 찾기 (다음 7일 내 첫 경기일)
  let nextGameDate: string | null = null;
  if (gameCards.length === 0) {
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
      today={today}
      publishAtISO={todayPublishAtISO(today)}
      games={gameCards}
      nextGameDate={nextGameDate}
      overallStats={overallResult.ok ? overallResult.stats : { total_count: 0, correct_count: 0, accuracy: null }}
      providerStats={providerResult.ok ? providerResult.rows : []}
    />
  );
}
