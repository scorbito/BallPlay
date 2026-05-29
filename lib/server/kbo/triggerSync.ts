// 페이지 server component 에서 부르는 일일 데이터 sync 트리거.
//
// 동작:
//   1. 오늘 게임 결과 sync (throttle 5분, await)
//   2. 오늘 모든 게임이 finished 상태면 cascade:
//      - 어제 라인업 sync   (throttle 30분, fire-and-forget)
//      - 시즌 순위 sync     (throttle 30분, fire-and-forget)
//      - AI 채점            (throttle 5분, fire-and-forget)
//   3. cascade 는 응답을 늦추지 않도록 void 처리.
//
// 호출 위치 (server component):
//   import { triggerDailyDataSync } from "@/lib/server/kbo/triggerSync";
//   export default async function Page() {
//     void triggerDailyDataSync();  // background trigger (응답 안 기다림)
//     const data = await loadFromDb();
//     return <Screen data={data} />;
//   }
//
// 통합 cron(scope=today)이 23:30 KST 에 한 번 도는 것과는 별개의 안전망.
// 사용자 트래픽이 있을 때 더 빈번하게 갱신되도록.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { syncGamesInRange } from "./syncGames";
import { syncLineupsForDate } from "./syncLineups";
import { syncStandings } from "./syncStandings";
import { scoreAiPredictionsForRange } from "./scoreAiPredictions";
import { ensureSync } from "./ensureSync";

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function kstYesterday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() - 1);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

/** 해당 날짜 게임이 모두 finished 인지. 게임이 0개면 false. */
async function isAllFinished(dateISO: string): Promise<boolean> {
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from("games").select("status").eq("game_date", dateISO);
  if (!data || data.length === 0) return false;
  return data.every((g) => g.status === "finished");
}

/**
 * 페이지가 부르는 진입점. throttle 로 보호되므로 매 요청마다 불러도 안전.
 * 응답은 빨리 (게임 sync 5분 throttle 안에서는 ms 단위) 반환.
 *
 * 예외:
 *   - 첫 호출(throttle 없음)은 게임 sync 까지 await (5~10초). 5분에 1번꼴.
 *   - cascade 는 항상 fire-and-forget.
 */
export async function triggerDailyDataSync(): Promise<void> {
  const today = kstToday();
  const yesterday = kstYesterday();

  // 1) 오늘 게임 결과 sync (throttle 5분).
  await ensureSync(
    `games-sync:${today}`,
    300,
    () => syncGamesInRange(today, today, { delayMs: 200 })
  ).catch(() => undefined);

  // 2) 오늘 게임 모두 finished? cascade 트리거.
  //    어제 라인업/시즌 순위/AI 채점은 사용자가 결과를 보러 들어왔을 때만 의미 있음.
  if (await isAllFinished(today)) {
    void ensureSync(
      `lineups-sync:${today}`,
      1800,
      () => syncLineupsForDate(today)
    ).catch(() => undefined);

    const season = Number(today.slice(0, 4));
    void ensureSync(
      `standings-sync:${season}`,
      1800,
      () => syncStandings(season)
    ).catch(() => undefined);

    void ensureSync(
      `ai-scoring:${today}`,
      300,
      () => scoreAiPredictionsForRange(yesterday, today)
    ).catch(() => undefined);
  }
}
