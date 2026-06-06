"use client";

import { Play, Swords, Trash2 } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import {
  canReplay,
  type BpRecordRow
} from "@/lib/supabase/query-parts/bpRecords";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";

type ReplayReason = NonNullable<ReturnType<typeof canReplay>["reason"]>;

function getReplayUnavailableText(reason: ReplayReason | undefined): string {
  switch (reason) {
    case "expired":
      return "7일이 지나 재생할 수 없어요.";
    case "engine_mismatch":
      return "엔진 버전이 달라 재생할 수 없어요.";
    case "data_dropped":
      return "재생 데이터가 만료되어 재생할 수 없어요.";
    default:
      return "재생할 수 없어요.";
  }
}

function getReplayUnavailableButtonText(reason: ReplayReason | undefined): string {
  switch (reason) {
    case "expired":
      return "재생 불가 (7일 만료)";
    case "engine_mismatch":
      return "재생 불가 (엔진 버전 다름)";
    case "data_dropped":
      return "재생 불가 (데이터 없음)";
    default:
      return "재생 불가";
  }
}

type Props = {
  row: BpRecordRow;
  deleting: boolean;
  canRematch: boolean;
  opponentSide: "home" | "away";
  onReplay: (row: BpRecordRow) => void;
  onOpenOpponent: (row: BpRecordRow) => void;
  onRematch: (row: BpRecordRow) => void;
  onDelete: (row: BpRecordRow) => void;
};

export function RecordCard({
  row,
  deleting,
  canRematch,
  opponentSide,
  onReplay,
  onOpenOpponent,
  onRematch,
  onDelete
}: Props) {
  const replay = canReplay(row, SIM_ENGINE_VERSION);
  const replayUnavailableText = replay.ok ? null : getReplayUnavailableText(replay.reason);
  const replayButtonText = replay.ok ? "재생" : getReplayUnavailableButtonText(replay.reason);
  const canUseSnapshot = row.input !== null;
  const showRematch = row.source === "public";
  // 공식 매치 = source='public' (공개 매치 도전) + 양쪽 라인업 ID 둘 다 NOT NULL.
  // 친구 매치는 source='friend' 라 무조건 연습 (연습경기장으로 분리됨).
  const isOfficial =
    row.source === "public"
    && row.home_lineup_id !== null && row.home_lineup_id !== undefined
    && row.away_lineup_id !== null && row.away_lineup_id !== undefined;
  const isWinner =
    (row.user_side === "home" && row.final_score.home > row.final_score.away) ||
    (row.user_side === "away" && row.final_score.away > row.final_score.home);
  const isDraw = row.final_score.home === row.final_score.away;

  return (
    <article className="records-card">
      <div className="records-card-head">
        <span className={`records-card-source records-card-source-${row.source}`}>
          {row.source === "friend" ? "친구 대전" : "공개 매칭"}
          {row.opponent_nickname ? (
            <span className="records-card-opponent"> · vs {row.opponent_nickname}</span>
          ) : null}
        </span>
        <span
          className={`records-card-tier ${isOfficial ? "is-official" : "is-practice"}`}
          title={isOfficial ? "공식 경기 (양쪽 출전 팀) — 전적에 집계" : "연습 경기 — 전적 미집계"}
        >
          {isOfficial ? "정식 매치" : "연습 매치"}
        </span>
        <span
          className={`records-card-outcome ${
            isDraw ? "is-draw" : isWinner ? "is-win" : "is-lose"
          }`}
        >
          {isDraw ? "무" : isWinner ? "승" : "패"}
        </span>
        <span className="records-card-date">
          {new Date(row.created_at).toLocaleDateString("ko-KR", {
            month: "2-digit",
            day: "2-digit"
          })}
        </span>
      </div>

      <div className="records-card-score">
        {opponentSide === "away" ? (
          <button
            type="button"
            className="records-card-team records-card-team-button"
            onClick={() => onOpenOpponent(row)}
            title="상대 라인업 보기"
          >
            <TeamBadge teamId={row.away_team_id} size="sm" />
            <span>{row.away_label ?? row.away_team_id}</span>
            <strong>{row.final_score.away}</strong>
          </button>
        ) : (
          <div className="records-card-team">
            <TeamBadge teamId={row.away_team_id} size="sm" />
            <span>{row.away_label ?? row.away_team_id}</span>
            <strong>{row.final_score.away}</strong>
          </div>
        )}
        <span className="records-card-vs">:</span>
        {opponentSide === "home" ? (
          <button
            type="button"
            className="records-card-team records-card-team-button is-right"
            onClick={() => onOpenOpponent(row)}
            title="상대 라인업 보기"
          >
            <TeamBadge teamId={row.home_team_id} size="sm" />
            <span>{row.home_label ?? row.home_team_id}</span>
            <strong>{row.final_score.home}</strong>
          </button>
        ) : (
          <div className="records-card-team is-right">
            <TeamBadge teamId={row.home_team_id} size="sm" />
            <span>{row.home_label ?? row.home_team_id}</span>
            <strong>{row.final_score.home}</strong>
          </div>
        )}
      </div>

      <footer className="records-card-actions">
        <button
          type="button"
          className="records-card-replay"
          onClick={() => onReplay(row)}
          disabled={!replay.ok}
          title={replay.ok ? "재생" : replayUnavailableText ?? "재생 불가"}
        >
          <Play size={14} />
          <span>{replayButtonText}</span>
        </button>
        {showRematch ? (
        <button
          type="button"
          className="records-card-rematch"
          onClick={() => onRematch(row)}
          disabled={!canUseSnapshot || !canRematch}
          title={canUseSnapshot ? "내 라인업을 선택해서 재대전" : "라인업 데이터 없음"}
        >
          <Swords size={14} />
          <span>재대전</span>
        </button>
        ) : null}
        <button
          type="button"
          className="records-card-delete"
          onClick={() => onDelete(row)}
          disabled={deleting}
          aria-label="삭제"
        >
          <Trash2 size={14} />
        </button>
      </footer>
    </article>
  );
}
