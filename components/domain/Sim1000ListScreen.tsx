"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Dices, Flame, Loader2, RefreshCw, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { useAppState } from "@/lib/state/AppState";
import { getTeam } from "@/lib/constants/teams";
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
  /** 운영자만 true — "다시 돌리기" 버튼 노출 */
  isAdmin?: boolean;
  /** 시즌 누적 적중률 (live 집계). undefined 또는 total 0 이면 안내 표시. */
  accuracyStats?: Sim1000AccuracyStats;
};

function formatDateLabel(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** today (YYYY-MM-DD) → 어제 (YYYY-MM-DD). UTC 기반 단순 -1일 계산이라 timezone 무관. */
function computeYesterday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
 * - 시뮬 박빙(homeWins == awayWins) 또는 실제 무승부(actualHome == actualAway) → "neutral"
 *   ※ 이 경우 적중/빗나감 판정 불가 → 배지 미노출.
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
  if (!simHomeUp && !simAwayUp) return "neutral";
  if (!actHomeUp && !actAwayUp) return "neutral";
  if (simHomeUp && actHomeUp) return "hit";
  if (simAwayUp && actAwayUp) return "hit";
  return "miss";
}

/** 승률 계산: 무승부 제외한 비율. n 이 0 이면 50/50. */
function winRatePct(homeWins: number, awayWins: number): { home: number; away: number } {
  const decisive = homeWins + awayWins;
  if (decisive <= 0) return { home: 50, away: 50 };
  const home = Math.round((homeWins / decisive) * 1000) / 10;
  return { home, away: Math.round((100 - home) * 10) / 10 };
}

export function Sim1000ListScreen({
  today,
  selectedDate,
  isToday,
  isFuture,
  prevDate,
  nextDate,
  games,
  isAdmin = false,
  accuracyStats
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

  // 어제 경기만 admin 재실행 허용 — 실제 발표 라인업·실제 선발 기반 사후 검증 시뮬용.
  // 오늘은 09:00 cron 이 처리, 그 이전 날짜는 의미 없으므로 비활성.
  const yesterday = computeYesterday(today);
  const isYesterday = selectedDate === yesterday;
  const showRerun = isAdmin && isYesterday;
  // 과거 날짜만 실제 결과 vs 시뮬 비교 표시 (오늘·미래는 점수 미존재).
  const isPast = !isToday && !isFuture;
  // admin이 오늘 페이지에서 어제 데이터가 없을 때 — prev 화살표는 시뮬 데이터 존재 날짜만
  // 이동하므로 어제 데이터가 없으면 영원히 갈 수 없는 모순. 이 케이스에 직접 점프 링크 노출.
  const showJumpToYesterday = isAdmin && isToday && prevDate !== yesterday;

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

        {/* ── 운영자 전용 "어제 경기 시뮬" (어제 + admin) — AI 예측 vs 시뮬 vs 실제 결과 3중 비교용 사후 검증 ── */}
        {showRerun ? (
          <div className="sim1000-admin-bar">
            <button
              type="button"
              className="sim1000-admin-rerun"
              onClick={handleRerun}
              disabled={rerunning}
              aria-label="어제 라인업으로 시뮬 다시 돌리기 (운영자)"
            >
              {rerunning ? (
                <Loader2 size={13} strokeWidth={2.5} className="sim1000-admin-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={13} strokeWidth={2.5} aria-hidden="true" />
              )}
              <span>{rerunning ? "돌리는 중…" : "어제 경기 시뮬"}</span>
            </button>
            <span className="sim1000-admin-hint">실제 발표 라인업 + 실제 선발 기준 사후 검증</span>
          </div>
        ) : null}

        {/* ── 운영자 전용 — 어제 데이터 없을 때 직접 점프 (prev 화살표 비활성화 우회) ── */}
        {showJumpToYesterday ? (
          <div className="sim1000-admin-bar">
            <Link
              href={`/predict/sim-1000?date=${yesterday}`}
              className="sim1000-admin-rerun"
              prefetch={false}
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
              <span>어제({formatDateLabel(yesterday)})로 가기</span>
            </Link>
            <span className="sim1000-admin-hint">어제 시뮬 데이터가 아직 없어요 — 이동 후 "어제 경기 시뮬"</span>
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
                const dominantTeam = homeDominant ? home : awayDominant ? away : null;
                const dominantTeamName = dominantTeam?.shortName ?? "박빙";
                // 우세팀 색상으로 배지 톤 — 팀 컬러 배경(반투명) + 화이트 텍스트.
                // 박빙(무승부 더 많거나 동률)은 중립 톤.
                const summaryStyle = dominantTeam
                  ? { background: dominantTeam.color, color: "#fff" }
                  : undefined;
                const timeLabel = formatGameTime(g.gameTime);

                // ── 실제 결과 비교 (과거 카드 한정) ──
                // - canceled: "🌧 취소" 라벨, 적중 판정 없음
                // - 양쪽 점수 존재: 실제 점수 행 + 적중 배지 표시
                // - 그 외(미진행 등): 비교 행 미노출
                const isCanceled = g.gameStatus === "canceled";
                const hasActualScore =
                  g.actualHomeScore !== null && g.actualAwayScore !== null;
                const showActualRow = isPast && (isCanceled || hasActualScore);
                const verdict =
                  isPast && hasActualScore && !isCanceled
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
                      <span className="sim1000-game-runs-label">평균 점수</span>
                      <span
                        className={`sim1000-game-summary ${
                          dominantTeam ? "sim1000-game-summary-team" : "sim1000-game-summary-tie"
                        }`}
                        style={summaryStyle}
                      >
                        <Flame size={11} strokeWidth={2.5} aria-hidden="true" />
                        {dominantTeamName} {dominantPct}%
                      </span>
                    </header>

                    {/* Row 2: 팀명+평균점수 인라인 매치업 */}
                    <div className="sim1000-game-teams">
                      <div className="sim1000-team">
                        <TeamBadge teamId={g.homeTeamId} size="sm" />
                        <span className="sim1000-team-name">{home.shortName}</span>
                        <span className="sim1000-team-score">{g.homeAvgRuns.toFixed(2)}</span>
                      </div>
                      <span className="sim1000-vs">vs</span>
                      <div className="sim1000-team">
                        <span className="sim1000-team-score">{g.awayAvgRuns.toFixed(2)}</span>
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

                    {/* Row 3: 상세 보기 */}
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
