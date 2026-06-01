"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, ChevronLeft, ChevronRight, Lock, Trophy, Wand2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { GameStatus } from "@/lib/types/api-contracts";
import type {
  AiOverallStats,
  AiProvider,
  AiProviderStats,
  BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";

export type AiWinnerGame = {
  id: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  predictions: BpAiPredictionRow[];
};

type Props = {
  today: string;                  // 오늘 KST YYYY-MM-DD (네비 한계용)
  selectedDate: string;           // 현재 보고 있는 날짜
  isToday: boolean;
  isFuture: boolean;              // 오늘보다 미래 (예측 없을 가능성)
  /** 이전 경기일 (없으면 null — 화살표 비활성) */
  prevDate: string | null;
  /** 다음 경기일 (없으면 null — 화살표 비활성). 미래 경기일도 허용 (AI 예측 도착 전 카운트다운 표시). */
  nextDate: string | null;
  publishAtISO: string;           // 선택 날짜의 09:00 KST ISO
  games: AiWinnerGame[];
  nextGameDate: string | null;    // 오늘 경기 없을 때 다음 경기일 (오늘 한정)
  overallStats: AiOverallStats;
  providerStats: AiProviderStats[];
  /** 운영자는 09시 공개 전이라도 잠금 해제 (컨텐츠 영상 제작용). */
  isAdmin?: boolean;
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

// AI 표시 순서 — 사용자 요청에 따라 GPT → Gemini → Claude 고정.
// 적중률 헤더, 경기 카드 픽, reveal 페이지 모두 같은 순서로.
const AI_ORDER: AiProvider[] = ["gpt", "gemini", "claude"];
const AI_ORDER_RANK: Record<AiProvider, number> = { gpt: 0, gemini: 1, claude: 2 };

/** 카운트다운: 09시 공개까지 남은 시간. 1초마다 업데이트. */
function useCountdown(targetISO: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(targetISO).getTime();
  const diff = Math.max(0, target - now);
  // 시간 스케일에 따라 라벨 형식 분기 — "17:00:00" 같은 시각 오인 방지.
  //   >= 24h: "약 X일 Y시간"
  //   1h ~ 24h: "약 H시간 M분"
  //   < 1h: "MM:SS"
  let label: string;
  if (diff >= 86_400_000) {
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    label = hours > 0 ? `약 ${days}일 ${hours}시간` : `약 ${days}일`;
  } else if (diff >= 3_600_000) {
    const hours = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    label = mins > 0 ? `약 ${hours}시간 ${mins}분` : `약 ${hours}시간`;
  } else {
    const mins = Math.floor(diff / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return {
    isPast: diff === 0,
    label
  };
}

function formatDateLabel(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** "18:30:00" 또는 "18:30" → "18:30". null/undefined 면 빈 문자열. */
function formatGameTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** 구장이 "미정" 또는 빈값이면 표시 안 함. */
function shouldShowStadium(stadium: string | null): boolean {
  if (!stadium) return false;
  const trimmed = stadium.trim();
  if (!trimmed) return false;
  return trimmed !== "미정";
}

/** 다수결 + 가중평균을 동시에 산출. UI 카드에서 한눈에. */
function summarize(predictions: BpAiPredictionRow[], homeTeamId: string, awayTeamId: string) {
  if (predictions.length === 0) return null;
  const homeVotes = predictions.filter((p) => p.predicted_winner_team_id === homeTeamId).length;
  const awayVotes = predictions.filter((p) => p.predicted_winner_team_id === awayTeamId).length;
  // 가중평균: 각 픽의 confidence를 해당 팀에 가산
  let homeWeight = 0;
  let awayWeight = 0;
  for (const p of predictions) {
    if (p.predicted_winner_team_id === homeTeamId) homeWeight += p.confidence;
    else if (p.predicted_winner_team_id === awayTeamId) awayWeight += p.confidence;
  }
  const totalWeight = homeWeight + awayWeight;
  const homePct = totalWeight > 0 ? Math.round((homeWeight / totalWeight) * 100) : 50;
  const dominantTeamId = homeVotes > awayVotes ? homeTeamId : awayVotes > homeVotes ? awayTeamId : null;
  // 합의 수준
  const isUnanimous = homeVotes === predictions.length || awayVotes === predictions.length;
  const isSplit = homeVotes > 0 && awayVotes > 0 && Math.abs(homeVotes - awayVotes) <= 1
    && predictions.length >= 2 && !isUnanimous;
  return {
    homeVotes,
    awayVotes,
    homePct,
    awayPct: 100 - homePct,
    dominantTeamId,
    isUnanimous,
    isSplit
  };
}

// reveal 페이지가 마킹하는 키 — 한 번 본 게임은 목록에서 결과 노출
const SEEN_STORAGE_PREFIX = "ballplay:ai-predict-seen:";

export function AiWinnerListScreen({
  today,
  selectedDate,
  isToday,
  isFuture,
  prevDate,
  nextDate,
  publishAtISO,
  games,
  nextGameDate,
  overallStats,
  providerStats,
  isAdmin = false
}: Props) {
  const countdown = useCountdown(publishAtISO);
  // 클라이언트 hydration 후 시간 계산 (SSR 미스매치 회피)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // 홈 펄스 뱃지용 — 오늘자 AI 예측 페이지 진입 시 viewed 마킹.
  // 09시 공개 전이거나 예측이 0건이면 마킹 안 함 (그땐 어차피 뱃지 안 떠야 함).
  useEffect(() => {
    if (!isToday || !countdown.isPast) return;
    const hasAny = games.some((g) => g.predictions.length > 0);
    if (!hasAny) return;
    try {
      window.localStorage.setItem("ballplay:ai-predict:lastViewedDate", selectedDate);
    } catch {
      // ignore storage errors
    }
  }, [isToday, countdown.isPast, games, selectedDate]);

  // 한 번이라도 reveal 페이지에서 본 게임 id 집합. hydration 후에만 채움 (SSR 안전).
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const g of games) {
      try {
        if (window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${g.id}`) === "1") {
          next.add(g.id);
        }
      } catch {
        // ignore storage errors
      }
    }
    setSeenIds(next);
  }, [games]);

  // 09:00 도달 전: 모든 경기가 잠금 상태.
  // 운영자(admin) 는 잠금 해제 — 컨텐츠 영상 사전 제작용으로 예측을 미리 봐야 함.
  // 공개 시각 전 — admin도 카드에 예측이 없으면 카운트다운 표시 (데이터 미생성 안내용).
  // 단 예측이 이미 존재하면 showLocked가 hasPredictions로 자연히 false가 돼서 admin은 미리 reveal됨.
  const isBeforePublish = hydrated && !countdown.isPast;

  const providerByName = useMemo(() => {
    const map = new Map<AiProvider, AiProviderStats>();
    for (const p of providerStats) map.set(p.ai_provider, p);
    return map;
  }, [providerStats]);

  return (
    <AppShell activeTab="home" title="AI 승리팀 예측" theme="light" backHref="/" wide>
      <section className="ai-winner-screen">
        {/* ── 시즌 적중률 헤더 카드 ── */}
        <header className="ai-winner-stats-card">
          <div className="ai-winner-stats-overall">
            <span className="ai-winner-stats-label">
              <Trophy size={12} strokeWidth={2.5} />
              AI 종합
            </span>
            <span className="ai-winner-stats-accuracy">
              {overallStats.accuracy !== null ? `${overallStats.accuracy}%` : "—"}
            </span>
            <span className="ai-winner-stats-detail">
              {overallStats.correct_count} / {overallStats.total_count} 적중
            </span>
          </div>
          <div className="ai-winner-stats-providers">
            {AI_ORDER.map((name) => {
              const stat = providerByName.get(name);
              const acc = stat?.accuracy;
              const total = stat?.total_count ?? 0;
              const correct = stat?.correct_count ?? 0;
              return (
                <div key={name} className={`ai-winner-provider-mini ai-winner-provider-${name}`}>
                  <span className="ai-winner-provider-name">{AI_LABEL[name]}</span>
                  <span className="ai-winner-provider-acc">{acc !== null && acc !== undefined ? `${acc}%` : "—"}</span>
                  <span className="ai-winner-provider-count">{correct}/{total}</span>
                </div>
              );
            })}
          </div>
        </header>

        {/* ── 날짜 네비게이션 — 경기 없는 날 자동 스킵.
            미래로도 이동 가능 (AI 예측 도착 전엔 카운트다운 카드로 표시). ── */}
        <nav className="ai-winner-date-nav" aria-label="날짜 선택">
          {prevDate ? (
            <Link
              href={`/predict/ai-winner?date=${prevDate}`}
              className="ai-winner-date-nav-btn"
              aria-label="이전 경기일"
              prefetch={false}
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="ai-winner-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </span>
          )}
          <div className="ai-winner-date-nav-current">
            <span className="ai-winner-date-nav-date">{formatDateLabel(selectedDate)}</span>
            <span className="ai-winner-date-nav-badge">
              {isToday ? "오늘" : isFuture ? "미래" : "지난 예측"}
            </span>
          </div>
          {nextDate ? (
            <Link
              href={`/predict/ai-winner?date=${nextDate}`}
              className="ai-winner-date-nav-btn"
              aria-label="다음 경기일"
              prefetch={false}
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="ai-winner-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronRight size={16} strokeWidth={2.5} />
            </span>
          )}
        </nav>

        {/* ── 선택 날짜 경기 ── */}
        <section className="ai-winner-games">
          {games.length === 0 ? (
            <div className="ai-winner-empty">
              <Bot size={36} strokeWidth={1.5} aria-hidden="true" />
              <p className="ai-winner-empty-title">
                {isToday ? "오늘은 경기가 없어요" : isFuture ? "예정된 경기가 없어요" : "이날은 경기가 없었어요"}
              </p>
              {isToday && nextGameDate ? (
                <p className="ai-winner-empty-sub">다음 경기 — {formatDateLabel(nextGameDate)}</p>
              ) : null}
              {!isToday ? (
                <p className="ai-winner-empty-sub">
                  <Link href="/predict/ai-winner" className="ai-winner-back-today">오늘로 돌아가기</Link>
                </p>
              ) : !nextGameDate ? (
                <p className="ai-winner-empty-sub">다음 일정은 곧 업데이트됩니다</p>
              ) : null}
            </div>
          ) : (
            <ul className="ai-winner-game-list">
              {games.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const finished = g.status === "finished";
                const isCanceled = g.status === "canceled";
                const hasPredictions = g.predictions.length > 0;
                // AI 표시 순서 고정 (GPT → Gemini → Claude)
                const orderedPredictions = [...g.predictions].sort(
                  (a, b) => AI_ORDER_RANK[a.ai_provider] - AI_ORDER_RANK[b.ai_provider]
                );
                const summary = summarize(g.predictions, g.homeTeamId, g.awayTeamId);
                // 사용자가 이 게임의 reveal 페이지를 한 번이라도 본 적 있는가
                // 안 봤으면 합의/픽/적중 미리보기를 숨겨서 클릭 동기 유발.
                // ⚠️ 미스터리 연출은 "오늘 첫 reveal"에만 의미 있음. 과거 날짜 경기는
                //    적중 결과 확인이 목적이므로 무조건 펼친 상태로 노출.
                const hasSeenReveal = seenIds.has(g.id);
                const effectiveSeen = hasSeenReveal || !isToday;

                // 카드 상태:
                //   1) 09시 전 + 예측 없음 → 잠금 카운트다운
                //   2) 09시 후 + 예측 있음 + 안 봤음 → "예측 완료 · 결과 보기" 미스터리
                //   2') 09시 후 + 예측 있음 + 봤음 → 결과 노출 (현재 로직)
                //   3) 경기 종료 + 안 봤음 → "경기 종료 · 결과 보기" (적중 가림)
                //   3') 경기 종료 + 봤음 → 점수 + 적중 노출
                //   4) 그 외 (예측 없는데 09시 지남) → "예측 준비 중"
                const showLocked = isBeforePublish && !hasPredictions;
                const showOpenTeaser = hasPredictions && !finished && !effectiveSeen;
                const showOpenRevealed = hasPredictions && !finished && effectiveSeen;
                const showFinishedTeaser = finished && hasPredictions && !effectiveSeen;
                const showFinishedRevealed = finished && effectiveSeen;
                // "예측 준비 중"은 오늘만 의미 있음. 과거 날짜(우천취소·예측 누락 등)에선
                // 별도 메시지 없이 카드를 그대로 둔다 — 결과(점수) 만 보이거나 빈 카드.
                const showPending = isToday
                  && !showLocked && !showOpenTeaser && !showOpenRevealed
                  && !showFinishedTeaser && !showFinishedRevealed && !finished;
                // 빈 종료 경기 (예측 없음 + finished) — 점수만 표시
                const showFinishedNoPredict = finished && !hasPredictions;

                // 점수는 KBO 공식 발표 정보라 종료된 경기는 항상 노출.
                // AI 예측의 적중 여부만 teaser 로 가린다.
                const showScoreInline = finished;
                const timeLabel = formatGameTime(g.gameTime);

                return (
                  <li key={g.id} className="ai-winner-game-card">
                    <div className="ai-winner-game-row">
                      <header className="ai-winner-game-head">
                        {timeLabel ? <span className="ai-winner-game-time">{timeLabel}</span> : null}
                        {shouldShowStadium(g.stadium) ? (
                          <span className="ai-winner-game-stadium">{g.stadium}</span>
                        ) : null}
                      </header>

                      <div className="ai-winner-game-teams">
                        {/* 홈팀 — 뱃지 · 팀명 · 점수(있을 때) */}
                        <div className="ai-winner-team">
                          <TeamBadge teamId={g.homeTeamId} size="sm" />
                          <span className="ai-winner-team-name">{home.shortName}</span>
                          {showScoreInline ? (
                            <span className="ai-winner-team-score">{g.homeScore ?? 0}</span>
                          ) : null}
                        </div>
                        <span className="ai-winner-vs">vs</span>
                        {/* 어웨이팀 — 점수(있을 때) · 팀명 · 뱃지 (홈팀과 좌우 대칭) */}
                        <div className="ai-winner-team">
                          {showScoreInline ? (
                            <span className="ai-winner-team-score">{g.awayScore ?? 0}</span>
                          ) : null}
                          <span className="ai-winner-team-name">{away.shortName}</span>
                          <TeamBadge teamId={g.awayTeamId} size="sm" />
                        </div>
                      </div>

                      {/* 의견 요약 — 시간/팀 라인의 우측에 inline 으로. 아이콘 + 우세팀 + 예측률.
                          showOpenRevealed 일 때만 노출 (잠금/teaser/finished 상태에선 숨김). */}
                      {showOpenRevealed && summary ? (
                        <span
                          className={`ai-winner-game-summary ai-winner-game-summary-${
                            summary.isUnanimous ? "unanimous" : summary.isSplit ? "split" : "majority"
                          }`}
                        >
                          {summary.isUnanimous ? "🔥" : summary.isSplit ? "⚔" : "⚡"}{" "}
                          {summary.dominantTeamId
                            ? `${getTeam(summary.dominantTeamId).shortName} ${
                                summary.dominantTeamId === g.homeTeamId ? summary.homePct : summary.awayPct
                              }%`
                            : `${home.shortName} ${summary.homePct}%`}
                        </span>
                      ) : null}
                    </div>

                    {/* 우천취소·일정변경 등으로 경기 자체가 없어진 경우 — 적중 판정 불가.
                        AI 예측 픽은 그대로 표시(있으면), 적중/실패만 자연 미표시. */}
                    {isCanceled ? (
                      <div className="ai-winner-canceled-banner">
                        🌧 경기 취소 · 적중 판정 없음
                      </div>
                    ) : null}

                    {showLocked ? (
                      <div className="ai-winner-card-state ai-winner-state-locked">
                        <Lock size={12} strokeWidth={2.5} />
                        공개까지 <strong>{countdown.label}</strong>
                      </div>
                    ) : null}

                    {showPending ? (
                      <div className="ai-winner-card-state ai-winner-state-pending">
                        예측 준비 중
                      </div>
                    ) : null}

                    {/* 09시 후 + 안 본 경기 — 미스터리 톤으로 클릭 유도 */}
                    {showOpenTeaser ? (
                      <div className="ai-winner-card-state ai-winner-state-teaser">
                        <Wand2 size={12} strokeWidth={2.5} />
                        AI 예측이 도착했어요
                      </div>
                    ) : null}

                    {/* 09시 후 + 본 경기 — AI별 픽만 표시. 종합 요약은 game-row 우측 inline 으로 이동. */}
                    {showOpenRevealed && summary ? (
                      <div className="ai-winner-picks">
                        {orderedPredictions.map((p) => (
                          <span
                            key={p.id}
                            className={`ai-winner-pick ai-winner-pick-${p.ai_provider}`}
                          >
                            <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                            <span className="ai-winner-pick-team">
                              <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                              <span className="ai-winner-pick-team-name">{getTeam(p.predicted_winner_team_id).shortName}</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* 경기 종료 + 안 본 경기 — 점수도 비공개 + 결과 보기 미스터리 톤 */}
                    {showFinishedTeaser ? (
                      <div className="ai-winner-card-state ai-winner-state-teaser">
                        <Wand2 size={12} strokeWidth={2.5} />
                        경기 종료 · AI 예측 결과 확인하기
                      </div>
                    ) : null}

                    {/* 경기 종료 + 본 경기 — AI별 픽팀 + 신뢰도 + 적중/실패 */}
                    {showFinishedRevealed && hasPredictions ? (
                      <div className="ai-winner-picks">
                        {orderedPredictions.map((p) => (
                          <span
                            key={p.id}
                            className={`ai-winner-pick ai-winner-pick-${p.ai_provider} ${p.is_correct === true ? "is-correct" : p.is_correct === false ? "is-wrong" : ""}`}
                          >
                            <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                            <span className="ai-winner-pick-team">
                              <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                              <span className="ai-winner-pick-team-name">{getTeam(p.predicted_winner_team_id).shortName}</span>
                            </span>
                            <span className="ai-winner-pick-result">
                              {p.is_correct === true ? "✓ 적중" : p.is_correct === false ? "✗ 실패" : "—"}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {hasPredictions ? (
                      <Link href={`/predict/ai-winner/${g.id}`} className="ai-winner-card-cta">
                        결과 보기
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </Link>
                    ) : null}
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
