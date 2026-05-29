"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Lock, Sparkles, Trophy } from "lucide-react";
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
  today: string;
  publishAtISO: string;          // 오늘 09:00 KST ISO
  games: AiWinnerGame[];
  nextGameDate: string | null;   // 오늘 경기 없을 때 다음 경기일
  overallStats: AiOverallStats;
  providerStats: AiProviderStats[];
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

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

export function AiWinnerListScreen({
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
              시즌 AI 종합 적중률
            </span>
            <span className="ai-winner-stats-accuracy">
              {overallStats.accuracy !== null ? `${overallStats.accuracy}%` : "—"}
            </span>
            <span className="ai-winner-stats-detail">
              {overallStats.correct_count} / {overallStats.total_count} 적중
            </span>
          </div>
          <div className="ai-winner-stats-providers">
            {(["gemini", "claude", "gpt"] as AiProvider[]).map((name) => {
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

        {/* ── 오늘 경기 ── */}
        <section className="ai-winner-games">
          <h2 className="ai-winner-section-title">
            <Sparkles size={14} strokeWidth={2.5} />
            오늘 경기
            {games.length > 0 ? <span className="ai-winner-section-count">{games.length}</span> : null}
          </h2>

          {games.length === 0 ? (
            <div className="ai-winner-empty">
              <Bot size={36} strokeWidth={1.5} aria-hidden="true" />
              <p className="ai-winner-empty-title">오늘은 경기가 없어요</p>
              {nextGameDate ? (
                <p className="ai-winner-empty-sub">다음 경기 — {formatDateLabel(nextGameDate)}</p>
              ) : (
                <p className="ai-winner-empty-sub">다음 일정은 곧 업데이트됩니다</p>
              )}
            </div>
          ) : (
            <ul className="ai-winner-game-list">
              {games.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const finished = g.status === "finished";
                const hasPredictions = g.predictions.length > 0;
                const summary = summarize(g.predictions, g.homeTeamId, g.awayTeamId);

                // 카드 상태:
                //   1) 09시 전 + 예측 없음 → 잠금 카운트다운
                //   2) 09시 후 + 예측 있음 → 결과 노출
                //   3) 경기 종료 → 결과 + 적중 표시
                //   4) 그 외 (예측 없는데 09시 지남) → "예측 준비 중"
                const showLocked = isBeforePublish && !hasPredictions;
                const showOpen = hasPredictions && !finished;
                const showFinished = finished;
                const showPending = !showLocked && !showOpen && !showFinished;

                return (
                  <li key={g.id} className="ai-winner-game-card">
                    <header className="ai-winner-game-head">
                      <span className="ai-winner-game-time">{g.gameTime ?? "—"}</span>
                      <span className="ai-winner-game-stadium">{g.stadium}</span>
                    </header>

                    <div className="ai-winner-game-teams">
                      <div className="ai-winner-team">
                        <TeamBadge teamId={g.homeTeamId} size="sm" />
                        <span className="ai-winner-team-name">{home.shortName}</span>
                      </div>
                      <span className="ai-winner-vs">vs</span>
                      <div className="ai-winner-team">
                        <TeamBadge teamId={g.awayTeamId} size="sm" />
                        <span className="ai-winner-team-name">{away.shortName}</span>
                      </div>
                    </div>

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

                    {showOpen && summary ? (
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
                          {g.predictions.map((p) => (
                            <span
                              key={p.id}
                              className={`ai-winner-pick ai-winner-pick-${p.ai_provider}`}
                              title={`${AI_LABEL[p.ai_provider]} · ${getTeam(p.predicted_winner_team_id).shortName} ${Math.round(p.confidence * 100)}%`}
                            >
                              <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                              <span className="ai-winner-pick-team">{getTeam(p.predicted_winner_team_id).shortName}</span>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {showFinished ? (
                      <div className="ai-winner-finished">
                        <div className="ai-winner-final-score">
                          {home.shortName} {g.homeScore ?? 0} - {g.awayScore ?? 0} {away.shortName}
                        </div>
                        {hasPredictions ? (
                          <div className="ai-winner-picks">
                            {g.predictions.map((p) => (
                              <span
                                key={p.id}
                                className={`ai-winner-pick ai-winner-pick-${p.ai_provider} ${p.is_correct === true ? "is-correct" : p.is_correct === false ? "is-wrong" : ""}`}
                              >
                                <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                                <span className="ai-winner-pick-result">
                                  {p.is_correct === true ? "✓" : p.is_correct === false ? "✗" : "—"}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {(showOpen || showFinished) && hasPredictions ? (
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
