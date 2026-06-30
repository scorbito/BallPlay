"use client";

// 적중률 랭킹 — 주간(화~일, 기본) / 전체(시즌) 탭. 둘 다 서버에서 prefetch 받아 전환만.

import { useState } from "react";
import { Trophy } from "lucide-react";
import type { PredictionRankingRow } from "@/lib/supabase/query-parts/bpPredictions";

type Tab = "week" | "season";

type Props = {
  weeklyRows: PredictionRankingRow[];
  seasonRows: PredictionRankingRow[];
  currentUserId: string | null;
};

export function PredictionRanking({ weeklyRows, seasonRows, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("week");
  const rows = tab === "week" ? weeklyRows : seasonRows;

  return (
    <section className="predict-rank" aria-label="적중률 랭킹">
      <header className="predict-rank-head">
        <div className="predict-rank-title">
          <Trophy size={16} />
          <strong>적중률 랭킹</strong>
        </div>
        <p className="predict-rank-sub">최소 5경기 예측 · 채점된 경기만 집계</p>
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
          {rows.map((row) => {
            const isAi = row.isAi === true;
            const isMe = !isAi && currentUserId !== null && row.user_id === currentUserId;
            const ratePct = Math.round(row.rate * 100);
            const rankBadgeClass =
              row.rank === 1 ? "predict-rank-num-gold"
              : row.rank === 2 ? "predict-rank-num-silver"
              : row.rank === 3 ? "predict-rank-num-bronze"
              : "";
            return (
              <li
                key={row.user_id}
                className={`predict-rank-row ${isMe ? "is-me" : ""} ${isAi ? `is-ai is-ai-${row.aiProvider ?? ""}` : ""}`}
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
            );
          })}
        </ol>
      )}
    </section>
  );
}
