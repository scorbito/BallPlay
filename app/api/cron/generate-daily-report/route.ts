import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { listGamesFromDb, listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton } from "@/lib/utils/dailyReportHelper";
import { generateDailyReportWithGemini } from "@/lib/server/kbo/geminiDailyReport";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60; // AI 분석에 시간이 걸리므로 60초 제한 허용

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  // 크론잡 인증 검증
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  let targetDate = url.searchParams.get("date");

  // 기본값: 어제 날짜 계산 (한국 시각 기준 어제 경기를 분석 대상으로 함)
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    const today = kstNow();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    targetDate = formatDate(yesterday);
  }

  console.log(`[Daily Report Cron Triggered] Target Date: ${targetDate}`);

  try {
    const supabase = createSupabaseAdminClient();

    // 1. 해당 날짜 경기 조회
    const games = await listGamesFromDb({
      from: targetDate,
      to: targetDate
    });

    if (games.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "No games on this date", date: targetDate });
    }

    // 2. 경기가 아직 진행 중이거나 예정된 것이 있는지 검증 (미완료 경기)
    const hasUnfinishedGames = games.some(g => g.status === "scheduled" || g.status === "in_progress");
    if (hasUnfinishedGames) {
      return NextResponse.json({ 
        ok: true, 
        skipped: true, 
        reason: "Some games are still scheduled or in progress", 
        date: targetDate 
      });
    }

    // 3. 당일 뉴스 헤드라인 수집
    let newsTitles: string[] = [];
    try {
      const { data: newsData } = await supabase
        .from("bp_news")
        .select("title")
        .gte("published_at", `${targetDate}T00:00:00+09:00`)
        .lte("published_at", `${targetDate}T23:59:59+09:00`)
        .order("published_at", { ascending: false });

      newsTitles = (newsData ?? []).map(n => n.title);
    } catch (err) {
      console.warn("[Daily Report Cron] 뉴스 조회 오류:", (err as Error).message);
    }

    // 4. 당일 순위표 수집
    let standingsData: any[] = [];
    try {
      const yearNum = parseInt(targetDate.split("-")[0], 10);
      standingsData = await listStandingsFromDb(yearNum);
    } catch (err) {
      console.warn("[Daily Report Cron] 순위표 조회 오류:", (err as Error).message);
    }

    // 5. AI 일일 리포트 데이터 생성
    const basicSkeleton = buildDailyReportSkeleton(games, targetDate);
    const aiReport = await generateDailyReportWithGemini(basicSkeleton, newsTitles, standingsData);

    if (!aiReport) {
      throw new Error("AI 리포트 생성에 실패했습니다 (반환값 null).");
    }

    // 6. DB 캐시 테이블에 적재 (upsert)
    const { error: upsertErr } = await supabase.from("daily_ai_reports").upsert({
      report_date: targetDate,
      report_json: aiReport,
      created_at: new Date().toISOString()
    });

    if (upsertErr) {
      throw new Error(`Failed to cache daily report in DB: ${upsertErr.message}`);
    }

    console.log(`[Daily Report Cron Successfully Cached] Date: ${targetDate}`);

    // 7. ISR 페이지 캐시 강제 무효화
    revalidatePath("/daily-report");
    revalidatePath("/");

    return NextResponse.json({ ok: true, cached: true, date: targetDate, report: aiReport });
  } catch (err) {
    console.error("[Daily Report Cron Fail]:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
