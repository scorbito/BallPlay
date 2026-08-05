"use client";

import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";

type TeamSelectModalProps = {
  open: boolean;
  onClose: () => void;
  currentTeamId: string | null;
  /** 팀을 고르면 호출. 저장(서버/로컬)은 부모가 처리. */
  onSelect: (teamId: string) => void;
  saving?: boolean;
};

/** 응원팀 선택 모달 — 10개 구단 그리드에서 하나 선택. */
export function TeamSelectModal({ open, onClose, currentTeamId, onSelect, saving = false }: TeamSelectModalProps) {
  return (
    <ModalShell open={open} title="응원팀 선택" onClose={onClose} panelClassName="match-talk-modal-panel">
      <div className="team-select-grid">
        {teams.map((team) => {
          const active = team.id === currentTeamId;
          return (
            <button
              key={team.id}
              type="button"
              className={active ? "team-select-chip team-select-chip-active" : "team-select-chip"}
              onClick={() => !saving && onSelect(team.id)}
              disabled={saving}
              aria-pressed={active}
            >
              <TeamBadge teamId={team.id} size="md" />
              <span>{team.shortName}</span>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
