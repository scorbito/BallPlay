import { ScheduleScreen } from "@/components/domain/ScheduleScreen";
import { listGamesFromDb } from "@/lib/supabase/queries";
import type { Game } from "@/lib/types/domain";

export const revalidate = 300;

function toDotDate(date: string) {
  return date.replaceAll("-", ".");
}

function toDomainGame(game: Awaited<ReturnType<typeof listGamesFromDb>>[number]): Game {
  return {
    id: game.id,
    date: toDotDate(game.date),
    time: game.time ?? "",
    stadium: game.stadium,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    status: game.status === "finished" || game.status === "canceled" ? game.status : "scheduled"
  };
}

export default async function SchedulePage() {
  // KBO 정규시즌 전체 + 시범경기/포스트시즌까지 커버 (2~12월)
  const today = new Date();
  const year = today.getFullYear();
  const start = new Date(year, 1, 1);
  const end = new Date(year, 11, 31);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const games = await listGamesFromDb({ from: fmt(start), to: fmt(end) })
    .then((items) => items.map(toDomainGame))
    .catch(() => []);

  return <ScheduleScreen games={games} />;
}
