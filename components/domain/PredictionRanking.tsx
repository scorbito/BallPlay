"use client";

// 적중률 랭킹은 초기 운영 단계에서 시즌 랭킹만 노출합니다.

import { Trophy } from "lucide-react";
import type { PredictionRankingRow } from "@/lib/supabase/query-parts/bpPredictions";

type Props = {
  initialRows: PredictionRankingRow[];
  currentUserId: string | null;
};

export function PredictionRanking({ initialRows, currentUserId }: Props) {
  return (
    <section className="predict-rank" aria-label="적중률 랭킹">
      <header className="predict-rank-head">
        <div className="predict-rank-title">
          <Trophy size={16} />
          <strong>적중률 랭킹</strong>
        </div>
        <p className="predict-rank-sub">최소 5경기 예측 · 채점된 경기만 집계</p>
      </header>

      {initialRows.length === 0 ? (
        <p className="predict-rank-empty">
          아직 5경기 이상 예측한 사용자가 없어요. 첫 도전자가 되어보세요.
        </p>
      ) : (
        <ol className="predict-rank-list">
          {initialRows.map((row) => {
            const isMe = currentUserId !== null && row.user_id === currentUserId;
            const ratePct = Math.round(row.rate * 100);
            const rankBadgeClass =
              row.rank === 1 ? "predict-rank-num-gold"
              : row.rank === 2 ? "predict-rank-num-silver"
              : row.rank === 3 ? "predict-rank-num-bronze"
              : "";
            return (
              <li
                key={row.user_id}
                className={`predict-rank-row ${isMe ? "is-me" : ""}`}
              >
                <span className={`predict-rank-num ${rankBadgeClass}`}>{row.rank}</span>
                <span className="predict-rank-nick">
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
