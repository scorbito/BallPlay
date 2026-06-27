import type { SupabaseClient } from "@supabase/supabase-js";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import { buildWeeklyReport, type TeamWeeklyReport } from "@/lib/utils/weeklyReportHelper";
import { generateWeeklyReportWithGemini } from "@/lib/server/kbo/geminiWeeklyReport";

// 특정 날짜가 속한 주의 월요일 날짜 문자열 계산 (YYYY-MM-DD)
export function getMondayOfDate(d: Date): string {
  const day = d.getDay();
  // 일요일(0)이면 6일을 빼고, 월요일(1)이면 0일, 화요일(2)이면 1일... 을 뺌
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

// 7일 더하거나 빼기 헬퍼 (UTC 기준으로 날짜만 계산)
export function addWeekDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// 주차 명칭 포맷팅 (예: "6월 3주차 (6/15 ~ 6/21)")
export function formatWeekName(startMonStr: string): string {
  const endSunStr = addWeekDays(startMonStr, 6);
  const [, monthStr, dayStr] = startMonStr.split("-");
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);
  const weekNum = Math.ceil(dayNum / 7);
  return `${monthNum}월 ${weekNum}주차 (${monthNum}/${dayNum} ~ ${parseInt(endSunStr.split("-")[1], 10)}/${parseInt(endSunStr.split("-")[2], 10)})`;
}

export interface WeeklyReportResult {
  rankings: TeamWeeklyReport[];
  cached: boolean; // weekly_ai_reports upsert 성공 여부
  error?: string;
}

// 해당 주차(월요일 시작)의 주간 리포트를 생성하고 weekly_ai_reports 캐시에 저장한다.
// page(Cache Miss)와 일일 동기화 스크립트가 공유한다.
// rankings 는 항상 반환하며(캐시 실패와 무관), 캐시 저장 결과는 cached 플래그로 알린다.
export async function generateAndCacheWeeklyReport(
  admin: SupabaseClient,
  startMonStr: string
): Promise<WeeklyReportResult> {
  const endSunStr = addWeekDays(startMonStr, 6); // 월요일 + 6일 = 일요일
  const weekName = formatWeekName(startMonStr);

  // 경기 조회
  const games = await listGamesFromDb({ from: startMonStr, to: endSunStr });

  // 해당 주간의 실제 뉴스 헤드라인 쿼리
  let newsTitles: string[] = [];
  try {
    const { data: newsData } = await admin
      .from("bp_news")
      .select("title")
      .gte("published_at", `${startMonStr}T00:00:00+09:00`)
      .lte("published_at", `${endSunStr}T23:59:59+09:00`)
      .order("published_at", { ascending: false });

    newsTitles = (newsData ?? []).map((n) => n.title);
  } catch (err) {
    console.warn("[Weekly Report News Fetch Warn] 뉴스 조회 오류:", (err as Error).message);
  }

  // 룰베이스 기본 리포트 뼈대 → 제미나이 Flash 텍스트 보강
  const basicRankings = buildWeeklyReport(games, weekName);
  const aiRankings = await generateWeeklyReportWithGemini(basicRankings, newsTitles, weekName);

  // 생성 완료된 데이터를 캐시 테이블에 저장
  try {
    const { error } = await admin.from("weekly_ai_reports").upsert({
      week_id: startMonStr,
      rankings_json: aiRankings,
      created_at: new Date().toISOString()
    });
    if (error) {
      return { rankings: aiRankings, cached: false, error: error.message };
    }
  } catch (err) {
    return { rankings: aiRankings, cached: false, error: (err as Error).message };
  }

  return { rankings: aiRankings, cached: true };
}
