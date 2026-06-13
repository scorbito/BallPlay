import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { listGamesFromDb, listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton } from "@/lib/utils/dailyReportHelper";
import { generateDailyReportWithGemini } from "@/lib/server/kbo/geminiDailyReport";

export const maxDuration = 60; // AI API 시간 지연 대비 60초 설정

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 동시 생성 방지 인메모리 락
const activeGenerations = new Set<string>();

function kstYesterday(): string {
  const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const yesterday = new Date(kstNow);
  yesterday.setDate(kstNow.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  // 일반 사용자도 접근 가능하므로 어드민 검증 제거

  let targetDate = kstYesterday();
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.date === "string" && DATE_RE.test(body.date)) {
      targetDate = body.date;
    }
  } catch {
    // 파싱 오류 시 기본값 사용
  }

  console.log(`[Daily Report Async Generate] Triggered. Date: ${targetDate}`);

  if (activeGenerations.has(targetDate)) {
    console.log(`[Daily Report Async Generate] Already generating for date: ${targetDate}. Rejecting request.`);
    return NextResponse.json({
      ok: false,
      error: `현재 해당 날짜(${targetDate})의 AI 일일 리포트가 생성 중입니다. 잠시만 기다려 주세요.`
    }, { status: 429 });
  }

  activeGenerations.add(targetDate);

  try {
    const admin = createSupabaseAdminClient();

    // 1) 중복 생성 방지: 이미 캐시된 데이터가 있다면 즉시 반환
    const { data: cacheRow, error: cacheErr } = await admin
      .from("daily_ai_reports")
      .select("report_json")
      .eq("report_date", targetDate)
      .maybeSingle();

    if (!cacheErr && cacheRow && cacheRow.report_json) {
      console.log(`[Daily Report Async Generate] Cache Hit. Returning cached report for ${targetDate}`);
      return NextResponse.json({
        ok: true,
        report: cacheRow.report_json
      });
    }

    // 2) 경기 데이터 조회
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

    const hasUnfinishedGames = games.some(g => g.status === "scheduled" || g.status === "in_progress");
    if (hasUnfinishedGames) {
      return NextResponse.json({
        ok: false,
        error: `아직 종료되지 않은 경기(진행 중 혹은 예정)가 존재합니다. 모든 경기가 끝난 후 리포트를 발행할 수 있습니다.`
      }, { status: 400 });
    }

    // 3) 뉴스 데이터 조회
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
      console.warn("[Daily Report Async Generate] 뉴스 조회 실패:", (err as Error).message);
    }

    // 4) 순위표 데이터 조회
    let standingsData: any[] = [];
    try {
      const yearNum = parseInt(targetDate.split("-")[0], 10);
      standingsData = await listStandingsFromDb(yearNum);
    } catch (err) {
      console.warn("[Daily Report Async Generate] 순위표 조회 실패:", (err as Error).message);
    }

    // 5) AI 리포트 생성
    const basicSkeleton = buildDailyReportSkeleton(games, targetDate);
    const aiReport = await generateDailyReportWithGemini(basicSkeleton, newsTitles, standingsData);

    if (!aiReport) {
      return NextResponse.json({
        ok: false,
        error: "AI 리포트 생성에 실패했습니다. API 키 설정 또는 제미나이 응답 상태를 확인해 주세요."
      }, { status: 500 });
    }

    // 6) DB 캐시 upsert
    const createdAt = new Date().toISOString();
    const { error: upsertErr } = await admin.from("daily_ai_reports").upsert({
      report_date: targetDate,
      report_json: aiReport,
      created_at: createdAt
    });

    if (upsertErr) {
      throw new Error(`DB 캐시 저장 실패: ${upsertErr.message}`);
    }

    // 7) ISR 페이지 무효화
    revalidatePath("/daily-report");
    revalidatePath("/");

    return NextResponse.json({ 
      ok: true, 
      date: targetDate, 
      createdAt,
      report: aiReport 
    });

  } catch (err) {
    console.error("[Daily Report Async Generate Fail]:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  } finally {
    activeGenerations.delete(targetDate);
  }
}
