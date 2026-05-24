"use server";

// 사용자가 경기일정 페이지에서 "갱신" 버튼을 누르면 호출되는 서버 액션.
// KBO 사이트에서 오늘 경기 결과를 가져와 DB에 upsert.
//
// 호출 측 처리:
//   - 호출 후 router.refresh()로 SSR 페이지 재페치 → 새 결과 반영
//   - 본 액션이 revalidatePath('/schedule')로 page-level cache 명시적 무효화

import { revalidatePath } from "next/cache";
import { syncGamesForDate } from "@/lib/server/kbo/syncGames";
import { fetchGamesForDate } from "@/lib/server/kbo/fetchGames";

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type RefreshTodayResult =
  | {
      ok: true;
      date: string;
      source: "kbo" | "naver" | "none";
      totalFromApi: number;
      finishedCount: number;
      inserted: number;
      updated: number;
      kboError?: string;
      naverError?: string;
    }
  | { ok: false; error: string };

export async function refreshTodayGamesAction(): Promise<RefreshTodayResult> {
  const today = formatDate(kstNow());
  try {
    // KBO API 호출 한 번 더 해서 진단용 정보 확보 (sync 안에서도 호출되지만 결과 노출용)
    const { games, source, kboError, naverError } = await fetchGamesForDate(today);
    const finishedCount = games.filter((g) => g.status === "finished").length;

    const r = await syncGamesForDate(today);

    // page-level cache 무효화 — SchedulePage가 revalidate=300이라 router.refresh()만으론
    // ISR 캐시가 안 깨질 수 있어 명시적으로 invalidate.
    revalidatePath("/schedule");
    revalidatePath("/");
    return {
      ok: true,
      date: today,
      source,
      totalFromApi: games.length,
      finishedCount,
      inserted: r.inserted,
      updated: r.updated,
      kboError,
      naverError
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
