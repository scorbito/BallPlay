"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  CalendarDays,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Flame,
  AlertTriangle,
  Lightbulb,
  Share2,
  Copy,
  Check
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import type { KboDailyReport, GameReport } from "@/lib/utils/dailyReportHelper";

type DailyReportScreenProps = {
  initialReport: KboDailyReport;
  reportDate: string;
  isPending?: boolean;
  isNoGames?: boolean;
  isFailed?: boolean;
  isAdmin?: boolean;
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
  isFailed = false,
  isAdmin = false 
}: DailyReportScreenProps) {
  const [activeTab, setActiveTab] = useState<"brief" | "games">("brief");
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const hasReport = !isPending && !isNoGames && !isFailed;
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  // 운영자 수동 리포트 생성 요청 핸들러
  const handleGenerateReport = async () => {
    if (generating) return;
    
    if (!confirm(`[운영자] ${reportDate} 날짜에 대해 일일 AI 분석 리포트를 재생성(재발행)하시겠습니까?\n(제미나이 API 일일 무료 호출 쿼터가 소모됩니다.)`)) {
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/daily-report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate })
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "리포트 생성에 실패했습니다.");
      }

      alert("성공적으로 일일 AI 리포트가 발행되었습니다!");
      router.refresh(); // 서버 데이터 새로고침
    } catch (err) {
      alert(`[에러] ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  // 날짜 포맷팅 (예: "2026년 6월 9일 (화)")
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
    initialReport.headlines.forEach((h, idx) => {
      shareText += `${idx + 1}. ${h}\n`;
    });
    
    if (initialReport.dailyMvpName !== "-") {
      shareText += `\n🏆 오늘의 MVP: ${initialReport.dailyMvpName}\n- ${initialReport.dailyMvpComment}\n`;
    }
    
    shareText += `\n더 자세한 경기별 패배/승리 요인 분석은 야구놀이터에서 확인해 보세요!`;

    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AppShell activeTab="home" title="일일 리포트" backHref="/" theme="light" wide>
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

        {/* 운영자 수동 리포트 발행 바 */}
        {isAdmin && (
          <div className="daily-admin-bar">
            <button
              type="button"
              className="daily-admin-btn"
              disabled={generating}
              onClick={handleGenerateReport}
            >
              <Flame size={16} className={generating ? "admin-spin" : ""} />
              <span>{generating ? "AI 일일 리포트 분석 중..." : "AI 일일 리포트 강제 발행 (운영자)"}</span>
            </button>
          </div>
        )}

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
              경기별 분석 ({initialReport.gameReports.length})
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
                <p className="empty-title">해당 일자의 AI 일일 리포트가 존재하지 않습니다</p>
                <p className="empty-subtitle">
                  일시적인 분석 오류 혹은 데이터 누락으로 리포트가 발행되지 않았습니다.<br />
                  {isAdmin && "운영자이신 경우 상단의 '강제 발행' 버튼으로 재생성을 시도하실 수 있습니다."}
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
                    {initialReport.headlines.map((hl, idx) => (
                      <li key={idx} className="headline-item">
                        <span className="bullet-num">{idx + 1}</span>
                        <p>{hl}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 오늘의 KBO MVP */}
                {initialReport.dailyMvpName && initialReport.dailyMvpName !== "-" && (
                  <div className="daily-card daily-mvp-card">
                    <div className="mvp-badge-header">
                      <Trophy className="mvp-trophy" size={24} />
                      <span className="mvp-badge-title">TODAY'S KBO MVP</span>
                    </div>
                    <div className="mvp-content">
                      <h4 className="mvp-name">{initialReport.dailyMvpName}</h4>
                      <p className="mvp-comment">{initialReport.dailyMvpComment}</p>
                    </div>
                  </div>
                )}

                {/* 주요 토픽 이슈 */}
                <div className="daily-card daily-topics-card">
                  <h3 className="card-title">🔥 오늘의 주요 이슈</h3>
                  <div className="topics-list">
                    {initialReport.hotTopics.map((topic, idx) => (
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
                  <p className="standings-summary-text">{initialReport.standingsSummary}</p>
                </div>

              </div>
            )}

            {/* 탭 2: 경기별 상세 리포트 */}
            {activeTab === "games" && (
              <div className="daily-tab-content-games">
                {initialReport.gameReports.length === 0 ? (
                  <p className="no-games-text">해당 날짜에는 경기가 없거나 취소되었습니다.</p>
                ) : (
                  <div className="daily-game-accordion-list">
                    {initialReport.gameReports.map((report) => {
                      const isExpanded = expandedGame === report.gameId;
                      const homeTeam = teams.find(t => t.id === report.homeTeamId);
                      const awayTeam = teams.find(t => t.id === report.awayTeamId);

                      // 승자 색상 분기를 위함
                      const isHomeWinner = report.homeScore > report.awayScore;
                      const isDraw = report.homeScore === report.awayScore;

                      return (
                        <div 
                          key={report.gameId}
                          className={`daily-game-accordion-item ${isExpanded ? "is-expanded" : ""}`}
                        >
                          {/* 스코어보드 헤더 */}
                          <button
                            type="button"
                            className="daily-game-header"
                            onClick={() => toggleExpandGame(report.gameId)}
                            aria-expanded={isExpanded}
                          >
                            <div className="game-score-row">
                              {/* 원정팀 */}
                              <div className={`score-team-cell away-cell ${!isHomeWinner && !isDraw ? "is-winner" : ""}`}>
                                <span className="team-name-text">{awayTeam?.shortName ?? report.awayTeamId}</span>
                                <TeamBadge teamId={report.awayTeamId} size="sm" />
                                <span className="score-num-text">{report.awayScore}</span>
                              </div>

                              {/* VS / 상태 분절 */}
                              <div className="score-versus-cell">
                                <span className="vs-label">VS</span>
                              </div>

                              {/* 홈팀 */}
                              <div className={`score-team-cell home-cell ${isHomeWinner && !isDraw ? "is-winner" : ""}`}>
                                <span className="score-num-text">{report.homeScore}</span>
                                <TeamBadge teamId={report.homeTeamId} size="sm" />
                                <span className="team-name-text">{homeTeam?.shortName ?? report.homeTeamId}</span>
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
                                <p className="summary-text">{report.summary}</p>
                              </div>

                              {/* 승리/패배 요인 그리드 */}
                              {report.winningFactors.length > 0 && (
                                <div className="game-factors-grid">
                                  {/* 승리요인 */}
                                  <div className="factor-box factor-winning">
                                    <h5 className="factor-title">
                                      <span className="dot dot-win"></span>
                                      승리 요인
                                    </h5>
                                    <ul className="factor-list">
                                      {report.winningFactors.map((wf, idx) => (
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
                                      {report.losingFactors.map((lf, idx) => (
                                        <li key={idx}>{lf}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}

                              {/* 경기 히어로 수훈 */}
                              {report.gameHeroName && report.gameHeroName !== "-" && (
                                <div className="game-hero-box">
                                  <span className="hero-label">Today's Hero</span>
                                  <strong className="hero-name">{report.gameHeroName}</strong>
                                  <p className="hero-desc">{report.gameHeroComment}</p>
                                </div>
                              )}

                              {/* AI 한 줄 드립 평 */}
                              {report.oneLiner && (
                                <div className="game-oneliner-box">
                                  <span className="oneliner-quote">“</span>
                                  <p className="oneliner-text">{report.oneLiner}</p>
                                  <span className="oneliner-quote-end">”</span>
                                </div>
                              )}

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
    </AppShell>
  );
}
