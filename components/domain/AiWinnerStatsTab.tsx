"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { getTeam } from "@/lib/constants/teams";
import { AiTeamPowerComparison } from "./AiTeamPowerComparison";

type StarterStats = {
  name: string;
  wins?: number;
  losses?: number;
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  vsOpponent?: PitcherVsOpponentStats | null;
};

type PitcherVsOpponentStats = {
  games: number;
  starts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  outs: number;
  innings: number;
  era: number | null;
  whip: number | null;
  k9: number | null;
  bb9: number | null;
  strikeouts: number;
  last_game_date: string | null;
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

  // 최근 10경기 누적 승리 흐름 가공
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
      <AiStartersSection
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeColor={homeColor}
        awayColor={awayColor}
        awayFill={awayFill}
        starters={data.starters}
      />

      {/* ── [섹션 2] 팀 타선 지표 대조 ── */}
      <AiBattingSection
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeColor={homeColor}
        awayColor={awayColor}
        awayFill={awayFill}
        batting={data.batting}
      />

      {/* ── [섹션 3] 최근 10경기 승리 누적 흐름 ── */}
      <AiRecentFlowSection
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeColor={homeColor}
        awayColor={awayColor}
        awayFill={awayFill}
        lineData={lineData}
        homeSummary={homeSummary}
        awaySummary={awaySummary}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ── 하위 컴포넌트: 선발 투수 지표 대조 ───────────────────────────
// ──────────────────────────────────────────────────────────
type StartersSectionProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
  awayFill: string;
  starters: {
    home: StarterStats;
    away: StarterStats;
  };
};

function AiStartersSection({
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
  awayFill,
  starters
}: StartersSectionProps) {
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

  const getPitcherGauge = (metric: "era" | "whip" | "k9" | "bb9") => {
    const homeVal = starters.home[metric];
    const awayVal = starters.away[metric];
    const sum = homeVal + awayVal;
    if (sum === 0) return { homePct: 50, awayPct: 50 };

    let homeRatio = homeVal / sum;
    if (metric === "era" || metric === "whip" || metric === "bb9") {
      homeRatio = 1 - homeRatio;
    }
    const homePct = Math.max(15, Math.min(85, Math.round(homeRatio * 100)));
    return {
      homePct,
      awayPct: 100 - homePct
    };
  };

  const handleTitleClick = () => {
    setAnimate(false);
    setRemountKey((prev) => prev + 1);
  };

  return (
    <section className="ai-stats-section" key={remountKey}>
      <h3
        className="ai-stats-section-title"
        onClick={handleTitleClick}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        선발 투수 매치업 지표
      </h3>
      <div className="ai-stats-starter-header">
        <div className="ai-stats-starter-profile text-left">
          <StarterPitcherIdentity
            align="left"
            teamName={homeTeamName}
            color={homeColor}
            starter={starters.home}
          />
        </div>
        <span className="starter-vs-badge">VS</span>
        <div className="ai-stats-starter-profile text-right">
          <StarterPitcherIdentity
            align="right"
            teamName={awayTeamName}
            color={awayColor}
            starter={starters.away}
          />
        </div>
      </div>

      <StarterPitcherVsComparison home={starters.home} away={starters.away} />

      <div className="ai-stats-starter-metrics" ref={sectionRef}>
        {(["era", "whip", "k9", "bb9"] as const).map((metric, idx) => {
          const label =
            metric === "era"
              ? "평균자책점 (ERA)"
              : metric === "whip"
                ? "출루허용률 (WHIP)"
                : metric === "k9"
                  ? "9이닝 탈삼진 (K/9)"
                  : "9이닝 볼넷 (BB/9)";
          const homeVal = starters.home[metric];
          const awayVal = starters.away[metric];
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

    </section>
  );
}

// ──────────────────────────────────────────────────────────
// ── 하위 컴포넌트: 팀 타선 지표 대조 ───────────────────────────
// ──────────────────────────────────────────────────────────
function formatStarterRecord(starter: StarterStats) {
  return `${starter.wins ?? 0}승 ${starter.losses ?? 0}패`;
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDecimal(value: unknown, digits = 2) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? "-" : numeric.toFixed(digits);
}

function formatInnings(value: unknown) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return "-";

  const whole = Math.trunc(numeric);
  const thirds = Math.round((numeric - whole) * 3);
  if (thirds <= 0) return `${whole}`;
  if (thirds >= 3) return `${whole + 1}`;
  return whole > 0 ? `${whole} ${thirds}/3` : `${thirds}/3`;
}

function getVsOpponentLabel(stats: PitcherVsOpponentStats | null | undefined) {
  if (!stats || stats.games <= 0) return "상대전 기록 없음";
  if (stats.outs < 15) return "상대전 표본 부족";
  return "상대전 기록";
}

type StarterPitcherIdentityProps = {
  align: "left" | "right";
  teamName: string;
  color: string;
  starter: StarterStats;
};

function StarterPitcherIdentity({
  align,
  teamName,
  color,
  starter
}: StarterPitcherIdentityProps) {
  const textAlign = align === "right" ? "text-right" : "text-left";
  const itemAlign = align === "right" ? "items-end" : "items-start";

  return (
    <div className={`flex flex-col gap-1.5 ${itemAlign} ${textAlign}`}>
      <span className="starter-label-team" style={{ color }}>
        {teamName}
      </span>
      <strong className="starter-label-name">{starter.name}</strong>
      <span className="starter-label-record">{formatStarterRecord(starter)}</span>
    </div>
  );
}

type StarterPitcherVsComparisonProps = {
  home: StarterStats;
  away: StarterStats;
};

function StarterPitcherVsComparison({ home, away }: StarterPitcherVsComparisonProps) {
  const homeStats = home.vsOpponent;
  const awayStats = away.vsOpponent;

  return (
    <div className="mb-5 border-b border-dashed border-slate-200 pb-4">
      <VsMetricRow
        left={getVsOpponentLabel(homeStats)}
        label="상대전 표본"
        right={getVsOpponentLabel(awayStats)}
      />
      <VsMetricRow
        left={formatVsRecord(homeStats)}
        label="상대전"
        right={formatVsRecord(awayStats)}
      />
      <VsMetricRow
        left={formatVsRate(homeStats)}
        label="ERA/WHIP"
        right={formatVsRate(awayStats)}
      />
      <VsMetricRow
        left={formatVsInningsStrikeouts(homeStats)}
        label="이닝/탈삼진"
        right={formatVsInningsStrikeouts(awayStats)}
      />
    </div>
  );
}

type VsMetricRowProps = {
  left: string;
  label: string;
  right: string;
};

function VsMetricRow({ left, label, right }: VsMetricRowProps) {
  return (
    <div className="grid grid-cols-[1fr_96px_1fr] items-center gap-2 py-1 text-xs font-extrabold text-slate-500">
      <span className="min-w-0 text-left leading-snug">{left}</span>
      <span className="text-center text-slate-400">{label}</span>
      <span className="min-w-0 text-right leading-snug">{right}</span>
    </div>
  );
}

function formatVsRecord(stats: PitcherVsOpponentStats | null | undefined) {
  if (!stats || stats.games <= 0) return "-";
  return `${stats.starts}경기 (${stats.wins}승 ${stats.losses}패)`;
}

function formatVsRate(stats: PitcherVsOpponentStats | null | undefined) {
  if (!stats || stats.games <= 0) return "-";
  return `${formatDecimal(stats.era)} / ${formatDecimal(stats.whip)}`;
}

function formatVsInningsStrikeouts(stats: PitcherVsOpponentStats | null | undefined) {
  if (!stats || stats.games <= 0) return "-";
  return `${formatInnings(stats.innings)}이닝 · ${stats.strikeouts}K`;
}

type BattingSectionProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
  awayFill: string;
  batting: {
    home: BattingStats;
    away: BattingStats;
  };
};

function AiBattingSection({
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
  awayFill,
  batting
}: BattingSectionProps) {
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

  const getBatterGauge = (metric: keyof BattingStats) => {
    const homeVal = batting.home[metric];
    const awayVal = batting.away[metric];
    const sum = homeVal + awayVal;
    if (sum === 0) return { homePct: 50, awayPct: 50 };

    const homeRatio = homeVal / sum;
    const homePct = Math.max(15, Math.min(85, Math.round(homeRatio * 100)));
    return {
      homePct,
      awayPct: 100 - homePct
    };
  };

  const handleTitleClick = () => {
    setAnimate(false);
    setRemountKey((prev) => prev + 1);
  };

  return (
    <section className="ai-stats-section" key={remountKey}>
      <h3
        className="ai-stats-section-title"
        onClick={handleTitleClick}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        최근 선발 타선 전력 비교
      </h3>
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

      <div className="ai-stats-starter-metrics" ref={sectionRef}>
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
          const homeVal = batting.home[metric];
          const awayVal = batting.away[metric];
          const { homePct, awayPct } = getBatterGauge(metric);

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
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// ── 하위 컴포넌트: 최근 10경기 승리 누적 흐름 ───────────────────
// ──────────────────────────────────────────────────────────
type RecentFlowSectionProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
  awayFill: string;
  lineData: any[];
  homeSummary: string;
  awaySummary: string;
};

function AiRecentFlowSection({
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
  awayFill,
  lineData,
  homeSummary,
  awaySummary
}: RecentFlowSectionProps) {
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

  const handleTitleClick = () => {
    setAnimate(false);
    setRemountKey((prev) => prev + 1);
  };

  return (
    <section className="ai-stats-section" key={remountKey}>
      <h3
        className="ai-stats-section-title"
        onClick={handleTitleClick}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        최근 10경기 승리 누적 흐름
      </h3>
      <p className="ai-stats-section-subtitle" style={{ marginBottom: "10px" }}>
        * 10경기 전부터 최근 경기까지의 누적 승리 횟수 추이(상승 곡선)입니다.
      </p>
      <div className="ai-stats-recent-summary" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "800", color: "#475569", marginBottom: "16px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px" }}>
        <span style={{ color: homeColor }}>{homeTeamName}: {homeSummary}</span>
        <span style={{ color: awayColor }}>{awayTeamName}: {awaySummary}</span>
      </div>
      <div className="ai-stats-line-wrapper" ref={sectionRef}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            key={animate ? "active" : "inactive"}
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
              isAnimationActive={animate}
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
              isAnimationActive={animate}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
