import { RankingScreen } from "@/components/domain/RankingScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
  PREDICTION_RANKING_MIN_GAMES,
  getPredictionRanking,
  getWeeklyPredictionRanking,
  type PredictionRankingRow
} from "@/lib/supabase/query-parts/bpPredictions";
import { getAiByProviderStats } from "@/lib/supabase/query-parts/bpAiPredictions";

const AI_LABEL: Record<string, string> = { gpt: "GPT", gemini: "Gemini", claude: "Claude" };

export const dynamic = "force-dynamic";

// KBO 주간(화요일 시작) — 오늘이 속한 주의 화요일 ISO. 월요일이면 직전 주 화요일.
function kstWeekStartTuesday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = kst.getDay(); // 0=일 .. 6=토
  const daysSinceTue = (dow - 2 + 7) % 7;
  kst.setDate(kst.getDate() - daysSinceTue);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function PredictionRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 적중률 랭킹은 누구나 열람 가능(보기 무료). 비로그인은 본인 행 하이라이트만 없음.

  const weekStart = kstWeekStartTuesday();

  // 주간(화~일, 우선 노출) + 전체(시즌) + 이번 주 AI별 적중률.
  const [weeklyResult, seasonResult, aiResult] = await Promise.all([
    getWeeklyPredictionRanking(supabase, {
      weekStartISO: weekStart,
      minGames: PREDICTION_RANKING_MIN_GAMES,
      limit: 20
    }),
    getPredictionRanking(supabase, {
      period: "season",
      minGames: PREDICTION_RANKING_MIN_GAMES,
      activeWithinDays: PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
      limit: 20
    }),
    getAiByProviderStats(createSupabaseAdminClient(), weekStart)
  ]);

  // 주간 랭킹에 3개 AI를 각각 기준 행으로 끼워 넣어 적중률순으로 정렬.
  const weeklyUsers = weeklyResult.ok ? weeklyResult.rows : [];
  const aiRows: PredictionRankingRow[] = aiResult.ok
    ? aiResult.rows
        .filter((r) => r.accuracy !== null && r.total_count > 0)
        .map((r) => ({
          rank: 0,
          user_id: `__ai_${r.ai_provider}__`,
          nickname: AI_LABEL[r.ai_provider] ?? r.ai_provider,
          main_team_id: null,
          avatar_image_url: null,
          total: r.total_count,
          correct: r.correct_count,
          rate: (r.accuracy ?? 0) / 100,
          isAi: true,
          aiProvider: r.ai_provider
        }))
    : [];

  const weeklyRanking = [...weeklyUsers, ...aiRows]
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return (
    <RankingScreen
      currentUserId={user?.id ?? null}
      weeklyRanking={weeklyRanking}
      seasonRanking={seasonResult.ok ? seasonResult.rows : []}
    />
  );
}
