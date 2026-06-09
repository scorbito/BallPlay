import { listGamesFromDb } from "@/lib/supabase/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AiBattleListScreen } from "@/components/domain/AiBattleListScreen";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

export default async function AiBattleListPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const today = kstToday();
  const selectedDate = searchParams.date && DATE_RE.test(searchParams.date) ? searchParams.date : today;

  // DB에서 해당 날짜의 KBO 경기 목록 조회
  const rawGames = await listGamesFromDb({ from: selectedDate, to: selectedDate }).catch(() => []);

  // 예측 데이터가 존재하는 game_id 목록 조회
  const gameIds = rawGames.map((g) => g.id);
  let predictedGameIds = new Set<string>();
  if (gameIds.length > 0) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("bp_ai_battle_predictions")
      .select("game_id")
      .in("game_id", gameIds);
    predictedGameIds = new Set((data ?? []).map((r) => r.game_id));
  }

  const games = rawGames.map((g) => ({
    id: g.id,
    gameDate: g.date,
    gameTime: g.time ?? null,
    stadium: g.stadium,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    status: g.status,
    homeStarter: g.homeStarter ?? null,
    awayStarter: g.awayStarter ?? null,
    hasPrediction: predictedGameIds.has(g.id)
  }));

  // 클라이언트의 날짜 업데이트 동작
  const handleDateChange = async (dateStr: string) => {
    "use server";
    redirect(`/predict/battle?date=${dateStr}`);
  };

  return (
    <AiBattleListScreen
      games={games}
      selectedDate={selectedDate}
      onDateChange={handleDateChange}
    />
  );
}
