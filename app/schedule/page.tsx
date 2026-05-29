import type { Metadata } from "next";
import { ScheduleScreen } from "@/components/domain/ScheduleScreen";
import { listGamesFromDb } from "@/lib/supabase/queries";
import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";
import type { Game } from "@/lib/types/domain";

export const metadata: Metadata = {
  title: "경기 일정",
  description: "오늘의 KBO 프로야구 경기 일정과 결과를 한눈에 확인하세요.",
  alternates: { canonical: "/schedule" }
};

// ISR 5분 — 진입 시 throttle된 sync 트리거가 새 결과를 잡으므로 짧게 캐싱.
// cron(/api/cron/sync-kbo-games)·refreshTodayGamesAction 의 revalidatePath('/schedule')
// 와 함께 작동.
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
  // 진입 시 일일 sync 트리거 (throttle). 동시 사용자가 와도 KBO 호출은 1번.
  void triggerDailyDataSync();

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
