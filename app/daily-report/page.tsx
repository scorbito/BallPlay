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
  const isAutoGenerateTarget = targetDate === yesterdayStr || targetDate === todayStr;
  if (isAutoGenerateTarget) {
    console.log(`[Daily Report Cache Miss] 신규 AI 일일 리포트 자동 생성 트리거 예정. date: ${targetDate}`);
  } else {
    console.log(`[Daily Report Cache Miss] 과거 날짜(${targetDate})이므로 자동 생성을 수행하지 않고 placeholder를 렌더링합니다.`);
  }

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

  // 모든 경기가 종료되었고 캐시가 없으므로 실시간 생성 작업을 처리합니다.
  // 어제(yesterdayStr) 또는 오늘(todayStr) 날짜인 경우에만 실시간 자동 분석을 동작시키고,
  // 그 이전의 과거 날짜인 경우 자동 호출을 차단하고 리포트가 없다는 화면을 유도합니다.
  const basicSkeleton = buildDailyReportSkeleton(games, targetDate);

  return (
    <DailyReportScreen 
      initialReport={basicSkeleton} 
      reportDate={targetDate}
      initialIsGenerating={isAutoGenerateTarget}
      isNoReport={!isAutoGenerateTarget}
      isAdmin={isAdmin}
    />
  );
}
