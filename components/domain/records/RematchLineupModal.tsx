"use client";

import { Swords } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import type { LineupEntry } from "@/lib/types/lineup";
import type { LineupStats } from "@/lib/supabase/query-parts/bpLineups";

export type RematchLineupOption = {
  id: string;
  entryId: string;
  name: string;
  teamId: string;
  entry: LineupEntry;
};

type Props = {
  open: boolean;
  opponentTeam: SimTeamInput | null;
  lineups: RematchLineupOption[];
  selectedEntryId: string | null;
  starting: boolean;
  onSelectEntry: (entryId: string) => void;
  onStart: () => void;
  onClose: () => void;
  /** entry_id → 전적. picker 라벨 옆에 (승-패) 표시. 없으면 라벨만. */
  statsByEntryId?: Record<string, LineupStats>;
};

function formatRecord(stats: LineupStats | undefined): string {
  if (!stats || stats.matches === 0) return "";
  return ` (${stats.wins}승 ${stats.losses}패)`;
}

export function RematchLineupModal({
  open,
  opponentTeam,
  lineups,
  selectedEntryId,
  starting,
  onSelectEntry,
  onStart,
  onClose,
  statsByEntryId
}: Props) {
  const selectedLineup = lineups.find((lineup) => lineup.entryId === selectedEntryId) ?? lineups[0] ?? null;

  return (
    <ModalShell
      open={open}
      title="재대전 라인업 선택"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
      closeOnBackdrop
    >
      {opponentTeam ? (
        <div className="stadium-enter-vs" aria-label="재대전 상대">
          <div className="stadium-enter-team">
            <span className="stadium-enter-team-label">상대</span>
            <TeamBadge teamId={opponentTeam.teamId} size="lg" />
            <strong>{opponentTeam.displayName ?? getTeam(opponentTeam.teamId).shortName}</strong>
          </div>
          <span className="stadium-enter-vs-label">VS</span>
          <div className="stadium-enter-team">
            <span className="stadium-enter-team-label">내 라인업</span>
            {selectedLineup ? (
              <>
                <TeamBadge teamId={selectedLineup.teamId} size="lg" />
                <strong>{selectedLineup.name}</strong>
              </>
            ) : (
              <span className="stadium-enter-empty">선택 필요</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="stadium-discover-my-picker" role="radiogroup" aria-label="내 공개 라인업 선택">
        <span className="stadium-discover-my-picker-label">내 공개 라인업 선택</span>
        <div className="stadium-discover-my-picker-list records-rematch-picker-list">
          {lineups.map((lineup) => {
            const recordTxt = formatRecord(statsByEntryId?.[lineup.entryId]);
            return (
              <button
                key={lineup.entryId}
                type="button"
                className={`stadium-discover-my-pick ${selectedEntryId === lineup.entryId ? "is-active" : ""}`}
                onClick={() => onSelectEntry(lineup.entryId)}
                aria-pressed={selectedEntryId === lineup.entryId}
              >
                <TeamBadge teamId={lineup.teamId} size="sm" />
                <span>{lineup.name}{recordTxt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="stadium-cta-primary"
        onClick={onStart}
        disabled={!selectedLineup || !opponentTeam || starting}
      >
        <Swords size={16} />
        {starting ? "시작 중..." : "이 라인업으로 재대전"}
      </button>
    </ModalShell>
  );
}
