"use client";

// 승리팀 예측 게임 — 오늘 KBO 경기 5개의 승리팀을 선택.
//   - scheduled 경기만 예측 가능 (in_progress/finished/canceled는 예측 불가)
//   - 예측 완료 버튼 누르면 그날 전체 잠금. 잠금 후 수정 불가.
//   - 경기 종료 후 적중/오답 표시 + 오늘/전체 적중률 표시
//
// 디자인: 일정 페이지처럼 컴팩트한 1줄 행 — 5경기가 한 화면에 다 보이도록.

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, Lock, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  lockPredictionsForDate,
  upsertPrediction
} from "@/lib/supabase/query-parts/bpPredictions";

export type WinnerPredictGame = {
  id: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
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
  prevDateISO: string;
  nextDateISO: string;
  games: WinnerPredictGame[];
  todayStats: Stats;
  allTimeStats: Stats;
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

export function WinnerPredictScreen({
  selectedDateISO,
  isToday,
  isFuture,
  prevDateISO,
  nextDateISO,
  games,
  todayStats,
  allTimeStats
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

  // 편집 가능 조건: 오늘 + scheduled + 미잠금. 과거 날짜는 무조건 read-only.
  const editableGames = useMemo(
    () => (isToday ? games.filter((g) => g.status === "scheduled" && !lockedMap[g.id]) : []),
    [games, lockedMap, isToday]
  );
  const unselectedCount = useMemo(
    () => editableGames.filter((g) => !predictions[g.id]).length,
    [editableGames, predictions]
  );
  const hasAnyEditable = editableGames.length > 0;
  const canSubmit = hasAnyEditable && unselectedCount === 0 && !locking;
  const allLockedToday = games.length > 0 && games.every((g) => g.status !== "scheduled" || lockedMap[g.id]);

  const handlePick = useCallback(
    (game: WinnerPredictGame, teamId: string) => {
      // 오늘이 아니면 절대 저장 안 함 (버튼이 disabled지만 안전 가드)
      if (!isToday || game.status !== "scheduled" || lockedMap[game.id]) return;
      setPredictions((prev) => ({ ...prev, [game.id]: teamId }));

      startSaving(async () => {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          showToast("세션이 만료됐어요. 새로고침해 주세요.");
          return;
        }
        const result = await upsertPrediction(client, {
          userId: user.id,
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
    [isToday, lockedMap, showToast, selectedDateISO]
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitConfirmOpen(true);
  }, [canSubmit]);

  const confirmSubmit = useCallback(async () => {
    setSubmitConfirmOpen(false);
    setLocking(true);
    const client = createSupabaseBrowserClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      setLocking(false);
      showToast("세션이 만료됐어요. 새로고침해 주세요.");
      return;
    }
    const result = await lockPredictionsForDate(client, user.id, selectedDateISO);
    setLocking(false);
    if (!result.ok) {
      showToast(`잠금 실패: ${result.error}`);
      return;
    }
    setLockedMap((prev) => {
      const next = { ...prev };
      for (const g of editableGames) next[g.id] = true;
      return next;
    });
    showToast(`${result.locked}개 예측 완료!`);
    router.refresh();
  }, [editableGames, router, showToast, selectedDateISO]);

  // 선택 날짜 라벨 — "5.26 (화)"
  const dateLabel = useMemo(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
  }, [selectedDateISO]);

  return (
    <AppShell activeTab="home" title="승리팀 예측" theme="light" backHref="/">
      {/* 상단 적중률 — 한 줄 컴팩트 */}
      <section className="predict-stats" aria-label="적중률">
        <div className="predict-stat">
          <span className="predict-stat-label">오늘</span>
          <strong className="predict-stat-value">{rateLabel(todayStats)}</strong>
          <span className="predict-stat-detail">{rateDetail(todayStats)}</span>
        </div>
        <div className="predict-stat-divider" aria-hidden="true" />
        <div className="predict-stat">
          <span className="predict-stat-label">전체</span>
          <strong className="predict-stat-value">{rateLabel(allTimeStats)}</strong>
          <span className="predict-stat-detail">{rateDetail(allTimeStats)}</span>
        </div>
      </section>

      {/* 날짜 헤더 — 좌우 화살표로 이전/다음 날 이동 (미래도 read-only로 볼 수 있음) */}
      <header className="predict-day-header">
        <Link
          href={`/predict/winner?date=${prevDateISO}`}
          className="predict-day-nav"
          aria-label="이전 날짜"
          prefetch
        >
          <ChevronLeft size={18} />
        </Link>
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
              {isFuture ? "다가올 경기 · 탭하면 오늘로" : "지난 예측 · 탭하면 오늘로"}
            </span>
          </Link>
        )}
        <Link
          href={`/predict/winner?date=${nextDateISO}`}
          className="predict-day-nav"
          aria-label="다음 날짜"
          prefetch
        >
          <ChevronRight size={18} />
        </Link>
      </header>

      {games.length === 0 ? (
        <section className="predict-empty">
          <strong>{isToday ? "오늘 경기가 없어요" : "이 날 경기가 없어요"}</strong>
          <p>좌우 화살표로 다른 날짜를 둘러보세요.</p>
        </section>
      ) : (
        <>
          <section className="predict-row-list" aria-label="오늘 경기">
            {games.map((game) => {
              const home = getTeam(game.homeTeamId);
              const away = getTeam(game.awayTeamId);
              const picked = predictions[game.id];
              const locked = lockedMap[game.id];
              const editable = isToday && game.status === "scheduled" && !locked;
              const showScores = game.status === "in_progress" || game.status === "finished";

              const homePicked = picked === game.homeTeamId;
              const awayPicked = picked === game.awayTeamId;
              const homeWon = showScores && game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore;
              const awayWon = showScores && game.homeScore !== null && game.awayScore !== null && game.awayScore > game.homeScore;

              const sideClass = (isPicked: boolean, won: boolean) => {
                const parts = ["predict-row-side"];
                if (isPicked) parts.push("is-picked");
                if (won && game.isJudged) parts.push("is-winner");
                if (isPicked && game.isJudged && game.isCorrect === true) parts.push("is-correct");
                if (isPicked && game.isJudged && game.isCorrect === false) parts.push("is-wrong");
                return parts.join(" ");
              };

              return (
                <article key={game.id} className={`predict-row ${editable ? "is-editable" : ""}`}>
                  <span className="predict-row-time">{shortTime(game.gameTime)}</span>

                  {/* Away */}
                  <button
                    type="button"
                    className={sideClass(awayPicked, awayWon)}
                    onClick={() => handlePick(game, game.awayTeamId)}
                    disabled={!editable || saving}
                    aria-pressed={awayPicked}
                  >
                    <TeamBadge teamId={game.awayTeamId} size="sm" />
                    <span className="predict-row-team">{away.shortName}</span>
                    {showScores ? <span className="predict-row-score">{game.awayScore ?? "-"}</span> : null}
                    {awayPicked && game.isJudged && game.isCorrect === true ? (
                      <Check size={12} className="predict-row-mark predict-row-mark-ok" />
                    ) : awayPicked && game.isJudged && game.isCorrect === false ? (
                      <X size={12} className="predict-row-mark predict-row-mark-no" />
                    ) : null}
                  </button>

                  <span className="predict-row-vs">VS</span>

                  {/* Home */}
                  <button
                    type="button"
                    className={`${sideClass(homePicked, homeWon)} predict-row-side-right`}
                    onClick={() => handlePick(game, game.homeTeamId)}
                    disabled={!editable || saving}
                    aria-pressed={homePicked}
                  >
                    {homePicked && game.isJudged && game.isCorrect === true ? (
                      <Check size={12} className="predict-row-mark predict-row-mark-ok" />
                    ) : homePicked && game.isJudged && game.isCorrect === false ? (
                      <X size={12} className="predict-row-mark predict-row-mark-no" />
                    ) : null}
                    {showScores ? <span className="predict-row-score">{game.homeScore ?? "-"}</span> : null}
                    <span className="predict-row-team">{home.shortName}</span>
                    <TeamBadge teamId={game.homeTeamId} size="sm" />
                  </button>

                  {/* 우측 상태 */}
                  <span className={`predict-row-status predict-row-status-${game.status}`}>
                    {locked && game.status === "scheduled" ? (
                      <Lock size={11} />
                    ) : game.status === "in_progress" ? (
                      "진행중"
                    ) : game.status === "finished" ? (
                      "종료"
                    ) : game.status === "canceled" ? (
                      "취소"
                    ) : (
                      "예정"
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
                  : unselectedCount > 0
                  ? `${unselectedCount}경기 선택 필요`
                  : `예측 완료 (${editableGames.length}경기)`}
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
    </AppShell>
  );
}
