import { Metadata } from "next";
import { DailyReportScreen } from "@/components/domain/DailyReportScreen";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import { buildDailyReportSkeleton, isSkeletonReport, type KboDailyReport } from "@/lib/utils/dailyReportHelper";
import { createSupabaseAdminClient } from "@/lib/supabase/server";


export const metadata: Metadata = {
  title: "?? ???",
  description: "KBO ?? ??? ?? ??? ??? ?? ??????.",
  alternates: {
    canonical: "/daily-report"
  }
};

type Props = {
  searchParams: {
    date?: string; // YYYY-MM-DD
    nocache?: string;
    focus?: string; // 특정 경기 ID
    backHref?: string; // 뒤로가기 경로
  };
};

type PublishedDailyReport = {
  reportDate: string;
  report: KboDailyReport;
  publishedAt: string | null;
};

export default async function DailyReportPage({ searchParams }: Props) {
  // 오늘 날짜 계산 (한국 시각 기준 보정)
  const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  
  // 기본 조회 날짜: 파라미터가 없으면 '어제 날짜'를 기준으로 합니다.
  const yesterday = new Date(nowKST);
  yesterday.setDate(nowKST.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const supabase = createSupabaseAdminClient();
  const requestedDate = searchParams.date;
  const isNoCache = searchParams.nocache === "true";
  const hasValidRequestedDate = Boolean(requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate));
  const latestPublishedReport = isNoCache ? null : await getLatestPublishedDailyReport(supabase, todayStr);
  let targetDate = hasValidRequestedDate
    ? requestedDate!
    : latestPublishedReport?.reportDate ?? yesterdayStr;

  // 조회 날짜가 오늘 날짜 이상인 경우 (아직 경기가 종료되지 않은 당일 또는 미래)
  const isTodayOrFuture = targetDate >= todayStr;

  // 1. Supabase 캐시 테이블(daily_ai_reports)에서 데이터 조회 시도 (nocache가 아닐 때만)
  let cachedReport = null;
  let cachedReportPublishedAt: string | null = null;
  if (!isNoCache) {
    try {
      const { data: cacheRow, error: cacheErr } = await supabase
        .from("daily_ai_reports")
        .select("report_json, created_at")
        .eq("report_date", targetDate)
        .maybeSingle();

      if (!cacheErr && cacheRow) {
        console.log(`[Daily Report Cache Hit] date: ${targetDate}`);
        const reportData = cacheRow.report_json;
        if (!isSkeletonReport(reportData)) {
          cachedReport = reportData;
          cachedReportPublishedAt = typeof cacheRow.created_at === "string" ? cacheRow.created_at : null;
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
        reportPublishedAt={cachedReportPublishedAt}
        focus={searchParams.focus}
        backHref={searchParams.backHref}
      />
    );
  }

  if (!searchParams.focus && latestPublishedReport && latestPublishedReport.reportDate !== targetDate) {
    return (
      <DailyReportScreen
        initialReport={latestPublishedReport.report}
        reportDate={latestPublishedReport.reportDate}
        reportPublishedAt={latestPublishedReport.publishedAt}
        backHref={searchParams.backHref}
      />
    );
  }

  console.log(`[Daily Report Cache Miss] date: ${targetDate}. Insert a manual report with report:daily:upsert.`);

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
        focus={searchParams.focus}
        backHref={searchParams.backHref}
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
        focus={searchParams.focus}
        backHref={searchParams.backHref}
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
      isNoReport={true}
      focus={searchParams.focus}
      backHref={searchParams.backHref}
    />
  );
}

async function getLatestPublishedDailyReport(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  latestDate: string
): Promise<PublishedDailyReport | null> {
  try {
    const { data, error } = await supabase
      .from("daily_ai_reports")
      .select("report_date, report_json, created_at")
      .lte("report_date", latestDate)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) return null;

    for (const row of data) {
      if (!row.report_json || isSkeletonReport(row.report_json)) continue;
      if (typeof row.report_date !== "string") continue;

      return {
        reportDate: row.report_date,
        report: row.report_json as KboDailyReport,
        publishedAt: typeof row.created_at === "string" ? row.created_at : null
      };
    }
  } catch {
    return null;
  }

  return null;
}
