import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStatsSnapshot } from "./syncStats";

/**
 * 경기 상세(AI 분석 등) 진입 시, 양 팀의 오늘 자(dateStr) 투수 스탯 스냅샷이
 * DB에 존재하는지 체크하고, 없으면 온디맨드로 성적을 긁어와 DB(bp_player_stats_snapshots)에 적재합니다.
 *
 * @param client Supabase Admin Client (upsert 권한 필요)
 * @param teamIds 양 팀 ID 배열 (예: ['lotte', 'doosan'])
 * @param dateStr 오늘 날짜 (YYYY-MM-DD)
 */
export async function fetchOnDemandStarterStats(
  client: SupabaseClient,
  teamIds: string[],
  dateStr: string
): Promise<void> {
  if (teamIds.length === 0) return;

  try {
    // 1. 오늘 날짜로 해당 팀들의 투수 스냅샷 데이터가 존재하는지 1개만 조회해 판정
    const { data, error } = await client
      .from("bp_player_stats_snapshots")
      .select("player_id")
      .in("team_id", teamIds)
      .eq("snapshot_date", dateStr)
      .eq("kind", "pitcher")
      .limit(1);

    if (error) {
      console.error("[On-Demand Stats] DB check error:", error.message);
      return;
    }

    // 2. 이미 오늘 자 스냅샷이 존재한다면 즉시 스킵 (하루에 한 번만 수집)
    if (data && data.length > 0) {
      console.log(`[On-Demand Stats] Snapshots for [${teamIds.join(", ")}] on ${dateStr} already exist. Skipping KBO scrape.`);
      return;
    }

    // 3. 없으면 해당 팀들만 크롤링 및 DB Upsert 진행
    console.log(`[On-Demand Stats] Snapshots missing for [${teamIds.join(", ")}] on ${dateStr}. Starting KBO stats scrape...`);
    const year = Number(dateStr.slice(0, 4));
    const result = await syncStatsSnapshot(dateStr, {
      year,
      teams: teamIds
    });

    console.log(
      `[On-Demand Stats] Scraped finished. Teams: ${result.teamsProcessed}, Batters: ${result.battersUpserted}, Pitchers: ${result.pitchersUpserted}, Errors: ${result.errors.length}`
    );
    if (result.errors.length > 0) {
      console.error("[On-Demand Stats] Scraper errors:", result.errors);
    }
  } catch (err) {
    console.error("[On-Demand Stats] Outer exception during on-demand sync:", err);
  }
}
