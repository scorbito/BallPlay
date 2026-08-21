"use client";

// 승리팀 예측 게임 — 오늘 KBO 경기 5개의 승리팀을 선택.
//   - scheduled 경기만 예측 가능 (in_progress/finished/canceled는 예측 불가)
//   - 예측 완료 버튼 누르면 그날 전체 잠금. 잠금 후 수정 불가.
//   - 경기 종료 후 적중/오답 표시 + 오늘/전체 적중률 표시
//
// 디자인: 일정 페이지처럼 컴팩트한 1줄 행 — 5경기가 한 화면에 다 보이도록.

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useLiveGames } from "@/lib/hooks/useLiveGames";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Check, ChevronLeft, ChevronRight, Crown, Info, Play, Timer, Users, X } from "lucide-react";
import { BaseballIcon } from "@/components/common/BaseballIcon";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { VirtualMatchButton } from "@/components/domain/stadium/VirtualMatchButton";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import {
  deletePrediction,
  upsertPrediction
} from "@/lib/supabase/query-parts/bpPredictions";
import { trackEvent } from "@/lib/analytics/events";
import { POINT_LABEL, SHOW_BP } from "@/lib/points/config";
import { WEEKLY_EVENT_ACTIVE } from "@/lib/predict/eventConfig";
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
  /** 진행 중 경기의 현재 이닝·초말 (라이브). 그 외 null. */
  innings: number | null;
  inningHalf: "top" | "bottom" | null;
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

const EMPTY_STATS: Stats = { total: 0, correct: 0, pending: 0 };

/** 클라 하이드레이션으로 채우는 내 픽의 판정/잠금 필드 (공개 셸엔 없음). */
type MyPickData = {
  isJudged: boolean;
  isCorrect: boolean | null;
  lockedAt: string | null;
  actualWinnerTeamId: string | null;
};

/** 경기별 AI 다수결 요약 — 공개된(published_at 지난) 예측만 집계된다. */
export type AiGamePick = {
  gameId: string;
  /** 최다 득표 팀. 동수면 null(= AI끼리 갈림) */
  majorityTeamId: string | null;
  /** 최다 득표 수 */
  majorityVotes: number;
  /** 공개된 AI 예측 총 개수 */
  totalVotes: number;
};

/** #rrggbb → rgba(). 팀 컬러를 카드 배경 틴트로 쓰기 위한 변환. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return `rgba(232, 74, 138, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/** 경기별 유저 픽 집계 응답(/api/predict/winner/pick-tallies). */
type PickTally = { total: number; teams: Record<string, number> };

/** 이 표본 미만이면 비율을 아예 안 보여준다. 3명 중 2명을 "67%"로 쓰면 숫자가 거짓말을 한다.
 *  실측(2026-07): 경기당 픽이 당일 34~36건, 며칠 전 날짜는 17~20건.
 *  20으로 잡으면 과거 날짜 대부분이 가려져 히스토리를 훑을 때 들쭉날쭉해 보이므로 10으로 둔다. */
const MIN_TALLY_SAMPLE = 10;

type UserPickSummary = {
  /** 다수 선택 팀. 동수면 null */
  majorityTeamId: string | null;
  /** 다수 선택 비율(%) */
  majorityPct: number;
  /** 다수 선택 팀 인원수 */
  majorityCount: number;
};

/** 홈/원정 픽 수만으로 다수 요약. 표본이 적으면 null → 화면에서 유저 파트를 생략. */
function summarizeUserPicks(
  tally: PickTally | undefined,
  homeTeamId: string,
  awayTeamId: string
): UserPickSummary | null {
  if (!tally) return null;
  const home = tally.teams[homeTeamId] ?? 0;
  const away = tally.teams[awayTeamId] ?? 0;
  const total = home + away;
  if (total < MIN_TALLY_SAMPLE) return null;
  if (home === away) return { majorityTeamId: null, majorityPct: 50, majorityCount: home };
  return {
    majorityTeamId: home > away ? homeTeamId : awayTeamId,
    majorityPct: Math.round((Math.max(home, away) / total) * 100),
    majorityCount: Math.max(home, away)
  };
}

/**
 * 내 픽이 AI·유저 다수와 어떤 관계인지 배지 하나로 압축.
 * AI용·유저용 배지를 따로 달면 정보량은 같은데 폭만 두 배 먹는다.
 */
function computeVerdict(
  picked: string | null | undefined,
  aiMajorityTeamId: string | null,
  userMajorityTeamId: string | null
): { cls: string; text: string } | null {
  if (!picked) return null;
  // 유저 표본이 부족하면 AI 기준 2단계로 폴백.
  if (!userMajorityTeamId) {
    if (!aiMajorityTeamId) return { cls: "is-split", text: "AI도 갈렸어요" };
    return picked === aiMajorityTeamId
      ? { cls: "is-same", text: "나와 같음" }
      : { cls: "is-diff", text: "나와 다름" };
  }
  const withAi = aiMajorityTeamId !== null && picked === aiMajorityTeamId;
  const withCrowd = picked === userMajorityTeamId;
  if (withAi && withCrowd) return { cls: "is-plain", text: "무난" };
  if (withAi) return { cls: "is-ai", text: "AI 편" };
  if (withCrowd) return { cls: "is-crowd", text: "사람 편" };
  return { cls: "is-alone", text: "나 혼자" };
}

/** 픽한 카드에 팀 컬러를 CSS 변수로 주입. 실제 배경·테두리 적용은 dark-predict.css. */
function pickTintStyle(isPicked: boolean, teamId: string): CSSProperties | undefined {
  if (!isPicked) return undefined;
  const color = getTeam(teamId).color;
  return {
    "--pick-line": color,
    "--pick-tint": hexToRgba(color, 0.1)
  } as CSSProperties;
}

type Props = {
  /** 화면에 표시 중인 날짜 (URL ?date=) */
  selectedDateISO: string;
  isToday: boolean;
  /** 선택된 날짜가 오늘보다 미래인지 — true면 read-only로만 표시 */
  isFuture: boolean;
  /** 미래 날짜 편집 허용 여부 — server에서 "다음 경기일 + 오늘 경기 모두 끝남(또는 휴식일)"인 경우만 true. */
  canEditFuture: boolean;
  /** 이전 경기일 (없으면 null — 화살표 숨김) */
  prevDateISO: string | null;
  /** 다음 경기일 (없으면 null — 화살표 숨김) */
  nextDateISO: string | null;
  /** 공개 셸 경기 목록 — 유저 필드(내 픽·판정)는 클라에서 하이드레이션한다. */
  games: WinnerPredictGame[];
  /** 이번 주 AI 3개 평균 적중률(0~100). 집계 전이면 null. — 나 vs AI 대결 표시용 */
  aiWeeklyAccuracy: number | null;
  /** 선택 날짜의 경기별 AI 다수결. 예측이 없는 경기는 배열에서 빠진다. */
  aiPicks: AiGamePick[];
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

/** 남은 시간 라벨 — "2시간 15분" / "42분" / "1분 미만". */
function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "1분 미만";
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
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
  games: shellGames,
  aiWeeklyAccuracy,
  aiPicks
}: Props) {
  const router = useRouter();
  const { showToast } = useAppState();

  const aiPickByGame = useMemo(
    () => new Map(aiPicks.map((pick) => [pick.gameId, pick])),
    [aiPicks]
  );

  const [predictions, setPredictions] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const g of shellGames) init[g.id] = g.predictedWinnerTeamId;
    return init;
  });

  // ── 유저 데이터 하이드레이션 ──
  // 페이지는 공개 셸(ISR 캐시)만 렌더하고, 내 픽·내 적중률은 여기서 /api/predict/winner/my 로 채운다.
  const [myPicks, setMyPicks] = useState<Record<string, MyPickData>>({});
  const [statsData, setStatsData] = useState<{ date: Stats; week: Stats; all: Stats }>({
    date: EMPTY_STATS,
    week: EMPTY_STATS,
    all: EMPTY_STATS
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/predict/winner/my?date=${selectedDateISO}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          picks?: Array<
            { gameId: string; predictedWinnerTeamId: string | null } & MyPickData
          >;
          dateStats?: Stats;
          weekStats?: Stats;
          allTimeStats?: Stats;
        };
        if (cancelled) return;
        const picks = data.picks ?? [];
        // 내가 이미 선택 중인(미제출) 픽은 덮지 않고, 서버에 있는 픽만 채운다.
        setPredictions((prev) => {
          const next = { ...prev };
          for (const p of picks) {
            if (next[p.gameId] == null) next[p.gameId] = p.predictedWinnerTeamId;
          }
          return next;
        });
        const pm: Record<string, MyPickData> = {};
        for (const p of picks) {
          pm[p.gameId] = {
            isJudged: p.isJudged,
            isCorrect: p.isCorrect,
            lockedAt: p.lockedAt,
            actualWinnerTeamId: p.actualWinnerTeamId
          };
        }
        setMyPicks(pm);
        setStatsData({
          date: data.dateStats ?? EMPTY_STATS,
          week: data.weekStats ?? EMPTY_STATS,
          all: data.allTimeStats ?? EMPTY_STATS
        });
      } catch {
        // 실패해도 공개 화면은 성립 — 내 픽·통계만 안 뜰 뿐.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDateISO]);

  // 오늘 경기는 사용자가 보는 동안 라이브 스코어로 갱신(진행 중일 때만, 전 경기 종료 시 중단).
  const liveShellGames = useLiveGames(selectedDateISO, shellGames, isToday);

  // 공개 셸 + 내 픽 병합 = 렌더용 games. 기존 렌더 본문은 game.isJudged/isCorrect 를 그대로 읽는다.
  const games = useMemo(
    () =>
      liveShellGames.map((g) => {
        const mp = myPicks[g.id];
        return mp ? { ...g, ...mp } : g;
      }),
    [liveShellGames, myPicks]
  );
  const dateStats = statsData.date;
  const weekStats = statsData.week;
  const allTimeStats = statsData.all;

  const [saving, startSaving] = useTransition();
  // 규칙 안내 — 상시 문구로 두면 세 번째 방문부터 아무도 안 읽어서 헤더 ⓘ로 접었다.
  const [helpOpen, setHelpOpen] = useState(false);
  // 익명 계정이면 로그인 유도(이벤트 추첨 대상이 되려면 로그인 필요). 첫 픽에서 1회만.
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [loginPromptShown, setLoginPromptShown] = useState(false);
  // 상시 안내용 — 비로그인(세션 없음 or 익명)이면 true. 로그인/회원이면 false.
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!cancelled) setIsGuest(!user || user.is_anonymous === true);
      } catch {
        // 조회 실패 시 안내를 띄우는 쪽(보수적)으로 — 로그인 유도가 과하진 않음.
        if (!cancelled) setIsGuest(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 편집 가능 조건:
  //   - 오늘: 항상 허용
  //   - 미래: server에서 결정 (오직 "다음 경기일 + 오늘 경기 모두 끝남(또는 휴식일)"인 경우만 true)
  //   - 그 다음 경기일 이후 미래 + 과거: read-only.
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

  // 선택 = 예측 확정 모델 — 잠금 여부가 아니라 '경기 시작 전'인지가 편집 가능 기준.
  const editableGames = useMemo(
    () => (canEditOnThisDate ? games.filter((g) => g.status === "scheduled" && !isStarted(g)) : []),
    [games, canEditOnThisDate, isStarted]
  );
  // 애니메이션 트리거 조건: 픽한 경기 + 그 경기 결과(isJudged)가 하나라도 있을 때.
  //   - 오늘 픽 직후(결과 없음) → 정적
  //   - 다음날 들어와서 결과 확인 → 전체 stagger + 펄스
  //   - 픽 없는 일반 경기 둘러보기 → 정적
  // 결과 애니메이션은 그날 "모든 경기가 종료"됐을 때만 (한 경기만 끝나선 안 됨).
  const hasAnyJudgedPick = useMemo(() => {
    const allGamesDone =
      games.length > 0 && games.every((g) => g.status === "finished" || g.status === "canceled");
    return allGamesDone && games.some((g) => predictions[g.id] && g.isJudged);
  }, [games, predictions]);

  // ── 유저 픽 집계 ──
  // 공개 조건(픽했거나 이미 시작·종료)을 만족하는 경기가 하나라도 있을 때만 가져온다.
  // 픽 전에 남의 선택을 보여주면 다수 쪽으로 쏠려서(밴드왜건) 통계가 스스로를 강화해 죽는다.
  const [tallies, setTallies] = useState<Record<string, PickTally>>({});
  const revealedCount = useMemo(
    () =>
      games.filter((g) => Boolean(predictions[g.id]) || isStarted(g) || g.status !== "scheduled")
        .length,
    [games, predictions, isStarted]
  );

  useEffect(() => {
    if (revealedCount === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/predict/winner/pick-tallies?date=${selectedDateISO}`);
        if (!res.ok) return;
        const data = (await res.json()) as { tallies?: Record<string, PickTally> };
        if (!cancelled && data.tallies) setTallies(data.tallies);
      } catch {
        // 집계 실패는 조용히 무시 — AI 정보만 보여도 화면은 성립한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDateISO, revealedCount]);

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
  const pickedCount = useMemo(
    () => editableGames.filter((g) => predictions[g.id]).length,
    [editableGames, predictions]
  );
  const hasAnyEditable = editableGames.length > 0;

  // 다음 예측 마감(=가장 이른 미시작 경기)까지 남은 ms. 오늘이 아니면 표시하지 않는다.
  //   nowMs 가 오늘만 15초 주기로 갱신되므로 다른 날짜에선 값이 멈춘다.
  const nextDeadlineMs = useMemo(() => {
    if (!isToday || !canEditOnThisDate) return null;
    const upcoming = games
      .filter((g) => g.status === "scheduled")
      .map((g) => gameStartMs(selectedDateISO, g.gameTime))
      .filter((ms): ms is number => ms !== null && ms > nowMs);
    if (upcoming.length === 0) return null;
    return Math.min(...upcoming) - nowMs;
  }, [games, selectedDateISO, nowMs, isToday, canEditOnThisDate]);

  // 10분 이내 = 빨강, 1시간 이내 = 주황, 그 밖 = 기본.
  const deadlineTone =
    nextDeadlineMs === null
      ? null
      : nextDeadlineMs <= 10 * 60_000
      ? "urgent"
      : nextDeadlineMs <= 60 * 60_000
      ? "soon"
      : "normal";

  // 선택 = 예측 확정 / 같은 팀 재선택 = 예측 취소.
  // 경기 시작 전까지 자유롭게 변경·취소 가능, 시작하면 자동 잠김(DB 트리거가 강제).
  const handlePick = useCallback(
    (game: WinnerPredictGame, teamId: string) => {
      // 오늘/미래만 저장 허용 (과거는 read-only). 경기 시작 시각이 지났으면 차단.
      if (!canEditOnThisDate || game.status !== "scheduled" || isStarted(game)) return;

      const prevPick = predictions[game.id] ?? null;
      const isCancel = prevPick === teamId;
      setPredictions((prev) => ({ ...prev, [game.id]: isCancel ? null : teamId }));

      startSaving(async () => {
        const client = createSupabaseBrowserClient();
        // 예측 저장은 "행동" → 세션 없으면 이 시점에 익명 계정 lazy 생성.
        const userId = await ensureAnonymousClient(client);
        if (!userId) {
          showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          setPredictions((prev) => ({ ...prev, [game.id]: prevPick }));
          return;
        }

        if (isCancel) {
          const res = await deletePrediction(client, userId, game.id);
          if (!res.ok) {
            showToast(`취소 실패: ${res.error}`);
            setPredictions((prev) => ({ ...prev, [game.id]: prevPick }));
            return;
          }
          showToast("예측을 취소했어요.");
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
          setPredictions((prev) => ({ ...prev, [game.id]: prevPick }));
          return;
        }
        void trackEvent("prediction_submitted", { gameDate: selectedDateISO, gameId: game.id });

        // BP 지급 — rewardKey 로 경기당 1회 멱등이라 픽할 때마다 호출해도 중복 지급 없음.
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
          // BP reward failure must not block prediction.
        }

        // 익명이면 로그인 유도 — 첫 픽에서 1회만. (BP 토스트가 모달을 가리지 않도록 분기)
        let isAnon = false;
        try {
          const { data: { user: authUser } } = await client.auth.getUser();
          isAnon = !authUser || authUser.is_anonymous === true;
        } catch {
          // ignore
        }
        if (isAnon && WEEKLY_EVENT_ACTIVE && !loginPromptShown) {
          setLoginPromptShown(true);
          setLoginPromptOpen(true);
          return;
        }
        if (SHOW_BP && awardedPoints > 0) {
          showToast(`예측 완료!\n${awardedPoints.toLocaleString()}${POINT_LABEL} 획득!`);
        }
      });
    },
    [canEditOnThisDate, isStarted, predictions, selectedDateISO, showToast, loginPromptShown]
  );

  // 로그인 유도 모달 닫기 — 닫을 때 비로소 서버 상태 동기화(열려 있는 동안 refresh 금지).
  const closeLoginPrompt = useCallback(() => {
    setLoginPromptOpen(false);
    router.refresh();
  }, [router]);

  // 선택 날짜 라벨 — "5.26 (화)"
  const dateLabel = useMemo(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
  }, [selectedDateISO]);

  return (
    <AppShell
      activeTab="home"
      title="승리팀 예측"
      theme="light"
      backHref="/"
      wide
      headerAction={
        <button
          type="button"
          className="predict-help-btn"
          onClick={() => setHelpOpen(true)}
          aria-label="예측 규칙 안내"
        >
          <Info size={16} strokeWidth={2.5} />
        </button>
      }
    >
      {/* ── 비로그인 상시 안내 — 이벤트 진행 중 + 게스트일 때만. 모달은 1회지만 이 띠는 계속 노출 ── */}
      {WEEKLY_EVENT_ACTIVE && isGuest ? (
        <Link
          href={`/login?next=${encodeURIComponent(`/predict/winner/date/${selectedDateISO}`)}`}
          className="predict-guest-banner"
          prefetch={false}
        >
          <span className="predict-guest-banner-text">
            🏆 지금은 <strong>당첨 대상이 아니에요.</strong> 로그인하면 주간 예측왕 이벤트에 응모돼요.
          </span>
          <span className="predict-guest-banner-cta">로그인 &rsaquo;</span>
        </Link>
      ) : null}

      {/* ── 선택 날짜 결과 배너 — 채점된 픽이 있을 때만 상단에 노출 ──
          결과가 없는 날(주 초반·첫 방문)에는 아무것도 그리지 않고 바로 경기 목록으로 간다.
          예전엔 빈 통계 카드 2개가 상단을 점유해 핵심 액션이 화면 아래로 밀려 있었다. */}
      {dateStats.total > 0 ? (
        <section
          className="predict-result-banner"
          aria-label="선택 날짜 적중 결과"
          style={
            hasAnyJudgedPick
              ? {
                  opacity: 0,
                  animation: `predict-stat-fade-in 0.5s ease-out ${lastCardEndMs}ms forwards`
                }
              : undefined
          }
        >
          <span className="predict-result-banner-label">
            {isToday ? "오늘 결과" : `${dateLabel} 결과`}
          </span>
          <strong className="predict-result-banner-rate">
            {shouldAnimateDateRate ? `${displayDateRate}%` : rateLabel(dateStats)}
          </strong>
          <span className="predict-result-banner-detail">{rateDetail(dateStats)}</span>
        </section>
      ) : null}

      {/* 날짜 헤더 — 좌우 화살표로 이전/다음 경기일 이동. 경기 없는 날은 자동 스킵.
          (예: 5/31 → 6/2 점프, 6/1 월요일은 KBO 휴식일이라 노출 안 함) */}
      <header className="predict-day-header">
        {prevDateISO ? (
          <Link
            href={`/predict/winner/date/${prevDateISO}`}
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
                ? "오늘"
                : games.some((g) => g.status === "scheduled")
                ? "오늘 · 예측 마감, 결과 대기"
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
            href={`/predict/winner/date/${nextDateISO}`}
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

      {/* ── 픽 진행도 + 마감 카운트다운 ──
          둘 다 "지금 찍어야 한다"는 같은 맥락이라 한 줄로 묶었다. 날짜 헤더에 넣으면
          3줄이 되고, 여기 두면 다음 경기일(미래 편집 가능)에서도 진행도가 보인다.
          카운트다운은 nowMs(잠금 판정용, 15초 주기)를 그대로 재사용해 추가 타이머가 없다. */}
      {hasAnyEditable || nextDeadlineMs !== null ? (
        <div className="predict-pickbar">
          {hasAnyEditable ? (
            <span
              className={`predict-progress${
                pickedCount === editableGames.length ? " is-complete" : ""
              }`}
              aria-label={`${pickedCount}/${editableGames.length}경기 예측`}
            >
              {editableGames.map((g) => (
                <span
                  key={g.id}
                  className={`predict-progress-dot${predictions[g.id] ? " is-filled" : ""}`}
                  aria-hidden
                />
              ))}
              <span className="predict-progress-label">
                {pickedCount === editableGames.length
                  ? "예측 완료"
                  : `${pickedCount}/${editableGames.length}`}
              </span>
            </span>
          ) : null}
          {nextDeadlineMs !== null ? (
            <span className={`predict-deadline predict-deadline-${deadlineTone}`} role="status">
              <Timer size={13} strokeWidth={2.5} aria-hidden />
              <span>
                마감까지 <strong>{formatRemaining(nextDeadlineMs)}</strong>
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

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
              // canEditOnThisDate(=isToday||isFuture)와 일관되게 — 미래 날짜도 편집 허용.
              // 선택=확정 모델이라 잠금 여부는 보지 않고, 경기 시작 전이면 계속 변경·취소 가능.
              const started = isStarted(game);
              const editable = canEditOnThisDate && game.status === "scheduled" && !started;
              const showScores = game.status === "in_progress" || game.status === "finished";

              // 1시간 이내면 "예정" 대신 남은 분을 띄운다. meta 컬럼이 48px 라 분 단위만.
              const startMs = gameStartMs(selectedDateISO, game.gameTime);
              const remainMs = startMs !== null ? startMs - nowMs : null;
              const isSoon =
                isToday &&
                game.status === "scheduled" &&
                remainMs !== null &&
                remainMs > 0 &&
                remainMs <= 60 * 60_000;
              const statusKind = started && game.status === "scheduled" ? "in_progress" : game.status;
              const statusExtra = isSoon
                ? (remainMs as number) <= 10 * 60_000
                  ? " is-urgent"
                  : " is-soon"
                : "";

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
                      // 하나만 표시 — 경기전: 시간 / 진행 중: N회초·말 / 종료: 경기종료.
                      statusKind === "in_progress" ? (
                        <span className={`predict-row-status predict-row-status-in_progress${statusExtra}`}>
                          {game.innings
                            ? `${game.innings}회${game.inningHalf === "bottom" ? "말" : "초"}`
                            : "진행중"}
                        </span>
                      ) : game.status === "finished" ? (
                        <span className="predict-row-status predict-row-status-finished">경기종료</span>
                      ) : game.status === "canceled" ? (
                        <span className="predict-row-status predict-row-status-canceled">취소</span>
                      ) : isSoon ? (
                        <span className={`predict-row-status predict-row-status-scheduled${statusExtra}`}>
                          {Math.max(1, Math.ceil((remainMs as number) / 60_000))}분
                        </span>
                      ) : (
                        <span className="predict-row-time">{shortTime(game.gameTime)}</span>
                      )
                    )}
                  </span>

                  {/* Away — grid 1fr auto 1fr로 team-block을 카드 정중앙에 고정 */}
                  <button
                    type="button"
                    className={sideClass(awayPicked, awayWon)}
                    style={pickTintStyle(awayPicked, game.awayTeamId)}
                    onClick={() => handlePick(game, game.awayTeamId)}
                    disabled={!editable || saving}
                    aria-pressed={awayPicked}
                  >
                    <TeamBadge teamId={game.awayTeamId} size="sm" />
                    <span className="predict-row-team-block">
                      <span className="predict-row-team">{away.shortName}</span>
                      {game.awayStarter ? (
                        <span className="predict-row-starter-inline" title="선발투수">
                          <BaseballIcon size={10} />
                          <span className="predict-row-starter-name">{game.awayStarter}</span>
                        </span>
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
                    style={pickTintStyle(homePicked, game.homeTeamId)}
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
                        <span className="predict-row-starter-inline" title="선발투수">
                          <BaseballIcon size={10} />
                          <span className="predict-row-starter-name">{game.homeStarter}</span>
                        </span>
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
                        // 아이콘만 — 이 페이지의 주 액션은 팀 선택이라 보조 액션은 폭까지 양보.
                        idleLabel={<Play size={13} strokeWidth={2.5} aria-hidden />}
                        busyLabel={<Play size={13} strokeWidth={2.5} aria-hidden />}
                        ariaLabel="경기 시뮬레이션 보기"
                        // 진입점 유지 여부를 데이터로 판단하기 위한 트래킹.
                        onStarted={() => {
                          void trackEvent("spectator_match_started", {
                            from: "winner_predict",
                            gameId: game.id,
                            gameDate: selectedDateISO
                          });
                        }}
                      />
                    ) : (
                      <span className="predict-row-play-placeholder" aria-hidden />
                    )}
                  </span>

                  {/* 경기별 AI 픽 — 픽하면 열리는 구조.
                      AI 픽을 먼저 보여주면 따라 찍게 되고 "나 vs AI 대결"이 성립하지 않는다. */}
                  {(() => {
                    const ai = aiPickByGame.get(game.id);
                    if (!ai || ai.totalVotes === 0) return null;

                    // 이미 시작·종료된 경기는 가릴 이유가 없어 픽 없이도 공개.
                    const revealed = Boolean(picked) || started || game.status !== "scheduled";
                    if (!revealed) {
                      return (
                        <span className="predict-row-ai predict-row-ai-locked">
                          <Bot size={12} aria-hidden />
                          <span>승리팀을 고르면 AI 예측이 열려요</span>
                        </span>
                      );
                    }

                    const aiTeam = ai.majorityTeamId ? getTeam(ai.majorityTeamId) : null;
                    const minorityVotes = ai.totalVotes - ai.majorityVotes;
                    const users = summarizeUserPicks(
                      tallies[game.id],
                      game.homeTeamId,
                      game.awayTeamId
                    );
                    const verdict = computeVerdict(
                      picked,
                      ai.majorityTeamId,
                      users?.majorityTeamId ?? null
                    );
                    return (
                      <Link
                        href={`/predict/ai-winner/${game.id}`}
                        className="predict-row-ai"
                        prefetch={false}
                      >
                        <Bot size={12} aria-hidden />
                        {aiTeam ? (
                          <>
                            <span className="predict-row-ai-votes">
                              {`AI ${ai.majorityVotes}:${minorityVotes}`}
                            </span>
                            <span className="predict-row-ai-team">{aiTeam.shortName}</span>
                          </>
                        ) : (
                          <span className="predict-row-ai-votes">{`AI ${ai.totalVotes}표 동수`}</span>
                        )}
                        {users ? (
                          <span className="predict-row-ai-users">
                            <Users size={12} aria-hidden />
                            <span className="predict-row-ai-votes">
                              {users.majorityTeamId
                                ? `유저 ${users.majorityPct}%`
                                : "유저 50:50"}
                            </span>
                            {users.majorityTeamId ? (
                              <>
                                <span className="predict-row-ai-team">
                                  {getTeam(users.majorityTeamId).shortName}
                                </span>
                                <span className="predict-row-ai-votes">
                                  ({users.majorityCount}명)
                                </span>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                        <span className="predict-row-ai-trail">
                          {verdict ? (
                            <span className={`predict-row-ai-verdict ${verdict.cls}`}>
                              {verdict.text}
                            </span>
                          ) : null}
                          <ChevronRight size={12} aria-hidden />
                        </span>
                      </Link>
                    );
                  })()}
                </article>
              );
            })}
          </section>

          {/* 선택 = 예측 확정. 첫 진입 온보딩 한 줄만 남기고 나머지 규칙은 헤더 ⓘ로.
              픽을 시작한 뒤에는 진행도가 날짜 헤더(n/5)에 이미 보이므로 문구를 지운다. */}
          {hasAnyEditable && pickedCount === 0 ? (
            <div className="predict-submit-bar">
              <p className="predict-submit-hint">팀을 선택하면 바로 예측돼요</p>
            </div>
          ) : null}
        </>
      )}

      {/* ── 이번 주 나 vs AI 대결 ──
          이벤트에서 출발한 재미 요소라 핵심 액션(픽) 아래로 내렸다. */}
      {(() => {
        const myTotal = weekStats.total;
        const myRate = myTotal > 0 ? (weekStats.correct / myTotal) * 100 : null;
        const aiRate = aiWeeklyAccuracy;
        let tone: "neutral" | "win" | "lose" | "draw" = "neutral";
        if (aiRate !== null && myRate !== null) {
          if (myRate > aiRate) tone = "win";
          else if (myRate < aiRate) tone = "lose";
          else tone = "draw";
        }
        // 양쪽 값이 다 있을 때만 막대를 채운다. 예전엔 데이터가 없어도 50:50으로
        // 칠해져서 숫자는 "—"인데 막대는 경쟁 중인 것처럼 보이는 오해가 있었다.
        const comparable = myRate !== null && aiRate !== null;
        const totalRate = (myRate ?? 0) + (aiRate ?? 0);
        const myPct = comparable && totalRate > 0 ? ((myRate ?? 0) / totalRate) * 100 : 0;
        const aiPct = comparable && totalRate > 0 ? 100 - myPct : 0;
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
            {!comparable ? (
              <p className="predict-duel-msg">
                {myRate === null
                  ? "이번 주 예측 결과가 나오면 AI와 비교돼요"
                  : "AI 집계를 기다리는 중이에요"}
              </p>
            ) : null}
          </section>
        );
      })()}

      {/* 누적 적중률 — 값이 있는 항목만 그린다. 주간 집계가 화요일에 리셋되는 탓에
          예전엔 매주 화·수요일마다 3칸 중 2칸이 "—"로 비어 있었다. */}
      {(() => {
        const items: Array<{ key: string; label: string; stats: Stats }> = [];
        if (weekStats.total > 0) items.push({ key: "week", label: "이번 주", stats: weekStats });
        items.push({ key: "all", label: "전체", stats: allTimeStats });
        return (
          <section className="predict-stats" aria-label="적중률">
            {items.map((item, idx) => (
              <Fragment key={item.key}>
                {idx > 0 ? <div className="predict-stat-divider" aria-hidden="true" /> : null}
                <div className="predict-stat">
                  <span className="predict-stat-label">{item.label}</span>
                  <strong className="predict-stat-value">{rateLabel(item.stats)}</strong>
                  <span className="predict-stat-detail">{rateDetail(item.stats)}</span>
                </div>
              </Fragment>
            ))}
          </section>
        );
      })()}

      {/* 적중률 랭킹 페이지 진입 — 항상 노출 */}
      <Link href="/predict/ranking" className="predict-rank-link" prefetch>
        <Crown size={16} />
        <span>적중률 랭킹 보기</span>
        <ArrowRight size={14} />
      </Link>

      <ModalShell
        open={helpOpen}
        title="예측 규칙"
        onClose={() => setHelpOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <ul className="predict-help-list">
          <li>팀을 누르면 그 자리에서 예측이 저장돼요. 별도 완료 버튼은 없어요.</li>
          <li>같은 팀을 다시 누르면 예측이 취소돼요.</li>
          <li>경기가 시작되면 자동으로 잠겨서 수정할 수 없어요.</li>
          <li>AI 예측은 내가 고른 뒤에 열려요. 따라 찍기를 막기 위한 규칙이에요.</li>
          <li>다음 경기일 예측은 오늘 경기가 모두 끝나면 열려요.</li>
        </ul>
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
            <strong>주간 예측왕 이벤트</strong> 당첨 대상이 되려면 로그인이 필요해요.<br />
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
              href={`/login?next=${encodeURIComponent(`/predict/winner/date/${selectedDateISO}`)}`}
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
