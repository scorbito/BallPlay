"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Dices, Flame } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";

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
};

type Props = {
  today: string;
  selectedDate: string;
  isToday: boolean;
  isFuture: boolean;
  prevDate: string | null;
  nextDate: string | null;
  games: Sim1000GameCard[];
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

/** 승률 계산: 무승부 제외한 비율. n 이 0 이면 50/50. */
function winRatePct(homeWins: number, awayWins: number): { home: number; away: number } {
  const decisive = homeWins + awayWins;
  if (decisive <= 0) return { home: 50, away: 50 };
  const home = Math.round((homeWins / decisive) * 1000) / 10;
  return { home, away: Math.round((100 - home) * 10) / 10 };
}

export function Sim1000ListScreen({
  today: _today,
  selectedDate,
  isToday,
  isFuture,
  prevDate,
  nextDate,
  games
}: Props) {
  return (
    <AppShell activeTab="home" title="1000판 시뮬레이션" theme="light" backHref="/" wide>
      <section className="sim1000-screen">
        {/* ── 헤더 설명 카드 ── */}
        <header className="sim1000-intro-card">
          <span className="sim1000-intro-icon">
            <Dices size={16} strokeWidth={2.5} />
          </span>
          <div className="sim1000-intro-text">
            <strong>1000판 시뮬레이션</strong>
            <p>어제 라인업 + 오늘 선발 투수 기준으로 한 경기를 1000번 돌려본 결과예요.</p>
          </div>
        </header>

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
              {isToday ? (
                <p className="sim1000-empty-sub">09:00 KST에 자동 생성됩니다.</p>
              ) : !isFuture ? (
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
                const dominantTeamName = homeDominant
                  ? home.shortName
                  : awayDominant
                    ? away.shortName
                    : "박빙";
                const timeLabel = formatGameTime(g.gameTime);

                return (
                  <li key={g.gameId} className="sim1000-game-card">
                    <div className="sim1000-game-row">
                      <header className="sim1000-game-head">
                        {timeLabel ? <span className="sim1000-game-time">{timeLabel}</span> : null}
                        {shouldShowStadium(g.stadium) ? (
                          <span className="sim1000-game-stadium">{g.stadium}</span>
                        ) : null}
                      </header>

                      <div className="sim1000-game-teams">
                        <div className="sim1000-team">
                          <TeamBadge teamId={g.homeTeamId} size="sm" />
                          <span className="sim1000-team-name">{home.shortName}</span>
                        </div>
                        <span className="sim1000-vs">vs</span>
                        <div className="sim1000-team">
                          <span className="sim1000-team-name">{away.shortName}</span>
                          <TeamBadge teamId={g.awayTeamId} size="sm" />
                        </div>
                      </div>

                      <span
                        className={`sim1000-game-summary ${
                          homeDominant
                            ? "sim1000-game-summary-home"
                            : awayDominant
                              ? "sim1000-game-summary-away"
                              : "sim1000-game-summary-tie"
                        }`}
                      >
                        <Flame size={11} strokeWidth={2.5} aria-hidden="true" />
                        {dominantTeamName} {dominantPct}%
                      </span>
                    </div>

                    <div className="sim1000-game-runs">
                      <span className="sim1000-game-runs-team">
                        {home.shortName} {g.homeAvgRuns.toFixed(2)}
                      </span>
                      <span className="sim1000-game-runs-sep">-</span>
                      <span className="sim1000-game-runs-team">
                        {g.awayAvgRuns.toFixed(2)} {away.shortName}
                      </span>
                      <span className="sim1000-game-runs-note">평균 점수</span>
                    </div>

                    <Link href={`/predict/sim-1000/${g.gameId}`} className="sim1000-card-cta">
                      상세 보기
                      <ArrowRight size={12} strokeWidth={2.5} />
                    </Link>
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
