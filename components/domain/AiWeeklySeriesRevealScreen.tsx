"use client";

import { useEffect, useMemo, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ConfidenceDonut } from "@/components/domain/ConfidenceDonut";
import { VirtualMatchButton } from "@/components/domain/stadium/VirtualMatchButton";
import { getTeam } from "@/lib/constants/teams";
import aiClaudeSrc from "@/data/Images/ai_claude.png";
import aiGptRightSrc from "@/data/Images/ai_gpt_right.png";
import type { AiProvider } from "@/lib/supabase/query-parts/bpAiPredictions";
import type { AiWeeklySeries } from "@/lib/supabase/query-parts/bpAiWeeklySeriesPredictions";


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

const AI_ORDER_RANK: Record<AiProvider, number> = { gpt: 0, gemini: 1, claude: 2 };

type Props = {
  series: AiWeeklySeries | null;
  backDate?: string;
};

const REVEAL_DELAY_MS = 700;

export function AiWeeklySeriesRevealScreen({ series, backDate = "2026-06-08" }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [visibleStage, setVisibleStage] = useState(0);
  const backHref = `/predict/ai-winner/date/${backDate}`;

  // 초기 reveal 트리거
  useEffect(() => {
    if (visibleStage !== 0) return;
    const t = window.setTimeout(() => setVisibleStage(1), 800);
    return () => window.clearTimeout(t);
  }, [visibleStage]);

  // 단계 자동 진행: AI 3개 카드 순차 등장
  useEffect(() => {
    if (visibleStage === 0 || visibleStage >= 3) return;
    const t = window.setTimeout(() => setVisibleStage((s) => Math.min(s + 1, 3)), REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [visibleStage]);

  const orderedPicks = useMemo(() => {
    if (!series) return [];
    return [...series.picks].sort((a, b) => AI_ORDER_RANK[a.provider] - AI_ORDER_RANK[b.provider]);
  }, [series]);

  if (!series) {
    return (
      <AppShell activeTab="home" title="시리즈 예측" theme="light" backHref={backHref}>
        <section className="ai-weekly-detail-screen">
          <div className="ai-reveal-empty">
            <p>시리즈 예측을 찾을 수 없어요.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const home = getTeam(series.homeTeamId);
  const away = getTeam(series.awayTeamId);
  const voteMap = new Map<string, number>();
  for (const pick of orderedPicks) {
    voteMap.set(pick.teamId, (voteMap.get(pick.teamId) ?? 0) + 1);
  }
  const majorityTeamId = Array.from(voteMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <AppShell activeTab="home" title="시리즈 예측" theme="light" backHref={backHref}>
      <section className="ai-weekly-detail-screen">
        <header className="ai-weekly-detail-hero">
          <div className="ai-weekly-detail-meta">
            <span>{series.label}</span>
            <span>{series.range}</span>
          </div>
          <div className="ai-weekly-detail-matchup">
            <div className="ai-weekly-detail-team">
              <TeamBadge teamId={series.homeTeamId} size="md" />
              <strong>{home.shortName}</strong>
            </div>
            <span>VS</span>
            <div className="ai-weekly-detail-team">
              <strong>{away.shortName}</strong>
              <TeamBadge teamId={series.awayTeamId} size="md" />
            </div>
          </div>
          <p>{series.headline}</p>
          {majorityTeamId ? (
            <div className="ai-weekly-detail-summary">
              <Trophy size={13} strokeWidth={2.5} />
              AI 종합: {getTeam(majorityTeamId).shortName} 우세
            </div>
          ) : null}
        </header>

        {/* ── 돌려보기 버튼 ── */}
        <VirtualMatchButton
          game={{
            homeTeamId: series.homeTeamId,
            awayTeamId: series.awayTeamId
          }}
          className="ai-reveal-sim-btn"
          idleLabel="경기 시뮬레이션"
          busyLabel="준비 중"
        />

        {/* 일일 예측 카드와 동일한 레이아웃(아바타 + 신뢰도 도넛)을 사용해 톤을 맞춘다. */}
        <ul className="ai-reveal-cards">
          {orderedPicks.map((pick, idx) => {
            const expanded = expandedIdx === idx;
            const visible = visibleStage > idx;
            const winnerTeam = getTeam(pick.teamId);
            // confidence 는 0~1 또는 0~100 둘 다 들어올 수 있어 0~1 로 정규화.
            const confidenceValue = pick.confidence <= 1 ? pick.confidence : pick.confidence / 100;
            return (
              <li
                key={pick.provider}
                className={`ai-reveal-card ai-reveal-card-${pick.provider} ${visible ? "is-visible" : ""}`}
                aria-hidden={!visible}
              >
                <div className="ai-reveal-card-prediction-head">
                  <div className="ai-reveal-card-prediction-main">
                    <span className="ai-reveal-card-ai">
                      {AI_LABEL[pick.provider]}
                      {pick.modelName ? <span className="ai-reveal-card-model"> · {pick.modelName}</span> : null}
                    </span>
                    <div className="ai-reveal-card-pick">
                      <TeamBadge teamId={pick.teamId} size="sm" />
                      <span className="ai-reveal-card-team">{pick.result}</span>
                    </div>
                  </div>
                  {Number.isFinite(pick.confidence) ? (
                    <div className="ai-reveal-card-prediction-side">
                      <ConfidenceDonut value={confidenceValue} color={winnerTeam.color} />
                    </div>
                  ) : null}
                </div>
                <div className="ai-reveal-card-key">
                  <span className="ai-reveal-card-key-label">핵심</span>
                  <span className="ai-reveal-card-key-value">{pick.note}</span>
                </div>
                <div className="ai-reveal-card-oneliner-row">
                  <Image
                    src={AI_AVATAR_SRC[pick.provider]}
                    alt={`${AI_LABEL[pick.provider]} AI 캐릭터`}
                    width={64}
                    height={64}
                    sizes="64px"
                    className={`ai-reveal-card-avatar ai-reveal-card-avatar-${pick.provider}`}
                  />
                  <p className="ai-reveal-card-oneliner">{pick.oneLiner}</p>
                </div>
                <button
                  type="button"
                  className="ai-reveal-card-toggle"
                  onClick={() => setExpandedIdx(expanded ? null : idx)}
                  aria-expanded={expanded}
                >
                  {expanded ? "상세 닫기" : "상세 설명"}
                  {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                </button>
                {expanded ? <p className="ai-reveal-card-detail">{pick.detailedAnalysis}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}
