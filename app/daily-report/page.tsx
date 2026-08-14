import type { Metadata } from "next";
import { renderDailyReport } from "@/lib/report/dailyReportRender";

// 정적/ISR — 기본 진입(최신 발행 리포트). 날짜 지정은 /daily-report/date/[date] 로 분리.
// searchParams 를 읽지 않아 전체 라우트 캐시 가능(예전엔 ?date= + admin no-store 로 동적 강제됐음).
// focus/backHref 는 DailyReportScreen 이 클라에서 window.location.search 로 읽는다.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "일일 리포트",
  description: "KBO 프로야구 경기 결과와 AI 총평을 매일 정리합니다.",
  alternates: { canonical: "/daily-report" }
};

export default async function DailyReportPage() {
  return renderDailyReport(null);
}
