"use client";

// AI 대전 도전 모달 — LobbyScreen "AI와 대결" 카드의 "도전" 버튼이 이 모달을 띄움.
// 페이지(/stadium/enter) 와 동일 내용을 AiChallengeBody 로 공유.

import { ModalShell } from "@/components/common/ModalShell";
import { AiChallengeBody } from "./AiChallengeBody";

type Props = {
  /** null 이면 닫힘, teamId 면 그 팀과의 매치 미리보기 모달 오픈. */
  opponentTeamId: string | null;
  onClose: () => void;
};

export function AiChallengeModal({ opponentTeamId, onClose }: Props) {
  return (
    <ModalShell
      open={opponentTeamId !== null}
      title="AI와 대결"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel ai-challenge-modal-panel challenge-start-modal-panel"
      closeOnBackdrop
    >
      {opponentTeamId ? (
        <AiChallengeBody opponentTeamId={opponentTeamId} onBeforeStart={onClose} />
      ) : null}
    </ModalShell>
  );
}
