"use client";

import { type ReactNode } from "react";

type LineupBatter = { playerId: string; name: string; battingHand?: "L" | "R" | "S" };

type InningOutcome = { label: string; isHit: boolean; isHr: boolean };
type TodayStat = { ab: number; hits: number };

export function LineupCard({
  side,
  pitcherName,
  batters,
  currentIdx,
  battingSide,
  showOutcome,
  isDone,
  inningOutcomes,
  todayStats
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
            todayStats
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
  todayStats: Map<string, TodayStat>
) {
  const isCurrent = battingSide === side && idx === currentIdx;
  const stored = inningOutcomes.get(batter.playerId);

  let outcomeNode: ReactNode = null;
  if (isCurrent && !showOutcome) {
    // 진행 중인 현재 타석 — 이전 결과가 있어도 새 타석이므로 ··· 표시
    outcomeNode = <span className="stadium-play-lineup-outcome is-pending">···</span>;
  } else if (stored) {
    outcomeNode = (
      <span
        className={`stadium-play-lineup-outcome ${stored.isHr ? "is-hr" : ""} ${stored.isHit ? "is-hit" : ""}`}
      >
        {stored.label}
      </span>
    );
  }

  // 이번 경기 누적 — "(안타수/타수)" 형식. AB 0이면 표시 안 함.
  const today = todayStats.get(batter.playerId);

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
      {outcomeNode}
    </li>
  );
}
