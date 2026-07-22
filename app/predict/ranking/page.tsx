import { RankingScreen } from "@/components/domain/RankingScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
  PREDICTION_RANKING_MIN_GAMES,
  PREDICTION_RANKING_SEASON_MIN_GAMES,
  getPredictionRanking,
  getWeeklyPredictionRanking,
  type PredictionRankingRow
} from "@/lib/supabase/query-parts/bpPredictions";
import { getAiByProviderStats } from "@/lib/supabase/query-parts/bpAiPredictions";

const AI_LABEL: Record<string, string> = { gpt: "GPT", gemini: "Gemini", claude: "Claude" };

/** 인원 제한 없음. Postgres int 최대값 — RPC p_limit이 int라 이 값을 넘기면 out of range. */
const NO_LIMIT = 2147483647;

export const dynamic = "force-dynamic";

// KBO prediction week starts on Tuesday and shows the current in-progress week.
function kstWeekStartTuesday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = kst.getDay(); // 0=Sun .. 6=Sat
  const daysSinceTue = (dow - 2 + 7) % 7;
  kst.setDate(kst.getDate() - daysSinceTue);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function PredictionRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 적중률 랭킹은 누구나 열람 가능(보기 무료). 비로그인은 본인 행 하이라이트만 없음.

  const weekStart = kstWeekStartTuesday();
  const adminClient = createSupabaseAdminClient();

  // 주간(화~일, 우선 노출) + 전체(시즌) + 이번 주 AI별 적중률.
  const [weeklyResult, seasonResult, aiResult] = await Promise.all([
    // 주간은 매주 리셋되고 이벤트 대상이라 전원 노출 — 자기 순위를 항상 확인할 수 있게.
    getWeeklyPredictionRanking(adminClient, {
      weekStartISO: weekStart,
      minGames: PREDICTION_RANKING_MIN_GAMES,
      limit: NO_LIMIT
    }),
    // 전체(시즌) 랭킹은 표본 하한을 높이고 최근 활동자만 — 유령 계정 상위권 점유 방지.
    // 인원 제한 없음: RPC가 limit과 무관하게 이미 전원 집계·정렬하므로 부하 차이가 없고,
    // 위 필터로 목록이 이미 걸러져 있어 다 보여줘도 지저분해지지 않는다.
    getPredictionRanking(supabase, {
      period: "season",
      minGames: PREDICTION_RANKING_SEASON_MIN_GAMES,
      activeWithinDays: PREDICTION_RANKING_ACTIVE_WITHIN_DAYS,
      // RPC의 p_limit은 Postgres int → MAX_SAFE_INTEGER를 넘기면 out of range 에러.
      limit: NO_LIMIT
    }),
    getAiByProviderStats(adminClient, weekStart)
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
    // 적중률 동률이면 AI를 위로(벤치마크 강조) → 그 다음 경기수 많은 순.
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        (a.isAi === b.isAi ? 0 : a.isAi ? -1 : 1) ||
        b.total - a.total
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return (
    <RankingScreen
      currentUserId={user?.id ?? null}
      weeklyRanking={weeklyRanking}
      seasonRanking={seasonResult.ok ? seasonResult.rows : []}
    />
  );
}
