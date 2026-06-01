"use client";

import { ModalShell } from "@/components/common/ModalShell";

export function SkipBlockedModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    // 6회 전 건너뛰기 시도 시 안내 모달. 5회까지 = KBO 정식경기 성립 기준.
    <ModalShell
      open={open}
      title="건너뛰기 안내"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          전적이 누적되는 경기라 <strong>5회까지 진행한 뒤</strong> 건너뛰기가 가능해요.<br />
          (KBO 정식경기 성립 기준)
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-primary"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
