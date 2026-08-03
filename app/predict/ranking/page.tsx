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
import { listEventDraws, buildHallOfFame, type EventDraw } from "@/lib/server/predict/weeklyContest";

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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PredictionRankingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // 적중률 랭킹은 누구나 열람 가능(보기 무료). 비로그인은 본인 행 하이라이트만 없음.

  const weekStart = kstWeekStartTuesday();
  const weekEnd = addDays(weekStart, 5); // 화 + 5 = 일
  const adminClient = createSupabaseAdminClient();

  // 이번 주 경기(취소 제외)로 예측왕 "자격 기준선" 계산.
  //   자격선 = 최종 자격 경기수(ceil(주간경기 × 2/3)) − 아직 안 끝난 경기 수.
  //   = "지금까지 예측 + 남은 경기 다 예측해도 최종 기준에 못 미치면 자격 불가"의 경계.
  //   예) 30경기·최종 20, 토요일(일요일 5경기 남음) → 20 − 5 = 15경기.
  const { data: weekGameRows } = await adminClient
    .from("games")
    .select("status")
    .gte("game_date", weekStart)
    .lte("game_date", weekEnd)
    .neq("status", "canceled");
  const scheduledCount = weekGameRows?.length ?? 0;
  const remainingCount = (weekGameRows ?? []).filter((g) => g.status !== "finished").length;
  const weeklyThreshold = scheduledCount > 0 ? Math.max(1, Math.ceil((scheduledCount * 2) / 3)) : 0;
  const weeklyQualifyBar = Math.max(0, weeklyThreshold - remainingCount);

  // 주간(화~일, 우선 노출) + 전체(시즌) + 이번 주 AI별 적중률 + 역대 예측왕.
  const [weeklyResult, seasonResult, aiResult, draws] = await Promise.all([
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
    getAiByProviderStats(adminClient, weekStart),
    // 명예의 전당 탭 — 마감된 주의 예측왕 기록. 실패해도 랭킹은 그대로 보여준다.
    listEventDraws(adminClient).catch(() => [] as EventDraw[])
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

  // 적중률 동률이면 AI를 위로(벤치마크 강조) → 그 다음 경기수 많은 순.
  const byRate = (a: PredictionRankingRow, b: PredictionRankingRow) =>
    b.rate - a.rate ||
    (a.isAi === b.isAi ? 0 : a.isAi ? -1 : 1) ||
    b.total - a.total;

  // 예측왕 자격 가능자(AI 포함)를 위로, 자격선 미달자는 아래로.
  //   미달자도 목록엔 남겨 자기 순위를 확인할 수 있게 하되, 자격 가능자 하단에 배치.
  const eligible = [...weeklyUsers.filter((u) => u.total >= weeklyQualifyBar), ...aiRows].sort(byRate);
  const ineligible = weeklyUsers.filter((u) => u.total < weeklyQualifyBar).sort(byRate);
  const weeklyRanking = [...eligible, ...ineligible].map((row, index) => ({ ...row, rank: index + 1 }));

  return (
    <RankingScreen
      currentUserId={user?.id ?? null}
      weeklyRanking={weeklyRanking}
      weeklyQualifyBar={weeklyQualifyBar}
      seasonRanking={seasonResult.ok ? seasonResult.rows : []}
      hallOfFame={buildHallOfFame(draws)}
    />
  );
}
