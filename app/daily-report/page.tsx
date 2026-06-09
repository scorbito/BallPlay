import { Metadata } from "next";
import { DailyReportScreen } from "@/components/domain/DailyReportScreen";
import { listGamesFromDb, listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton, isSkeletonReport } from "@/lib/utils/dailyReportHelper";
import { generateDailyReportWithGemini } from "@/lib/server/kbo/geminiDailyReport";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth/userTier";

export const metadata: Metadata = {
  title: "일일 리포트",
  description: "실제 KBO 경기 결과와 뉴스를 종합하여 제미나이 AI가 승리/패배 요인 및 오늘의 판도를 요약 분석한 고품질 일일 리포트입니다.",
  alternates: {
    canonical: "/daily-report"
  }
};

type Props = {
  searchParams: {
    date?: string; // YYYY-MM-DD
    nocache?: string; // "true" 이면 캐시를 무시하고 제미나이 강제 호출
  };
};

export default async function DailyReportPage({ searchParams }: Props) {
  // 0) admin 등급 검증
  const userClient = createSupabaseServerClient();
  const { tier } = await getUserTier(userClient);
  const isAdmin = tier === "admin";

  // 오늘 날짜 계산 (한국 시각 기준 보정)
  const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  
  // 기본 조회 날짜: 파라미터가 없으면 '어제 날짜'를 기준으로 합니다.
  const yesterday = new Date(nowKST);
  yesterday.setDate(nowKST.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let targetDate = searchParams.date;
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    targetDate = yesterdayStr;
  }

  // 오늘 날짜 문자열
  const todayStr = nowKST.toISOString().split("T")[0];

  // 조회 날짜가 오늘 날짜 이상인 경우 (아직 경기가 종료되지 않은 당일 또는 미래)
  const isTodayOrFuture = targetDate >= todayStr;

  const supabase = createSupabaseAdminClient();
  const isNoCache = searchParams.nocache === "true";

  // 1. Supabase 캐시 테이블(daily_ai_reports)에서 데이터 조회 시도 (nocache가 아닐 때만)
  let cachedReport = null;
  if (!isNoCache && !isTodayOrFuture) {
    try {
      const { data: cacheRow, error: cacheErr } = await supabase
        .from("daily_ai_reports")
        .select("report_json")
        .eq("report_date", targetDate)
        .maybeSingle();

      if (!cacheErr && cacheRow) {
        console.log(`[Daily Report Cache Hit] date: ${targetDate}`);
        const reportData = cacheRow.report_json;
        if (!isSkeletonReport(reportData)) {
          cachedReport = reportData;
        } else {
          console.log(`[Daily Report Cache Skip] 캐시된 데이터가 더미 스켈레톤이므로 무시합니다. date: ${targetDate}`);
        }
      }
    } catch (err) {
      console.warn("[Daily Report Cache Error] 캐시 테이블 조회 우회:", (err as Error).message);
    }
  }

  // 캐시가 유효하면 화면 렌더링
  if (cachedReport) {
    return (
      <DailyReportScreen 
        initialReport={cachedReport} 
        reportDate={targetDate}
        isAdmin={isAdmin}
      />
    );
  }

  // 2. 캐시가 없거나 실시간 강제 생성이 필요한 경우
  console.log(`[Daily Report Cache Miss] 신규 AI 일일 리포트 생성 시도. date: ${targetDate}`);

  // 해당 날짜의 경기 데이터 조회
  const games = await listGamesFromDb({
    from: targetDate,
    to: targetDate
  });

  const isNoGames = games.length === 0;
  const hasUnfinishedGames = games.some(g => g.status === "scheduled" || g.status === "in_progress");
  const isPending = !isNoGames && (hasUnfinishedGames || isTodayOrFuture);

  // 경기 일정이 아예 없으면 경기가 없는 날 상태로 렌더링
  if (isNoGames) {
    const emptySkeleton = buildDailyReportSkeleton([], targetDate);
    return (
      <DailyReportScreen 
        initialReport={emptySkeleton} 
        reportDate={targetDate}
        isNoGames={true}
        isAdmin={isAdmin}
      />
    );
  }

  // 경기 종료 전이면 대기 화면 렌더링
  if (isPending) {
    const emptySkeleton = buildDailyReportSkeleton([], targetDate);
    return (
      <DailyReportScreen 
        initialReport={emptySkeleton} 
        reportDate={targetDate}
        isPending={true}
        isAdmin={isAdmin}
      />
    );
  }

  // 모든 경기가 종료된 상태이므로 AI 분석 리포트 생성 및 캐시 저장 진행
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
    console.warn("[Daily Report News Fetch Warn] 뉴스 조회 오류:", (err as Error).message);
  }

  // 당일 순위표 조회
  let standingsData: any[] = [];
  try {
    const yearNum = parseInt(targetDate.split("-")[0], 10);
    standingsData = await listStandingsFromDb(yearNum);
  } catch (err) {
    console.warn("[Daily Report Standings Fetch Warn] 순위표 조회 오류:", (err as Error).message);
  }

  // 룰베이스 기본 스켈레톤 빌드
  const basicSkeleton = buildDailyReportSkeleton(games, targetDate);

  // Gemini API를 사용하여 경기 리포트 및 종합 브리핑 고도화
  const aiReport = await generateDailyReportWithGemini(basicSkeleton, newsTitles, standingsData);

  if (aiReport) {
    // 생성 완료된 데이터를 캐시 테이블에 저장
    try {
      await supabase.from("daily_ai_reports").upsert({
        report_date: targetDate,
        report_json: aiReport,
        created_at: new Date().toISOString()
      });
      console.log(`[Daily Report Cache Saved] date: ${targetDate}`);
    } catch (err) {
      console.error("[Daily Report Cache Save Fail]:", (err as Error).message);
    }

    return (
      <DailyReportScreen 
        initialReport={aiReport} 
        reportDate={targetDate}
        isAdmin={isAdmin}
      />
    );
  }

  // 생성에 실패하여 null이 반환된 경우 (더미 데이터를 캐싱하거나 화면에 보여주지 않고 Failed 상태로 표시)
  console.warn(`[Daily Report Generation Failed] date: ${targetDate}`);
  const emptySkeleton = buildDailyReportSkeleton(games, targetDate);
  return (
    <DailyReportScreen 
      initialReport={emptySkeleton} 
      reportDate={targetDate}
      isFailed={true}
      isAdmin={isAdmin}
    />
  );
}
