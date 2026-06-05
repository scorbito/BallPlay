"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ClipboardCheck, Crown, Dices, ListOrdered, Swords, Target, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { GameStatus } from "@/lib/types/api-contracts";
import type {
  BpSimResultRow,
  SimBatterAggregate,
  SimMvpFreq,
  SimPitcherAggregate
} from "@/lib/supabase/query-parts/bpSimResults";

export type Sim1000GameInfo = {
  gameId: string;
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeStarter: string | null;
  awayStarter: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
};

/** 시뮬에 쓰인 타순 1명 (1~9번). */
export type Sim1000LineupBatter = {
  order: number;
  name: string;
  position: string | null;
};

type Props = {
  game: Sim1000GameInfo;
  sim: BpSimResultRow;
  /** 시뮬에 쓰인 타순 (없으면 라인업 섹션 미노출). */
  homeLineup?: Sim1000LineupBatter[] | null;
  awayLineup?: Sim1000LineupBatter[] | null;
};

// ── 팀 컬러 대비 보정 ──────────────────────────────────────
// 그래프(도넛·히스토그램·MVP)에서 홈/원정 팀 색이 너무 비슷하면(예: 삼성 vs NC, 둘 다 남색)
// 구분이 안 됨. 두 색 거리가 임계 미만이면 원정 fill 색을 밝게/어둡게 자동 조정해 구분.
// 텍스트(평균점수·우세 라벨)에는 적용 안 함 — 가독성 위해 원본 팀색 유지.
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
/** 원정 fill 색 — 홈 색과 너무 가까울 때:
 *  1) 원정 팀의 실제 보조색(accent)이 있고 홈과 충분히 다르면 그걸 사용 (실제 팀컬러라 자연스러움).
 *  2) 없거나 그것도 비슷하면 밝게/어둡게(홈에서 더 멀어지는 쪽) 알고리즘 조정. */
function ensureAwayFill(homeHex: string, awayHex: string, awayAccent?: string): string {
  const home = hexToRgb(homeHex);
  const away = hexToRgb(awayHex);
  if (colorDist(home, away) >= 110) return awayHex; // 충분히 다름

  // 1) 팀 보조색 우선 — 예: NC(남색) 보조색 금색 → 삼성(파랑)과 확실히 구분.
  if (awayAccent) {
    const acc = hexToRgb(awayAccent);
    if (colorDist(home, acc) >= 110) return awayAccent;
  }

  // 2) 알고리즘 폴백 — 밝게/어둡게.
  const lighter = mix(away, [255, 255, 255], 0.55);
  const darker = mix(away, [0, 0, 0], 0.5);
  const chosen = colorDist(home, lighter) >= colorDist(home, darker) ? lighter : darker;
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}

// ── 진입 애니메이션 훅 ──────────────────────────────────────
// mount 직후 false→true 로 전환 — CSS transition 트리거용. force-dynamic 페이지라
// 진입할 때마다 새 mount → 매번 재생.
function useMountFlag(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return on;
}

// 0 → target 카운트업 (easeOutCubic, ~900ms).
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);
  return value;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

function shouldShowStadium(stadium: string | null): boolean {
  if (!stadium) return false;
  const trimmed = stadium.trim();
  if (!trimmed) return false;
  return trimmed !== "미정";
}

/** 0.0 ~ 1.0 → "00.0%" 형식. */
function pctLabel(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 누적 안타에서 단타로 환산: (hits - hr) 단타+2루+3루 합쳐서 안타. 단순 합계만 사용. */
function avg(hits: number, ab: number): string {
  if (ab <= 0) return ".000";
  const v = hits / ab;
  return v.toFixed(3).replace(/^0/, "");
}

/** ipOuts(아웃카운트) → IP 표시(소수점 1자리). 예: 9 → 3.0, 10 → 3.1 */
function ipFromOuts(outs: number): string {
  const whole = Math.floor(outs / 3);
  const rem = outs % 3;
  return `${whole}.${rem}`;
}

/** SVG 도넛 — 홈/원정 승률 표시. cx, cy, r 고정. n 무승부면 가운데 라벨에 표시. */
function WinrateDonut({
  homeWins,
  awayWins,
  ties,
  homeColor,
  awayColor,
  awayNoteColor,
  homeName,
  awayName
}: {
  homeWins: number;
  awayWins: number;
  ties: number;
  homeColor: string;
  awayColor: string;       // 세그먼트 fill (대비 보정 적용)
  awayNoteColor: string;   // 가운데 우세 텍스트용 (원본 팀색)
  homeName: string;
  awayName: string;
}) {
  const total = homeWins + awayWins + ties;
  const safeTotal = total > 0 ? total : 1;
  const homeRatio = homeWins / safeTotal;
  const awayRatio = awayWins / safeTotal;
  const tieRatio = ties / safeTotal;

  const size = 160;
  const stroke = 18;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  // 회전 시작점을 12시 방향으로.
  // dasharray 누적으로 세그먼트 그림.
  const homeLen = C * homeRatio;
  const awayLen = C * awayRatio;
  const tieLen = C * tieRatio;
  const homeStart = 0;
  const awayStart = homeLen;
  const tieStart = homeLen + awayLen;

  // 결정전 승률 (무승부 제외) — 가운데 큰 라벨용.
  const decisive = homeWins + awayWins;
  const homeDecPct = decisive > 0 ? Math.round((homeWins / decisive) * 1000) / 10 : 50;
  const homeDominant = homeWins > awayWins;

  // 진입 애니메이션 — 세그먼트 채워지기 + 가운데 % 카운트업.
  const drawn = useMountFlag();
  const targetPct = decisive > 0 ? (homeDominant ? homeDecPct : 100 - homeDecPct) : 50;
  const displayPct = useCountUp(targetPct);
  const drawStyle = { transition: "stroke-dasharray 0.95s cubic-bezier(0.22, 1, 0.36, 1)" } as const;

  return (
    <div className="sim1000-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="승률 도넛">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--bp-line-soft, rgba(0,0,0,0.06))"
          strokeWidth={stroke}
        />
        {/* 홈 세그먼트 */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={homeColor}
          strokeWidth={stroke}
          strokeDasharray={drawn ? `${homeLen} ${C - homeLen}` : `0 ${C}`}
          strokeDashoffset={-homeStart}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
          style={drawStyle}
        />
        {/* 원정 세그먼트 */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={awayColor}
          strokeWidth={stroke}
          strokeDasharray={drawn ? `${awayLen} ${C - awayLen}` : `0 ${C}`}
          strokeDashoffset={-awayStart}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
          style={drawStyle}
        />
        {/* 무승부 세그먼트 (있을 때만) */}
        {ties > 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--bp-line, #d6dae0)"
            strokeWidth={stroke}
            strokeDasharray={drawn ? `${tieLen} ${C - tieLen}` : `0 ${C}`}
            strokeDashoffset={-tieStart}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
            style={drawStyle}
          />
        ) : null}
      </svg>
      <div className="sim1000-donut-center">
        <span className="sim1000-donut-center-pct">{displayPct.toFixed(1)}%</span>
        <span
          className="sim1000-donut-center-note"
          style={
            decisive > 0
              ? { color: homeDominant ? homeColor : awayNoteColor, fontWeight: 900 }
              : undefined
          }
        >
          {homeDominant ? `${homeName} 우세` : decisive > 0 ? `${awayName} 우세` : "박빙"}
        </span>
      </div>
    </div>
  );
}

/** 점수차 히스토그램 — 가로 막대. key 가 "+N"/"-N"/"0" 형식의 jsonb. */
function DiffHistogram({
  hist,
  n,
  homeColor,
  awayColor
}: {
  hist: Record<string, number>;
  n: number;
  homeColor: string;
  awayColor: string;
}) {
  const entries = useMemo(() => {
    const list: { key: string; diff: number; count: number }[] = [];
    for (const [k, v] of Object.entries(hist)) {
      const diff = Number(k.startsWith("+") ? k.slice(1) : k);
      if (Number.isFinite(diff)) list.push({ key: k, diff, count: Number(v) || 0 });
    }
    list.sort((a, b) => a.diff - b.diff);
    return list;
  }, [hist]);

  const maxCount = entries.reduce((m, e) => Math.max(m, e.count), 0) || 1;
  // n 으로 비율 라벨링.
  const safeN = n > 0 ? n : 1000;
  const grown = useMountFlag(); // 진입 시 막대 0 → 목표폭

  if (entries.length === 0) {
    return <p className="sim1000-empty-inline">분포 데이터가 없어요.</p>;
  }

  return (
    <div className="sim1000-hist">
      {entries.map((e, i) => {
        const widthPct = (e.count / maxCount) * 100;
        const isHome = e.diff > 0;
        const isAway = e.diff < 0;
        const color = isHome ? homeColor : isAway ? awayColor : "var(--bp-line, #d6dae0)";
        const ratio = e.count / safeN;
        return (
          <div key={e.key} className="sim1000-hist-row">
            <span className="sim1000-hist-label">{e.diff > 0 ? `+${e.diff}` : e.diff}</span>
            <div className="sim1000-hist-bar-track">
              <div
                className="sim1000-hist-bar-fill"
                style={{
                  width: grown ? `${widthPct}%` : "0%",
                  background: color,
                  transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
                  transitionDelay: `${Math.min(i * 18, 360)}ms`
                }}
              />
            </div>
            <span className="sim1000-hist-value">
              {e.count}
              <span className="sim1000-hist-value-pct"> · {pctLabel(ratio, 1)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 팀별 상위 N 타자 — 안타+홈런×2 정렬. */
function topBatters(
  batters: Record<string, SimBatterAggregate>,
  teamId: string,
  limit: number
): Array<{ playerId: string; b: SimBatterAggregate }> {
  const list: Array<{ playerId: string; b: SimBatterAggregate }> = [];
  for (const [playerId, b] of Object.entries(batters)) {
    if (b.team === teamId) list.push({ playerId, b });
  }
  list.sort((a, b) => b.b.hits + b.b.hr * 2 - (a.b.hits + a.b.hr * 2));
  return list.slice(0, limit);
}

/** MVP 빈도 Top N. */
function topMvp(
  mvp: Record<string, SimMvpFreq>,
  limit: number
): Array<{ playerId: string; m: SimMvpFreq }> {
  const list: Array<{ playerId: string; m: SimMvpFreq }> = [];
  for (const [playerId, m] of Object.entries(mvp)) list.push({ playerId, m });
  list.sort((a, b) => b.m.count - a.m.count);
  return list.slice(0, limit);
}

/** 선발 투수 찾기 — name 일치 또는 team + 가장 많은 경기 출장. */
function findStarter(
  pitchers: Record<string, SimPitcherAggregate>,
  teamId: string,
  starterName: string | null
): SimPitcherAggregate | null {
  // 1. name 정확 일치 + team
  if (starterName) {
    for (const p of Object.values(pitchers)) {
      if (p.team === teamId && p.name === starterName) return p;
    }
  }
  // 2. team 중 games 최대 (가장 많이 등판 = 선발일 확률 높음)
  let best: SimPitcherAggregate | null = null;
  for (const p of Object.values(pitchers)) {
    if (p.team !== teamId) continue;
    if (best === null || p.games > best.games) best = p;
  }
  return best;
}

export function Sim1000DetailScreen({ game, sim, homeLineup, awayLineup }: Props) {
  const home = getTeam(game.homeTeamId);
  const away = getTeam(game.awayTeamId);
  // 차트·뱃지 색은 팀 컬러 기준. (이전 핑크/회색 정적 토큰 대체)
  // homeColor/awayColor: 텍스트용 원본 팀색. awayFill: 그래프 채움용 대비 보정색
  // (홈과 너무 비슷하면 자동으로 밝게/어둡게 — 삼성 vs NC 같은 동계열 구분).
  const homeColor = home.color;
  const awayColor = away.color;
  const awayFill = ensureAwayFill(homeColor, awayColor, away.accent);
  const mvpGrown = useMountFlag(); // MVP 막대 진입 애니메이션

  const timeLabel = formatTime(game.gameTime);
  const safeN = sim.n > 0 ? sim.n : 1000;
  const tieRatio = sim.ties / safeN;
  const extraRatio = sim.extra_inning_count / safeN;

  // 팀별 타자 TOP 3
  const homeBatters = useMemo(() => topBatters(sim.batters, game.homeTeamId, 3), [sim.batters, game.homeTeamId]);
  const awayBatters = useMemo(() => topBatters(sim.batters, game.awayTeamId, 3), [sim.batters, game.awayTeamId]);

  // 선발 비교
  const homeStarterRow = useMemo(
    () => findStarter(sim.pitchers, game.homeTeamId, game.homeStarter),
    [sim.pitchers, game.homeTeamId, game.homeStarter]
  );
  const awayStarterRow = useMemo(
    () => findStarter(sim.pitchers, game.awayTeamId, game.awayStarter),
    [sim.pitchers, game.awayTeamId, game.awayStarter]
  );

  // MVP TOP 5
  const mvpTop = useMemo(() => topMvp(sim.mvp_freq, 5), [sim.mvp_freq]);
  const mvpMax = mvpTop[0]?.m.count ?? 1;

  return (
    <AppShell
      activeTab="home"
      title="1000판 시뮬 결과"
      backHref={`/predict/sim-1000?date=${game.gameDate}`}
      theme="light"
      wide
    >
      <section className="sim1000-detail-screen">
        {/* 실제 경기 결과 — 시뮬 데이터보다 먼저 노출 (맨 위). 점수 있거나 우천취소일 때만.
            시뮬 우세팀 vs 실제 승리팀 적중 판정. */}
        {(() => {
          const isCanceled = game.status === "canceled";
          // 종료된 경기만 결과로 — 진행 중 중간 스코어는 미확정이라 제외.
          const hasScore =
            game.status === "finished" && game.homeScore !== null && game.awayScore !== null;
          if (!isCanceled && !hasScore) return null;

          const simHomeUp = sim.home_wins > sim.away_wins;
          const simAwayUp = sim.away_wins > sim.home_wins;
          const actHomeUp = hasScore && (game.homeScore as number) > (game.awayScore as number);
          const actAwayUp = hasScore && (game.awayScore as number) > (game.homeScore as number);
          // 시뮬 박빙(예측 없음)만 neutral, 실제 무승부는 miss(못 맞힘).
          let verdict: "hit" | "miss" | "neutral" = "neutral";
          if (hasScore) {
            if (!simHomeUp && !simAwayUp) verdict = "neutral";
            else if (simHomeUp && actHomeUp) verdict = "hit";
            else if (simAwayUp && actAwayUp) verdict = "hit";
            else verdict = "miss";
          }
          const winnerName = actHomeUp ? home.shortName : actAwayUp ? away.shortName : null;

          return (
            <section className="sim1000-section sim1000-section-actual">
              {/* 헤더 — 3분할: 타이틀(좌) · 승리팀 라벨(중앙) · 적중/빗나감(우) */}
              <div className="sim1000-actual-detail-head">
                <h2 className="sim1000-section-title sim1000-actual-detail-title">
                  <ClipboardCheck size={14} strokeWidth={2.5} />
                  실제 경기 결과
                </h2>
                <span className="sim1000-actual-detail-winner-inline">
                  {isCanceled ? null : winnerName ? (
                    <>
                      <span style={{ color: actHomeUp ? homeColor : awayColor, fontWeight: 900 }}>
                        {winnerName}
                      </span>{" "}
                      승
                    </>
                  ) : (
                    "무승부"
                  )}
                </span>
                {!isCanceled && verdict === "hit" ? (
                  <span className="sim1000-actual-verdict sim1000-actual-verdict-hit">✓ 적중</span>
                ) : !isCanceled && verdict === "miss" ? (
                  <span className="sim1000-actual-verdict sim1000-actual-verdict-miss">✗ 빗나감</span>
                ) : (
                  <span className="sim1000-actual-verdict-placeholder" aria-hidden="true" />
                )}
              </div>
              {isCanceled ? (
                <p className="sim1000-actual-canceled-detail">🌧 우천취소 — 적중 판정 없음</p>
              ) : (
                <div className="sim1000-actual-detail">
                  <div className="sim1000-actual-detail-grid">
                    <span className="sim1000-actual-detail-side sim1000-actual-detail-side-left">
                      <TeamBadge teamId={game.homeTeamId} size="sm" />
                      <span className="sim1000-actual-detail-team">{home.shortName}</span>
                      <span
                        className="sim1000-actual-detail-num"
                        style={{ color: actHomeUp ? homeColor : undefined }}
                      >
                        {game.homeScore}
                      </span>
                    </span>
                    <span className="sim1000-actual-detail-vs">vs</span>
                    <span className="sim1000-actual-detail-side sim1000-actual-detail-side-right">
                      <span
                        className="sim1000-actual-detail-num"
                        style={{ color: actAwayUp ? awayColor : undefined }}
                      >
                        {game.awayScore}
                      </span>
                      <span className="sim1000-actual-detail-team">{away.shortName}</span>
                      <TeamBadge teamId={game.awayTeamId} size="sm" />
                    </span>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* ── 매치업 헤더 (시뮬 평균점수) ── */}
        <header className="sim1000-matchup">
          <div className="sim1000-matchup-meta">
            {timeLabel ? <span>{timeLabel}</span> : null}
            {timeLabel && shouldShowStadium(game.stadium) ? <span> · </span> : null}
            {shouldShowStadium(game.stadium) ? <span>{game.stadium}</span> : null}
          </div>
          <div className="sim1000-matchup-teams">
            <div className="sim1000-matchup-team">
              <TeamBadge teamId={game.homeTeamId} size="md" />
              <div className="sim1000-matchup-team-info">
                <span className="sim1000-matchup-team-name">{home.shortName}</span>
                {game.homeStarter ? (
                  <span className="sim1000-matchup-team-starter">{game.homeStarter}</span>
                ) : null}
              </div>
            </div>
            <div className="sim1000-matchup-center">
              <span className="sim1000-matchup-avg" style={{ color: homeColor }}>
                {sim.home_avg_runs.toFixed(2)}
              </span>
              <span className="sim1000-matchup-vs">VS</span>
              <span className="sim1000-matchup-avg" style={{ color: awayColor }}>
                {sim.away_avg_runs.toFixed(2)}
              </span>
            </div>
            <div className="sim1000-matchup-team">
              <div className="sim1000-matchup-team-info sim1000-matchup-team-info-right">
                <span className="sim1000-matchup-team-name">{away.shortName}</span>
                {game.awayStarter ? (
                  <span className="sim1000-matchup-team-starter">{game.awayStarter}</span>
                ) : null}
              </div>
              <TeamBadge teamId={game.awayTeamId} size="md" />
            </div>
          </div>
          <p className="sim1000-matchup-avg-note">평균 점수 (1000판 기준)</p>
        </header>

        {/* 1. 종합 결과 */}
        <section className="sim1000-section sim1000-section-summary">
          <h2 className="sim1000-section-title">
            <Trophy size={14} strokeWidth={2.5} />
            종합 결과
            <span className="sim1000-section-count">{safeN}판</span>
          </h2>

          <div className="sim1000-summary-grid">
            <WinrateDonut
              homeWins={sim.home_wins}
              awayWins={sim.away_wins}
              ties={sim.ties}
              homeColor={homeColor}
              awayColor={awayFill}
              awayNoteColor={awayColor}
              homeName={home.shortName}
              awayName={away.shortName}
            />
            <div className="sim1000-summary-stats">
              <div className="sim1000-summary-row">
                <span className="sim1000-summary-team">
                  <span className="sim1000-color-dot" style={{ background: homeColor }} />
                  {home.shortName}
                </span>
                <span className="sim1000-summary-wins">{sim.home_wins}승</span>
              </div>
              <div className="sim1000-summary-row">
                <span className="sim1000-summary-team">
                  <span className="sim1000-color-dot" style={{ background: awayFill }} />
                  {away.shortName}
                </span>
                <span className="sim1000-summary-wins">{sim.away_wins}승</span>
              </div>
              <div className="sim1000-summary-row sim1000-summary-row-misc">
                <span className="sim1000-summary-misc-label">무승부</span>
                <span className="sim1000-summary-misc-value">
                  {sim.ties} ({pctLabel(tieRatio, 1)})
                </span>
              </div>
              <div className="sim1000-summary-row sim1000-summary-row-misc">
                <span className="sim1000-summary-misc-label">연장</span>
                <span className="sim1000-summary-misc-value">
                  {sim.extra_inning_count} ({pctLabel(extraRatio, 1)})
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 점수차 분포 */}
        <section className="sim1000-section">
          <h2 className="sim1000-section-title">
            <BarChart3 size={14} strokeWidth={2.5} />
            점수차 분포
          </h2>
          <p className="sim1000-section-sub">
            홈({home.shortName}) 기준. + 는 {home.shortName} 우세, − 는 {away.shortName} 우세.
          </p>
          <DiffHistogram
            hist={sim.diff_hist ?? {}}
            n={safeN}
            homeColor={homeColor}
            awayColor={awayFill}
          />
        </section>

        {/* 출전 라인업 — 타순 9명 + 선발 투수 (시뮬에 쓰인 라인업) */}
        {homeLineup || awayLineup ? (
          <section className="sim1000-section">
            <h2 className="sim1000-section-title">
              <ListOrdered size={14} strokeWidth={2.5} />
              출전 라인업
            </h2>
            <p className="sim1000-section-sub">시뮬에 쓰인 타순 + 선발 투수</p>
            <div className="sim1000-lineup-grid">
              <LineupColumn
                teamId={game.homeTeamId}
                teamName={home.shortName}
                starter={game.homeStarter}
                batters={homeLineup ?? null}
              />
              <LineupColumn
                teamId={game.awayTeamId}
                teamName={away.shortName}
                starter={game.awayStarter}
                batters={awayLineup ?? null}
              />
            </div>
          </section>
        ) : null}

        {/* 3. 타자 누적 TOP 6 (팀별 3명) */}
        <section className="sim1000-section">
          <h2 className="sim1000-section-title">
            <Users size={14} strokeWidth={2.5} />
            타자 핵심 6인
          </h2>
          <p className="sim1000-section-sub">경기당 평균(/{safeN}판) 기준</p>
          <div className="sim1000-batters-grid">
            <div className="sim1000-batters-col">
              <div className="sim1000-batters-col-head">
                <TeamBadge teamId={game.homeTeamId} size="sm" />
                <span>{home.shortName}</span>
              </div>
              {homeBatters.length > 0 ? (
                <ul className="sim1000-batter-list">
                  {homeBatters.map(({ playerId, b }) => (
                    <li key={playerId} className="sim1000-batter-row">
                      <span className="sim1000-batter-name">{b.name}</span>
                      <span className="sim1000-batter-stats">
                        <span>타석 {(b.pa / safeN).toFixed(1)}</span>
                        <span>타율 {avg(b.hits, b.ab)}</span>
                        <span>홈런 {(b.hr / safeN).toFixed(2)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sim1000-empty-inline">데이터 없음</p>
              )}
            </div>
            <div className="sim1000-batters-col">
              <div className="sim1000-batters-col-head">
                <TeamBadge teamId={game.awayTeamId} size="sm" />
                <span>{away.shortName}</span>
              </div>
              {awayBatters.length > 0 ? (
                <ul className="sim1000-batter-list">
                  {awayBatters.map(({ playerId, b }) => (
                    <li key={playerId} className="sim1000-batter-row">
                      <span className="sim1000-batter-name">{b.name}</span>
                      <span className="sim1000-batter-stats">
                        <span>타석 {(b.pa / safeN).toFixed(1)}</span>
                        <span>타율 {avg(b.hits, b.ab)}</span>
                        <span>홈런 {(b.hr / safeN).toFixed(2)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sim1000-empty-inline">데이터 없음</p>
              )}
            </div>
          </div>
        </section>

        {/* 4. 선발 vs 선발 */}
        <section className="sim1000-section">
          <h2 className="sim1000-section-title">
            <Swords size={14} strokeWidth={2.5} />
            선발 vs 선발
          </h2>
          <p className="sim1000-section-sub">경기당 평균 · 등판은 1000판 중 선발 등판 수</p>
          <div className="sim1000-starter-grid">
            <StarterCard team={home} side="home" row={homeStarterRow} n={safeN} color={homeColor} />
            <StarterCard team={away} side="away" row={awayStarterRow} n={safeN} color={awayFill} />
          </div>
        </section>

        {/* 5. MVP 빈도 */}
        <section className="sim1000-section">
          <h2 className="sim1000-section-title">
            <Crown size={14} strokeWidth={2.5} />
            MVP 빈도 TOP 5
          </h2>
          {mvpTop.length > 0 ? (
            <ul className="sim1000-mvp-list">
              {mvpTop.map(({ playerId, m }, i) => {
                const widthPct = (m.count / mvpMax) * 100;
                const ratio = m.count / safeN;
                const isHomeSide = m.team === game.homeTeamId;
                return (
                  <li key={playerId} className="sim1000-mvp-row">
                    <span className="sim1000-mvp-rank">#{i + 1}</span>
                    <span className="sim1000-mvp-name">{m.name}</span>
                    <span className="sim1000-mvp-team">
                      {isHomeSide ? home.shortName : m.team === game.awayTeamId ? away.shortName : m.team}
                    </span>
                    <div className="sim1000-mvp-bar-track">
                      <div
                        className="sim1000-mvp-bar-fill"
                        style={{
                          width: mvpGrown ? `${widthPct}%` : "0%",
                          background: isHomeSide ? homeColor : awayFill,
                          transition: "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
                          transitionDelay: `${i * 60}ms`
                        }}
                      />
                    </div>
                    <span className="sim1000-mvp-value">
                      {m.count}회
                      <span className="sim1000-mvp-value-pct"> · {pctLabel(ratio, 1)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sim1000-empty-inline">MVP 데이터가 없어요.</p>
          )}
        </section>

        {/* 라인업 소스 메타 */}
        <footer className="sim1000-footer">
          <span className="sim1000-footer-icon">
            <Dices size={11} strokeWidth={2.5} />
          </span>
          <span>
            {sim.lineup_source_home || sim.lineup_source_away
              ? `라인업 ${sim.lineup_source_home ?? "?"} (홈) · ${sim.lineup_source_away ?? "?"} (원정) + 오늘 선발 투수 기준`
              : "오늘 선발 투수 기준"}
            {" · "}시뮬 엔진 v{sim.engine_version}
          </span>
        </footer>
      </section>
    </AppShell>
  );
}

/** 한 팀의 출전 라인업 — 선발 투수 헤더 + 타순 9명. */
function LineupColumn({
  teamId,
  teamName,
  starter,
  batters
}: {
  teamId: string;
  teamName: string;
  starter: string | null;
  batters: Sim1000LineupBatter[] | null;
}) {
  return (
    <div className="sim1000-lineup-col">
      <div className="sim1000-lineup-col-head">
        <TeamBadge teamId={teamId} size="sm" />
        <span className="sim1000-lineup-col-team">{teamName}</span>
      </div>
      <div className="sim1000-lineup-starter">
        <span className="sim1000-lineup-starter-label">
          <Target size={11} strokeWidth={2.5} aria-hidden="true" />
          선발
        </span>
        <span className="sim1000-lineup-starter-name">{starter ?? "—"}</span>
      </div>
      {batters && batters.length > 0 ? (
        <ol className="sim1000-lineup-list">
          {batters.map((b) => (
            <li key={b.order} className="sim1000-lineup-row">
              <span className="sim1000-lineup-order">{b.order}</span>
              <span className="sim1000-lineup-name">{b.name}</span>
              {b.position ? <span className="sim1000-lineup-pos">{b.position}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sim1000-empty-inline">타순 데이터 없음</p>
      )}
    </div>
  );
}

function StarterCard({
  team,
  side,
  row,
  n,
  color
}: {
  team: { shortName: string };
  side: "home" | "away";
  row: SimPitcherAggregate | null;
  n: number;
  color: string;
}) {
  if (row === null) {
    return (
      <div className={`sim1000-starter-card sim1000-starter-card-${side}`}>
        <div className="sim1000-starter-head">
          <span className="sim1000-color-dot" style={{ background: color }} />
          <span className="sim1000-starter-team">{team.shortName}</span>
        </div>
        <p className="sim1000-empty-inline">선발 데이터 없음</p>
      </div>
    );
  }
  const ipPerGame = row.games > 0 ? row.ipOuts / row.games / 3 : 0;
  const era = row.games > 0 && row.ipOuts > 0 ? (row.er * 27) / row.ipOuts : 0;
  const kPerGame = row.games > 0 ? row.k / row.games : 0;
  const bbPerGame = row.games > 0 ? row.bb / row.games : 0;
  const hrPerGame = row.games > 0 ? row.hr / row.games : 0;
  return (
    <div className={`sim1000-starter-card sim1000-starter-card-${side}`}>
      <div className="sim1000-starter-head">
        <span className="sim1000-color-dot" style={{ background: color }} />
        <span className="sim1000-starter-team">{team.shortName}</span>
        <Target size={11} strokeWidth={2.5} aria-hidden="true" />
        <span className="sim1000-starter-name">{row.name}</span>
      </div>
      <div className="sim1000-starter-stats">
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">이닝</span>
          <span className="sim1000-starter-stat-value">{ipPerGame.toFixed(2)}</span>
        </div>
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">평균자책</span>
          <span className="sim1000-starter-stat-value">{era.toFixed(2)}</span>
        </div>
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">탈삼진</span>
          <span className="sim1000-starter-stat-value">{kPerGame.toFixed(2)}</span>
        </div>
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">볼넷</span>
          <span className="sim1000-starter-stat-value">{bbPerGame.toFixed(2)}</span>
        </div>
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">피홈런</span>
          <span className="sim1000-starter-stat-value">{hrPerGame.toFixed(2)}</span>
        </div>
        <div className="sim1000-starter-stat">
          <span className="sim1000-starter-stat-label">등판</span>
          <span className="sim1000-starter-stat-value">
            {row.games}/{n}
          </span>
        </div>
      </div>
    </div>
  );
}
