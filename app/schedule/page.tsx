import type { Metadata } from "next";
import { ScheduleScreen } from "@/components/domain/ScheduleScreen";
import { listGamesFromDb } from "@/lib/supabase/queries";
import type { Game } from "@/lib/types/domain";

export const metadata: Metadata = {
  title: "경기 일정",
  description: "오늘의 KBO 프로야구 경기 일정과 결과를 한눈에 확인하세요.",
  alternates: { canonical: "/schedule" }
};

// ISR 24시간 — 시즌 일정은 거의 정적이라 길게 캐싱.
// 새 결과/일정 변동은 두 경로로 즉시 무효화됨:
//   1. cron(/api/cron/sync-kbo-games) sync 후 revalidatePath('/schedule')
//   2. 사용자 갱신 버튼 클릭 시 refreshTodayGamesAction에서 revalidatePath('/schedule')
// 이 둘 덕분에 캐시 만료 전에도 데이터 변경되면 다음 요청에 즉시 반영됨.
export const revalidate = 86400;

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
