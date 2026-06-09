"use client";

import { useMemo } from "react";
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
};

type Props = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  data: StatsTabData;
};

// KBO 10개 팀 대표 색상 매핑
const TEAM_COLORS: Record<string, string> = {
  lg: "#c30452",      // 트윈스 레드
  doosan: "#131230",  // 베어스 네이비
  kt: "#2b2b2b",      // 위즈 블랙
  samsung: "#074ca1",  // 라이온즈 블루
  ssg: "#e02027",      // 랜더스 레드
  nc: "#07306b",      // 다이노스 네이비
  kia: "#c70125",      // 타이거즈 레드
  hanwha: "#ff6600",   // 이글스 오렌지
  kiwoom: "#570514",   // 히어로즈 버건디
  lotte: "#041e42"     // 자이언츠 네이비
};

export function AiWinnerStatsTab({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, data }: Props) {
  const homeColor = TEAM_COLORS[homeTeamId] ?? "#e84a8a";
  const awayColor = TEAM_COLORS[awayTeamId] ?? "#475569";

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

  // 2. 팀 타선 방사형 데이터 정규화 (100점 만점 기준 보정)
  const radarData = useMemo(() => {
    const normalize = (val: number, min: number, max: number) => {
      return Math.round(Math.max(10, Math.min(100, ((val - min) / (max - min)) * 100)));
    };

    const h = data.batting.home;
    const a = data.batting.away;

    return [
      {
        subject: "타율",
        [homeTeamName]: normalize(h.avg, 0.200, 0.340),
        [awayTeamName]: normalize(a.avg, 0.200, 0.340),
        rawHome: h.avg.toFixed(3),
        rawAway: a.avg.toFixed(3)
      },
      {
        subject: "출루율",
        [homeTeamName]: normalize(h.obp, 0.260, 0.420),
        [awayTeamName]: normalize(a.obp, 0.260, 0.420),
        rawHome: h.obp.toFixed(3),
        rawAway: a.obp.toFixed(3)
      },
      {
        subject: "장타율",
        [homeTeamName]: normalize(h.slg, 0.300, 0.520),
        [awayTeamName]: normalize(a.slg, 0.300, 0.520),
        rawHome: h.slg.toFixed(3),
        rawAway: a.slg.toFixed(3)
      },
      {
        subject: "OPS",
        [homeTeamName]: normalize(h.ops, 0.550, 0.940),
        [awayTeamName]: normalize(a.ops, 0.550, 0.940),
        rawHome: h.ops.toFixed(3),
        rawAway: a.ops.toFixed(3)
      },
      {
        subject: "컨택",
        [homeTeamName]: Math.round(h.contact * 100),
        [awayTeamName]: Math.round(a.contact * 100),
        rawHome: `${Math.round(h.contact * 100)}점`,
        rawAway: `${Math.round(a.contact * 100)}점`
      }
    ];
  }, [data.batting, homeTeamName, awayTeamName]);

  // 3. 최근 10경기 득점 추이 꺾은선 차트 데이터 가공
  const lineData = useMemo(() => {
    const homeGames = data.recentGames.home;
    const awayGames = data.recentGames.away;
    const length = Math.max(homeGames.length, awayGames.length);

    return Array.from({ length }, (_, i) => ({
      name: `${i + 1}경기전`,
      [homeTeamName]: homeGames[i]?.score ?? 0,
      [awayTeamName]: awayGames[i]?.score ?? 0
    }));
  }, [data.recentGames, homeTeamName, awayTeamName]);

  return (
    <div className="ai-stats-tab-container">
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

        {/* 세부 수평 대칭 막대 그래프 리스트 */}
        <div className="ai-stats-starter-metrics">
          {(["era", "whip", "k9", "bb9"] as const).map((metric) => {
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
                    style={{ width: `${homePct}%`, background: homeColor }}
                  />
                  <div className="metric-bar-gap" />
                  <div
                    className="metric-bar away-bar"
                    style={{ width: `${awayPct}%`, background: awayColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── [섹션 2] 팀 타선 방사형 레이더 비교 ── */}
      <section className="ai-stats-section">
        <h3 className="ai-stats-section-title">오늘 출전 타선 전력 분석</h3>
        <p className="ai-stats-section-subtitle">
          * 최근 9인 선발 타순의 시즌 종합 성적을 백분율화한 지표입니다.
        </p>
        <div className="ai-stats-radar-wrapper">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#cbd5e1" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#475569", fontSize: 13, fontWeight: 800 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name={homeTeamName}
                dataKey={homeTeamName}
                stroke={homeColor}
                fill={homeColor}
                fillOpacity={0.25}
              />
              <Radar
                name={awayTeamName}
                dataKey={awayTeamName}
                stroke={awayColor}
                fill={awayColor}
                fillOpacity={0.25}
              />
              <Legend verticalAlign="bottom" height={36} />
              <Tooltip
                formatter={(value: any, name: any, props: any) => {
                  const isHome = name === homeTeamName;
                  const rawVal = isHome ? props.payload.rawHome : props.payload.rawAway;
                  return [`${rawVal} (${value}점)`, name];
                }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "700" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── [섹션 3] 최근 10경기 득점 페이스 ── */}
      <section className="ai-stats-section">
        <h3 className="ai-stats-section-title">최근 10경기 득점 흐름</h3>
        <div className="ai-stats-line-wrapper">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip
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
              />
              <Line
                type="monotone"
                dataKey={awayTeamName}
                stroke={awayColor}
                strokeWidth={3}
                activeDot={{ r: 6 }}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
