"use client";

// 승리팀 예측 게임 — 오늘 KBO 경기 5개의 승리팀을 선택.
//   - scheduled 경기만 예측 가능 (in_progress/finished/canceled는 예측 불가)
//   - 예측 완료 버튼 누르면 그날 전체 잠금. 잠금 후 수정 불가.
//   - 경기 종료 후 적중/오답 표시 + 오늘/전체 적중률 표시
//
// 디자인: 일정 페이지처럼 컴팩트한 1줄 행 — 5경기가 한 화면에 다 보이도록.

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { VirtualMatchButton } from "@/components/domain/stadium/VirtualMatchButton";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import {
  lockPredictionsForDate,
  upsertPrediction
} from "@/lib/supabase/query-parts/bpPredictions";
import { trackEvent } from "@/lib/analytics/events";
import { POINT_LABEL } from "@/lib/points/config";
import { emitPointBalanceUpdated } from "@/components/domain/points/pointEvents";

export type WinnerPredictGame = {
  id: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
  /** 선발 투수 이름 — KBO 미발표 시 null */
  homeStarter: string | null;
  awayStarter: string | null;
  predictedWinnerTeamId: string | null;
  lockedAt: string | null;
  actualWinnerTeamId: string | null;
  isJudged: boolean;
  isCorrect: boolean | null;
};

type Stats = { total: number; correct: number; pending: number };

type Props = {
  /** 화면에 표시 중인 날짜 (URL ?date=) */
  selectedDateISO: string;
  isToday: boolean;
  /** 선택된 날짜가 오늘보다 미래인지 — true면 read-only로만 표시 */
  isFuture: boolean;
  /** 미래 날짜 편집 허용 여부 — server에서 "내일 + 오늘 경기 모두 끝남"인 경우만 true. */
  canEditFuture: boolean;
  /** 이전 경기일 (없으면 null — 화살표 숨김) */
  prevDateISO: string | null;
  /** 다음 경기일 (없으면 null — 화살표 숨김) */
  nextDateISO: string | null;
  games: WinnerPredictGame[];
  /** 선택된 날짜 기준 적중률 (어제로 가면 어제 통계) */
  dateStats: Stats;
  /** 이번 주(화~일) 누적 적중률 */
  weekStats: Stats;
  allTimeStats: Stats;
  /** 이번 주 AI 3개 평균 적중률(0~100). 집계 전이면 null. — 나 vs AI 대결 표시용 */
  aiWeeklyAccuracy: number | null;
};

function rateLabel(stats: Stats): string {
  if (stats.total === 0) return "—";
  return `${Math.round((stats.correct / stats.total) * 100)}%`;
}

function rateDetail(stats: Stats): string {
  if (stats.total === 0 && stats.pending === 0) return "예측 없음";
  if (stats.total === 0) return `${stats.pending}경기 대기`;
  return `${stats.correct}/${stats.total}${stats.pending > 0 ? ` (+${stats.pending} 대기)` : ""}`;
}

function shortTime(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5); // "18:30:00" → "18:30"
}

// 경기 시작 시각(KST) → epoch ms. gameTime 없으면 null(판단 불가 → 시작 전으로 취급).
// +09:00 오프셋을 명시해 클라 타임존과 무관하게 KST 기준으로 계산.
function gameStartMs(dateISO: string, gameTime: string | null): number | null {
  if (!gameTime) return null;
  const ms = Date.parse(`${dateISO}T${gameTime.slice(0, 5)}:00+09:00`);
  return Number.isNaN(ms) ? null : ms;
}

export function WinnerPredictScreen({
  selectedDateISO,
  isToday,
  isFuture,
  canEditFuture,
  prevDateISO,
  nextDateISO,
  games,
  dateStats,
  weekStats,
  allTimeStats,
  aiWeeklyAccuracy
}: Props) {
  const router = useRouter();
  const { showToast } = useAppState();

  const [predictions, setPredictions] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const g of games) init[g.id] = g.predictedWinnerTeamId;
    return init;
  });

  const [lockedMap, setLockedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of games) init[g.id] = g.lockedAt !== null;
    return init;
  });

  const [saving, startSaving] = useTransition();
  const [locking, setLocking] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  // 잠금 후 익명 계정이면 로그인 유도(이벤트 추첨 대상이 되려면 로그인 필요).
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  // 편집 가능 조건:
  //   - 오늘: 항상 허용
  //   - 미래: server에서 결정 (오직 "내일 + 오늘 경기 모두 끝남"인 경우만 true)
  //   - 모레 이후 미래 + 과거: read-only.
  const canEditOnThisDate = isToday || (isFuture && canEditFuture);

  // 경기 시작 컷오프 — 시작 시각이 지난 경기는 예측/잠금 불가.
  //   status가 KBO 동기화로 바뀌기 전이라도 시작 시각 기준으로 즉시 마감.
  //   페이지를 열어둔 채 시작 시각이 지나도 반영되도록 15초마다 현재 시각 갱신(오늘만 필요).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isToday) return; // 미래/과거 날짜는 시작 컷오프 불필요
    const id = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(id);
  }, [isToday]);
  const isStarted = useCallback(
    (game: WinnerPredictGame) => {
      const start = gameStartMs(selectedDateISO, game.gameTime);
      return start !== null && nowMs >= start;
    },
    [selectedDateISO, nowMs]
  );

  const editableGames = useMemo(
    () => (canEditOnThisDate ? games.filter((g) => g.status === "scheduled" && !lockedMap[g.id] && !isStarted(g)) : []),
    [games, lockedMap, canEditOnThisDate, isStarted]
  );
  // 애니메이션 트리거 조건: 픽한 경기 + 그 경기 결과(isJudged)가 하나라도 있을 때.
  //   - 오늘 픽 직후(결과 없음) → 정적
  //   - 다음날 들어와서 결과 확인 → 전체 stagger + 펄스
  //   - 픽 없는 일반 경기 둘러보기 → 정적
  const hasAnyJudgedPick = useMemo(
    () => games.some((g) => predictions[g.id] && g.isJudged),
    [games, predictions]
  );

  // 카드 stagger 애니메이션이 끝나는 시점 = 마지막 카드 등장(슬라이드 완료) ms.
  // 마지막 카드 인덱스 = games.length - 1, stagger 간격 500ms, 슬라이드 0.45s.
  const lastCardEndMs = useMemo(
    () => (games.length > 0 ? (games.length - 1) * 500 + 450 : 0),
    [games.length]
  );

  // 날짜 적중률 카운트업 — hasAnyJudgedPick일 때만 0 → target 부드럽게 증가.
  const dateRateTarget =
    dateStats.total > 0 ? Math.round((dateStats.correct / dateStats.total) * 100) : 0;
  const shouldAnimateDateRate = hasAnyJudgedPick && dateStats.total > 0;
  const [displayDateRate, setDisplayDateRate] = useState(
    shouldAnimateDateRate ? 0 : dateRateTarget
  );

  useEffect(() => {
    if (!shouldAnimateDateRate) {
      setDisplayDateRate(dateRateTarget);
      return;
    }
    let raf = 0;
    let startTime = 0;
    const animDuration = 800;
    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      if (elapsed < lastCardEndMs) {
        setDisplayDateRate(0);
        raf = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, (elapsed - lastCardEndMs) / animDuration);
      const eased = 1 - Math.pow(1 - progress, 2); // ease-out
      setDisplayDateRate(Math.round(dateRateTarget * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shouldAnimateDateRate, dateRateTarget, lastCardEndMs]);
  const unselectedCount = useMemo(
    () => editableGames.filter((g) => !predictions[g.id]).length,
    [editableGames, predictions]
  );
  const pickedCount = useMemo(
    () => editableGames.filter((g) => predictions[g.id]).length,
    [editableGames, predictions]
  );
  const hasAnyEditable = editableGames.length > 0;
  // 1경기라도 픽했으면 완료 가능. 나머지는 picked만 처리됨.
  const canSubmit = hasAnyEditable && pickedCount > 0 && !locking;
  const allLockedToday = games.length > 0 && games.every((g) => g.status !== "scheduled" || lockedMap[g.id]);

  const handlePick = useCallback(
    (game: WinnerPredictGame, teamId: string) => {
      // 오늘/미래만 저장 허용 (과거는 read-only). 버튼이 disabled지만 안전 가드.
      // 경기 시작 시각이 지났으면 차단.
      if (!canEditOnThisDate || game.status !== "scheduled" || lockedMap[game.id] || isStarted(game)) return;
      setPredictions((prev) => ({ ...prev, [game.id]: teamId }));

      startSaving(async () => {
        const client = createSupabaseBrowserClient();
        // 예측 저장은 "행동" → 세션 없으면 이 시점에 익명 계정 lazy 생성.
        const userId = await ensureAnonymousClient(client);
        if (!userId) {
          showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          setPredictions((prev) => ({ ...prev, [game.id]: game.predictedWinnerTeamId }));
          return;
        }
        const result = await upsertPrediction(client, {
          userId,
          gameId: game.id,
          gameDate: selectedDateISO,
          predictedWinnerTeamId: teamId
        });
        if (!result.ok) {
          showToast(`저장 실패: ${result.error}`);
          setPredictions((prev) => ({ ...prev, [game.id]: game.predictedWinnerTeamId }));
        }
      });
    },
    [canEditOnThisDate, lockedMap, showToast, selectedDateISO, isStarted]
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitConfirmOpen(true);
  }, [canSubmit]);

  // 로그인 유도 모달 닫기 — 닫을 때 비로소 서버 상태 동기화(열려 있는 동안 refresh 금지).
  const closeLoginPrompt = useCallback(() => {
    setLoginPromptOpen(false);
    router.refresh();
  }, [router]);

  const confirmSubmit = useCallback(async () => {
    setSubmitConfirmOpen(false);
    setLocking(true);
    const client = createSupabaseBrowserClient();
    const userId = await ensureAnonymousClient(client);
    if (!userId) {
      setLocking(false);
      showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const result = await lockPredictionsForDate(client, userId, selectedDateISO);
    setLocking(false);
    if (!result.ok) {
      showToast(`잠금 실패: ${result.error}`);
      return;
    }
    let awardedPoints = 0;
    try {
      const pointRes = await fetch("/api/points/prediction-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameDate: selectedDateISO })
      });
      const pointData = await pointRes.json();
      if (pointRes.ok && pointData.ok) {
        emitPointBalanceUpdated(pointData.balance);
        awardedPoints = Number(pointData.awarded ?? 0);
      }
    } catch {
      // BP reward failure must not block prediction submission.
    }
    // 익명 여부 확인 — 로그인 유도 모달 분기용. (조회 실패 시 보수적으로 비익명 취급)
    let isAnon = false;
    try {
      const { data: { user: authUser } } = await client.auth.getUser();
      isAnon = !authUser || authUser.is_anonymous === true;
    } catch {
      // ignore
    }

    setLockedMap((prev) => {
      const next = { ...prev };
      for (const g of editableGames) next[g.id] = true;
      return next;
    });
    void trackEvent("prediction_submitted", {
      gameDate: selectedDateISO,
      lockedCount: result.locked,
      pickedCount
    });

    if (isAnon) {
      // 익명 → 로그인 유도 모달. router.refresh()는 이 컴포넌트를 리렌더/리마운트해
      // 모달을 닫아버리므로, 모달이 열려 있는 동안엔 호출하지 않고 닫을 때 새로고침한다.
      // (잠금 UI는 위 setLockedMap 으로 이미 반영됨)
      setLoginPromptOpen(true);
    } else {
      showToast(
        awardedPoints > 0
          ? `${result.locked}개 예측 완료!\n${awardedPoints.toLocaleString()}${POINT_LABEL} 획득!`
          : `${result.locked}개 예측 완료!`
      );
      router.refresh();
    }
  }, [editableGames, pickedCount, router, showToast, selectedDateISO]);

  // 선택 날짜 라벨 — "5.26 (화)"
  const dateLabel = useMemo(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
  }, [selectedDateISO]);

  return (
    <AppShell activeTab="home" title="승리팀 예측" theme="light" backHref="/" wide>
      {/* ── 이번 주 나 vs AI 대결 (이벤트 동기 부여) ── */}
      {(() => {
        const myTotal = weekStats.total;
        const myRate = myTotal > 0 ? (weekStats.correct / myTotal) * 100 : null;
        const aiRate = aiWeeklyAccuracy;
        let tone: "neutral" | "win" | "lose" | "draw" = "neutral";
        let msg = "";
        if (aiRate === null) {
          msg = "";
        } else if (myRate === null) {
          msg = "아직 채점된 예측이 없어요. 예측에 참여해 AI에 도전하세요!";
        } else if (myRate > aiRate) {
          tone = "win";
          msg = "🔥 AI를 이기고 있어요! 이대로 가면 당첨 도전 가능!";
        } else if (myRate < aiRate) {
          tone = "lose";
          msg = `AI에 ${Math.round(aiRate - myRate)}%p 뒤지는 중 — 더 맞혀보세요!`;
        } else {
          tone = "draw";
          msg = "AI와 동률! 한 끗 차이예요.";
        }
        // 마주보는 분할 막대 — 두 적중률의 비율로 좌/우 점유.
        const totalRate = (myRate ?? 0) + (aiRate ?? 0);
        const myPct = totalRate > 0 ? ((myRate ?? 0) / totalRate) * 100 : 50;
        const aiPct = 100 - myPct;
        return (
          <section className={`predict-duel predict-duel-${tone}`} aria-label="이번 주 AI 대결">
            <div className="predict-duel-head">
              <span className="predict-duel-head-me">
                나{myTotal > 0 ? ` (${myTotal})` : ""} <strong>{myRate !== null ? `${Math.round(myRate)}%` : "—"}</strong>
              </span>
              <span className="predict-duel-head-title">⚔ 이번 주 AI 대결</span>
              <span className="predict-duel-head-ai">
                <strong>{aiRate !== null ? `${aiRate}%` : "—"}</strong> AI 평균
              </span>
            </div>
            <div className="h2h-bar-container predict-duel-bar">
              <div className="h2h-bar predict-duel-bar-me" style={{ width: `${myPct}%` }} />
              <div className="h2h-bar-gap" style={{ marginLeft: "auto" }} />
              <div className="h2h-bar predict-duel-bar-ai" style={{ width: `${aiPct}%` }} />
            </div>
            {msg ? <p className="predict-duel-msg">{msg}</p> : null}
          </section>
        );
      })()}

      {/* 상단 적중률 — 한 줄 컴팩트. 좌측은 선택 날짜 기준이라 어제로 가면 어제 통계.
          애니메이션 트리거(hasAnyJudgedPick) 시 카드 등장 끝난 후 페이드인 + 숫자 카운트업. */}
      <section className="predict-stats" aria-label="적중률">
        <div
          className="predict-stat"
          style={
            hasAnyJudgedPick
              ? {
                  opacity: 0,
                  animation: `predict-stat-fade-in 0.5s ease-out ${lastCardEndMs}ms forwards`
                }
              : undefined
          }
        >
          <span className="predict-stat-label">{isToday ? "오늘" : dateLabel}</span>
          <strong className="predict-stat-value">
            {shouldAnimateDateRate ? `${displayDateRate}%` : rateLabel(dateStats)}
          </strong>
          <span className="predict-stat-detail">{rateDetail(dateStats)}</span>
        </div>
        <div className="predict-stat-divider" aria-hidden="true" />
        <div className="predict-stat">
          <span className="predict-stat-label">이번 주</span>
          <strong className="predict-stat-value">{rateLabel(weekStats)}</strong>
          <span className="predict-stat-detail">{rateDetail(weekStats)}</span>
        </div>
        <div className="predict-stat-divider" aria-hidden="true" />
        <div className="predict-stat">
          <span className="predict-stat-label">전체</span>
          <strong className="predict-stat-value">{rateLabel(allTimeStats)}</strong>
          <span className="predict-stat-detail">{rateDetail(allTimeStats)}</span>
        </div>
      </section>

      {/* 날짜 헤더 — 좌우 화살표로 이전/다음 경기일 이동. 경기 없는 날은 자동 스킵.
          (예: 5/31 → 6/2 점프, 6/1 월요일은 KBO 휴식일이라 노출 안 함) */}
      <header className="predict-day-header">
        {prevDateISO ? (
          <Link
            href={`/predict/winner?date=${prevDateISO}`}
            className="predict-day-nav"
            aria-label="이전 경기일"
            prefetch
          >
            <ChevronLeft size={18} />
          </Link>
        ) : (
          <span className="predict-day-nav predict-day-nav-disabled" aria-hidden />
        )}
        {isToday ? (
          <div className="predict-day-center">
            <strong>{dateLabel}</strong>
            <span className="predict-day-hint">
              {hasAnyEditable
                ? `오늘 · 승리팀 선택 (${editableGames.length - unselectedCount}/${editableGames.length})`
                : allLockedToday && games.some((g) => g.status === "scheduled")
                ? "오늘 · 예측 완료, 결과 대기"
                : "오늘"}
            </span>
          </div>
        ) : (
          <Link
            href="/predict/winner"
            className="predict-day-center predict-day-center-link"
            aria-label="오늘로 돌아가기"
            prefetch
          >
            <strong>{dateLabel}</strong>
            <span className="predict-day-hint">
              {isFuture ? "미리 예측 가능 · 탭하면 오늘로" : "지난 예측 · 탭하면 오늘로"}
            </span>
          </Link>
        )}
        {nextDateISO ? (
          <Link
            href={`/predict/winner?date=${nextDateISO}`}
            className="predict-day-nav"
            aria-label="다음 경기일"
            prefetch
          >
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span className="predict-day-nav predict-day-nav-disabled" aria-hidden />
        )}
      </header>

      {games.length === 0 ? (
        <section className="predict-empty">
          <strong>{isToday ? "오늘 경기가 없어요" : "이 날 경기가 없어요"}</strong>
          <p>좌우 화살표로 다른 날짜를 둘러보세요.</p>
        </section>
      ) : (
        <>
          <section className="predict-row-list" aria-label="오늘 경기">
            {games.map((game, idx) => {
              const home = getTeam(game.homeTeamId);
              const away = getTeam(game.awayTeamId);
              const picked = predictions[game.id];
              const locked = lockedMap[game.id];
              // canEditOnThisDate(=isToday||isFuture)와 일관되게 — 미래 날짜도 편집 허용.
              // 단, 경기 시작 시각이 지났으면 마감.
              const started = isStarted(game);
              const editable = canEditOnThisDate && game.status === "scheduled" && !locked && !started;
              const showScores = game.status === "in_progress" || game.status === "finished";

              const homePicked = picked === game.homeTeamId;
              const awayPicked = picked === game.awayTeamId;
              const homeWon = showScores && game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore;
              const awayWon = showScores && game.homeScore !== null && game.awayScore !== null && game.awayScore > game.homeScore;
              const resultLabel = picked && game.isJudged
                ? game.isCorrect === true
                  ? "적중"
                  : "실패"
                : null;

              // 페이지에 픽이 하나라도 있으면 모든 카드 stagger로 등장 (예측 페이지 톤).
              // 픽이 전혀 없는 날(일반 경기 둘러보기)에선 다 정적.
              const rowClasses = ["predict-row"];
              if (editable) rowClasses.push("is-editable");
              if (hasAnyJudgedPick) rowClasses.push("is-staggered");

              const sideClass = (isPicked: boolean, won: boolean) => {
                const parts = ["predict-row-side"];
                if (isPicked) parts.push("is-picked");
                if (won && game.isJudged) parts.push("is-winner");
                if (isPicked && game.isJudged && game.isCorrect === true) parts.push("is-correct");
                if (isPicked && game.isJudged && game.isCorrect === false) parts.push("is-wrong");
                return parts.join(" ");
              };

              // 카드 stagger — inline shorthand로 animation 전체 명시 (CSS hot reload 누락 방지).
              // 0.5초 간격으로 위에서부터 순차 등장.
              const animationStyle = hasAnyJudgedPick
                ? {
                    animation: `predict-row-judged-in 0.45s ease-out ${idx * 500}ms backwards`
                  }
                : undefined;
              // 결과 라벨 펄스 = 카드 등장 시점 + 카드 슬라이드 완료(0.45s)
              return (
                <article key={game.id} className={rowClasses.join(" ")} style={animationStyle}>
                  <span className="predict-row-meta">
                    {resultLabel ? (
                      <span
                        className={`predict-row-meta-result ${
                          game.isCorrect === true ? "is-correct" : "is-wrong"
                        }`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 36,
                          padding: "5px 7px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 900,
                          lineHeight: 1,
                          color: "#ffffff",
                          whiteSpace: "nowrap",
                          background: game.isCorrect === true ? "var(--bp-success)" : "var(--bp-danger)",
                          boxShadow: game.isCorrect === true
                            ? "0 2px 8px rgba(22, 163, 74, 0.25)"
                            : "0 2px 8px rgba(239, 68, 68, 0.22)"
                        }}
                      >
                        {resultLabel}
                      </span>
                    ) : (
                      <>
                        <span className="predict-row-time">{shortTime(game.gameTime)}</span>
                        <span className={`predict-row-status predict-row-status-${started && game.status === "scheduled" ? "in_progress" : game.status}`}>
                          {game.status === "in_progress" ? "진행중" : game.status === "finished" ? "종료" : game.status === "canceled" ? "취소" : started ? "마감" : "예정"}
                        </span>
                      </>
                    )}
                  </span>

                  {/* Away — grid 1fr auto 1fr로 team-block을 카드 정중앙에 고정 */}
                  <button
                    type="button"
                    className={sideClass(awayPicked, awayWon)}
                    onClick={() => handlePick(game, game.awayTeamId)}
                    disabled={!editable || saving}
                    aria-pressed={awayPicked}
                  >
                    <TeamBadge teamId={game.awayTeamId} size="sm" />
                    <span className="predict-row-team-block">
                      <span className="predict-row-team">{away.shortName}</span>
                      {game.awayStarter ? (
                        <span className="predict-row-starter-inline">{game.awayStarter}</span>
                      ) : null}
                    </span>
                    <span className="predict-row-side-trail">
                      {showScores ? <span className="predict-row-score">{game.awayScore ?? "-"}</span> : null}
                      {/* 픽 마크: 적중=초록✓, 오답=빨강X, 미채점=핑크✓ */}
                      {awayPicked && game.isJudged && game.isCorrect === true ? (
                        <Check size={14} className="predict-row-mark predict-row-mark-ok" strokeWidth={3} aria-label="적중" />
                      ) : awayPicked && game.isJudged && game.isCorrect === false ? (
                        <X size={14} className="predict-row-mark predict-row-mark-no" strokeWidth={3} aria-label="오답" />
                      ) : awayPicked ? (
                        <Check size={14} className="predict-row-mark predict-row-mark-pick" strokeWidth={3} aria-label="내 픽" />
                      ) : null}
                    </span>
                  </button>

                  <span className="predict-row-vs">VS</span>

                  {/* Home — 미러 구조 (trail | team | badge) */}
                  <button
                    type="button"
                    className={`${sideClass(homePicked, homeWon)} predict-row-side-right`}
                    onClick={() => handlePick(game, game.homeTeamId)}
                    disabled={!editable || saving}
                    aria-pressed={homePicked}
                  >
                    <span className="predict-row-side-trail">
                      {/* 픽 마크: 적중=초록✓, 오답=빨강X, 미채점=핑크✓ */}
                      {homePicked && game.isJudged && game.isCorrect === true ? (
                        <Check size={14} className="predict-row-mark predict-row-mark-ok" strokeWidth={3} aria-label="적중" />
                      ) : homePicked && game.isJudged && game.isCorrect === false ? (
                        <X size={14} className="predict-row-mark predict-row-mark-no" strokeWidth={3} aria-label="오답" />
                      ) : homePicked ? (
                        <Check size={14} className="predict-row-mark predict-row-mark-pick" strokeWidth={3} aria-label="내 픽" />
                      ) : null}
                      {showScores ? <span className="predict-row-score">{game.homeScore ?? "-"}</span> : null}
                    </span>
                    <span className="predict-row-team-block">
                      <span className="predict-row-team">{home.shortName}</span>
                      {game.homeStarter ? (
                        <span className="predict-row-starter-inline">{game.homeStarter}</span>
                      ) : null}
                    </span>
                    <TeamBadge teamId={game.homeTeamId} size="sm" />
                  </button>

                  <span
                    className="predict-row-action"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}
                  >
                    {game.status !== "canceled" ? (
                      <VirtualMatchButton
                        game={{
                          homeTeamId: game.homeTeamId,
                          awayTeamId: game.awayTeamId,
                          homeStarter: game.homeStarter,
                          awayStarter: game.awayStarter
                        }}
                        className="predict-row-play-btn"
                        idleLabel="경기 시뮬"
                        busyLabel="준비중"
                      />
                    ) : (
                      <span className="predict-row-play-placeholder" aria-hidden />
                    )}
                  </span>

                </article>
              );
            })}
          </section>

          {/* 예측 완료 버튼 */}
          {hasAnyEditable ? (
            <div className="predict-submit-bar">
              <button
                type="button"
                className="predict-submit-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {locking
                  ? "잠그는 중..."
                  : pickedCount === 0
                  ? "경기를 1개 이상 선택"
                  : `예측 완료 (${pickedCount}경기)`}
              </button>
              <p className="predict-submit-hint">완료 후에는 수정할 수 없어요</p>
            </div>
          ) : null}
        </>
      )}

      {/* 적중률 랭킹 페이지 진입 — 항상 노출 */}
      <Link href="/predict/ranking" className="predict-rank-link" prefetch>
        <Crown size={16} />
        <span>적중률 랭킹 보기</span>
        <ArrowRight size={14} />
      </Link>

      <ModalShell
        open={submitConfirmOpen}
        title="예측 완료"
        onClose={() => setSubmitConfirmOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            오늘 예측을 완료할까요?<br />
            완료 후에는 <strong>수정할 수 없어요.</strong>
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setSubmitConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="lineup-confirm-destruct"
              onClick={confirmSubmit}
            >
              예측 완료
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={loginPromptOpen}
        title="이벤트 참여하려면 로그인하세요"
        onClose={closeLoginPrompt}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            예측이 완료됐어요! 🎉<br />
            <strong>승부예측 AI 대결 이벤트</strong> 추첨 대상이 되려면 로그인이 필요해요.<br />
            <span style={{ fontSize: "13px", color: "var(--bp-text-secondary)" }}>
              (당첨 시 쿠폰 전달을 위해 메일·카카오 로그인이 필요합니다)
            </span>
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={closeLoginPrompt}
            >
              다음에
            </button>
            <Link
              href={`/login?next=${encodeURIComponent(`/predict/winner?date=${selectedDateISO}`)}`}
              className="lineup-confirm-destruct"
              style={{ textDecoration: "none", textAlign: "center" }}
              prefetch={false}
            >
              로그인하기
            </Link>
          </div>
        </div>
      </ModalShell>
    </AppShell>
  );
}
