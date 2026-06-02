"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { GameStatus } from "@/lib/types/api-contracts";
import type {
  AiProvider,
  BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";

type GameInfo = {
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
};

type Props = {
  gameId: string;
  game: GameInfo;
  predictions: BpAiPredictionRow[];
  /** 오늘 경기인가 — 과거 경기면 연출 없이 즉시 펼친 상태로 노출. */
  isToday?: boolean;
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

const REVEAL_DELAY_MS = 700;      // 각 AI 카드 등장 간격
const SUMMARY_DELAY_MS = 500;     // 마지막 AI 후 종합 결과 등장까지 추가 지연

const SEEN_STORAGE_PREFIX = "ballplay:ai-predict-seen:";

function hasSeenBefore(gameId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${gameId}`) === "1";
  } catch {
    return false;
  }
}

function markSeen(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${SEEN_STORAGE_PREFIX}${gameId}`, "1");
  } catch {
    // ignore quota errors
  }
}

/** 다수결·가중평균 계산. */
function summarize(predictions: BpAiPredictionRow[], homeTeamId: string, awayTeamId: string) {
  const homeVotes = predictions.filter((p) => p.predicted_winner_team_id === homeTeamId).length;
  const awayVotes = predictions.filter((p) => p.predicted_winner_team_id === awayTeamId).length;
  let homeWeight = 0;
  let awayWeight = 0;
  for (const p of predictions) {
    if (p.predicted_winner_team_id === homeTeamId) homeWeight += p.confidence;
    else if (p.predicted_winner_team_id === awayTeamId) awayWeight += p.confidence;
  }
  const total = homeWeight + awayWeight;
  const homePct = total > 0 ? Math.round((homeWeight / total) * 100) : 50;
  const majorityTeamId = homeVotes > awayVotes ? homeTeamId : awayVotes > homeVotes ? awayTeamId : null;
  const isUnanimous = predictions.length > 0 && (homeVotes === predictions.length || awayVotes === predictions.length);
  return { homeVotes, awayVotes, homePct, awayPct: 100 - homePct, majorityTeamId, isUnanimous };
}

export function AiWinnerRevealScreen({ gameId, game, predictions, isToday = true }: Props) {
  const home = getTeam(game.homeTeamId);
  const away = getTeam(game.awayTeamId);

  // AI 표시 순서 고정 — GPT → Gemini → Claude (목록·헤더 적중률과 일치)
  const orderedPredictions = useMemo(() => {
    const rank: Record<AiProvider, number> = { gpt: 0, gemini: 1, claude: 2 };
    return [...predictions].sort((a, b) => rank[a.ai_provider] - rank[b.ai_provider]);
  }, [predictions]);

  // 단계: 0=매치업만, 1=첫 AI 등장, 2=두 번째, 3=세 번째, 4=종합 결과까지 모두.
  const [visibleStage, setVisibleStage] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // mount 직후 1회 — 이미 본 게임이거나 과거 경기면 4로 즉시 점프 (연출 스킵).
  // (SSR-safe: useEffect에서만 localStorage 접근.)
  useEffect(() => {
    if (!isToday || hasSeenBefore(gameId)) setVisibleStage(4);
  }, [gameId, isToday]);

  // 초기 reveal 트리거 — visibleStage가 0이면 800ms 후 1로.
  // Strict mode의 두 번 실행에 안전: cleanup이 timer를 비우고 두 번째 mount가 다시 set.
  useEffect(() => {
    if (visibleStage !== 0) return;
    const t = window.setTimeout(() => setVisibleStage(1), 800);
    return () => window.clearTimeout(t);
  }, [visibleStage]);

  // 단계 자동 진행: AI 등장 + 마지막 후 종합 결과
  useEffect(() => {
    if (visibleStage === 0 || visibleStage >= 4) return;
    const isLast = visibleStage >= orderedPredictions.length;
    const delay = isLast ? SUMMARY_DELAY_MS : REVEAL_DELAY_MS;
    const t = window.setTimeout(() => setVisibleStage((s) => Math.min(s + 1, 4)), delay);
    return () => window.clearTimeout(t);
  }, [visibleStage, orderedPredictions.length]);

  // reveal 페이지 진입 즉시 seen 마킹 — 사용자가 stage 4 도달 전에 뒤로 나가도
  // "결과를 봤다"고 판단 (페이지 진입 = 의도. 목록에서 미스터리 풀려야 일관성).
  useEffect(() => {
    markSeen(gameId);
  }, [gameId]);

  const replay = () => {
    setExpandedIdx(null);
    setVisibleStage(0);
    window.setTimeout(() => setVisibleStage(1), 600);
  };

  const summary = summarize(orderedPredictions, game.homeTeamId, game.awayTeamId);
  const finished = game.status === "finished";
  const actualWinnerId =
    finished && game.homeScore !== null && game.awayScore !== null
      ? game.homeScore > game.awayScore
        ? game.homeTeamId
        : game.awayScore > game.homeScore
          ? game.awayTeamId
          : null
      : null;

  return (
    <AppShell
      activeTab="home"
      title="AI 분석 결과"
      backHref="/predict/ai-winner"
      theme="light"
      headerAction={
        visibleStage >= 4 ? (
          <button
            type="button"
            className="ai-reveal-replay-btn"
            onClick={replay}
            aria-label="다시 보기"
          >
            <RotateCcw size={16} strokeWidth={2.5} />
          </button>
        ) : null
      }
    >
      <section className="ai-reveal-screen">
        {/* ── 매치업 헤더 ── */}
        <header className="ai-reveal-matchup">
          <div className="ai-reveal-matchup-meta">
            {game.gameTime ?? "—"} · {game.stadium}
          </div>
          <div className="ai-reveal-matchup-teams">
            <div className="ai-reveal-team">
              <TeamBadge teamId={game.homeTeamId} size="md" />
              <span className="ai-reveal-team-name">{home.shortName}</span>
              {finished ? <span className="ai-reveal-team-score">{game.homeScore ?? 0}</span> : null}
            </div>
            <span className="ai-reveal-vs">VS</span>
            <div className="ai-reveal-team">
              {finished ? <span className="ai-reveal-team-score">{game.awayScore ?? 0}</span> : null}
              <span className="ai-reveal-team-name">{away.shortName}</span>
              <TeamBadge teamId={game.awayTeamId} size="md" />
            </div>
          </div>
          {finished && actualWinnerId ? (
            <div className="ai-reveal-actual-result">
              <Trophy size={12} strokeWidth={2.5} />
              {getTeam(actualWinnerId).shortName} 승
            </div>
          ) : null}
        </header>

        {/* 예측 없으면 */}
        {orderedPredictions.length === 0 ? (
          <div className="ai-reveal-empty">
            <p>아직 공개된 분석이 없어요.</p>
          </div>
        ) : (
          <>
            {/* ── AI 예측 카드 — 단계별 페이드인 ── */}
            <ul className="ai-reveal-cards">
              {orderedPredictions.map((p, idx) => {
                const visible = visibleStage > idx;
                const expanded = expandedIdx === idx;
                const winnerTeam = getTeam(p.predicted_winner_team_id);
                const isCorrect = p.is_correct === true;
                const isWrong = p.is_correct === false;
                return (
                  <li
                    key={p.id}
                    className={`ai-reveal-card ai-reveal-card-${p.ai_provider} ${visible ? "is-visible" : ""}`}
                    aria-hidden={!visible}
                  >
                    <header className="ai-reveal-card-head">
                      <span className="ai-reveal-card-ai">
                        {AI_LABEL[p.ai_provider]}
                        {p.model_name ? <span className="ai-reveal-card-model"> · {p.model_name}</span> : null}
                      </span>
                      {finished ? (
                        <span className={`ai-reveal-card-result ${isCorrect ? "is-correct" : isWrong ? "is-wrong" : ""}`}>
                          {isCorrect ? "적중" : isWrong ? "실패" : "—"}
                        </span>
                      ) : null}
                    </header>
                    <div className="ai-reveal-card-pick">
                      <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                      <span className="ai-reveal-card-team">{winnerTeam.shortName} 승</span>
                      <span className="ai-reveal-card-confidence">{Math.round(p.confidence * 100)}%</span>
                    </div>
                    <div className="ai-reveal-card-key">
                      <span className="ai-reveal-card-key-label">핵심</span>
                      <span className="ai-reveal-card-key-value">{p.key_factor}</span>
                    </div>
                    <p className="ai-reveal-card-oneliner">{p.one_liner}</p>
                    <button
                      type="button"
                      className="ai-reveal-card-toggle"
                      onClick={() => setExpandedIdx(expanded ? null : idx)}
                      aria-expanded={expanded}
                    >
                      {expanded ? "상세 닫기" : "상세 분석"}
                      {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                    </button>
                    {expanded ? (
                      <p className="ai-reveal-card-detail">{p.detailed_analysis}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* ── 종합 결과 (마지막 단계) ── */}
            <section className={`ai-reveal-summary ${visibleStage >= 4 ? "is-visible" : ""}`} aria-hidden={visibleStage < 4}>
              <h2 className="ai-reveal-summary-title">
                <Trophy size={14} strokeWidth={2.5} />
                3 AI 종합 의견
              </h2>
              <div className="ai-reveal-summary-rows">
                <div className="ai-reveal-summary-row">
                  <span className="ai-reveal-summary-label">다수결</span>
                  <span className="ai-reveal-summary-value">
                    {home.shortName} {summary.homeVotes} · {away.shortName} {summary.awayVotes}
                  </span>
                </div>
                <div className="ai-reveal-summary-row">
                  <span className="ai-reveal-summary-label">가중평균</span>
                  <span className="ai-reveal-summary-value">
                    {home.shortName} {summary.homePct}% · {away.shortName} {summary.awayPct}%
                  </span>
                </div>
              </div>
              <div className="ai-reveal-summary-tag-row">
                {summary.isUnanimous ? (
                  <span className="ai-reveal-summary-tag ai-reveal-tag-unanimous">🔥 만장일치</span>
                ) : summary.majorityTeamId ? (
                  <span className="ai-reveal-summary-tag ai-reveal-tag-majority">
                    ⚡ {getTeam(summary.majorityTeamId).shortName} 우세
                  </span>
                ) : (
                  <span className="ai-reveal-summary-tag ai-reveal-tag-split">⚔ 의견 분분</span>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </AppShell>
  );
}
