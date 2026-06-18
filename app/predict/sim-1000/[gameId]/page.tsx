import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import {
  getSimResultByGameId,
  type BpSimResultRow
} from "@/lib/supabase/query-parts/bpSimResults";
import {
  Sim1000DetailScreen,
  type Sim1000GameInfo,
  type Sim1000LineupBatter
} from "@/components/domain/Sim1000DetailScreen";
import type { GameStatus } from "@/lib/types/api-contracts";


export const dynamic = "force-dynamic";

export default async function Sim1000DetailPage({
  params
}: {
  params: { gameId: string };
}) {
  const supabase = createSupabaseServerClient();

  // 시뮬 상세는 정식 로그인 전용. 비로그인/익명(guest)은 로그인으로 보낸다.
  // (리스트는 소프트 게이트로 매치업만 노출하지만, 상세는 곧 전체 수치라 하드 게이트.)
  // AI 예측 reveal 페이지와 동형 — userTier.tier === "guest" 기준.
  const userTier = await getUserTierByIdentity(supabase, getRequestIdentity());
  if (userTier.tier === "guest") {
    redirect(`/login?next=${encodeURIComponent(`/predict/sim-1000/${params.gameId}`)}`);
  }

  type GameRow = {
    id: string;
    game_date: string;
    game_time: string | null;
    stadium: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    status: GameStatus;
  };

  const [simResult, gameRes] = await Promise.all([
    getSimResultByGameId(supabase, params.gameId),
    supabase
      .from("games")
      .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status")
      .eq("id", params.gameId)
      .maybeSingle()
  ]);

  if (!simResult.ok || simResult.row === null) {
    // 시뮬 결과 자체가 없으면 detail 페이지에 보여줄 게 없음 → 목록으로.
    notFound();
  }

  const sim: BpSimResultRow = simResult.row;
  const gameRow = gameRes.data as GameRow | null;

  // 시뮬에 쓰인 타순 라인업 — bp_sim_results.lineup_source_* 가 사용된 라인업 날짜라
  // 그 날짜의 bp_team_recent_lineups 를 다시 조회해 1~9번 타순을 복원 (스키마 변경 없이).
  type RecentBatter = { order: number; name: string; position: string | null };
  async function fetchLineup(teamId: string, sourceDate: string | null): Promise<Sim1000LineupBatter[] | null> {
    if (!sourceDate) return null;
    const { data } = await supabase
      .from("bp_team_recent_lineups")
      .select("batting")
      .eq("team_id", teamId)
      .eq("game_date", sourceDate)
      .maybeSingle();
    const batting = (data?.batting ?? null) as RecentBatter[] | null;
    if (!batting || batting.length === 0) return null;
    return [...batting]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((b) => ({ order: b.order, name: b.name, position: b.position }));
  }

  const [homeLineup, awayLineup] = await Promise.all([
    fetchLineup(sim.home_team_id, sim.lineup_source_home),
    fetchLineup(sim.away_team_id, sim.lineup_source_away)
  ]);

  const game: Sim1000GameInfo = {
    gameId: params.gameId,
    gameDate: sim.game_date,
    gameTime: gameRow?.game_time ?? null,
    stadium: gameRow?.stadium ?? "",
    homeTeamId: sim.home_team_id,
    awayTeamId: sim.away_team_id,
    homeStarter: sim.home_starter,
    awayStarter: sim.away_starter,
    homeScore: gameRow?.home_score ?? null,
    awayScore: gameRow?.away_score ?? null,
    status: gameRow?.status ?? "scheduled"
  };

  return (
    <Sim1000DetailScreen
      game={game}
      sim={sim}
      homeLineup={homeLineup}
      awayLineup={awayLineup}
    />
  );
}
