"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Dices, Flame, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { useAppState } from "@/lib/state/AppState";
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
  /** 운영자만 true — "다시 돌리기" 버튼 노출 */
  isAdmin?: boolean;
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
  games,
  isAdmin = false
}: Props) {
  const router = useRouter();
  const { showToast } = useAppState();
  const [rerunning, setRerunning] = useState(false);

  // 운영자 "다시 돌리기" — 09:00 cron 이후 발표 라인업/선발 교체 등이 반영된 데이터로 다시 시뮬.
  // 1회 실행 ~ 5경기 × 3~5초 = 수 초 단위. 진행 중에는 버튼 disabled.
  async function handleRerun() {
    if (rerunning) return;
    setRerunning(true);
    showToast("다시 돌리는 중이에요. 수 초 걸려요…");
    try {
      const res = await fetch("/api/admin/sim-1000/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate })
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ran?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        showToast(`다시 돌리기 실패: ${json.error ?? res.statusText}`);
        return;
      }
      const ran = json.ran ?? 0;
      const failed = json.failed ?? 0;
      showToast(
        failed > 0
          ? `다시 돌렸어요 (${ran}경기 성공, ${failed}경기 실패)`
          : `다시 돌렸어요 (${ran}경기)`
      );
      router.refresh();
    } catch (err) {
      showToast(`다시 돌리기 실패: ${(err as Error).message}`);
    } finally {
      setRerunning(false);
    }
  }

  const showRerun = isAdmin && isToday;

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

        {/* ── 운영자 전용 "다시 돌리기" (오늘 + admin) ── */}
        {showRerun ? (
          <div className="sim1000-admin-bar">
            <button
              type="button"
              className="sim1000-admin-rerun"
              onClick={handleRerun}
              disabled={rerunning}
              aria-label="시뮬 다시 돌리기 (운영자)"
            >
              {rerunning ? (
                <Loader2 size={13} strokeWidth={2.5} className="sim1000-admin-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={13} strokeWidth={2.5} aria-hidden="true" />
              )}
              <span>{rerunning ? "돌리는 중…" : "다시 돌리기"}</span>
            </button>
            <span className="sim1000-admin-hint">발표 라인업 반영 등 cron 이후 재실행</span>
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
