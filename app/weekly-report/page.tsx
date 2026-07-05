import { Metadata } from "next";
import { WeeklyReportScreen } from "@/components/domain/WeeklyReportScreen";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  addWeekDays as addDays,
  formatWeekName,
  getMondayOfDate
} from "@/lib/server/kbo/weeklyReport";

export const metadata: Metadata = {
  title: "주간 리포트",
  description: "KBO 주간 경기 결과와 팀별 흐름을 정리한 주간 리포트입니다.",
  alternates: {
    canonical: "/weekly-report"
  }
};

type Props = {
  searchParams: {
    week?: string;
    nocache?: string;
  };
};

export default async function WeeklyReportPage({ searchParams }: Props) {
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const todayMonStr = getMondayOfDate(new Date(now.toISOString().split("T")[0]));
  const supabase = createSupabaseAdminClient();

  const explicitWeek = searchParams.week && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.week)
    ? searchParams.week
    : null;

  let latestCachedWeek: string | null = null;
  if (!explicitWeek) {
    const { data: latestRow } = await supabase
      .from("weekly_ai_reports")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestCachedWeek = typeof latestRow?.week_id === "string" ? latestRow.week_id : null;
  }

  let startMonStr = explicitWeek ?? latestCachedWeek ?? addDays(todayMonStr, -7);
  if (!startMonStr || !/^\d{4}-\d{2}-\d{2}$/.test(startMonStr)) {
    startMonStr = addDays(todayMonStr, -7);
  }

  const weekName = formatWeekName(startMonStr);
  const isPending = startMonStr >= todayMonStr && latestCachedWeek !== startMonStr;

  if (isPending) {
    return (
      <WeeklyReportScreen
        initialRankings={[]}
        weekName={weekName}
        currentWeekMon={startMonStr}
        isPending={true}
      />
    );
  }

  let cachedRankings = null;
  if (searchParams.nocache !== "true") {
    try {
      const { data: cacheRow, error: cacheErr } = await supabase
        .from("weekly_ai_reports")
        .select("rankings_json")
        .eq("week_id", startMonStr)
        .maybeSingle();

      if (!cacheErr && cacheRow) {
        console.log(`[Weekly Report Cache Hit] weekId: ${startMonStr}`);
        cachedRankings = cacheRow.rankings_json;
      }
    } catch (err) {
      console.warn("[Weekly Report Cache Error]", (err as Error).message);
    }
  } else {
    console.log(`[Weekly Report Cache Bypass] weekId: ${startMonStr}`);
  }

  if (cachedRankings) {
    return (
      <WeeklyReportScreen
        initialRankings={cachedRankings}
        weekName={weekName}
        currentWeekMon={startMonStr}
      />
    );
  }

  console.log(`[Weekly Report Cache Miss] weekId: ${startMonStr}. Insert a manual report with report:weekly:upsert.`);

  return (
    <WeeklyReportScreen
      initialRankings={[]}
      weekName={weekName}
      currentWeekMon={startMonStr}
      isPending={true}
    />
  );
}
