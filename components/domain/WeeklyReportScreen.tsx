"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  CalendarDays,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ContentPointClaimButton } from "@/components/domain/points/ContentPointClaimButton";
import type { TeamWeeklyReport } from "@/lib/utils/weeklyReportHelper";

type WeeklyReportScreenProps = {
  initialRankings: TeamWeeklyReport[];
  weekName: string;
  currentWeekMon: string; // 현재 조회 중인 주간의 월요일 날짜 (YYYY-MM-DD)
  isPending?: boolean; // 아직 리포트가 생성되지 않은 주간인지 여부
};

// 특정 날짜가 속한 주의 월요일 구하기
function getMondayOfDate(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

// 7일 더하거나 빼기 헬퍼
function offsetDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function WeeklyReportScreen({ initialRankings, weekName, currentWeekMon, isPending = false }: WeeklyReportScreenProps) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const router = useRouter();

  // 아코디언 토글
  const toggleExpand = (teamCode: string) => {
    setExpandedTeam(prev => (prev === teamCode ? null : teamCode));
  };

  // 이전 주차로 이동 (7일 차감)
  const handlePrevWeek = () => {
    const prevWeekMon = offsetDays(currentWeekMon, -7);
    router.push(`/weekly-report?week=${prevWeekMon}`);
    setExpandedTeam(null);
  };

  // 다음 주차로 이동 (7일 가산)
  const handleNextWeek = () => {
    const nextWeekMon = offsetDays(currentWeekMon, 7);
    router.push(`/weekly-report?week=${nextWeekMon}`);
    setExpandedTeam(null);
  };

  // 다음 주차로 가기 버튼 비활성화 조건:
  // 다음 주차가 오늘 날짜가 속한 주의 월요일(진행 중인 주차) 이상이라면 다음 주로 이동 불가하도록 차단
  const today = new Date();
  const todayMonStr = getMondayOfDate(today);
  const isNextDisabled = offsetDays(currentWeekMon, 7) >= todayMonStr;

  // 시리즈 결과에 따른 배지 렌더링
  const renderResultBadge = (result: string) => {
    switch (result) {
      case "sweep_win":
        return <span className="weekly-badge badge-sweep-win">스윕승</span>;
      case "winning":
        return <span className="weekly-badge badge-winning">위닝</span>;
      case "split":
        return <span className="weekly-badge badge-split">1승1패</span>;
      case "losing":
        return <span className="weekly-badge badge-losing">루징</span>;
      case "sweep_loss":
        return <span className="weekly-badge badge-sweep-loss">스윕패</span>;
      default:
        return <span className="weekly-badge">{result}</span>;
    }
  };

  return (
    <AppShell activeTab="home" title="주간 리포트" backHref="/" theme="light" wide>
      <div className="weekly-report-container">
        
        {/* 주차 네비게이션 카드 */}
        <div className="weekly-report-title-card">
          <button 
            type="button" 
            className="weekly-nav-btn" 
            onClick={handlePrevWeek}
            aria-label="이전 주차 리포트 보기"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="weekly-title-center">
            <CalendarDays size={20} className="weekly-selector-icon" />
            <div className="weekly-title-text-group">
              <h2 className="weekly-selector-title">{weekName} 경기 성적</h2>
              <span className="weekly-selector-subtitle">실제 KBO 경기와 뉴스를 연동한 실시간 AI 분석 리포트</span>
            </div>
          </div>

          <button 
            type="button" 
            className="weekly-nav-btn" 
            onClick={handleNextWeek}
            disabled={isNextDisabled}
            aria-label="다음 주차 리포트 보기"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* 통합형 구단별 순위 리포트 목록 */}
        <div className="weekly-teams-analysis">
          <div className="weekly-section-header">
            <FileText size={18} className="weekly-header-icon" />
            <h3>주간 순위 리포트</h3>
          </div>

          {/* 테이블 스타일 가이드라인 헤더 */}
          {!isPending && (
            <div className="weekly-list-header-row" aria-hidden="true">
              <span className="col-lbl-rank">순위</span>
              <span className="col-lbl-team">팀명</span>
              <span className="col-lbl-record">전적</span>
              <span className="col-lbl-series">시리즈 결과</span>
              <span className="col-lbl-spacer"></span>
            </div>
          )}
          
          {isPending ? (
            <div className="weekly-report-empty-state">
              <div className="empty-icon-wrap">
                <FileText size={48} className="empty-icon" />
              </div>
              <p className="empty-title">아직 리포트가 생성되지 않은 주차입니다</p>
              <p className="empty-subtitle">
                주간 경기 일정이 모두 종료된 후 (일요일 자정 이후)<br />
                실제 경기 결과에 기반한 AI 분석 리포트가 생성됩니다.
              </p>
            </div>
          ) : (
            <div className="weekly-accordion-list">
              {initialRankings.map((team) => {
                const isExpanded = expandedTeam === team.teamCode;

                return (
                  <div 
                    key={team.teamCode} 
                    className={`weekly-accordion-item ${isExpanded ? "is-expanded" : ""}`}
                  >
                    {/* 아코디언 헤더 (표의 행 역할 수행) */}
                    <button 
                      type="button"
                      className="weekly-accordion-header"
                      onClick={() => toggleExpand(team.teamCode)}
                      aria-expanded={isExpanded}
                    >
                      <div className="weekly-header-grid">
                        {/* 순위 */}
                        <span className={`grid-rank ${team.weeklyRank <= 3 ? "is-top-three" : ""}`}>{team.weeklyRank}위</span>
                        
                        {/* 팀 배지 + 팀명 */}
                        <div className="grid-team">
                          <TeamBadge teamId={team.teamCode} size="sm" />
                          <span className="grid-team-name">{team.teamName.split(" ")[0]}</span>
                        </div>
                        
                        {/* 전적 */}
                        <span className="grid-record">{team.wins}승 {team.losses}패</span>
                        
                        {/* 시리즈 결과 배지 */}
                        <div className="grid-badges">
                          {renderResultBadge(team.series1.result)}
                          {renderResultBadge(team.series2.result)}
                        </div>
                        
                        {/* 펼치기 아이콘 */}
                        <span className="grid-chevron">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </button>

                    {/* 아코디언 바디 */}
                    {isExpanded && (
                      <div className="weekly-accordion-body">
                        {/* 주간 총평 */}
                        <div className="body-overall-card">
                          <span className="section-small-title">💡 이번 주 평가</span>
                          <p className="overall-comment-text">{team.overallComment}</p>
                        </div>

                        {/* 시리즈 2개 상세 */}
                        <div className="body-series-grid">
                          <div className="series-detail-box">
                            <div className="series-title-row">
                              <span className="series-title-label">시리즈 1</span>
                              <strong>vs {team.series1.opponent} ({team.series1.score})</strong>
                            </div>
                            <p className="series-summary">{team.series1.summary}</p>
                            <div className="series-details-content">{team.series1.details}</div>
                          </div>

                          <div className="series-detail-box">
                            <div className="series-title-row">
                              <span className="series-title-label">시리즈 2</span>
                              <strong>vs {team.series2.opponent} ({team.series2.score})</strong>
                            </div>
                            <p className="series-summary">{team.series2.summary}</p>
                            <div className="series-details-content">{team.series2.details}</div>
                          </div>
                        </div>
                        <ContentPointClaimButton
                          contentType="weekly_report_team"
                          contentId={`${currentWeekMon}|${team.teamCode}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
