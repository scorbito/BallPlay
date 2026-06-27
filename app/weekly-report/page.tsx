import { Metadata } from "next";
import { WeeklyReportScreen } from "@/components/domain/WeeklyReportScreen";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  addWeekDays as addDays,
  formatWeekName,
  generateAndCacheWeeklyReport,
  getMondayOfDate
} from "@/lib/server/kbo/weeklyReport";

export const metadata: Metadata = {
  title: "주간 리포트",
  description: "실제 KBO 리그 경기 결과와 뉴스를 제미나이 AI가 고품질로 자동 분석 정리한 한 주간의 성적 리포트입니다.",
  alternates: {
    canonical: "/weekly-report"
  }
};

type Props = {
  searchParams: {
    week?: string; // YYYY-MM-DD (해당 주 월요일 시작일)
    nocache?: string; // "true" 이면 캐시를 무시하고 제미나이를 강제 호출합니다.
  };
};

export default async function WeeklyReportPage({ searchParams }: Props) {
  // 오늘 날짜 계산 (한국 시각 기준 보정)
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const todayMonStr = getMondayOfDate(new Date(now.toISOString().split("T")[0]));
  const supabase = createSupabaseAdminClient();
  
  // 기본 주차: URL 파라미터 week가 있으면 사용하고, 없으면 '지난주 월요일'을 기본으로 봅니다.
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
    startMonStr = addDays(todayMonStr, -7); // 기본값: 지난주 월요일
  }
  
  // 주간 명칭 포맷팅 (예: "6월 1주차")
  const weekName = formatWeekName(startMonStr);

  // 조회하려는 주차가 현재 진행 중인 주차이거나 미래의 주간인지 판단
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

  const isNoCache = searchParams.nocache === "true";

  // 1. Supabase 캐시 테이블(weekly_ai_reports)에서 데이터 조회 시도 (nocache가 아닐 때만)
  let cachedRankings = null;
  if (!isNoCache) {
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
      // 캐시 테이블이 아직 없거나 SQL 에러 발생 시 로그만 출력하고 넘어가서, 
      // 실시간 로딩(무오류)으로 화면이 무조건 정상 노출되도록 안전망 설계
      console.warn("[Weekly Report Cache Error] 캐시 테이블 조회 우회:", (err as Error).message);
    }
  } else {
    console.log(`[Weekly Report Cache Bypass] 강제 캐시 무시 활성화. weekId: ${startMonStr}`);
  }

  // 캐시가 유효하면 화면 렌더링
  if (cachedRankings) {
    return (
      <WeeklyReportScreen 
        initialRankings={cachedRankings} 
        weekName={weekName}
        currentWeekMon={startMonStr}
      />
    );
  }

  // 2. 캐시가 없으면 실제 경기 및 뉴스 기반 AI 리포트 생성 및 캐시 저장
  console.log(`[Weekly Report Cache Miss] 신규 AI 리포트 생성 시작. weekId: ${startMonStr}`);

  const { rankings: aiRankings, cached, error: cacheSaveError } = await generateAndCacheWeeklyReport(
    supabase,
    startMonStr
  );
  if (cached) {
    console.log(`[Weekly Report Cache Saved] weekId: ${startMonStr}`);
  } else {
    console.error("[Weekly Report Cache Save Fail]:", cacheSaveError);
  }

  return (
    <WeeklyReportScreen 
      initialRankings={aiRankings} 
      weekName={weekName}
      currentWeekMon={startMonStr}
    />
  );
}
