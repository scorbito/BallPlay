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
  prevDate: string;
  nextDate: string;
  publishAtISO: string;           // 선택 날짜의 09:00 KST ISO
  games: AiWinnerGame[];
  nextGameDate: string | null;    // 오늘 경기 없을 때 다음 경기일 (오늘 한정)
  overallStats: AiOverallStats;
  providerStats: AiProviderStats[];
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
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return {
    isPast: diff === 0,
    label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
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
  providerStats
}: Props) {
  const countdown = useCountdown(publishAtISO);
  // 클라이언트 hydration 후 시간 계산 (SSR 미스매치 회피)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

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

  // 09:00 도달 전: 모든 경기가 잠금 상태
  const isBeforePublish = hydrated && !countdown.isPast;

  const providerByName = useMemo(() => {
    const map = new Map<AiProvider, AiProviderStats>();
    for (const p of providerStats) map.set(p.ai_provider, p);
    return map;
  }, [providerStats]);

  return (
    <AppShell activeTab="home" title="AI 승리팀 예측" theme="light" backHref="/">
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

        {/* ── 날짜 네비게이션 — 오늘 / 과거로 이동 가능. 미래는 비활성 ── */}
        <nav className="ai-winner-date-nav" aria-label="날짜 선택">
          <Link
            href={`/predict/ai-winner?date=${prevDate}`}
            className="ai-winner-date-nav-btn"
            aria-label="이전 날짜"
            prefetch={false}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </Link>
          <div className="ai-winner-date-nav-current">
            <span className="ai-winner-date-nav-date">{formatDateLabel(selectedDate)}</span>
            <span className="ai-winner-date-nav-badge">
              {isToday ? "오늘" : isFuture ? "미래" : "지난 예측"}
            </span>
          </div>
          {nextDate <= today ? (
            <Link
              href={`/predict/ai-winner?date=${nextDate}`}
              className="ai-winner-date-nav-btn"
              aria-label="다음 날짜"
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
                const hasSeenReveal = seenIds.has(g.id);

                // 카드 상태:
                //   1) 09시 전 + 예측 없음 → 잠금 카운트다운
                //   2) 09시 후 + 예측 있음 + 안 봤음 → "예측 완료 · 결과 보기" 미스터리
                //   2') 09시 후 + 예측 있음 + 봤음 → 결과 노출 (현재 로직)
                //   3) 경기 종료 + 안 봤음 → "경기 종료 · 결과 보기" (적중 가림)
                //   3') 경기 종료 + 봤음 → 점수 + 적중 노출
                //   4) 그 외 (예측 없는데 09시 지남) → "예측 준비 중"
                const showLocked = isBeforePublish && !hasPredictions;
                const showOpenTeaser = hasPredictions && !finished && !hasSeenReveal;
                const showOpenRevealed = hasPredictions && !finished && hasSeenReveal;
                const showFinishedTeaser = finished && hasPredictions && !hasSeenReveal;
                const showFinishedRevealed = finished && hasSeenReveal;
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

                    {/* 09시 후 + 본 경기 — 합의·픽 미리보기 노출 */}
                    {showOpenRevealed && summary ? (
                      <>
                        <div className="ai-winner-summary">
                          {summary.isUnanimous ? (
                            <span className="ai-winner-summary-tag ai-winner-summary-unanimous">🔥 만장일치</span>
                          ) : summary.isSplit ? (
                            <span className="ai-winner-summary-tag ai-winner-summary-split">⚔ 의견 분분</span>
                          ) : (
                            <span className="ai-winner-summary-tag ai-winner-summary-majority">⚡ 우세</span>
                          )}
                          <span className="ai-winner-summary-text">
                            {summary.dominantTeamId
                              ? `${getTeam(summary.dominantTeamId).shortName} ${summary.homePct >= 50 && summary.dominantTeamId === g.homeTeamId ? summary.homePct : summary.awayPct}%`
                              : `${home.shortName} ${summary.homePct}% · ${away.shortName} ${summary.awayPct}%`}
                          </span>
                        </div>
                        <div className="ai-winner-picks">
                          {orderedPredictions.map((p) => (
                            <span
                              key={p.id}
                              className={`ai-winner-pick ai-winner-pick-${p.ai_provider}`}
                            >
                              <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                              <span className="ai-winner-pick-team">
                                {getTeam(p.predicted_winner_team_id).shortName}
                                <span className="ai-winner-pick-conf"> ({Math.round(p.confidence * 100)}%)</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      </>
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
                              {getTeam(p.predicted_winner_team_id).shortName}
                              <span className="ai-winner-pick-conf"> ({Math.round(p.confidence * 100)}%)</span>
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
