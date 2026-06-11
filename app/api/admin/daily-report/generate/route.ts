import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth/userTier";
import { listGamesFromDb, listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton } from "@/lib/utils/dailyReportHelper";
import { generateDailyReportWithGemini } from "@/lib/server/kbo/geminiDailyReport";

export const maxDuration = 60; // AI API 시간 지연 대비 60초 설정

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kstYesterday(): string {
  const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const yesterday = new Date(kstNow);
  yesterday.setDate(kstNow.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  // 1) admin 등급 검증
  const userClient = createSupabaseServerClient();
  const { tier } = await getUserTier(userClient);
  if (tier !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // 2) Body에서 날짜 파라미터 파싱
  let targetDate = kstYesterday(); // 기본값: 어제 날짜
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.date === "string" && DATE_RE.test(body.date)) {
      targetDate = body.date;
    }
  } catch {
    // 파싱 오류 시 기본값(어제) 유지
  }

  console.log(`[Admin Daily Report Rerun] Triggered by admin. Date: ${targetDate}`);

  try {
    const admin = createSupabaseAdminClient();

    // 3) 경기 데이터 조회
    const games = await listGamesFromDb({
      from: targetDate,
      to: targetDate
    });

    if (games.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: `해당 날짜(${targetDate})에 경기가 예정되어 있지 않아 리포트를 생성할 수 없습니다.` 
      }, { status: 400 });
    }

    // 3.5) 경기가 아직 모두 종료되지 않았는지 검증 (잘못 누름 방지)
    // Admin manual generation intentionally bypasses the unfinished-game guard.
    const hasUnfinishedGames = false;
    if (hasUnfinishedGames) {
      return NextResponse.json({
        ok: false,
        error: `아직 종료되지 않은 경기(진행 중 혹은 예정)가 존재합니다. 해당 일자의 모든 경기가 완전히 끝난 후에 리포트를 발행할 수 있습니다.`
      }, { status: 400 });
    }

    // 4) 뉴스 데이터 조회
    let newsTitles: string[] = [];
    try {
      const { data: newsData } = await admin
        .from("bp_news")
        .select("title")
        .gte("published_at", `${targetDate}T00:00:00+09:00`)
        .lte("published_at", `${targetDate}T23:59:59+09:00`)
        .order("published_at", { ascending: false });

      newsTitles = (newsData ?? []).map(n => n.title);
    } catch (err) {
      console.warn("[Admin Daily Report Rerun] 뉴스 조회 실패:", (err as Error).message);
    }

    // 5) 순위표 데이터 조회
    let standingsData: any[] = [];
    try {
      const yearNum = parseInt(targetDate.split("-")[0], 10);
      standingsData = await listStandingsFromDb(yearNum);
    } catch (err) {
      console.warn("[Admin Daily Report Rerun] 순위표 조회 실패:", (err as Error).message);
    }

    // 6) AI 리포트 강제 갱신
    const basicSkeleton = buildDailyReportSkeleton(games, targetDate);
    const aiReport = await generateDailyReportWithGemini(basicSkeleton, newsTitles, standingsData);

    if (!aiReport) {
      return NextResponse.json({
        ok: false,
        error: "AI 리포트 생성에 실패했습니다. API 키 설정 또는 제미나이 응답 상태를 확인해 주세요."
      }, { status: 500 });
    }

    // 7) DB 캐시 upsert
    const { error: upsertErr } = await admin.from("daily_ai_reports").upsert({
      report_date: targetDate,
      report_json: aiReport,
      created_at: new Date().toISOString()
    });

    if (upsertErr) {
      throw new Error(`DB 캐시 갱신 실패: ${upsertErr.message}`);
    }

    // 8) ISR 페이지 무효화
    revalidatePath("/daily-report");
    revalidatePath("/");

    return NextResponse.json({ 
      ok: true, 
      date: targetDate, 
      report: aiReport 
    });

  } catch (err) {
    console.error("[Admin Daily Report Rerun Fail]:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
