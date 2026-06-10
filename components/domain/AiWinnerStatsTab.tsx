"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { getTeam } from "@/lib/constants/teams";
import { AiTeamPowerComparison } from "./AiTeamPowerComparison";

type StarterStats = {
  name: string;
  era: number;
  whip: number;
  k9: number;
  bb9: number;
};

type BattingStats = {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  contact: number;
};

type RecentGame = {
  date: string;
  score: number;
  opponentScore: number;
};

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

export type StatsTabData = {
  starters: {
    home: StarterStats;
    away: StarterStats;
  };
  batting: {
    home: BattingStats;
    away: BattingStats;
  };
  recentGames: {
    home: RecentGame[];
    away: RecentGame[];
  };
  teamStandings?: {
    home: TeamStandingData;
    away: TeamStandingData;
  };
  h2hRecord?: H2HRecordData;
};

type Props = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  data: StatsTabData;
};

// ── 팀 컬러 대비 보정 ──────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function mix(c: [number, number, number], t: [number, number, number], amt: number): [number, number, number] {
  return [c[0] + (t[0] - c[0]) * amt, c[1] + (t[1] - c[1]) * amt, c[2] + (t[2] - c[2]) * amt];
}
function ensureAwayFill(homeHex: string, awayHex: string, awayAccent?: string): string {
  const home = hexToRgb(homeHex);
  const away = hexToRgb(awayHex);
  if (colorDist(home, away) >= 110) return awayHex; // 충분히 다름

  if (awayAccent) {
    const acc = hexToRgb(awayAccent);
    if (colorDist(home, acc) >= 110) return awayAccent;
  }

  const lighter = mix(away, [255, 255, 255], 0.55);
  const darker = mix(away, [0, 0, 0], 0.5);
  const chosen = colorDist(home, lighter) >= colorDist(home, darker) ? lighter : darker;
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}

export function AiWinnerStatsTab({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, data }: Props) {
  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);

  const homeColor = home.color;
  const awayColor = away.color;
  const awayFill = ensureAwayFill(homeColor, awayColor, away.accent);

  // 스크롤 감지 및 애니메이션 상태 정의
  const [animateStarters, setAnimateStarters] = useState(false);
  const [animateBatting, setAnimateBatting] = useState(false);
  const [animateRecentFlow, setAnimateRecentFlow] = useState(false);

  const startersSectionRef = useRef<HTMLDivElement>(null);
  const battingSectionRef = useRef<HTMLDivElement>(null);
  const recentFlowSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let startersObserver: IntersectionObserver | null = null;
    let battingObserver: IntersectionObserver | null = null;
    let recentFlowObserver: IntersectionObserver | null = null;

    // 마운트 시점의 레이아웃이 완전히 정렬된 뒤(150ms 후) 정확한 뷰포트 교차 상태 감지 시작
    const timer = setTimeout(() => {
      const config = { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }; // 하단 마진 -80px을 주어 확실히 스크롤해서 보일 때 트리거

      startersObserver = new IntersectionObserver(([entry]) => {
        setAnimateStarters(entry.isIntersecting);
      }, config);

      battingObserver = new IntersectionObserver(([entry]) => {
        setAnimateBatting(entry.isIntersecting);
      }, config);

      recentFlowObserver = new IntersectionObserver(([entry]) => {
        setAnimateRecentFlow(entry.isIntersecting);
      }, config);

      if (startersSectionRef.current) {
        startersObserver.observe(startersSectionRef.current);
      }
      if (battingSectionRef.current) {
        battingObserver.observe(battingSectionRef.current);
      }
      if (recentFlowSectionRef.current) {
        recentFlowObserver.observe(recentFlowSectionRef.current);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (startersObserver) startersObserver.disconnect();
      if (battingObserver) battingObserver.disconnect();
      if (recentFlowObserver) recentFlowObserver.disconnect();
    };
  }, []);

  // 1. 선발 투수 지표 게이지 비율 계산 헬퍼
  // ERA, WHIP는 낮을수록 우수하므로 가로 대칭 바가 역으로 넓어지게 처리
  const getPitcherGauge = (metric: "era" | "whip" | "k9" | "bb9") => {
    const homeVal = data.starters.home[metric];
    const awayVal = data.starters.away[metric];
    const sum = homeVal + awayVal;
    if (sum === 0) return { homePct: 50, awayPct: 50 };

    let homeRatio = homeVal / sum;
    if (metric === "era" || metric === "whip" || metric === "bb9") {
      // 낮을수록 유리한 지표는 반전
      homeRatio = 1 - homeRatio;
    }
    const homePct = Math.max(15, Math.min(85, Math.round(homeRatio * 100)));
    return {
      homePct,
      awayPct: 100 - homePct
    };
  };

  // 2. 팀 타선 지표 게이지 비율 계산 헬퍼 (높을수록 좋음)
  const getBatterGauge = (metric: keyof BattingStats) => {
    const homeVal = data.batting.home[metric];
    const awayVal = data.batting.away[metric];
    const sum = homeVal + awayVal;
    if (sum === 0) return { homePct: 50, awayPct: 50 };

    const homeRatio = homeVal / sum;
    const homePct = Math.max(15, Math.min(85, Math.round(homeRatio * 100)));
    return {
      homePct,
      awayPct: 100 - homePct
    };
  };

  // 3. 최근 10경기 누적 승리 흐름 가공
  const lineData = useMemo(() => {
    const homeGames = data.recentGames.home;
    const awayGames = data.recentGames.away;
    const length = Math.max(homeGames.length, awayGames.length);

    let homeWinsAcc = 0;
    let awayWinsAcc = 0;

    return Array.from({ length }, (_, i) => {
      const homeG = homeGames[i];
      const awayG = awayGames[i];

      if (homeG && homeG.score > homeG.opponentScore) {
        homeWinsAcc += 1;
      }
      if (awayG && awayG.score > awayG.opponentScore) {
        awayWinsAcc += 1;
      }

      let label = `${10 - i}경기전`;
      if (i === length - 1) {
        label = "최근";
      }

      return {
        name: label,
        [homeTeamName]: homeWinsAcc,
        [awayTeamName]: awayWinsAcc
      };
    });
  }, [data.recentGames, homeTeamName, awayTeamName]);

  // 최근 10경기 승패 요약 계산
  const homeSummary = useMemo(() => {
    let w = 0, d = 0, l = 0;
    data.recentGames.home.forEach((g) => {
      if (g.score > g.opponentScore) w++;
      else if (g.score < g.opponentScore) l++;
      else d++;
    });
    return `${w}승 ${d}무 ${l}패`;
  }, [data.recentGames.home]);

  const awaySummary = useMemo(() => {
    let w = 0, d = 0, l = 0;
    data.recentGames.away.forEach((g) => {
      if (g.score > g.opponentScore) w++;
      else if (g.score < g.opponentScore) l++;
      else d++;
    });
    return `${w}승 ${d}무 ${l}패`;
  }, [data.recentGames.away]);

  return (
    <div className="ai-stats-tab-container">
      {/* ── [섹션 0] 팀 전력 비교 ── */}
      {data.teamStandings && data.h2hRecord && (
        <AiTeamPowerComparison
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          homeColor={homeColor}
          awayColor={awayColor}
          awayFill={awayFill}
          homeStanding={data.teamStandings.home}
          awayStanding={data.teamStandings.away}
          h2hRecord={data.h2hRecord}
        />
      )}

      {/* ── [섹션 1] 선발 투수 지표 대조 ── */}
      <section className="ai-stats-section">
        <h3 className="ai-stats-section-title">선발 투수 매치업 지표</h3>
        <div className="ai-stats-starter-header">
          <div className="ai-stats-starter-profile text-left">
            <span className="starter-label-team" style={{ color: homeColor }}>
              {homeTeamName}
            </span>
            <strong className="starter-label-name">{data.starters.home.name}</strong>
          </div>
          <span className="starter-vs-badge">VS</span>
          <div className="ai-stats-starter-profile text-right">
            <span className="starter-label-team" style={{ color: awayColor }}>
              {awayTeamName}
            </span>
            <strong className="starter-label-name">{data.starters.away.name}</strong>
          </div>
        </div>

        <div className="ai-stats-starter-metrics" ref={startersSectionRef}>
          {(["era", "whip", "k9", "bb9"] as const).map((metric, idx) => {
            const label =
              metric === "era"
                ? "평균자책점 (ERA)"
                : metric === "whip"
                  ? "출루허용률 (WHIP)"
                  : metric === "k9"
                    ? "9이닝 탈삼진 (K/9)"
                    : "9이닝 볼넷 (BB/9)";
            const homeVal = data.starters.home[metric];
            const awayVal = data.starters.away[metric];
            const { homePct, awayPct } = getPitcherGauge(metric);

            return (
              <div className="starter-metric-row" key={metric}>
                <div className="metric-row-info">
                  <span className="metric-value home-val">{homeVal.toFixed(2)}</span>
                  <span className="metric-label">{label}</span>
                  <span className="metric-value away-val">{awayVal.toFixed(2)}</span>
                </div>
                <div className="metric-bar-container">
                  <div
                    className="metric-bar home-bar"
                    style={{
                      width: animateStarters ? `${homePct}%` : "0%",
                      background: homeColor,
                      transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                      transitionDelay: `${idx * 80}ms`
                    }}
                  />
                  <div className="metric-bar-gap" style={{ marginLeft: "auto" }} />
                  <div
                    className="metric-bar away-bar"
                    style={{
                      width: animateStarters ? `${awayPct}%` : "0%",
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
      </section>

      {/* ── [섹션 2] 팀 타선 지표 대조 ── */}
      <section className="ai-stats-section">
        <h3 className="ai-stats-section-title">최근 선발 타선 전력 비교</h3>
        <p className="ai-stats-section-subtitle">
          * 최근 9인 선발 타순의 시즌 종합 성적을 대칭 지표로 나타낸 것입니다.
        </p>
        <div className="ai-stats-starter-header">
          <div className="ai-stats-starter-profile text-left">
            <span className="starter-label-team" style={{ color: homeColor }}>
              {homeTeamName}
            </span>
          </div>
          <span className="starter-vs-badge">VS</span>
          <div className="ai-stats-starter-profile text-right">
            <span className="starter-label-team" style={{ color: awayColor }}>
              {awayTeamName}
            </span>
          </div>
        </div>

        <div className="ai-stats-starter-metrics" ref={battingSectionRef}>
          {(["avg", "obp", "slg", "ops", "contact"] as const).map((metric, idx) => {
            const label =
              metric === "avg"
                ? "타율 (AVG)"
                : metric === "obp"
                  ? "출루율 (OBP)"
                  : metric === "slg"
                    ? "장타율 (SLG)"
                    : metric === "ops"
                      ? "OPS"
                      : "컨택 점수 (Contact)";
            const homeVal = data.batting.home[metric];
            const awayVal = data.batting.away[metric];
            const { homePct, awayPct } = getBatterGauge(metric);

            // 컨택만 100점 만점, 타율/장타율/출루율/OPS는 소수점 3자리 표출 (.280 등)
            const formatValue = (val: number) => {
              if (metric === "contact") return Math.round(val * 100).toString();
              return val.toFixed(3).replace(/^0/, "");
            };

            return (
              <div className="starter-metric-row" key={metric}>
                <div className="metric-row-info">
                  <span className="metric-value home-val">{formatValue(homeVal)}</span>
                  <span className="metric-label">{label}</span>
                  <span className="metric-value away-val">{formatValue(awayVal)}</span>
                </div>
                <div className="metric-bar-container">
                  <div
                    className="metric-bar home-bar"
                    style={{
                      width: animateBatting ? `${homePct}%` : "0%",
                      background: homeColor,
                      transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                      transitionDelay: `${idx * 80}ms`
                    }}
                  />
                  <div className="metric-bar-gap" style={{ marginLeft: "auto" }} />
                  <div
                    className="metric-bar away-bar"
                    style={{
                      width: animateBatting ? `${awayPct}%` : "0%",
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
      </section>

      {/* ── [섹션 3] 최근 10경기 승리 누적 흐름 ── */}
      <section className="ai-stats-section">
        <h3 className="ai-stats-section-title">최근 10경기 승리 누적 흐름</h3>
        <p className="ai-stats-section-subtitle" style={{ marginBottom: "10px" }}>
          * 10경기 전부터 최근 경기까지의 누적 승리 횟수 추이(상승 곡선)입니다.
        </p>
        <div className="ai-stats-recent-summary" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "800", color: "#475569", marginBottom: "16px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px" }}>
          <span style={{ color: homeColor }}>{homeTeamName}: {homeSummary}</span>
          <span style={{ color: awayColor }}>{awayTeamName}: {awaySummary}</span>
        </div>
        <div className="ai-stats-line-wrapper" ref={recentFlowSectionRef}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              key={animateRecentFlow ? "active" : "inactive"}
              data={lineData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} domain={[0, 10]} />
              <Tooltip
                formatter={(value: any, name: any) => [`${value}승`, name]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "700" }}
              />
              <Legend verticalAlign="top" height={32} />
              <Line
                type="monotone"
                dataKey={homeTeamName}
                stroke={homeColor}
                strokeWidth={3}
                activeDot={{ r: 6 }}
                dot={{ r: 3 }}
                isAnimationActive={animateRecentFlow}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey={awayTeamName}
                stroke={awayFill}
                strokeWidth={3}
                activeDot={{ r: 6 }}
                dot={{ r: 3 }}
                isAnimationActive={animateRecentFlow}
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
