"use client";

import { type CSSProperties, type ReactNode } from "react";
import type { BaseState } from "@/lib/sim/types";

type LineupBatter = { playerId: string; name: string; battingHand?: "L" | "R" | "S" };

type InningOutcome = { label: string; isHit: boolean; isHr: boolean; isSteal?: boolean; isStealFail?: boolean };
type TodayStat = { ab: number; hits: number };

const BASE_BADGE_STYLE = {
  marginLeft: 0,
  padding: "2px 6px",
  borderRadius: 999,
  background: "rgba(14, 165, 233, 0.14)",
  color: "#0284c7",
  fontSize: 11,
  fontWeight: 800,
  fontStyle: "normal",
  lineHeight: 1
} as const;

const STEAL_OUTCOME_STYLE = {
  background: "linear-gradient(135deg, rgba(251, 191, 36, 0.34), rgba(245, 158, 11, 0.24))",
  color: "#a16207",
  boxShadow: "0 6px 14px rgba(245, 158, 11, 0.18)"
} as const;

const STEAL_FAIL_OUTCOME_STYLE = {
  background: "linear-gradient(135deg, rgba(251, 191, 36, 0.28), rgba(253, 230, 138, 0.34))",
  color: "#92400e",
  boxShadow: "0 6px 14px rgba(245, 158, 11, 0.14)"
} as const;

export function LineupCard({
  side,
  pitcherName,
  batters,
  currentIdx,
  battingSide,
  showOutcome,
  isDone,
  inningOutcomes,
  todayStats,
  baseState
}: {
  side: "home" | "away";
  pitcherName: string;
  batters: LineupBatter[];
  currentIdx: number;
  battingSide: "home" | "away";
  showOutcome: boolean;
  isDone: boolean;
  inningOutcomes: Map<string, InningOutcome>;
  todayStats: Map<string, TodayStat>;
  baseState: BaseState;
}) {
  return (
    <div
      className={`stadium-play-batting-card ${
        !isDone && battingSide === side ? "is-offense" : ""
      } ${isDone ? "is-final" : ""}`}
    >
      <div className="stadium-play-batting-head">
        <span className="stadium-play-batting-pitcher">투수 {pitcherName}</span>
      </div>
      <ol className="stadium-play-lineup">
        {batters.map((b, idx) =>
          renderLineupRow(
            side,
            b,
            idx,
            currentIdx,
            battingSide,
            showOutcome,
            inningOutcomes,
            todayStats,
            baseState
          )
        )}
      </ol>
    </div>
  );
}

function renderLineupRow(
  side: "home" | "away",
  batter: LineupBatter,
  idx: number,
  currentIdx: number,
  battingSide: "home" | "away",
  showOutcome: boolean,
  inningOutcomes: Map<string, InningOutcome>,
  todayStats: Map<string, TodayStat>,
  baseState: BaseState
) {
  const isCurrent = battingSide === side && idx === currentIdx;
  const stored = inningOutcomes.get(batter.playerId);

  let outcomeNode: ReactNode = null;
  if (isCurrent && !showOutcome) {
    // 진행 중인 현재 타석 — 이전 결과가 있어도 새 타석이므로 ··· 표시
    outcomeNode = <span className="stadium-play-lineup-outcome is-pending">···</span>;
  } else if (stored) {
    const outcomeStyle: CSSProperties | undefined = stored.isSteal
      ? STEAL_OUTCOME_STYLE
      : stored.isStealFail
        ? STEAL_FAIL_OUTCOME_STYLE
        : undefined;
    outcomeNode = (
      <span
        className={`stadium-play-lineup-outcome ${stored.isHr ? "is-hr" : ""} ${stored.isHit ? "is-hit" : ""} ${stored.isSteal ? "is-steal" : ""} ${stored.isStealFail ? "is-steal-fail" : ""}`}
        style={outcomeStyle}
      >
        {stored.label}
      </span>
    );
  }

  // 이번 경기 누적 — "(안타수/타수)" 형식. AB 0이면 표시 안 함.
  const baseLabel = getBaseLabel(baseState, batter.playerId);
  const today = todayStats.get(batter.playerId);
  const baseNode = baseLabel ? (
    <em className="stadium-play-lineup-base" style={BASE_BADGE_STYLE}>
      {baseLabel}
    </em>
  ) : null;

  return (
    <li
      key={batter.playerId}
      className={`stadium-play-lineup-row ${isCurrent ? "is-current" : ""}`}
      data-batter-id={batter.playerId}
      data-batting-hand={batter.battingHand}
    >
      <span className="stadium-play-lineup-order">{idx + 1}</span>
      <span className="stadium-play-lineup-name">
        {batter.name}
        {today && today.ab > 0 ? (
          <em className="stadium-play-lineup-today">
            ({today.hits}/{today.ab})
          </em>
        ) : null}
      </span>
      {(baseNode || outcomeNode) ? (
        <span
          className="stadium-play-lineup-status"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {baseNode}
          {outcomeNode}
        </span>
      ) : null}
    </li>
  );
}

function getBaseLabel(baseState: BaseState, playerId: string) {
  if (baseState.first === playerId) return "1루";
  if (baseState.second === playerId) return "2루";
  if (baseState.third === playerId) return "3루";
  return null;
}
