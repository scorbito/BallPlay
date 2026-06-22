"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, RotateCcw, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ConfidenceDonut } from "@/components/domain/ConfidenceDonut";
import { VirtualMatchButton } from "@/components/domain/stadium/VirtualMatchButton";
import { getTeam } from "@/lib/constants/teams";
import type { GameStatus } from "@/lib/types/api-contracts";
import aiClaudeSrc from "@/data/Images/ai_claude.png";
import aiGptRightSrc from "@/data/Images/ai_gpt_right.png";

const AiWinnerStatsTab = dynamic(
  () => import("./AiWinnerStatsTab").then((m) => m.AiWinnerStatsTab),
  { ssr: false }
);
const AiWinnerSimTab = dynamic(
  () => import("./AiWinnerSimTab").then((m) => m.AiWinnerSimTab),
  { ssr: false }
);
import type {
  AiProvider,
  BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";
import type { BpSimResultRow } from "@/lib/supabase/query-parts/bpSimResults";
import type { Sim1000LineupBatter } from "./AiWinnerSimTab";
import { ContentPointClaimButton } from "@/components/domain/points/ContentPointClaimButton";


type GameInfo = {
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  homeStarter: string | null;
  awayStarter: string | null;
};

type Props = {
  gameId: string;
  game: GameInfo;
  predictions: BpAiPredictionRow[];
  /** 오늘 경기인가 — 과거 경기면 연출 없이 즉시 펼친 상태로 노출. */
  isToday?: boolean;
  isFuture?: boolean;
  selectedDate?: string;
  sim: BpSimResultRow | null;
  homeLineup: Sim1000LineupBatter[] | null;
  awayLineup: Sim1000LineupBatter[] | null;
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

const AI_AVATAR_SRC: Record<AiProvider, StaticImageData | string> = {
  gemini: "/images/ai승부대결_gemini.png",
  claude: aiClaudeSrc,
  gpt: aiGptRightSrc
};

const REVEAL_DELAY_MS = 700;      // 각 AI 카드 등장 간격
const SUMMARY_DELAY_MS = 500;     // 마지막 AI 후 종합 결과 등장까지 추가 지연

const SEEN_STORAGE_PREFIX = "ballplay:ai-predict-seen:";

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

export function AiWinnerRevealScreen({
  gameId,
  game,
  predictions,
  isToday = true,
  isFuture = false,
  selectedDate,
  sim,
  homeLineup,
  awayLineup
}: Props) {
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

  // 전력 비교 탭 관련 상태 및 fetch 로직
  const [activeTab, setActiveTab] = useState<"ai" | "stats" | "sim">("ai");
  const [statsData, setStatsData] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsRequestKey, setStatsRequestKey] = useState(0);

  useEffect(() => {
    if (activeTab !== "stats") return;
    if (statsData || statsLoading || statsError) return;

    setStatsLoading(true);
    setStatsError(null);
    fetch(`/api/predict/ai-winner/${gameId}/stats`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.ok) {
          setStatsData(resData);
        } else {
          setStatsError(resData.error || "데이터를 불러오지 못했습니다.");
        }
      })
      .catch((err) => {
        setStatsError("네트워크 오류가 발생했습니다.");
        console.error(err);
      })
      .finally(() => {
        setStatsLoading(false);
      });
  }, [activeTab, gameId, statsData, statsError, statsLoading, statsRequestKey]);

  // mount 직후 1회 — 과거 경기면 4로 즉시 점프 (연출 스킵).
  // 오늘 경기는 재진입이라도 매번 애니메이션 재생 (사용자 영상 제작 워크플로우).
  // 목록 화면의 미스터리 카드는 markSeen 으로 별도 관리 (한 번 본 픽은 가리지 않음).
  useEffect(() => {
    if (!isToday && !isFuture) setVisibleStage(4);
  }, [isFuture, isToday]);

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
  const hasCompleteAiPredictions = new Set(orderedPredictions.map((p) => p.ai_provider)).size >= 3;
  const isPastDate = !isToday && !isFuture;
  const finished =
    game.status === "finished" ||
    (game.status !== "in_progress" && game.homeScore !== null && game.awayScore !== null) ||
    isPastDate;
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
      backHref={`/predict/ai-winner/date/${selectedDate ?? game.gameDate}`}
      theme="light"
      wide={activeTab === "sim"}
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
              <div className="ai-reveal-team-info">
                <span className="ai-reveal-team-name">{home.shortName}</span>
                {game.homeStarter ? (
                  <span className="ai-reveal-team-starter">{game.homeStarter}</span>
                ) : null}
              </div>
              {finished ? <span className="ai-reveal-team-score">{game.homeScore ?? 0}</span> : null}
            </div>
            <span className="ai-reveal-vs">VS</span>
            <div className="ai-reveal-team">
              {finished ? <span className="ai-reveal-team-score">{game.awayScore ?? 0}</span> : null}
              <div className="ai-reveal-team-info">
                <span className="ai-reveal-team-name">{away.shortName}</span>
                {game.awayStarter ? (
                  <span className="ai-reveal-team-starter">{game.awayStarter}</span>
                ) : null}
              </div>
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

        {/* ── 돌려보기 / 경기 리포트 버튼 ── */}
        {finished ? (
          <Link
            href={`/daily-report?date=${game.gameDate}&focus=${gameId}&backHref=${encodeURIComponent(`/predict/ai-winner/${gameId}`)}`}
            className="ai-reveal-report-btn"
          >
            경기 분석 리포트 보기
          </Link>
        ) : (
          <VirtualMatchButton
            game={{
              homeTeamId: game.homeTeamId,
              awayTeamId: game.awayTeamId,
              homeStarter: game.homeStarter,
              awayStarter: game.awayStarter
            }}
            className="ai-reveal-sim-btn"
            idleLabel="경기 시뮬레이션"
            busyLabel="준비 중"
          />
        )}

        <div className="ai-reveal-tab-bar">
          <button
            type="button"
            className={`ai-reveal-tab-btn ${activeTab === "ai" ? "is-active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            AI 예측 결과
          </button>
          {hasCompleteAiPredictions && (
            <button
              type="button"
              className={`ai-reveal-tab-btn ${activeTab === "stats" ? "is-active" : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              정밀 데이터 비교
            </button>
          )}
          {sim && (
            <button
              type="button"
              className={`ai-reveal-tab-btn ${activeTab === "sim" ? "is-active" : ""}`}
              onClick={() => setActiveTab("sim")}
            >
              1000판 시뮬
            </button>
          )}
        </div>

        {activeTab === "ai" ? (
          orderedPredictions.length === 0 ? (
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
                      <div className="ai-reveal-card-prediction-head">
                        <div className="ai-reveal-card-prediction-main">
                          <span className="ai-reveal-card-ai">
                            {AI_LABEL[p.ai_provider]}
                            {p.model_name ? <span className="ai-reveal-card-model"> · {p.model_name}</span> : null}
                          </span>
                          <div className="ai-reveal-card-pick">
                            <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                            <span className="ai-reveal-card-team">{winnerTeam.shortName} 승</span>
                            {finished ? (
                              <span className={`ai-reveal-card-result ${isCorrect ? "is-correct" : isWrong ? "is-wrong" : ""}`}>
                                {isCorrect ? "적중" : isWrong ? "실패" : "—"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="ai-reveal-card-prediction-side">
                        <ConfidenceDonut
                          value={p.confidence}
                          color={winnerTeam.color}
                        />
                        </div>
                      </div>
                      <div className="ai-reveal-card-key">
                        <span className="ai-reveal-card-key-label">핵심</span>
                        <span className="ai-reveal-card-key-value">{p.key_factor}</span>
                      </div>
                      <div className="ai-reveal-card-oneliner-row">
                        <Image
                          src={AI_AVATAR_SRC[p.ai_provider]}
                          alt={`${AI_LABEL[p.ai_provider]} AI 캐릭터`}
                          width={64}
                          height={64}
                          sizes="64px"
                          className={`ai-reveal-card-avatar ai-reveal-card-avatar-${p.ai_provider}`}
                        />
                        <p className="ai-reveal-card-oneliner">{p.one_liner}</p>
                      </div>
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
          )
        ) : activeTab === "stats" ? (
          <div className="ai-reveal-stats-section">
            {statsLoading && (
              <div className="ai-stats-loading">
                <span className="spinner" />
                <p>KBO 최신 성적 분석 중...</p>
              </div>
            )}
            {statsError && (
              <div className="ai-stats-error">
                <p>{statsError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatsData(null);
                    setStatsError(null);
                    setStatsLoading(false);
                    setStatsRequestKey((value) => value + 1);
                  }}
                  className="retry-btn"
                >
                  다시 시도
                </button>
              </div>
            )}
            {!statsLoading && !statsError && statsData && (
              <AiWinnerStatsTab
                homeTeamId={game.homeTeamId}
                awayTeamId={game.awayTeamId}
                homeTeamName={home.shortName}
                awayTeamName={away.shortName}
                data={statsData}
              />
            )}
          </div>
        ) : (
          sim && (
            <AiWinnerSimTab
              game={{
                gameId,
                gameDate: game.gameDate,
                gameTime: game.gameTime,
                stadium: game.stadium,
                homeTeamId: game.homeTeamId,
                awayTeamId: game.awayTeamId,
                homeStarter: game.homeStarter,
                awayStarter: game.awayStarter,
                homeScore: game.homeScore,
                awayScore: game.awayScore,
                status: game.status
              }}
              sim={sim}
              homeLineup={homeLineup}
              awayLineup={awayLineup}
            />
          )
        )}
      </section>
      {predictions.length > 0 ? (
        <ContentPointClaimButton contentType="ai_prediction" contentId={gameId} />
      ) : null}
    </AppShell>
  );
}
