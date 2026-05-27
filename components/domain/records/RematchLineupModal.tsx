"use client";

import { Swords } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import type { LineupEntry } from "@/lib/types/lineup";

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
};

export function RematchLineupModal({
  open,
  opponentTeam,
  lineups,
  selectedEntryId,
  starting,
  onSelectEntry,
  onStart,
  onClose
}: Props) {
  const selectedLineup = lineups.find((lineup) => lineup.entryId === selectedEntryId) ?? lineups[0] ?? null;

  return (
    <ModalShell
      open={open}
      title="재대전 라인업 선택"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      {opponentTeam ? (
        <div className="stadium-discover-vs records-rematch-vs" aria-label="재대전 상대">
          <div className="stadium-discover-vs-team">
            <span className="stadium-discover-vs-label">상대</span>
            <TeamBadge teamId={opponentTeam.teamId} size="lg" />
            <strong>{opponentTeam.displayName ?? getTeam(opponentTeam.teamId).shortName}</strong>
          </div>
          <span className="stadium-discover-vs-divider">VS</span>
          <div className="stadium-discover-vs-team">
            <span className="stadium-discover-vs-label">내 라인업</span>
            {selectedLineup ? (
              <>
                <TeamBadge teamId={selectedLineup.teamId} size="lg" />
                <strong>{selectedLineup.name}</strong>
              </>
            ) : (
              <strong>선택 필요</strong>
            )}
          </div>
        </div>
      ) : null}

      <div className="stadium-discover-my-picker" role="radiogroup" aria-label="내 공개 라인업 선택">
        <span className="stadium-discover-my-picker-label">내 공개 라인업 선택</span>
        <div className="stadium-discover-my-picker-list records-rematch-picker-list">
          {lineups.map((lineup) => (
            <button
              key={lineup.entryId}
              type="button"
              className={`stadium-discover-my-pick ${selectedEntryId === lineup.entryId ? "is-active" : ""}`}
              onClick={() => onSelectEntry(lineup.entryId)}
              aria-pressed={selectedEntryId === lineup.entryId}
            >
              <TeamBadge teamId={lineup.teamId} size="sm" />
              <span>{lineup.name}</span>
            </button>
          ))}
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
