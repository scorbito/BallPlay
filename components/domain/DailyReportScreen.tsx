"use client";

import { useState, useEffect } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  CalendarDays,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Flame,
  Lightbulb,
  Copy,
  Check
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import type { KboDailyReport } from "@/lib/utils/dailyReportHelper";
import { PageViewCounter } from "@/components/domain/PageViewCounter";
import { ContentPointClaimButton } from "@/components/domain/points/ContentPointClaimButton";


type DailyReportScreenProps = {
  initialReport: KboDailyReport;
  reportDate: string;
  isPending?: boolean;
  isNoGames?: boolean;
  isFailed?: boolean;
  isNoReport?: boolean;
  focus?: string;
  backHref?: string;
  reportPublishedAt?: string | null;
};

// YYYY-MM-DD 날짜 차감/가산 헬퍼
function offsetDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// 요일 구하기 한글 헬퍼
function getDayOfWeekKr(dateStr: string): string {
  const week = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return week[d.getDay()];
}

export function DailyReportScreen({ 
  initialReport, 
  reportDate, 
  isPending = false, 
  isNoGames = false,
  isFailed: initialIsFailed = false,
  isNoReport: initialIsNoReport = false,
  focus,
  backHref,
  reportPublishedAt = null
}: DailyReportScreenProps) {
  const [activeTab, setActiveTab] = useState<"brief" | "games">("brief");
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  
  // 클라이언트 내부 상태 관리
  const [report, setReport] = useState<KboDailyReport>(initialReport);
  const [isFailed, setIsFailed] = useState(initialIsFailed);
  const [isNoReport, setIsNoReport] = useState(initialIsNoReport);
  const [contentPublishedAt, setContentPublishedAt] = useState<string | null>(reportPublishedAt);

  const hasReport = !isPending && !isNoGames && !isFailed && !isNoReport;
  const reportContentId = contentPublishedAt ? `${reportDate}|${contentPublishedAt}` : reportDate;
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // 날짜나 서버 리프레시 시 상태 갱신
  useEffect(() => {
    setReport(initialReport);
    setIsFailed(initialIsFailed);
    setIsNoReport(initialIsNoReport);
    setContentPublishedAt(reportPublishedAt);
  }, [initialReport, initialIsFailed, initialIsNoReport, reportDate, reportPublishedAt]);

  // 포커스 경기 자동 확장 및 탭 전환
  useEffect(() => {
    if (focus) {
      setExpandedGame(focus);
      setActiveTab("games");
    }
  }, [focus]);
  // Date label formatting
  const [yStr, mStr, dStr] = reportDate.split("-");
  const formattedDate = `${parseInt(yStr, 10)}년 ${parseInt(mStr, 10)}월 ${parseInt(dStr, 10)}일 (${getDayOfWeekKr(reportDate)})`;

  // 이전 날짜 이동 (1일 차감)
  const handlePrevDay = () => {
    const prevDate = offsetDateStr(reportDate, -1);
    router.push(`/daily-report?date=${prevDate}`);
    setExpandedGame(null);
  };

  // 다음 날짜 이동 (1일 가산)
  const handleNextDay = () => {
    const nextDate = offsetDateStr(reportDate, 1);
    router.push(`/daily-report?date=${nextDate}`);
    setExpandedGame(null);
  };

  // 다음 날로 가기 비활성화: 오늘 날짜 이상이면 차단
  const todayKSTStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const isNextDisabled = reportDate >= todayKSTStr;

  // 경기 상세 아코디언 토글
  const toggleExpandGame = (gameId: string) => {
    setExpandedGame(prev => (prev === gameId ? null : gameId));
  };

  // 클립보드 공유 복사 기능
  const handleCopyShare = () => {
    if (copied) return;
    
    let shareText = `[KBO 일일 AI 분석 리포트 - ${formattedDate}]\n\n`;
    shareText += `⭐ 오늘의 KBO 3줄 요약\n`;
    report.headlines.forEach((h, idx) => {
      shareText += `${idx + 1}. ${h}\n`;
    });
    
    if (report.dailyMvpName !== "-") {
      shareText += `\n🏆 오늘의 MVP: ${report.dailyMvpName}\n- ${report.dailyMvpComment}\n`;
    }
    
    shareText += `\n더 자세한 경기별 패배/승리 요인 분석은 야구놀이터에서 확인해 보세요!`;

    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AppShell activeTab="home" title="일일 리포트" backHref={backHref ?? "/"} theme="light" wide>
      <div className="daily-report-container">
        
        {/* 날짜 선택 네비게이션 카드 */}
        <div className="daily-report-title-card">
          <button 
            type="button" 
            className="daily-nav-btn" 
            onClick={handlePrevDay}
            aria-label="이전 날짜 리포트 보기"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="daily-title-center">
            <CalendarDays size={20} className="daily-selector-icon" />
            <div className="daily-title-text-group">
              <h2 className="daily-selector-title">{formattedDate} 경기</h2>
              <span className="daily-selector-subtitle">경기 정보와 뉴스를 종합한 AI 일일 분석 리포트</span>
            </div>
          </div>

          <button 
            type="button" 
            className="daily-nav-btn" 
            onClick={handleNextDay}
            disabled={isNextDisabled}
            aria-label="다음 날짜 리포트 보기"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        {hasReport && (
          <div className="daily-tabs">
            <button
              type="button"
              className={`daily-tab-btn ${activeTab === "brief" ? "active" : ""}`}
              onClick={() => setActiveTab("brief")}
            >
              종합 브리핑
            </button>
            <button
              type="button"
              className={`daily-tab-btn ${activeTab === "games" ? "active" : ""}`}
              onClick={() => setActiveTab("games")}
            >
              경기별 분석 ({report.gameReports.length})
            </button>
          </div>
        )}

        {!hasReport ? (
          <div className="daily-report-empty-state">
            <div className="empty-icon-wrap">
              <FileText size={48} className="empty-icon" />
            </div>
            {isNoGames && (
              <>
                <p className="empty-title">예정되거나 진행된 경기가 없는 날입니다</p>
                <p className="empty-subtitle">
                  해당 날짜에는 프로야구(KBO) 경기 일정이 편성되지 않아<br />
                  AI 분석 리포트를 발행하지 않습니다.
                </p>
              </>
            )}
            {isPending && (
              <>
                <p className="empty-title">AI 일일 리포트 생성 대기 중입니다</p>
                <p className="empty-subtitle">
                  오늘 열리는 모든 경기가 정상적으로 종료되고 관련 뉴스가 송출되면<br />
                  AI가 경기 결과와 실황 뉴스를 종합하여 리포트를 자동으로 분석·발행합니다.
                </p>
              </>
            )}
            {isFailed && (
              <>
                <p className="empty-title">해당 일자의 AI 일일 리포트 발행에 실패했습니다</p>
                <p className="empty-subtitle" style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                  <span>일시적인 분석 오류 또는 데이터 누락으로 리포트가 발행되지 않았습니다.</span>
                </p>
              </>
            )}
            {isNoReport && (
              <>
                <p className="empty-title">발행된 일일 리포트가 없습니다</p>
                <p className="empty-subtitle">
                  해당 날짜에는 AI 일일 리포트가 자동으로 발행되지 않았습니다.<br />
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="daily-report-content">
            
            {/* 탭 1: 종합 브리핑 */}
            {activeTab === "brief" && (
              <div className="daily-tab-content-brief">
                
                {/* 3줄 요약 카드 */}
                <div className="daily-card daily-headline-card">
                  <div className="card-header-with-action">
                    <h3 className="card-title">💡 오늘의 KBO 3줄 요약</h3>
                    <button 
                      type="button" 
                      className="share-copy-btn" 
                      onClick={handleCopyShare}
                      title="종합 리포트 텍스트 복사"
                    >
                      {copied ? <Check size={18} className="text-green" /> : <Copy size={18} />}
                      <span>{copied ? "복사완료" : "공유 복사"}</span>
                    </button>
                  </div>
                  <ul className="headline-list">
                    {report.headlines.map((hl, idx) => (
                      <li key={idx} className="headline-item">
                        <span className="bullet-num">{idx + 1}</span>
                        <p>{hl}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 오늘의 KBO MVP */}
                {report.dailyMvpName && report.dailyMvpName !== "-" && (
                  <div className="daily-card daily-mvp-card">
                    <div className="mvp-badge-header">
                      <Trophy className="mvp-trophy" size={24} />
                      <span className="mvp-badge-title">TODAY&apos;S KBO MVP</span>
                    </div>
                    <div className="mvp-content">
                      <h4 className="mvp-name">{report.dailyMvpName}</h4>
                      <p className="mvp-comment">{report.dailyMvpComment}</p>
                    </div>
                  </div>
                )}

                {/* 주요 토픽 이슈 */}
                <div className="daily-card daily-topics-card">
                  <h3 className="card-title">🔥 오늘의 주요 이슈</h3>
                  <div className="topics-list">
                    {report.hotTopics.map((topic, idx) => (
                      <div key={idx} className="topic-item">
                        <h4 className="topic-item-title">
                          <Flame size={16} className="topic-icon" />
                          {topic.title}
                        </h4>
                        <p className="topic-item-desc">{topic.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 순위 변동 해설 */}
                <div className="daily-card daily-standings-card">
                  <h3 className="card-title">📈 순위 판도 변동</h3>
                  <p className="standings-summary-text">{report.standingsSummary}</p>
                </div>

                <ContentPointClaimButton contentType="daily_report" contentId={reportContentId} />

              </div>
            )}

            {/* 탭 2: 경기별 상세 리포트 */}
            {activeTab === "games" && (
              <div className="daily-tab-content-games">
                {report.gameReports.length === 0 ? (
                  <p className="no-games-text">해당 날짜에는 경기가 없거나 취소되었습니다.</p>
                ) : (
                  <div className="daily-game-accordion-list">
                    {report.gameReports.map((gameReport) => {
                      const isExpanded = expandedGame === gameReport.gameId;
                      const homeTeam = teams.find(t => t.id === gameReport.homeTeamId);
                      const awayTeam = teams.find(t => t.id === gameReport.awayTeamId);

                      // 승자 색상 분기를 위함
                      const isHomeWinner = gameReport.homeScore > gameReport.awayScore;
                      const isDraw = gameReport.homeScore === gameReport.awayScore;

                      return (
                        <div 
                          key={gameReport.gameId}
                          className={`daily-game-accordion-item ${isExpanded ? "is-expanded" : ""}`}
                        >
                          {/* 스코어보드 헤더 */}
                          <button
                            type="button"
                            className="daily-game-header"
                            onClick={() => toggleExpandGame(gameReport.gameId)}
                            aria-expanded={isExpanded}
                          >
                            <div className="game-score-row">
                              {/* 원정팀 */}
                              <div className={`score-team-cell away-cell ${!isHomeWinner && !isDraw ? "is-winner" : ""}`}>
                                <span className="team-name-text">{awayTeam?.shortName ?? gameReport.awayTeamId}</span>
                                <TeamBadge teamId={gameReport.awayTeamId} size="sm" />
                                <span className="score-num-text">{gameReport.awayScore}</span>
                              </div>

                              {/* VS / 상태 분절 */}
                              <div className="score-versus-cell">
                                <span className="vs-label">VS</span>
                              </div>

                              {/* 홈팀 */}
                              <div className={`score-team-cell home-cell ${isHomeWinner && !isDraw ? "is-winner" : ""}`}>
                                <span className="score-num-text">{gameReport.homeScore}</span>
                                <TeamBadge teamId={gameReport.homeTeamId} size="sm" />
                                <span className="team-name-text">{homeTeam?.shortName ?? gameReport.homeTeamId}</span>
                              </div>

                              {/* 펼치기 아이콘 */}
                              <span className="game-expand-chevron">
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </span>
                            </div>
                          </button>

                          {/* 경기 분석 아코디언 바디 */}
                          {isExpanded && (
                            <div className="daily-game-body">
                              
                              {/* 경기 총평 */}
                              <div className="game-summary-box">
                                <Lightbulb size={18} className="summary-bulb-icon" />
                                <p className="summary-text">{gameReport.summary}</p>
                              </div>

                              {/* 승리/패배 요인 그리드 */}
                              {gameReport.winningFactors.length > 0 && (
                                <div className="game-factors-grid">
                                  {/* 승리요인 */}
                                  <div className="factor-box factor-winning">
                                    <h5 className="factor-title">
                                      <span className="dot dot-win"></span>
                                      승리 요인
                                    </h5>
                                    <ul className="factor-list">
                                      {gameReport.winningFactors.map((wf, idx) => (
                                        <li key={idx}>{wf}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* 패배요인 */}
                                  <div className="factor-box factor-losing">
                                    <h5 className="factor-title">
                                      <span className="dot dot-lose"></span>
                                      패배 아쉬운 점
                                    </h5>
                                    <ul className="factor-list">
                                      {gameReport.losingFactors.map((lf, idx) => (
                                        <li key={idx}>{lf}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}

                              {/* 경기 히어로 수훈 */}
                              {gameReport.gameHeroName && gameReport.gameHeroName !== "-" && (
                                <div className="game-hero-box">
                                  <span className="hero-label">Today&apos;s Hero</span>
                                  <strong className="hero-name">{gameReport.gameHeroName}</strong>
                                  <p className="hero-desc">{gameReport.gameHeroComment}</p>
                                </div>
                              )}

                              {/* AI 한 줄 드립 평 */}
                              {gameReport.oneLiner && (
                                <div className="game-oneliner-box">
                                  <span className="oneliner-quote">“</span>
                                  <p className="oneliner-text">{gameReport.oneLiner}</p>
                                  <span className="oneliner-quote-end">”</span>
                                </div>
                              )}

                              <ContentPointClaimButton
                                contentType="daily_report_game"
                                contentId={contentPublishedAt ? `${reportDate}|${contentPublishedAt}|${gameReport.gameId}` : `${reportDate}:${gameReport.gameId}`}
                              />

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
      <PageViewCounter />
    </AppShell>
  );
}
