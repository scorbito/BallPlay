// 일일 리포트 렌더 — base(최신)와 /date/[date] 가 공유.
//
// 예전엔 page 가 searchParams(date/nocache/focus/backHref) + admin(no-store) 클라를 써서
// 라우트가 완전 동적(no-store)이었다. 리포트 본문은 유저 무관 공개 데이터라, 날짜를 경로
// 파라미터로 분리하고 모든 조회를 createSupabaseCacheClient(service_role+revalidate)로 바꾸면
// 전체 라우트 ISR 캐시가 걸린다. focus/backHref 는 DailyReportScreen 이 클라에서 읽는다.

import { DailyReportScreen } from "@/components/domain/DailyReportScreen";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import {
  buildDailyReportSkeleton,
  isSkeletonReport,
  type KboDailyReport
} from "@/lib/utils/dailyReportHelper";
import { createSupabaseCacheClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidReportDate(d: string): boolean {
  return DATE_RE.test(d);
}

type PublishedDailyReport = {
  reportDate: string;
  report: KboDailyReport;
  publishedAt: string | null;
};

async function getLatestPublishedDailyReport(
  supabase: ReturnType<typeof createSupabaseCacheClient>,
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

/** explicitDate=null 이면 최신 발행 리포트를 보여준다. */
export async function renderDailyReport(explicitDate: string | null) {
  const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  const yesterday = new Date(nowKST);
  yesterday.setDate(nowKST.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // 쿠키리스 + service_role + next.revalidate — RLS 통과(리포트 읽기) + ISR 캐시 유지.
  const supabase = createSupabaseCacheClient(60);

  const hasValidDate = Boolean(explicitDate && DATE_RE.test(explicitDate));
  const latestPublished = await getLatestPublishedDailyReport(supabase, todayStr);
  const targetDate = hasValidDate ? explicitDate! : latestPublished?.reportDate ?? yesterdayStr;
  const isTodayOrFuture = targetDate >= todayStr;

  // 캐시 테이블(daily_ai_reports)에서 대상 날짜 리포트 조회.
  let cachedReport: KboDailyReport | null = null;
  let cachedPublishedAt: string | null = null;
  try {
    const { data: cacheRow, error } = await supabase
      .from("daily_ai_reports")
      .select("report_json, created_at")
      .eq("report_date", targetDate)
      .maybeSingle();
    if (!error && cacheRow && !isSkeletonReport(cacheRow.report_json)) {
      cachedReport = cacheRow.report_json as KboDailyReport;
      cachedPublishedAt = typeof cacheRow.created_at === "string" ? cacheRow.created_at : null;
    }
  } catch {
    // 조회 실패 시 아래 스켈레톤 경로로.
  }

  if (cachedReport) {
    return (
      <DailyReportScreen
        initialReport={cachedReport}
        reportDate={targetDate}
        reportPublishedAt={cachedPublishedAt}
      />
    );
  }

  // 기본 진입(날짜 미지정)인데 대상 날짜 리포트가 없으면 최신 발행분을 보여준다.
  if (!hasValidDate && latestPublished && latestPublished.reportDate !== targetDate) {
    return (
      <DailyReportScreen
        initialReport={latestPublished.report}
        reportDate={latestPublished.reportDate}
        reportPublishedAt={latestPublished.publishedAt}
      />
    );
  }

  // 리포트가 없으면 경기 데이터로 스켈레톤/대기/미작성 화면.
  const games = await listGamesFromDb({ from: targetDate, to: targetDate }, supabase);
  const isNoGames = games.length === 0;
  const hasUnfinishedGames = games.some((g) => g.status === "scheduled" || g.status === "in_progress");
  const isPending = !isNoGames && (hasUnfinishedGames || isTodayOrFuture);

  if (isNoGames) {
    return (
      <DailyReportScreen
        initialReport={buildDailyReportSkeleton([], targetDate)}
        reportDate={targetDate}
        isNoGames
      />
    );
  }
  if (isPending) {
    return (
      <DailyReportScreen
        initialReport={buildDailyReportSkeleton([], targetDate)}
        reportDate={targetDate}
        isPending
      />
    );
  }
  return (
    <DailyReportScreen
      initialReport={buildDailyReportSkeleton(games, targetDate)}
      reportDate={targetDate}
      isNoReport
    />
  );
}
