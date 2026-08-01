"use client";

// 적중률 랭킹 — 주간(화~일, 기본) / 전체(시즌) 탭. 둘 다 서버에서 prefetch 받아 전환만.

import { Fragment, useState } from "react";
import { Trophy } from "lucide-react";
import type { PredictionRankingRow } from "@/lib/supabase/query-parts/bpPredictions";

type Tab = "week" | "season";

type Props = {
  weeklyRows: PredictionRankingRow[];
  /** 예측왕 자격 기준선 — 이 경기 수 미만은 자격 미달(하단 배치 + 구분선). */
  weeklyQualifyBar?: number;
  seasonRows: PredictionRankingRow[];
  currentUserId: string | null;
};

export function PredictionRanking({ weeklyRows, weeklyQualifyBar = 0, seasonRows, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("week");
  const rows = tab === "week" ? weeklyRows : seasonRows;

  // 주간 탭에서만: 자격선 미달 첫 행 위치 → 구분선 삽입.
  const showQualifyGate = tab === "week" && weeklyQualifyBar > 0;
  const firstBelowBarIdx = showQualifyGate
    ? rows.findIndex((r) => r.isAi !== true && r.total < weeklyQualifyBar)
    : -1;

  return (
    <section className="predict-rank" aria-label="적중률 랭킹">
      <header className="predict-rank-head">
        <div className="predict-rank-title">
          <Trophy size={16} />
          <strong>적중률 랭킹</strong>
        </div>
        <p className="predict-rank-sub">
          {tab === "week"
            ? "최소 5경기 예측 · 채점된 경기만 집계"
            : "최소 10경기 예측 · 최근 14일 내 참여자 · 채점된 경기만 집계"}
        </p>
      </header>

      <div className="predict-rank-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "week"}
          className={`predict-rank-tab ${tab === "week" ? "is-active" : ""}`}
          onClick={() => setTab("week")}
        >
          주간
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "season"}
          className={`predict-rank-tab ${tab === "season" ? "is-active" : ""}`}
          onClick={() => setTab("season")}
        >
          전체
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="predict-rank-empty">
          {tab === "week"
            ? "이번 주 아직 5경기 이상 예측한 사용자가 없어요. 첫 도전자가 되어보세요."
            : "아직 5경기 이상 예측한 사용자가 없어요. 첫 도전자가 되어보세요."}
        </p>
      ) : (
        <ol className="predict-rank-list">
          {rows.map((row, index) => {
            const isAi = row.isAi === true;
            const isMe = !isAi && currentUserId !== null && row.user_id === currentUserId;
            const ratePct = Math.round(row.rate * 100);
            const belowBar = showQualifyGate && !isAi && row.total < weeklyQualifyBar;
            const rankBadgeClass =
              row.rank === 1 ? "predict-rank-num-gold"
              : row.rank === 2 ? "predict-rank-num-silver"
              : row.rank === 3 ? "predict-rank-num-bronze"
              : "";
            const gate =
              index === firstBelowBarIdx ? (
                <li className="predict-rank-gate" aria-hidden>
                  예측왕 자격 기준 미달 · {weeklyQualifyBar}경기 이상 예측 필요
                </li>
              ) : null;
            return (
              <Fragment key={row.user_id}>
                {gate}
              <li
                className={`predict-rank-row ${isMe ? "is-me" : ""} ${isAi ? `is-ai is-ai-${row.aiProvider ?? ""}` : ""} ${belowBar ? "is-below-bar" : ""}`}
              >
                <span className={`predict-rank-num ${rankBadgeClass}`}>{row.rank}</span>
                <span className="predict-rank-nick">
                  {isAi ? <span className="predict-rank-ai-tag" aria-hidden>AI</span> : null}
                  {row.nickname ?? "익명"}
                  {isMe ? <span className="predict-rank-me-tag">나</span> : null}
                </span>
                <span className="predict-rank-stats">
                  <strong>{ratePct}%</strong>
                  <span className="predict-rank-stats-detail">{row.correct}/{row.total}</span>
                </span>
              </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </section>
  );
}
