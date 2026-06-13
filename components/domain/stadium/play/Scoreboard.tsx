"use client";

import { useEffect, useRef, useState } from "react";
import { TeamLogo } from "@/components/common/TeamLogo";
import type { BaseState } from "@/lib/sim/types";
import { Diamond, OutDots } from "./Diamond";

// 점수 갱신 지연(ms): 안타·홈런 애니메이션과 박자를 맞추기 위해 살짝 늦춤.
const SCORE_DEFER_MS = 350;
// 효과 className 유지 시간(ms): CSS keyframes 길이보다 살짝 넉넉히.
const EFFECT_DURATION_MS = 1050;

type ScoreEffect = "" | "is-pumping-1" | "is-pumping-n";

function deriveEffect(delta: number): ScoreEffect {
  if (delta <= 0) return "";
  if (delta === 1) return "is-pumping-1";
  return "is-pumping-n";
}

export function Scoreboard({
  awayTeamId,
  homeTeamId,
  awayLabel,
  homeLabel,
  totalAway,
  totalHome,
  awayNickname,
  homeNickname,
  awayInitial,
  homeInitial,
  awayColor,
  homeColor,
  awayBadgeStyle,
  homeBadgeStyle,
  baseState,
  outs
}: {
  awayTeamId: string;
  homeTeamId: string;
  awayLabel: string;
  homeLabel: string;
  totalAway: number;
  totalHome: number;
  awayNickname: string | null;
  homeNickname: string | null;
  awayInitial?: string;
  homeInitial?: string;
  awayColor?: string;
  homeColor?: string;
  awayBadgeStyle?: "circle" | "shield";
  homeBadgeStyle?: "circle" | "shield";
  baseState: BaseState;
  outs: 0 | 1 | 2 | 3;
}) {
  // 표시용 지연 점수. 부모가 cursor 진행 시 즉시 totalAway/totalHome을 갱신하지만,
  // 사용자 시야엔 SCORE_DEFER_MS 뒤에 반영해 타격 모션과 점수 변동의 박자를 맞춤.
  const [shown, setShown] = useState({ away: totalAway, home: totalHome });
  const prevShownRef = useRef(shown);
  const [awayEffect, setAwayEffect] = useState<ScoreEffect>("");
  const [homeEffect, setHomeEffect] = useState<ScoreEffect>("");

  // 점수 갱신: 증가는 지연, 감소(예: 새 게임 시작)는 즉시.
  useEffect(() => {
    if (totalAway === shown.away && totalHome === shown.home) return;
    const awayDecreased = totalAway < shown.away;
    const homeDecreased = totalHome < shown.home;
    if (awayDecreased || homeDecreased) {
      setShown({ away: totalAway, home: totalHome });
      return;
    }
    const t = window.setTimeout(() => {
      setShown({ away: totalAway, home: totalHome });
    }, SCORE_DEFER_MS);
    return () => window.clearTimeout(t);
  }, [totalAway, totalHome, shown.away, shown.home]);

  // shown 변동 감지 → delta 기반 효과 트리거. 초기값(0→0) 은 delta=0이라 자동 스킵.
  useEffect(() => {
    const prev = prevShownRef.current;
    const awayDelta = shown.away - prev.away;
    const homeDelta = shown.home - prev.home;
    prevShownRef.current = shown;

    const nextAway = deriveEffect(awayDelta);
    const nextHome = deriveEffect(homeDelta);

    const rafIds: number[] = [];
    const timerIds: number[] = [];

    if (nextAway) {
      // 동일 효과 재트리거를 위해 한 프레임 비웠다가 다시 set.
      setAwayEffect("");
      rafIds.push(window.requestAnimationFrame(() => setAwayEffect(nextAway)));
      timerIds.push(window.setTimeout(() => setAwayEffect(""), EFFECT_DURATION_MS));
    }
    if (nextHome) {
      setHomeEffect("");
      rafIds.push(window.requestAnimationFrame(() => setHomeEffect(nextHome)));
      timerIds.push(window.setTimeout(() => setHomeEffect(""), EFFECT_DURATION_MS));
    }
    if (rafIds.length === 0 && timerIds.length === 0) return;
    return () => {
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      timerIds.forEach((id) => window.clearTimeout(id));
    };
  }, [shown]);

  const awayScoreClass = `stadium-play-team-score${awayEffect ? ` ${awayEffect}` : ""}`;
  const homeScoreClass = `stadium-play-team-score${homeEffect ? ` ${homeEffect}` : ""}`;

  return (
    // 스코어보드 + 다이아몬드 + 아웃카운트
    // 팀별 레이아웃: [큰 팀 배지] [팀명 + 큰 점수] (반대편은 거울)
    <header className="stadium-play-scoreboard">
      <div className="stadium-play-team">
        <div className="stadium-play-team-badge-col">
          {awayNickname ? (
            <span className="stadium-play-team-nickname" title={awayNickname}>{awayNickname}</span>
          ) : null}
          <TeamLogo
            teamId={awayTeamId}
            size="lg"
            fallbackName={awayLabel}
            fallbackInitial={awayInitial}
            fallbackColor={awayColor}
            fallbackBadgeStyle={awayBadgeStyle}
          />
        </div>
        <div className="stadium-play-team-info">
          <span className="stadium-play-team-name">{awayLabel}</span>
          <strong className={awayScoreClass}>{shown.away}</strong>
        </div>
      </div>
      <div className="stadium-play-state">
        <Diamond base={baseState} />
        <OutDots outs={outs} />
      </div>
      <div className="stadium-play-team stadium-play-team-right">
        <div className="stadium-play-team-info">
          <span className="stadium-play-team-name">{homeLabel}</span>
          <strong className={homeScoreClass}>{shown.home}</strong>
        </div>
        <div className="stadium-play-team-badge-col">
          {homeNickname ? (
            <span className="stadium-play-team-nickname" title={homeNickname}>{homeNickname}</span>
          ) : null}
          <TeamLogo
            teamId={homeTeamId}
            size="lg"
            fallbackName={homeLabel}
            fallbackInitial={homeInitial}
            fallbackColor={homeColor}
            fallbackBadgeStyle={homeBadgeStyle}
          />
        </div>
      </div>
    </header>
  );
}
