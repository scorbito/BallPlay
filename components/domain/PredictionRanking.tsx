"use client";

// 예측 적중률 랭킹 — 기간 탭(오늘/주/월/시즌) + TOP 리스트.
// 시즌 탭 초기 데이터는 서버에서 prefetch, 다른 탭은 클릭 시 클라이언트 fetch.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getPredictionRanking,
  type PredictionRankingPeriod,
  type PredictionRankingRow
} from "@/lib/supabase/query-parts/bpPredictions";

const PERIOD_LABEL: Record<PredictionRankingPeriod, string> = {
  today: "오늘",
  week: "주간",
  month: "월간",
  season: "시즌"
};

const PERIOD_ORDER: PredictionRankingPeriod[] = ["today", "week", "month", "season"];

type Props = {
  initialRows: PredictionRankingRow[];
  initialPeriod: PredictionRankingPeriod;
  currentUserId: string | null;
};

export function PredictionRanking({ initialRows, initialPeriod, currentUserId }: Props) {
  const [period, setPeriod] = useState<PredictionRankingPeriod>(initialPeriod);
  const [rowsByPeriod, setRowsByPeriod] = useState<Partial<Record<PredictionRankingPeriod, PredictionRankingRow[]>>>(() => ({
    [initialPeriod]: initialRows
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = rowsByPeriod[period];

  const fetchPeriod = useCallback(
    async (p: PredictionRankingPeriod) => {
      if (rowsByPeriod[p]) return; // 캐시 hit
      setLoading(true);
      setError(null);
      const client = createSupabaseBrowserClient();
      const result = await getPredictionRanking(client, { period: p, minGames: 5, limit: 20 });
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRowsByPeriod((prev) => ({ ...prev, [p]: result.rows }));
    },
    [rowsByPeriod]
  );

  useEffect(() => {
    void fetchPeriod(period);
  }, [period, fetchPeriod]);

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
        {PERIOD_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            className={`predict-rank-tab ${period === p ? "is-active" : ""}`}
            onClick={() => setPeriod(p)}
            role="tab"
            aria-selected={period === p}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {loading && !rows ? (
        <div className="predict-rank-loading">
          <Loader2 size={16} className="predict-rank-spin" /> 불러오는 중...
        </div>
      ) : error ? (
        <p className="predict-rank-empty">불러오기 실패 — {error}</p>
      ) : !rows || rows.length === 0 ? (
        <p className="predict-rank-empty">
          아직 5경기 이상 예측한 사용자가 없어요. 첫 도전자가 되어보세요!
        </p>
      ) : (
        <ol className="predict-rank-list">
          {rows.map((row) => {
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
                <span className="predict-rank-team">
                  {row.main_team_id ? <TeamBadge teamId={row.main_team_id} size="sm" /> : null}
                </span>
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
