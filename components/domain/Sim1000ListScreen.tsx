"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Dices, Flame, Lock, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { SIM_1000_VIEWED_KEY } from "@/components/domain/HomeCardPulse";
import { trackEvent } from "@/lib/analytics/events";
import type { Sim1000AccuracyStats } from "@/lib/supabase/query-parts/bpSimResults";


/** /predict/sim-1000 목록 카드 1개 데이터. page 에서 row → card 매핑. */
export type Sim1000GameCard = {
  gameId: string;
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeWins: number;
  awayWins: number;
  ties: number;
  n: number;
  homeAvgRuns: number;
  awayAvgRuns: number;
  /** 실제 경기 점수. status 가 finished 이거나 양쪽 점수 모두 존재할 때만 의미 있음. */
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  /** "scheduled" | "in_progress" | "finished" | "canceled" 등 */
  gameStatus: string;
};

type Props = {
  today: string;
  selectedDate: string;
  isToday: boolean;
  isFuture: boolean;
  prevDate: string | null;
  nextDate: string | null;
  games: Sim1000GameCard[];
  /** 시즌 누적 적중률 (live 집계). undefined 또는 total 0 이면 안내 표시. */
  accuracyStats?: Sim1000AccuracyStats;
  /** 소프트 게이트 — 비로그인/익명이면 true. 매치업·누적 적중률만 보이고 수치는 로그인 유도. */
  locked?: boolean;
};

function formatDateLabel(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function formatGameTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

function shouldShowStadium(stadium: string | null): boolean {
  if (!stadium) return false;
  const trimmed = stadium.trim();
  if (!trimmed) return false;
  return trimmed !== "미정";
}

/**
 * 시뮬 우세팀 vs 실제 승리팀 일치 여부.
 * - 시뮬 박빙(homeWins == awayWins) → "neutral" (예측 자체가 없으니 판정 제외).
 * - 실제 무승부 → "miss" (시뮬은 한 팀을 예측했으니 못 맞힌 것).
 * - 시뮬 우세팀과 실제 승리팀이 같으면 "hit", 다르면 "miss".
 * - 우천취소 케이스는 호출 전에 status 로 가드 (여기서 다루지 않음).
 */
function judgeAccuracy(
  homeWins: number,
  awayWins: number,
  actualHome: number,
  actualAway: number
): "hit" | "miss" | "neutral" {
  const simHomeUp = homeWins > awayWins;
  const simAwayUp = awayWins > homeWins;
  const actHomeUp = actualHome > actualAway;
  const actAwayUp = actualAway > actualHome;
  if (!simHomeUp && !simAwayUp) return "neutral"; // 시뮬 박빙 → 평가 불가
  if (simHomeUp && actHomeUp) return "hit";
  if (simAwayUp && actAwayUp) return "hit";
  return "miss"; // 실제 무승부 포함 — 못 맞힘
}

/** 승률 계산: 무승부 제외한 비율. n 이 0 이면 50/50. */
function winRatePct(homeWins: number, awayWins: number): { home: number; away: number } {
  const decisive = homeWins + awayWins;
  if (decisive <= 0) return { home: 50, away: 50 };
  const home = Math.round((homeWins / decisive) * 1000) / 10;
  return { home, away: Math.round((100 - home) * 10) / 10 };
}

export function Sim1000ListScreen({
  selectedDate,
  isToday,
  isFuture,
  prevDate,
  nextDate,
  games,
  accuracyStats,
  locked = false
}: Props) {
  // 로그인 유도 링크 — 로그인 후 현재 날짜의 시뮬 결과로 복귀.
  const loginHref = `/login?next=${encodeURIComponent(`/predict/sim-1000?date=${selectedDate}`)}`;

  // 홈 펄스 뱃지 해제 — 오늘자 시뮬 결과가 있는 페이지에 진입하면 viewed 마킹.
  useEffect(() => {
    if (!isToday || games.length === 0) return;
    void trackEvent("sim1000_viewed", {
      gameDate: selectedDate,
      gameCount: games.length,
      locked
    });
    try {
      window.localStorage.setItem(SIM_1000_VIEWED_KEY, selectedDate);
    } catch {
      // ignore storage errors
    }
  }, [isToday, games.length, locked, selectedDate]);

  return (
    <AppShell
      activeTab="home"
      title="1000판 시뮬레이션"
      theme="light"
      backHref="/"
      wide
    >
      <section className="sim1000-screen">
        {/* ── 설명 (카드 없이 텍스트만) ── */}
        <p className="sim1000-intro-note">
          어제 라인업 + 오늘 선발 투수 기준으로 한 경기를 1000번 돌려본 결과예요.
        </p>

        {/* ── 시즌 누적 적중률 헤더 카드 (live 집계) ── */}
        <div className="sim1000-accuracy-card">
          <span className="sim1000-accuracy-label">
            <Target size={12} strokeWidth={2.5} aria-hidden="true" />
            시뮬 누적 적중률
          </span>
          {accuracyStats && accuracyStats.total > 0 ? (
            <>
              <span className="sim1000-accuracy-pct">
                {accuracyStats.accuracy !== null ? `${accuracyStats.accuracy}%` : "—"}
              </span>
              <span className="sim1000-accuracy-detail">
                {accuracyStats.correct} / {accuracyStats.total} 적중
              </span>
            </>
          ) : (
            <span className="sim1000-accuracy-empty">아직 판정된 경기가 없어요</span>
          )}
        </div>

        {/* ── 로그인 유도 배너 (비로그인/익명 한정). 위 누적 적중률은 미끼로 그대로 노출. ── */}
        {locked ? (
          <div className="sim1000-login-banner">
            <Lock size={18} strokeWidth={2.5} aria-hidden="true" />
            <div className="sim1000-login-banner-text">
              <strong>1000판 시뮬 결과는 로그인 후 볼 수 있어요</strong>
              <p>어느 팀이 우세할지 — 한 경기를 1000번 돌린 승률·평균점수를 확인하세요.</p>
            </div>
            <Link href={loginHref} className="sim1000-login-banner-cta" prefetch={false}>
              로그인
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        ) : null}

        {/* ── 날짜 네비게이션 (시뮬 결과 존재 날짜만 이동) ── */}
        <nav className="sim1000-date-nav" aria-label="날짜 선택">
          {prevDate ? (
            <Link
              href={`/predict/sim-1000?date=${prevDate}`}
              className="sim1000-date-nav-btn"
              aria-label="이전 시뮬 날짜"
              prefetch={false}
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="sim1000-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </span>
          )}
          <div className="sim1000-date-nav-current">
            <span className="sim1000-date-nav-date">{formatDateLabel(selectedDate)}</span>
            <span className="sim1000-date-nav-badge">
              {isToday ? "오늘" : isFuture ? "예정" : "지난 결과"}
            </span>
          </div>
          {nextDate ? (
            <Link
              href={`/predict/sim-1000?date=${nextDate}`}
              className="sim1000-date-nav-btn"
              aria-label="다음 시뮬 날짜"
              prefetch={false}
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="sim1000-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronRight size={16} strokeWidth={2.5} />
            </span>
          )}
        </nav>

        {/* ── 경기 카드 리스트 ── */}
        <section className="sim1000-games">
          {games.length === 0 ? (
            <div className="sim1000-empty">
              <Dices size={36} strokeWidth={1.5} aria-hidden="true" />
              <p className="sim1000-empty-title">
                {isToday
                  ? "오늘 시뮬 결과가 아직 없어요"
                  : isFuture
                    ? "예정된 시뮬 결과가 없어요"
                    : "이날은 시뮬 결과가 없어요"}
              </p>
              {!isToday && !isFuture ? (
                <p className="sim1000-empty-sub">
                  <Link href="/predict/sim-1000" className="sim1000-back-today">
                    오늘로 돌아가기
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="sim1000-game-list">
              {games.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const rate = winRatePct(g.homeWins, g.awayWins);
                const homeDominant = g.homeWins > g.awayWins;
                const awayDominant = g.awayWins > g.homeWins;
                const dominantPct = homeDominant ? rate.home : awayDominant ? rate.away : 50;
                const dominantTeam = homeDominant ? home : awayDominant ? away : null;
                const dominantTeamName = dominantTeam?.shortName ?? "박빙";
                // 우세팀 색상으로 배지 톤 — 팀 컬러 배경(반투명) + 화이트 텍스트.
                // 박빙(무승부 더 많거나 동률)은 중립 톤.
                const summaryStyle = dominantTeam
                  ? { background: dominantTeam.color, color: "#fff" }
                  : undefined;
                const timeLabel = formatGameTime(g.gameTime);

                // ── 실제 결과 비교 ──
                // 날짜 무관하게 "종료/취소"된 경기면 표시 (오늘 경기도 끝나면 즉시).
                // - canceled: "🌧 취소" 라벨, 적중 판정 없음
                // - finished + 양쪽 점수: 실제 점수 행 + 적중 배지 표시
                // - 진행 중(in_progress)·미시작: 비교 행 미노출 (중간 스코어 = 미확정)
                const isCanceled = g.gameStatus === "canceled";
                const isFinished =
                  g.gameStatus === "finished" &&
                  g.actualHomeScore !== null &&
                  g.actualAwayScore !== null;
                const showActualRow = isCanceled || isFinished;
                const verdict = isFinished
                  ? judgeAccuracy(
                      g.homeWins,
                      g.awayWins,
                      g.actualHomeScore as number,
                      g.actualAwayScore as number
                    )
                  : null;

                return (
                  <li key={g.gameId} className="sim1000-game-card">
                    {/* Row 1: 시간·구장 | 평균점수 라벨(중앙) | 우세팀 배지 */}
                    <header className="sim1000-game-top">
                      <span className="sim1000-game-head">
                        {timeLabel ? <span className="sim1000-game-time">{timeLabel}</span> : null}
                        {shouldShowStadium(g.stadium) ? (
                          <span className="sim1000-game-stadium">{g.stadium}</span>
                        ) : null}
                      </span>
                      <span className="sim1000-game-runs-label">{locked ? "" : "승리 횟수"}</span>
                      {locked ? (
                        <span className="sim1000-game-summary sim1000-game-summary-locked">
                          <Lock size={11} strokeWidth={2.5} aria-hidden="true" />
                          우세팀 %
                        </span>
                      ) : (
                        <span
                          className={`sim1000-game-summary ${
                            dominantTeam ? "sim1000-game-summary-team" : "sim1000-game-summary-tie"
                          }`}
                          style={summaryStyle}
                        >
                          <Flame size={11} strokeWidth={2.5} aria-hidden="true" />
                          {dominantTeamName} {dominantPct}%
                        </span>
                      )}
                    </header>

                    {/* Row 2: 팀명+승리횟수 인라인 매치업 (평균점수보다 승패 직결 지표) */}
                    <div className="sim1000-game-teams">
                      <div className="sim1000-team">
                        <TeamBadge teamId={g.homeTeamId} size="sm" />
                        <span className="sim1000-team-name">{home.shortName}</span>
                        <span className={`sim1000-team-score${locked ? " sim1000-team-score-locked" : ""}`}>
                          {locked ? "–" : `${g.homeWins}승`}
                        </span>
                      </div>
                      <span className="sim1000-vs">vs</span>
                      <div className="sim1000-team">
                        <span className={`sim1000-team-score${locked ? " sim1000-team-score-locked" : ""}`}>
                          {locked ? "–" : `${g.awayWins}승`}
                        </span>
                        <span className="sim1000-team-name">{away.shortName}</span>
                        <TeamBadge teamId={g.awayTeamId} size="sm" />
                      </div>
                    </div>

                    {/* Row 2.5: 실제 결과 (과거 카드 한정) — 시뮬 행과 같은 grid로 vs 정렬 */}
                    {showActualRow ? (
                      <div className="sim1000-actual-row">
                        {isCanceled ? (
                          <span className="sim1000-actual-canceled">🌧 우천취소</span>
                        ) : (
                          <>
                            <div className="sim1000-actual-grid">
                              <span className="sim1000-actual-side sim1000-actual-side-left">
                                <span className="sim1000-actual-label">실제</span>
                                <span className="sim1000-actual-team">{home.shortName}</span>
                                <span className="sim1000-actual-num">{g.actualHomeScore}</span>
                              </span>
                              <span className="sim1000-actual-vs">vs</span>
                              <span className="sim1000-actual-side sim1000-actual-side-right">
                                <span className="sim1000-actual-num">{g.actualAwayScore}</span>
                                <span className="sim1000-actual-team">{away.shortName}</span>
                              </span>
                            </div>
                            {verdict === "hit" ? (
                              <span className="sim1000-game-verdict sim1000-game-verdict-hit">
                                ✓ 적중
                              </span>
                            ) : verdict === "miss" ? (
                              <span className="sim1000-game-verdict sim1000-game-verdict-miss">
                                ✗ 빗나감
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}

                    {/* Row 3: 상세 보기 (잠금 시 로그인 유도) */}
                    {locked ? (
                      <Link href={loginHref} className="sim1000-card-cta" prefetch={false}>
                        <Lock size={12} strokeWidth={2.5} />
                        로그인하고 상세 보기
                      </Link>
                    ) : (
                      <Link href={`/predict/sim-1000/${g.gameId}`} className="sim1000-card-cta">
                        상세 보기
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </AppShell>
  );
}
