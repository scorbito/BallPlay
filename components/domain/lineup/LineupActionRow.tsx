"use client";

import { Eye, EyeOff, History } from "lucide-react";
import type { LineupEntry, LineupMode } from "@/lib/types/lineup";
import type { SyncStatus } from "@/lib/storage/useLineupSync";
import type { LineupStats } from "@/lib/supabase/query-parts/bpLineups";

type LineupActionRowProps = {
  mode: LineupMode;
  currentEntry: LineupEntry | null;
  syncStatus: SyncStatus;
  publishRequirementMessage: string | null;
  canPublish: boolean;
  needsAutoFillNotice: boolean;
  publishProcessing: boolean;
  poolCount: number;
  filledCount: number;
  pitcherFilled: number;
  /** 현재 entry의 stats (없으면 undefined) — 공개 상태 hint에서 사용 */
  currentEntryStats: LineupStats | undefined;
  /** "실제 경기 라인업 불러오기" 버튼 hint에 보여줄 팀 약칭 */
  selectedTeamShortName: string;
  onModeChange: (mode: LineupMode) => void;
  onRecentOpen: () => void;
  /** 공개 요청 — 마무리/불펜이 비어있으면 자동 채움 모달, 아니면 즉시 공개 */
  onPublishRequest: () => void;
  /** 비공개 요청 — 확인 모달 띄움 */
  onUnpublishRequest: () => void;
};

/** 액션 행 — 최근 라인업 불러오기 + 타자/투수 토글 + 공개 버튼 + 대기 풀 뱃지 (PC 와이드) */
export function LineupActionRow({
  mode,
  currentEntry,
  syncStatus,
  publishRequirementMessage,
  canPublish,
  needsAutoFillNotice,
  publishProcessing,
  poolCount,
  currentEntryStats,
  selectedTeamShortName,
  onModeChange,
  onRecentOpen,
  onPublishRequest,
  onUnpublishRequest
}: LineupActionRowProps) {
  return (
    <div className="lineup-action-row">
      {currentEntry?.isPublished ? (() => {
        const wins = currentEntryStats?.wins ?? 0;
        const losses = currentEntryStats?.losses ?? 0;
        return (
          <p className="lineup-action-hint lineup-action-hint-published">
            🔒 공개 라인업 · {wins}승 {losses}패
          </p>
        );
      })() : currentEntry ? (
        <button
          type="button"
          className="lineup-recent-load-btn"
          onClick={onRecentOpen}
          title={`${selectedTeamShortName}이(가) 최근 경기에서 실제로 쓴 선발 라인업으로 자동 세팅`}
        >
          <History size={12} />
          <span>실제 경기 라인업 불러오기</span>
        </button>
      ) : null}
      <div className="lineup-action-buttons">
        {/* 타자/투수 토글 — 공유 옆에 배치 */}
        <div className="lineup-mode-toggle lineup-mode-toggle-inline" role="tablist" aria-label="라인업 종류">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "batter"}
            className={mode === "batter" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
            onClick={() => onModeChange("batter")}
          >
            타자
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pitcher"}
            className={mode === "pitcher" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
            onClick={() => onModeChange("pitcher")}
          >
            투수
          </button>
        </div>
        {/* 공개/비공개 토글 */}
        {(() => {
          if (!currentEntry) return null;
          const isOn = !!currentEntry.isPublished;
          // 익명도 DB sync되므로 syncStatus가 "synced"면 통과. "local-only"는 sync 실패 fallback.
          const canSync = syncStatus !== "local-only";
          // 공개 조건 미충족은 클릭 시 안내한다. 이미 공개 중이면 세션을 재확인해 비공개 전환을 시도한다.
          const disabled = publishProcessing || (!isOn && !canSync);
          const tip = !canSync
            ? "잠시 후 다시 시도해주세요"
            : isOn
              ? "공개 중 — 다른 사람이 도전 가능. 클릭하여 비공개로 (전적 리셋)"
              : publishRequirementMessage ?? "공개로 바꾸면 다른 사람이 도전할 수 있어요";
          return (
            <button
              type="button"
              className={`lineup-action-btn ${isOn ? "lineup-action-btn-published" : "lineup-action-btn-primary"}`}
              disabled={disabled}
              title={tip}
              onClick={() => {
                if (isOn) {
                  onUnpublishRequest();
                } else {
                  onPublishRequest();
                }
              }}
            >
              {isOn ? <Eye size={12} /> : <EyeOff size={12} />}
              {isOn ? "공개 중" : "공개하기"}
            </button>
          );
        })()}
      </div>
      {/* PC 와이드 모드에서만 노출 — 대기 선수 카드 헤더 자리 절약. 모바일은 풀 카드 자체에 헤더 유지. */}
      <div className="lineup-action-pool-badge" aria-hidden="true">
        <strong>대기</strong>
        <span className="lineup-section-count">{poolCount}</span>
      </div>
    </div>
  );
}
