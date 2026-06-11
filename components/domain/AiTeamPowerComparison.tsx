"use client";

import { useEffect, useRef, useState } from "react";

type TeamStandingData = {
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  form: ("win" | "lose" | "draw")[];
  teamEra: number;
  teamBattingAvg: number;
};

type H2HRecordData = {
  wins: number;
  losses: number;
  draws: number;
};

type Props = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
  awayFill: string;
  homeStanding: TeamStandingData;
  awayStanding: TeamStandingData;
  h2hRecord: H2HRecordData;
};

export function AiTeamPowerComparison({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
  awayFill,
  homeStanding,
  awayStanding,
  h2hRecord
}: Props) {
  const [animate, setAnimate] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
        ([entry]) => {
          setAnimate(entry.isIntersecting);
        },
        { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
      );

      if (sectionRef.current) {
        observer.observe(sectionRef.current);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [remountKey]);

  // 승률 계산 (승 / (승 + 패))
  const getWinRate = (standing: TeamStandingData) => {
    const total = standing.wins + standing.losses;
    if (total === 0) return 0;
    return Number((standing.wins / total).toFixed(3));
  };

  const homeWinRate = getWinRate(homeStanding);
  const awayWinRate = getWinRate(awayStanding);

  // 대칭 게이지 비율 계산 헬퍼
  const getGaugePct = (metric: "winRate" | "batting" | "era") => {
    let homeVal = 0;
    let awayVal = 0;

    if (metric === "winRate") {
      homeVal = homeWinRate;
      awayVal = awayWinRate;
    } else if (metric === "batting") {
      homeVal = homeStanding.teamBattingAvg;
      awayVal = awayStanding.teamBattingAvg;
    } else if (metric === "era") {
      homeVal = homeStanding.teamEra;
      awayVal = awayStanding.teamEra;
    }

    const sum = homeVal + awayVal;
    if (sum === 0) return { homePct: 50, awayPct: 50 };

    let homeRatio = homeVal / sum;
    if (metric === "era") {
      // 평균자책점은 낮을수록 우수하므로 반전
      homeRatio = 1 - homeRatio;
    }

    const homePct = Math.max(15, Math.min(85, Math.round(homeRatio * 100)));
    return {
      homePct,
      awayPct: 100 - homePct
    };
  };

  // Form 뱃지 렌더링 헬퍼
  const renderFormBadges = (form: ("win" | "lose" | "draw")[]) => {
    if (!form || form.length === 0) {
      return <span className="no-form-data">-</span>;
    }
    return form.map((result, idx) => {
      let label = "무";
      let className = "is-draw";
      if (result === "win") {
        label = "승";
        className = "is-win";
      } else if (result === "lose") {
        label = "패";
        className = "is-lose";
      }
      return (
        <span key={idx} className={`form-badge ${className}`}>
          {label}
        </span>
      );
    });
  };

  // 대칭형 바 리스트 정의
  const metrics = [
    {
      key: "winRate" as const,
      label: "시즌 승률",
      homeDisplay: homeWinRate.toFixed(3).replace(/^0/, ""),
      awayDisplay: awayWinRate.toFixed(3).replace(/^0/, "")
    },
    {
      key: "batting" as const,
      label: "시즌 팀 타율",
      homeDisplay: homeStanding.teamBattingAvg.toFixed(3).replace(/^0/, ""),
      awayDisplay: awayStanding.teamBattingAvg.toFixed(3).replace(/^0/, "")
    },
    {
      key: "era" as const,
      label: "팀 평균자책점 (ERA)",
      homeDisplay: homeStanding.teamEra.toFixed(2),
      awayDisplay: awayStanding.teamEra.toFixed(2)
    }
  ];

  const handleTitleClick = () => {
    setAnimate(false);
    setRemountKey(prev => prev + 1);
  };

  return (
    <section
      key={remountKey}
      className="ai-stats-section team-power-comparison-card"
      ref={sectionRef}
    >
      <h3
        className="ai-stats-section-title"
        onClick={handleTitleClick}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        팀 전력 비교
      </h3>
      
      {/* ── 양 팀 순위 & 시즌 전적 ── */}
      <div className="power-card-header">
        <div className="power-team-profile text-left">
          <span className="power-team-name" style={{ color: homeColor }}>
            {homeTeamName}
          </span>
          <strong className="power-team-record">
            {homeStanding.rank}위 ({homeStanding.wins}승 {homeStanding.draws}무 {homeStanding.losses}패)
          </strong>
          <div className="power-team-form-row">
            {renderFormBadges(homeStanding.form)}
          </div>
        </div>

        <span className="power-vs-badge">VS</span>

        <div className="power-team-profile text-right">
          <span className="power-team-name" style={{ color: awayColor }}>
            {awayTeamName}
          </span>
          <strong className="power-team-record">
            {awayStanding.rank}위 ({awayStanding.wins}승 {awayStanding.draws}무 {awayStanding.losses}패)
          </strong>
          <div className="power-team-form-row justify-end">
            {renderFormBadges(awayStanding.form)}
          </div>
        </div>
      </div>

      {/* ── 주요 지표 대칭 가로 바 ── */}
      <div className="power-card-metrics">
        {metrics.map((metric, idx) => {
          const { homePct, awayPct } = getGaugePct(metric.key);
          return (
            <div className="starter-metric-row" key={metric.key}>
              <div className="metric-row-info">
                <span className="metric-value home-val">{metric.homeDisplay}</span>
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value away-val">{metric.awayDisplay}</span>
              </div>
              <div className="metric-bar-container">
                <div
                  className="metric-bar home-bar"
                  style={{
                    width: animate ? `${homePct}%` : "0%",
                    background: homeColor,
                    transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                    transitionDelay: `${idx * 80}ms`
                  }}
                />
                <div className="metric-bar-gap" style={{ marginLeft: "auto" }} />
                <div
                  className="metric-bar away-bar"
                  style={{
                    width: animate ? `${awayPct}%` : "0%",
                    background: awayFill,
                    transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                    transitionDelay: `${idx * 80}ms`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 시즌 상대 전적 ── */}
      {(() => {
        const totalH2hWins = h2hRecord.wins + h2hRecord.losses;
        const homeH2hRate = totalH2hWins > 0 ? (h2hRecord.wins / totalH2hWins) * 100 : 50;
        const awayH2hRate = totalH2hWins > 0 ? (h2hRecord.losses / totalH2hWins) * 100 : 50;

        const homeH2hRateDisplay = homeH2hRate.toFixed(0);
        const awayH2hRateDisplay = awayH2hRate.toFixed(0);

        // 게이지 최소/최대값 보정
        const homeH2hPct = Math.max(15, Math.min(85, Math.round(homeH2hRate)));
        const awayH2hPct = 100 - homeH2hPct;

        return (
          <div className="power-card-h2h-v2">
            <div className="metric-row-info">
              <div className="h2h-team-score text-left" style={{ color: homeColor }}>
                {homeTeamName} <strong>{h2hRecord.wins}승</strong>
              </div>
              
              <div className="metric-label" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                <span>이번 시즌 맞대결 승률</span>
                {h2hRecord.draws > 0 && (
                  <span className="h2h-draw-badge">{h2hRecord.draws}무승부</span>
                )}
              </div>
              
              <div className="h2h-team-score text-right" style={{ color: awayColor }}>
                {awayTeamName} <strong>{h2hRecord.losses}승</strong>
              </div>
            </div>

            <div className="h2h-bar-container">
              <div
                className="h2h-bar home-h2h-bar"
                style={{
                  width: animate ? `${homeH2hPct}%` : "0%",
                  background: homeColor,
                  transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                  transitionDelay: "240ms"
                }}
              />
              <div className="h2h-bar-gap" style={{ marginLeft: "auto" }} />
              <div
                className="h2h-bar away-h2h-bar"
                style={{
                  width: animate ? `${awayH2hPct}%` : "0%",
                  background: awayFill,
                  transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                  transitionDelay: "240ms"
                }}
              />
            </div>
          </div>
        );
      })()}
    </section>
  );
}
