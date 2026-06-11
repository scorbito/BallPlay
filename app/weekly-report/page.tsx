import { Metadata } from "next";
import { WeeklyReportScreen } from "@/components/domain/WeeklyReportScreen";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import { buildWeeklyReport } from "@/lib/utils/weeklyReportHelper";
import { generateWeeklyReportWithGemini } from "@/lib/server/kbo/geminiWeeklyReport";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "주간 리포트",
  description: "실제 KBO 리그 경기 결과와 뉴스를 제미나이 AI가 고품질로 자동 분석 정리한 한 주간의 성적 리포트입니다.",
  alternates: {
    canonical: "/weekly-report"
  }
};

// 특정 날짜가 속한 주의 월요일 날짜 문자열 계산 (YYYY-MM-DD)
function getMondayOfDate(d: Date): string {
  const day = d.getDay();
  // 일요일(0)이면 6일을 빼고, 월요일(1)이면 0일, 화요일(2)이면 1일... 을 뺌
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

// 7일 더하거나 빼기 헬퍼
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

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
  
  // 기본 주차: URL 파라미터 week가 있으면 사용하고, 없으면 '지난주 월요일'을 기본으로 봅니다.
  let startMonStr = searchParams.week;
  if (!startMonStr || !/^\d{4}-\d{2}-\d{2}$/.test(startMonStr)) {
    startMonStr = addDays(todayMonStr, -7); // 기본값: 지난주 월요일
  }
  
  const endSunStr = addDays(startMonStr, 6); // 월요일 + 6일 = 일요일
  
  // 주간 명칭 포맷팅 (예: "6월 1주차")
  const [yearStr, monthStr, dayStr] = startMonStr.split("-");
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);
  const weekNum = Math.ceil(dayNum / 7);
  const weekName = `${monthNum}월 ${weekNum}주차 (${monthNum}/${dayNum} ~ ${parseInt(endSunStr.split("-")[1], 10)}/${parseInt(endSunStr.split("-")[2], 10)})`;

  // 조회하려는 주차가 현재 진행 중인 주차이거나 미래의 주간인지 판단
  const isPending = startMonStr >= todayMonStr;

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

  const supabase = createSupabaseAdminClient();

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

  // 경기 조회
  const games = await listGamesFromDb({
    from: startMonStr,
    to: endSunStr
  });

  // 해당 주간의 실제 뉴스 헤드라인 쿼리
  let newsTitles: string[] = [];
  try {
    const { data: newsData } = await supabase
      .from("bp_news")
      .select("title")
      .gte("published_at", `${startMonStr}T00:00:00+09:00`)
      .lte("published_at", `${endSunStr}T23:59:59+09:00`)
      .order("published_at", { ascending: false });
    
    newsTitles = (newsData ?? []).map(n => n.title);
  } catch (err) {
    console.warn("[Weekly Report News Fetch Warn] 뉴스 조회 오류:", (err as Error).message);
  }

  // 룰베이스 기본 리포트 뼈대 생성
  const basicRankings = buildWeeklyReport(games, weekName);

  // 제미나이 Flash API 연동하여 스포츠 분석 기사 스타일의 텍스트로 보강
  const aiRankings = await generateWeeklyReportWithGemini(basicRankings, newsTitles, weekName);

  // 생성 완료된 데이터를 캐시 테이블에 저장
  try {
    await supabase.from("weekly_ai_reports").upsert({
      week_id: startMonStr,
      rankings_json: aiRankings,
      created_at: new Date().toISOString()
    });
    console.log(`[Weekly Report Cache Saved] weekId: ${startMonStr}`);
  } catch (err) {
    console.error("[Weekly Report Cache Save Fail]:", (err as Error).message);
  }

  return (
    <WeeklyReportScreen 
      initialRankings={aiRankings} 
      weekName={weekName}
      currentWeekMon={startMonStr}
    />
  );
}
